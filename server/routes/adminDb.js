// server/routes/adminDb.js
/**
 * DB 관리용 API 라우터 (관리자 UI와 통신)
 * 기본 CRUD와 백업·복구 기능 제공
 * 보안: SQL Injection 방지를 위한 화이트리스트 검증 적용
 */
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../db/helper');

const router = express.Router();

const fs = require('fs-extra');

/**
 * 테이블 스키마에서 실제 컬럼명 리스트를 조회합니다.
 * @param {string} tableName - 테이블 이름
 * @param {string} dbName - 데이터베이스 파일명
 * @returns {Promise<Array>} 컬럼명 배열
 */
async function getTableColumns(tableName, dbName = 'main.db') {
  const targetPath = path.join(__dirname, '../../database', 
    path.basename(dbName).endsWith('.db') ? path.basename(dbName) : `${path.basename(dbName)}.db`);
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(targetPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      
      db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
        db.close();
        if (err) return reject(err);
        
        // prgma table_info는 name 필드를 포함합니다.
        const columns = rows.map(row => row.name);
        resolve(columns);
      });
    });
  });
}

/**
 * 테이블 존재 여부를 확인합니다.
 * @param {string} tableName - 테이블 이름
 * @param {string} dbName - 데이터베이스 파일명
 * @returns {Promise<boolean>} 테이블 존재 여부
 */
async function tableExists(tableName, dbName = 'main.db') {
  const targetPath = path.join(__dirname, '../../database', 
    path.basename(dbName).endsWith('.db') ? path.basename(dbName) : `${path.basename(dbName)}.db`);
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(targetPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName], (err, row) => {
        db.close();
        if (err) return reject(err);
        resolve(!!row);
      });
    });
  });
}

/**
 * 소문자-대문자 구문을 무시하는 컬럼명 비교
 * SQLite는 컬럼명에 대해 대소문자를 구별하지 않으므로, 소문자로 비교
 */
function normalizeColumnName(col) {
  return col.toLowerCase().trim();
}

// DB 연결 헬퍼 (읽기·쓰기)
function getDb(dbName = 'main.db') {
  // 보안: 디렉토리 트래버설 방지
  const safeName = path.basename(dbName);
  const targetPath = path.join(__dirname, '../../database', safeName.endsWith('.db') ? safeName : `${safeName}.db`);
  return new sqlite3.Database(targetPath);
}

// ------------------- 데이터베이스 목록 및 요약 정보 -------------------
// GET /admin/api/databases
router.get('/databases', async (req, res, next) => {
  try {
    const dbDir = path.join(__dirname, '../../database');
    await fs.ensureDir(dbDir);
    const files = await fs.readdir(dbDir);
    const dbFiles = files.filter(f => f.endsWith('.db'));

    const list = [];
    for (const file of dbFiles) {
      const filePath = path.join(dbDir, file);
      const stats = await fs.stat(filePath);
      
      // DB 요약 정보 가져오기
      const dbInfo = await new Promise(resolve => {
        const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, err => {
          if (err) return resolve({ tablesCount: 0, journalMode: 'unknown' });
          db.all("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
            const tablesCount = rows && rows[0] ? rows[0].count : 0;
            db.get("PRAGMA journal_mode", (err, pragmaRow) => {
              db.close();
              resolve({
                tablesCount,
                journalMode: pragmaRow ? pragmaRow.journal_mode : 'unknown'
              });
            });
          });
        });
      });

      list.push({
        name: file,
        sizeBytes: stats.size,
        sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
        updatedAt: stats.mtime,
        tablesCount: dbInfo.tablesCount,
        journalMode: dbInfo.journalMode,
        status: 'active'
      });
    }

    res.json(list);
  } catch (err) {
    next(err);
  }
});

// ------------------- 신규 데이터베이스 생성 -------------------
// POST /admin/api/databases
router.post('/databases', express.json(), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: '유효한 데이터베이스 이름이 필요합니다.' });
    }

    const cleanName = path.basename(name).trim();
    const dbFileName = cleanName.endsWith('.db') ? cleanName : `${cleanName}.db`;
    const dbDir = path.join(__dirname, '../../database');
    await fs.ensureDir(dbDir);
    const filePath = path.join(dbDir, dbFileName);

    if (await fs.pathExists(filePath)) {
      return res.status(400).json({ error: '이미 존재하는 데이터베이스 이름입니다.' });
    }

    // 신규 DB 파일 생성 및 초기화
    const db = new sqlite3.Database(filePath, async (err) => {
      if (err) return next(err);
      db.run('PRAGMA journal_mode=WAL;');
      db.run('PRAGMA foreign_keys = ON;');
      db.close();

      const stats = await fs.stat(filePath);
      res.json({
        message: '데이터베이스가 성공적으로 생성되었습니다.',
        database: {
          name: dbFileName,
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
          updatedAt: stats.mtime,
          tablesCount: 0,
          journalMode: 'wal',
          status: 'active'
        }
      });
    });
  } catch (err) {
    next(err);
  }
});

