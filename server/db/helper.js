/**
 * server/db/helper.js — SQLite 조회 전용 헬퍼
 *
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-007 (database.md): DB 연결 규칙 참조
 */

const path    = require('path');
const sqlite3 = require('sqlite3').verbose();

// R-007 1장: DB 파일 위치 고정
const DB_PATH = path.join(__dirname, '../../database/main.db');

/**
 * SQLite에 단순 SELECT 쿼리를 실행하고 결과 행 배열을 반환합니다.
 * 쓰기(INSERT/UPDATE/DELETE)는 이 헬퍼를 사용하지 않습니다.
 *
 * @param {string}   sql    - 실행할 SQL 문
 * @param {Array}    params - 바인딩 파라미터 배열 (기본값: [])
 * @returns {Promise<Array>} 결과 행 배열
 */
function queryDatabase(sql, params = []) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(err);

            db.all(sql, params, (queryErr, rows) => {
                db.close();
                if (queryErr) return reject(queryErr);
                resolve(rows);
            });
        });
    });
}

module.exports = { queryDatabase, DB_PATH };
