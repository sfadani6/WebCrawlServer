// server/routes/adminDb.js
/**
 * DB 관리용 API 라우터 (관리자 UI와 통신)
 * 기본 CRUD와 백업·복구 기능 제공
 */
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../db/helper');

const router = express.Router();

const fs = require('fs-extra');

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
router.get('/tables/:name/schema', (req, res, next) => {
  const { name } = req.params;
  const db = getDb(req.query.db);
  db.all(`PRAGMA table_info(${name})`, (err, rows) => {
    db.close();
    if (err) return next(err);
    res.json(rows);
  });
});

// ------------------- 테이블 레코드 조회 -------------------
// GET /admin/api/tables/:name/rows
router.get('/tables/:name/rows', (req, res, next) => {
  const { name } = req.params;
  const { limit = 20, offset = 0, order_by = 'rowid', order_dir = 'ASC', query } = req.query;
  const db = getDb(req.query.db);
  let sql = `SELECT * FROM ${name}`;
  const params = [];
  if (query) {
    // 간단 LIKE 검색 (보안 상 제한된 구현)
    sql += ' WHERE 1=1';
    // 사용자가 전달한 추가 컬럼 파라미터들을 모두 LIKE 조건으로 적용
    const filterCols = Object.keys(req.query).filter(k => !['limit','offset','order_by','order_dir','query','db'].includes(k));
    if (filterCols.length) {
      sql += ' AND (' + filterCols.map(col => `${col} LIKE ?`).join(' AND ') + ')';
      filterCols.forEach(col => params.push(`%${req.query[col]}%`));
    }
  }
  sql += ` ORDER BY ${order_by} ${order_dir.toUpperCase()}`;
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  db.all(sql, params, (err, rows) => {
    db.close();
    if (err) return next(err);
    res.json(rows);
  });
});

// ------------------- 행 추가 -------------------
// POST /admin/api/tables/:name/rows
router.post('/tables/:name/rows', express.json(), (req, res, next) => {
  const { name } = req.params;
  const newRow = req.body;
  if (!newRow || Object.keys(newRow).length === 0) {
    return res.status(400).json({ error: '데이터가 없습니다.' });
  }
  const cols = Object.keys(newRow);
  const vals = Object.values(newRow);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${placeholders})`;
  const db = getDb(req.query.db);
  db.run(sql, vals, function(err) {
    db.close();
    if (err) return next(err);
    res.json({ id: this.lastID, inserted: this.changes });
  });
});

// ------------------- 행 수정 -------------------
// PUT /admin/api/tables/:name/rows/:id
router.put('/tables/:name/rows/:id', express.json(), (req, res, next) => {
  const { name, id } = req.params;
  const updates = req.body; // {col: value, ...}
  const setClauses = [];
  const params = [];
  for (const [col, val] of Object.entries(updates)) {
    setClauses.push(`${col} = ?`);
    params.push(val);
  }
  const sql = `UPDATE ${name} SET ${setClauses.join(', ')} WHERE rowid = ?`;
  params.push(id);
  const db = getDb();
  db.run(sql, params, function(err) {
    db.close();
    if (err) return next(err);
    res.json({ changed: this.changes });
  });
});

// ------------------- 행 삭제 (단일) -------------------
// DELETE /admin/api/tables/:name/rows/:id
router.delete('/tables/:name/rows/:id', (req, res, next) => {
  const { name, id } = req.params;
  const sql = `DELETE FROM ${name} WHERE rowid = ?`;
  const db = getDb();
  db.run(sql, [id], function(err) {
    db.close();
    if (err) return next(err);
    res.json({ deleted: this.changes });
  });
});

// ------------------- 다중 삭제 -------------------
// DELETE /admin/api/tables/:name/rows (body: {ids: [id...]})
router.delete('/tables/:name/rows', express.json(), (req, res, next) => {
  const { name } = req.params;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids 배열이 필요합니다.' });
  }
  const placeholders = ids.map(() => '?').join(',');
  const sql = `DELETE FROM ${name} WHERE rowid IN (${placeholders})`;
  const db = getDb();
  db.run(sql, ids, function(err) {
    db.close();
    if (err) return next(err);
    res.json({ deleted: this.changes });
  });
});

// ------------------- 백업 -------------------
// POST /admin/api/tables/:name/backup?format=json|csv
router.post('/tables/:name/backup', (req, res, next) => {
  const { name } = req.params;
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const db = getDb();
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
});

// ------------------- 복원 -------------------
// POST /admin/api/tables/:name/restore (JSON 배열 body)
router.post('/tables/:name/restore', express.json(), (req, res, next) => {
  const { name } = req.params;
  const rows = req.body; // [{col:val, ...}, ...]
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: '복원 데이터가 필요합니다.' });
  }
  const db = getDb();
  const cols = Object.keys(rows[0]);
  const placeholders = cols.map(() => '?').join(',');
  const sql = `INSERT INTO ${name} (${cols.join(',')}) VALUES (${placeholders})`;
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
});

module.exports = router;