// ------------------- 테이블 목록 -------------------
// GET /admin/api/tables
router.get('/tables', (req, res, next) => {
  const dbName = req.query.db || 'main.db';
  const db = getDb(dbName);
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
    db.close();
    if (err) return next(err);
    const tables = rows.map(r => r.name);
    res.json(tables);
  });
});

// ------------------- 테이블 스키마 조회 -------------------
// GET /admin/api/tables/:name/schema
router.get('/tables/:name/schema', async (req, res, next) => {
  try {
    const { name } = req.params;
    const dbName = req.query.db || 'main.db';
    
    // 보안: 테이블 존재 여부 확인
    const tableExistsFlag = await tableExists(name, dbName);
    if (!tableExistsFlag) {
      return res.status(404).json({ error: '테이블을 찾을 수 없습니다.' });
    }
    
    const db = getDb(dbName);
    db.all(`PRAGMA table_info(${name})`, (err, rows) => {
      db.close();
      if (err) return next(err);
      res.json(rows);
    });
  } catch (err) {
    next(err);
  }
});

// ------------------- 테이블 레코드 조회 -------------------
// GET /admin/api/tables/:name/rows
router.get('/tables/:name/rows', async (req, res, next) => {
  try {
    const { name } = req.params;
    const { limit = 20, offset = 0, order_by = 'rowid', order_dir = 'ASC', query } = req.query;
    const dbName = req.query.db || 'main.db';
    
    // 보안: 테이블 존재 여부 확인
    const tableExistsFlag = await tableExists(name, dbName);
    if (!tableExistsFlag) {
      return res.status(404).json({ error: '테이블을 찾을 수 없습니다.' });
    }
    
    // 보안: 실제 컬럼 리스트 가져오기 (화이트리스트 검증을 위해)
    const validColumns = await getTableColumns(name, dbName);
    const validColumnNames = validColumns.map(normalizeColumnName);
    
    // 보안: ORDER BY 컬럼명 검증
    const normalizedOrderBy = normalizeColumnName(order_by);
    if (!validColumnNames.includes(normalizedOrderBy) && normalizedOrderBy !== 'rowid') {
      return res.status(400).json({ error: `유효하지 않은 ORDER BY 컬럼: ${order_by}` });
    }
    
    const db = getDb(dbName);
    let sql = 'SELECT * FROM ' + name;
    const params = [];
    
    if (query) {
      // 보안: 사용자 입력 컬럼명 검증
      const filterCols = Object.keys(req.query).filter(k => !['limit','offset','order_by','order_dir','query','db'].includes(k));
      const allowedFilterCols = filterCols.filter(col => validColumnNames.includes(normalizeColumnName(col)));
      
      if (allowedFilterCols.length > 0) {
        sql += ' WHERE 1=1';
        // 보안: 검증된 컬럼명만 사용
        sql += ' AND (' + allowedFilterCols.map(col => `${col} LIKE ?`).join(' AND ') + ')';
        allowedFilterCols.forEach(col => params.push(`%${req.query[col]}%`));
      }
    }
    
    // 보안: 검증된 ORDER BY 컬럼 사용
    sql += ` ORDER BY ${order_by} ${order_dir.toUpperCase()}`;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) return next(err);
      res.json(rows);
    });
  } catch (err) {
    next(err);
  }
});

