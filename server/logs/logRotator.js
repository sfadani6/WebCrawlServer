/**
 * Log Rotator - 로그 파일 로테이션 및 정리
 * 
 * R-009 (logging.md) 4장: 로그 파일 생성 및 로테이션 정책
 * - 일자별 로그 파일 자동 생성
 * - 보관 기간 초과 로그 자동 삭제 (기본 30일)
 * - 로그 디렉토리 자동 생성
 */

const fs = require('fs-extra');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../db/helper');

// 로그 보관 설정
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 30;
const LOG_ROTATION_INTERVAL_MS = 3600000; // 1시간마다 체크

// 로테이터 인터벌
let rotatorInterval = null;

/**
 * 로그 디렉토리 경로 반환
 */
function getLogDir() {
  return path.join(__dirname, '../../logs');
}

/**
 * 오늘 날짜의 로그 파일 경로 반환
 */
function getTodayLogPath() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return path.join(getLogDir(), `server-${dateStr}.log`);
}

/**
 * 파일 로깅 - 지정된 메시지를 오늘 날짜 로그 파일에 추가
 * @param {string} level - 로그 레벨 (INFO, WARN, ERROR)
 * @param {string} message - 로그 메시지
 */
function writeLogFile(level, message) {
  const logPath = getTodayLogPath();
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}\n`;
  
  fs.appendFile(logPath, line, { encoding: 'utf8' }).catch(err => {
    console.error(`[LogRotator] 파일 쓰기 오류: ${err.message}`);
  });
}

/**
 * 오래된 로그 파일 정리 - 보관 기간 초과 파일 삭제
 */
async function cleanOldLogs() {
  try {
    const logDir = getLogDir();
    const files = await fs.readdir(logDir);
    const now = Date.now();
    const maxAge = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      // 로그 파일만 처리 (server-YYYY-MM-DD.log 패턴)
      if (!/^server-\d{4}-\d{2}-\d{2}\.log$/.test(file)) continue;
      
      const filePath = path.join(logDir, file);
      try {
        const stats = await fs.stat(filePath);
        if (now - stats.mtime > maxAge) {
          await fs.remove(filePath);
          deletedCount++;
          console.log(`[LogRotator] 오래된 로그 파일 삭제: ${file}`);
        }
      } catch (statErr) {
        // 개별 파일 오류는 무시
      }
    }

    if (deletedCount > 0) {
      console.log(`[LogRotator] ${deletedCount}개 오래된 로그 파일 정리 완료`);
    }
  } catch (err) {
    console.error(`[LogRotator] 로그 정리 오류: ${err.message}`);
  }
}

/**
 * activity_logs 테이블 오래된 레코드 정리
 */
async function cleanOldActivityLogs() {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error(`[LogRotator] DB 연결 오류: ${err.message}`);
        return resolve();
      }
      
      const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      db.run(`DELETE FROM activity_logs WHERE created_at < ?`, [cutoff], function(err) {
        if (err) {
          console.error(`[LogRotator] activity_logs 정리 오류: ${err.message}`);
        } else if (this.changes > 0) {
          console.log(`[LogRotator] activity_logs ${this.changes}개 레코드 정리 완료`);
        }
        db.close();
        resolve();
      });
    });
  });
}

/**
 * error_logs 테이블 오래된 레코드 정리
 */
async function cleanOldErrorLogs() {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error(`[LogRotator] DB 연결 오류: ${err.message}`);
        return resolve();
      }
      
      const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      db.run(`DELETE FROM error_logs WHERE created_at < ?`, [cutoff], function(err) {
        if (err) {
          console.error(`[LogRotator] error_logs 정리 오류: ${err.message}`);
        } else if (this.changes > 0) {
          console.log(`[LogRotator] error_logs ${this.changes}개 레코드 정리 완료`);
        }
        db.close();
        resolve();
      });
    });
  });
}

/**
 * 로그 로테이터 시작
 * @param {number} intervalMs - 체크 간격 (밀리초, 기본 1시간)
 */
function startLogRotator(intervalMs = LOG_ROTATION_INTERVAL_MS) {
  console.log(`[LogRotator] 로그 로테이터 시작 (보관 기간: ${LOG_RETENTION_DAYS}일, 체크 간격: ${intervalMs / 60000}분)`);

  // 로그 디렉토리 생성
  fs.ensureDir(getLogDir()).catch(err => {
    console.error(`[LogRotator] 로그 디렉토리 생성 오류: ${err.message}`);
  });

  // 즉시 한 번 실행
  cleanOldLogs();
  cleanOldActivityLogs();
  cleanOldErrorLogs();

  // 주기적 실행
  if (rotatorInterval) {
    clearInterval(rotatorInterval);
  }
  rotatorInterval = setInterval(async () => {
    await cleanOldLogs();
    await cleanOldActivityLogs();
    await cleanOldErrorLogs();
  }, intervalMs);
}

/**
 * 로그 로테이터 정지
 */
function stopLogRotator() {
  if (rotatorInterval) {
    clearInterval(rotatorInterval);
    rotatorInterval = null;
    console.log('[LogRotator] 로그 로테이터 정지');
  }
}

module.exports = {
  startLogRotator,
  stopLogRotator,
  writeLogFile,
  cleanOldLogs,
  cleanOldActivityLogs,
  cleanOldErrorLogs,
  getTodayLogPath
};