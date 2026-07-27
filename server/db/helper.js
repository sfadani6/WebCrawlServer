/**
 * server/db/helper.js — SQLite DB 공통 헬퍼
 *
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-007 (database.md): DB 연결 규칙 참조
 *
 * 모든 DB 모듈에서 이 헬퍼를 통해 DB에 접근한다.
 * DB 연결 생성/종료 패턴이 6개 파일에 중복되어 있던 것을 통합.
 */

const path    = require('path');
const sqlite3 = require('sqlite3').verbose();

// R-007 1장: DB 파일 위치 고정
const DB_PATH = path.join(__dirname, '../../database/main.db');

// 공유 DB 연결 객체 (싱글톤)
let cachedDb = null;

/**
 * DB 연결 가져오기 (싱글톤 패턴)
 * @returns {sqlite3.Database}
 */
function getDbConnection() {
  if (!cachedDb) {
    cachedDb = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error('[DB] 공유 연결 생성 오류:', err);
    });
    // 성능 최적화 설정
    cachedDb.run('PRAGMA journal_mode = WAL');
    cachedDb.run('PRAGMA synchronous = NORMAL');
  }
  return cachedDb;
}

/**
 * DB 연결 종료 (서버 종료 시 호출)
 */
function closeDbConnection() {
  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
  }
}

/**
 * DB 연결 생성 (읽기 전용)
 * @param {string} [dbPath] - DB 파일 경로 (기본: main.db)
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
 * DB 연결 생성 (읽기/쓰기)
 * @param {string} [dbPath] - DB 파일 경로 (기본: main.db)
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
 * 트랜잭션 내에서 여러 쿼리 실행
 * @param {Array<{sql: string, params: Array}>} queries
 * @returns {Promise<Array>}
 */
function transaction(queries) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const results = [];
      let hasError = false;
      
      // 순차 실행을 위해 query-by-query approach 사용
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

module.exports = {
  queryDatabase,
  queryOne,
  execute,
  transaction,
  openReadonly,
  openReadwrite,
  getDbPath,
  DB_PATH,
  closeDbConnection
};