// ------------------- 행 추가 -------------------
// POST /admin/api/tables/:name/rows
router.post('/tables/:name/rows', express.json(), async (req, res, next) => {
  try {
    const { name } = req.params;
    const newRow = req.body;
    const dbName = req.query.db || 'main.db';
    
    if (!newRow || Object.keys(newRow).length === 0) {
      return res.status(400).json({ error: '데이터가 없습니다.' });
    }
    
    // 보안: 테이블 존재 여부 확인
    const tableExistsFlag = await tableExists(name, dbName);
    if (!tableExistsFlag) {
      return res.status(404).json({ error: '테이블을 찾을 수 없습니다.' });
    }
    
    // 보안: 실제 컬럼 리스트 가져오기
    const validColumns = await getTableColumns(name, dbName);
    const validColumnNames = validColumns.map(normalizeColumnName);
    
    // 보안: 유효한 컬럼만 필터링
    const cols = Object.keys(newRow).filter(col => validColumnNames.includes(normalizeColumnName(col)));
    if (cols.length === 0) {
      return res.status(400).json({ error: '유효한 컬럼이 없습니다.' });
    }
    
    const vals = cols.map(col => newRow[col]);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${placeholders})`;
    const db = getDb(dbName);
    db.run(sql, vals, function(err) {
      db.close();
      if (err) return next(err);
      res.json({ id: this.lastID, inserted: this.changes });
    });
  } catch (err) {
    next(err);
  }
});

// ------------------- 행 수정 -------------------
// PUT /admin/api/tables/:name/rows/:id
router.put('/tables/:name/rows/:id', express.json(), async (req, res, next) => {
  try {
    const { name, id } = req.params;
    const updates = req.body; // {col: value, ...}
    const dbName = req.query.db || 'main.db';
    
    // 보안: 테이블 존재 여부 확인
    const tableExistsFlag = await tableExists(name, dbName);
    if (!tableExistsFlag) {
      return res.status(404).json({ error: '테이블을 찾을 수 없습니다.' });
    }
    
    // 보안: 실제 컬럼 리스트 가져오기
    const validColumns = await getTableColumns(name, dbName);
    const validColumnNames = validColumns.map(normalizeColumnName);
    
    // 보안: 유효한 컬럼만 필터링
    const setClauses = [];
    const params = [];
    for (const [col, val] of Object.entries(updates)) {
      if (validColumnNames.includes(normalizeColumnName(col))) {
        setClauses.push(`${col} = ?`);
        params.push(val);
      }
    }
    
    if (setClauses.length === 0) {
      return res.status(400).json({ error: '유효한 컬럼이 없습니다.' });
    }
    
    const sql = `UPDATE ${name} SET ${setClauses.join(', ')} WHERE rowid = ?`;
    params.push(id);
    const db = getDb(dbName);
    db.run(sql, params, function(err) {
      db.close();
      if (err) return next(err);
      res.json({ changed: this.changes });
    });
  } catch (err) {
    next(err);
  }
});

// ------------------- 행 삭제 (단일) -------------------
// DELETE /admin/api/tables/:name/rows/:id
router.delete('/tables/:name/rows/:id', async (req, res, next) => {
  try {
    const { name, id } = req.params;
    const dbName = req.query.db || 'main.db';
    
    // 보안: 테이블 존재 여부 확인
    const tableExistsFlag = await tableExists(name, dbName);
    if (!tableExistsFlag) {
      return res.status(404).json({ error: '테이블을 찾을 수 없습니다.' });
    }
    
    const sql = `DELETE FROM ${name} WHERE rowid = ?`;
    const db = getDb(dbName);
    db.run(sql, [id], function(err) {
      db.close();
      if (err) return next(err);
      res.json({ deleted: this.changes });
    });
  } catch (err) {
    next(err);
  }
});

// ------------------- 다중 삭제 -------------------
// DELETE /admin/api/tables/:name/rows (body: {ids: [id...]})
router.delete('/tables/:name/rows', express.json(), async (req, res, next) => {
  try {
    const { name } = req.params;
    const { ids } = req.body;
    const dbName = req.query.db || 'main.db';
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids 배열이 필요합니다.' });
    }
    
    // 보안: 테이블 존재 여부 확인
    const tableExistsFlag = await tableExists(name, dbName);
    if (!tableExistsFlag) {
      return res.status(404).json({ error: '테이블을 찾을 수 없습니다.' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const sql = `DELETE FROM ${name} WHERE rowid IN (${placeholders})`;
    const db = getDb(dbName);
    db.run(sql, ids, function(err) {
      db.close();
      if (err) return next(err);
      res.json({ deleted: this.changes });
    });
  } catch (err) {
    next(err);
  }
});

// ------------------- 백업 -------------------
// POST /admin/api/tables/:name/backup?format=json|csv
router.post('/tables/:name/backup', async (req, res, next) => {
  try {
    const { name } = req.params;
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const dbName = req.query.db || 'main.db';
    
    // 보안: 테이블 존재 여부 확인
    const tableExistsFlag = await tableExists(name, dbName);
    if (!tableExistsFlag) {
      return res.status(404).json({ error: '테이블을 찾을 수 없습니다.' });
    }
    
    const db = getDb(dbName);
    db.all(`SELECT * FROM ${name}`, (err, rows) => {
      db.close();
      if (err) return next(err);
      if (format === 'csv') {
        const header = Object.keys(rows[0] || {}).join(',');
        const csv = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const content = header + '\n' + csv;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${name}.csv`);
        res.send(content);
      } else {
        res.json(rows);
      }
    });
  } catch (err) {
    next(err);
  }
});

