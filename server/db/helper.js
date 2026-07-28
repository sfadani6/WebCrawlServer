const path    = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto  = require('crypto');

/**
 * R-007 1장: DB 파일 위치 고정
 */
const DB_PATH = path.join(__dirname, '../../database/main.db');

/**
 * 경로별 캐시된 DB 커넥션 맵
 */
const connectionPool = new Map();

/**
 * DB 연결 가져오기 (경로별 싱글톤/커넥션 풀 패턴)
 * @param {string} [targetPath=DB_PATH] - DB 파일 전체 경로
 * @returns {sqlite3.Database}
 */
function getDbForPath(targetPath = DB_PATH) {
  const resolvedPath = path.resolve(targetPath);
  if (!connectionPool.has(resolvedPath)) {
    const db = new sqlite3.Database(resolvedPath, (err) => {
      if (err) console.error(`[DB] 연결 생성 오류 (${resolvedPath}):`, err);
    });
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
    connectionPool.set(resolvedPath, db);
  }
  return connectionPool.get(resolvedPath);
}

/**
 * DB 연결 가져오기 (기본 main.db)
 * @returns {sqlite3.Database}
 */
function getDbConnection() {
  return getDbForPath(DB_PATH);
}

/**
 * DB 연결 종료
 * @param {sqlite3.Database|string} [target] - 종료할 DB 객체 또는 경로
 */
function closeDbConnection(target) {
  if (!target) {
    connectionPool.forEach((db) => db.close());
    connectionPool.clear();
    return;
  }
  if (typeof target === 'string') {
    const resolvedPath = path.resolve(target);
    const db = connectionPool.get(resolvedPath);
    if (db) {
      db.close();
      connectionPool.delete(resolvedPath);
    }
  } else if (target && typeof target.close === 'function') {
    target.close();
  }
}

/**
 * 읽기 전용 DB 연결 생성
 * @param {string} [dbPath=DB_PATH] - DB 파일 경로
 * @returns {Promise<sqlite3.Database>}
 */
function openReadonly(dbPath = DB_PATH) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

/**
 *읽기/쓰기 DB 연결 생성
 * @param {string} [dbPath=DB_PATH] - DB 파일 경로
 * @returns {Promise<sqlite3.Database>}
 */
function openReadwrite(dbPath = DB_PATH) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

/**
 * SELECT 쿼리 실행
 * @param {string} sql - SQL 문
 * @param {Array} [params] - 바인딩 파라미터
 * @returns {Promise<Array>} 결과 행 배열
 */
function queryDatabase(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.all(sql, params, (queryErr, rows) => {
      if (queryErr) return reject(queryErr);
      resolve(rows);
    });
  });
}

/**
 * 단일 행 조회
 * @param {string} sql - SQL 문
 * @param {Array} [params] - 바인딩 파라미터
 * @returns {Promise<Object|null>} 결과 행
 */
function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.get(sql, params, (queryErr, row) => {
      if (queryErr) return reject(queryErr);
      resolve(row || null);
    });
  });
}

/**
 * INSERT/UPDATE/DELETE 실행
 * @param {string} sql - SQL 문
 * @param {Array} [params] - 바인딩 파라미터
 * @returns {Promise<{lastID: number, changes: number}>}
 */
function execute(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * 트랜잭션 내 여러 쿼리 실행
 * @param {Array<{sql: string, params: Array}>} queries
 * @returns {Promise<Array>} 실행 결과 배열
 */
function transaction(queries) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const results = [];
      const runNext = (index) => {
        if (index >= queries.length) {
          db.run('COMMIT', (err) => {
            if (err) return reject(err);
            resolve(results);
          });
          return;
        }
        const q = queries[index];
        db.run(q.sql, q.params || [], function (err) {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          results.push({ lastID: this.lastID, changes: this.changes });
          runNext(index + 1);
        });
      };
      runNext(0);
    });
  });
}

/**
 * DB 파일 경로 생성 (디렉토리 트래버설 방지)
 * @param {string} dbName - DB 파일명
 * @returns {string} 전체 경로
 */
function getDbPath(dbName = 'main.db') {
  const safeName = path.basename(dbName);
  const fileName = safeName.endsWith('.db') ? safeName : `${safeName}.db`;
  return path.join(__dirname, '../../database', fileName);
}

/**
 * 랜덤 토큰 생성 (Hex 문자열)
 * @returns {string}
 */
function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 플러그인 요청 테이블 생성
 */
async function createPluginRequestsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS plugin_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      browser_name TEXT,
      browser_version TEXT,
      extension_id TEXT,
      hostname TEXT,
      status TEXT DEFAULT 'pending',
      approved_token TEXT,
      approved_at TIMESTAMP,
      connected BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  return queryDatabase(sql);
}

/**
 * 플러그인 요청 저장
 * @param {Object} requestData - 브라우저/확장 정보
 * @returns {Promise<number>} 새로 삽입된 행 ID
 */