// ------------------- 복원 -------------------
// POST /admin/api/tables/:name/restore (JSON 배열 body)
router.post('/tables/:name/restore', express.json(), async (req, res, next) => {
  try {
    const { name } = req.params;
    const rows = req.body; // [{col:val, ...}, ...]
    const dbName = req.query.db || 'main.db';
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: '복원 데이터가 필요합니다.' });
    }
    
    // 보안: 테이블 존재 여부 확인
    const tableExistsFlag = await tableExists(name, dbName);
    if (!tableExistsFlag) {
      return res.status(404).json({ error: '테이블을 찾을 수 없습니다.' });
    }
    
    // 보안: 실제 컬럼 리스트 가져오기
    const validColumns = await getTableColumns(name, dbName);
    const validColumnNames = validColumns.map(normalizeColumnName);
    
    // 보안: 유효한 컬럼만 필터링
    const cols = Object.keys(rows[0] || {}).filter(col => validColumnNames.includes(normalizeColumnName(col)));
    if (cols.length === 0) {
      return res.status(400).json({ error: '유효한 컬럼이 없습니다.' });
    }
    
    const placeholders = cols.map(() => '?').join(',');
    const sql = `INSERT INTO ${name} (${cols.join(',')}) VALUES (${placeholders})`;
    const db = getDb(dbName);
    const stmt = db.prepare(sql);
    db.serialize(() => {
      for (const row of rows) {
        stmt.run(cols.map(c => row[c]));
      }
    });
    stmt.finalize(err => {
      db.close();
      if (err) return next(err);
      res.json({ inserted: rows.length });
    });
  } catch (err) {
    next(err);
  }
});

// ------------------- 데이터베이스 삭제 -------------------
// DELETE /admin/api/databases/:name
router.delete('/databases/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const cleanName = path.basename(name).trim();
    const dbFileName = cleanName.endsWith('.db') ? cleanName : `${cleanName}.db`;

    // main.db 삭제 금지
    if (dbFileName.toLowerCase() === 'main.db') {
      return res.status(400).json({ error: 'main.db는 시스템 기초 베이스이므로 삭제할 수 없습니다.' });
    }

    const dbDir = path.join(__dirname, '../../database');
    const filePath = path.join(dbDir, dbFileName);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: '존재하지 않는 데이터베이스 파일입니다.' });
    }

    // SQLite 파일 및 저널 파일 삭제
    await fs.remove(filePath);
    await fs.remove(`${filePath}-wal`).catch(() => {});
    await fs.remove(`${filePath}-shm`).catch(() => {});

    res.json({ message: `${dbFileName} 데이터베이스가 성공적으로 삭제되었습니다.` });
  } catch (err) {
    next(err);
  }
});

// ------------------- 테이블 생성 (DDL) -------------------
// POST /admin/api/tables
router.post('/tables', express.json(), async (req, res, next) => {
  try {
    const { tableName, columns } = req.body;
    const dbName = req.query.db || 'main.db';

    if (!tableName || typeof tableName !== 'string' || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({ error: '유효한 테이블 이름을 입력하세요. (영문, 숫자, 언더바만 가능)' });
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: '최소 1개 이상의 컬럼이 필요합니다.' });
    }

    const colDefs = columns.map(c => {
      const name = (c.name || '').trim();
      const type = (c.type || 'TEXT').toUpperCase();
      const constraints = (c.constraints || '').trim();
      if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        throw new Error(`유효하지 않은 컬럼 이름: ${name}`);
      }
      return `${name} ${type} ${constraints}`;
    });

    const sql = `CREATE TABLE ${tableName} (${colDefs.join(', ')})`;
    const db = getDb(dbName);
    db.run(sql, err => {
      db.close();
      if (err) return next(err);
      res.json({ message: `테이블 '${tableName}'이(가) 성공적으로 생성되었습니다.` });
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ------------------- 테이블 삭제 (DDL) -------------------
// DELETE /admin/api/tables/:name
router.delete('/tables/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const dbName = req.query.db || 'main.db';

    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return res.status(400).json({ error: '유효하지 않은 테이블 이름입니다.' });
    }

    // main.db의 코어 테이블 삭제 보호 (선택적 경고)
    const protectedTables = ['modules', 'workflows', 'scheduled_jobs', 'activity_logs', 'error_logs', 'schema_migrations', 'configattr', 'config'];
    if (dbName === 'main.db' && protectedTables.includes(name.toLowerCase())) {
      return res.status(400).json({ error: `'${name}' 테이블은 main.db 시스템 코어 테이블이므로 삭제할 수 없습니다.` });
    }

    const sql = `DROP TABLE ${name}`;
    const db = getDb(dbName);
    db.run(sql, err => {
      db.close();
      if (err) return next(err);
      res.json({ message: `테이블 '${name}'이(가) 성공적으로 삭제되었습니다.` });
    });
  } catch (err) {
    next(err);
  }
});