function insertPluginRequest(requestData) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    const sql = `INSERT INTO plugin_requests (browser_name, browser_version, extension_id, hostname, status, created_at) VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`;
    db.run(sql, [requestData.browser_name, requestData.browser_version, requestData.extension_id, requestData.hostname], function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

/**
 *ステータ스에 따라 플러그인 요청 조회
 * @param {Object} [filter] - 필터 객체 (예: {status: 'pending'})
 * @returns {Promise<Array>} 조회된 요청 배열
 */
function getPluginRequests(filter = { status: 'pending' }) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    const whereClause = filter.status ? `WHERE status = ?` : '';
    const params = filter.status ? [filter.status] : [];
    const sql = `SELECT * FROM plugin_requests ${whereClause}`;
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * 플러그인 요청 승인 및 토큰 발급
 * @param {number} requestId - 승인할 요청 ID
 * @returns {Promise<string>} 생성된 토큰
 */
function approvePluginRequest(requestId) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    const token = crypto.randomBytes(16).toString('hex');
    db.run(
      `UPDATE plugin_requests SET status = 'approved', approved_token = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [token, requestId],
      function (err) {
        if (err) return reject(err);
        resolve(token);
      }
    );
  });
}

/**
 * 플러그인 요청 상태 업데이트
 * @param {number} requestId - 상태를 바꿀 요청 ID
 * @param {string} status - 새 상태 ('rejected', 'disconnected', etc.)
 * @returns {Promise<void>}
 */
function updatePluginRequestStatus(requestId, status) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.run(
      `UPDATE plugin_requests SET status = ? WHERE id = ?`,
      [status, requestId],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

/**
 * 기존 테이블 생성 (핵심 테이블)
 */
async function initializeCoreTables() {
  const coreTables = [
    `CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      config TEXT,
      tags TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS crawler_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      kind TEXT NOT NULL,
      interval_seconds INTEGER DEFAULT 0,
      last_checked_at TIMESTAMP,
      last_result TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS crawler_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER NOT NULL,
      external_id TEXT,
      title TEXT,
      content TEXT,
      raw TEXT,
      published_at TIMESTAMP,
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(target_id) REFERENCES crawler_targets(id)
    )`,
    `CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      yaml_content TEXT NOT NULL,
      module_id INTEGER,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (module_id) REFERENCES modules(id)
    )`,
    `CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      workflow_id INTEGER NOT NULL,
      cron_expression TEXT,
      once_at TIMESTAMP,
      interval_seconds INTEGER,
      status TEXT NOT NULL DEFAULT 'waiting',
      overlap_policy TEXT NOT NULL DEFAULT 'skip',
      last_executed_at TIMESTAMP,
      next_execution_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    )`,
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      cpu_usage REAL,
      memory_usage REAL,
      module_id INTEGER,
      workflow_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (module_id) REFERENCES modules(id),
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    )`,
    `CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      stack_trace TEXT,
      context TEXT,
      activity_log_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (activity_log_id) REFERENCES activity_logs(id)
    )`,
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      module TEXT,
      description TEXT NOT NULL,
      applied_sql TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS configattr (
      idx INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS config (
      idx INTEGER PRIMARY KEY AUTOINCREMENT,
      attr_id INTEGER NOT NULL,
      val1 TEXT,
      val2 TEXT,
      memo TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attr_id) REFERENCES configattr(idx) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS admin_credentials (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  let completed = 0;
  const total = coreTables.length;
  if (total === 0) {
    return resolve();
  }

  coreTables.forEach((sql) => {
    queryDatabase(sql, (err) => {
      if (err) {
        console.error('[DB] 테이블 생성 오류:', err);
      } else {
        completed++;
        if (completed === total) {
          // 코어 테이블 초기 데이터 삽입
          const initConfigAttrSql = `
            INSERT OR IGNORE INTO configattr (idx, name, description) VALUES 
             (1, '브라우저', '브라우저 실행 경로 및 인자 설정'),
             (2, '크롤러', '크롤러 동시 실행 및 딜레이 설정'),
             (3, '시스템', '서버 시스템 전반 환경 설정')
          `;
          execute(initConfigAttrSql, (err) => {
            if (err) console.error('[DB] configattr 시딩 오류:', err);
            else {
              // 관리자 계정 초기화
              getDbConnection().get(
                `SELECT id FROM admin_credentials WHERE id = 1`,
                (err, row) => {
                  if (err) {
                    console.error('[DB] 관리자 계정 조회 오류:', err);
                  } else {
                    if (!row) {
                      const INIT_USER = process.env.ADMIN_USERNAME || 'adminkim';
                      const INIT_PASS = process.env.ADMIN_PASSWORD || 'akssj#kasjf';
                      const hash = bcrypt.hashSync(INIT_PASS, 12);
                      execute(
                        `INSERT OR IGNORE INTO admin_credentials (id, username, password) VALUES (1, ?, ?)`,
                        [INIT_USER, hash],
                        (err) => {
                          if (err) console.error('[DB] 관리자 계정 시딩 오류:', err);
                          else console.log(`[DB] 관리자 계정 초기화 완료 (username: ${INIT_USER})`);
                        }
                      );
                    }
                  }
                }
              );
            }
          });
        }
      }
    });
  });
}

/**
 * 기존 코어 테이블 초기화 실행
 */
initializeCoreTables();

/**
 * 모듈 내보내기
 */
module.exports = {
  queryDatabase,
  queryOne,
  execute,
  transaction,
  openReadonly,
  openReadwrite,
  getDbPath,
  getDbForPath,
  getDbConnection,
  DB_PATH,
  closeDbConnection,
  createPluginRequestsTable,
  insertPluginRequest,
  getPluginRequests,
  approvePluginRequest,
  updatePluginRequestStatus,
  generateToken
};