// ------------------- Config 설정 관리 API (main.db) -------------------
// GET /admin/api/config
router.get('/config', (req, res, next) => {
  const db = getDb('main.db');
  const sql = `
    SELECT 
      c.idx,
      c.attr_id,
      ca.name as attr_name,
      ca.description as attr_desc,
      c.val1,
      c.val2,
      c.memo,
      c.created_at
    FROM config c
    LEFT JOIN configattr ca ON c.attr_id = ca.idx
    ORDER BY c.idx ASC
  `;
  db.all(sql, (err, rows) => {
    db.close();
    if (err) return next(err);
    res.json(rows);
  });
});

// POST /admin/api/config
router.post('/config', express.json(), (req, res, next) => {
  const { attr_id, val1, val2, memo } = req.body;
  if (!attr_id) return res.status(400).json({ error: '속성을 선택해야 합니다.' });
  const db = getDb('main.db');
  const sql = `INSERT INTO config (attr_id, val1, val2, memo) VALUES (?, ?, ?, ?)`;
  db.run(sql, [attr_id, val1 || '', val2 || '', memo || ''], function(err) {
    db.close();
    if (err) return next(err);
    res.json({ idx: this.lastID, message: '설정 항목이 추가되었습니다.' });
  });
});

// PUT /admin/api/config/:idx
router.put('/config/:idx', express.json(), (req, res, next) => {
  const { idx } = req.params;
  const { attr_id, val1, val2, memo } = req.body;
  const db = getDb('main.db');
  const sql = `UPDATE config SET attr_id = ?, val1 = ?, val2 = ?, memo = ? WHERE idx = ?`;
  db.run(sql, [attr_id, val1 || '', val2 || '', memo || '', idx], function(err) {
    db.close();
    if (err) return next(err);
    res.json({ changed: this.changes, message: '설정이 저장되었습니다.' });
  });
});

// DELETE /admin/api/config/:idx
router.delete('/config/:idx', (req, res, next) => {
  const { idx } = req.params;
  const db = getDb('main.db');
  db.run(`DELETE FROM config WHERE idx = ?`, [idx], function(err) {
    db.close();
    if (err) return next(err);
    res.json({ deleted: this.changes });
  });
});

// DELETE /admin/api/config_clear
router.delete('/config_clear', (req, res, next) => {
  const db = getDb('main.db');
  db.run(`DELETE FROM config`, function(err) {
    db.close();
    if (err) return next(err);
    res.json({ deleted: this.changes, message: 'config 테이블 데이터가 전체 초기화되었습니다.' });
  });
});

// GET /admin/api/configattr
router.get('/configattr', (req, res, next) => {
  const db = getDb('main.db');
  db.all(`SELECT * FROM configattr ORDER BY idx ASC`, (err, rows) => {
    db.close();
    if (err) return next(err);
    res.json(rows);
  });
});

// POST /admin/api/configattr
router.post('/configattr', express.json(), (req, res, next) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '속성 이름이 필요합니다.' });
  const db = getDb('main.db');
  db.run(`INSERT INTO configattr (name, description) VALUES (?, ?)`, [name.trim(), description || ''], function(err) {
    db.close();
    if (err) return next(err);
    res.json({ idx: this.lastID, name: name.trim(), description: description || '' });
  });
});

// DELETE /admin/api/configattr/:idx
router.delete('/configattr/:idx', (req, res, next) => {
  const { idx } = req.params;
  const db = getDb('main.db');
  db.run(`DELETE FROM configattr WHERE idx = ?`, [idx], function(err) {
    db.close();
    if (err) return next(err);
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
