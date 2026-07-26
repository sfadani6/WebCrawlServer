/**
 * Retry Middleware - API 호출 자동 재시도
 * 
 * R-013 (security.md) 4.2: 최대 3회 재시도 정책
 */

const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../db/helper');

/**
 * 재시도 옵션
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  delayMs: 1000
};

/**
 * 지수 백오프 지연 계산
 * @param {number} attempt - 시도 횟수
 * @returns {number} 지연 시간 (ms)
 */
function getBackoffDelay(attempt) {
  return RETRY_CONFIG.delayMs * Math.pow(2, attempt);
}

/**
 * 에러 로그 기록
 */
function logError(errorType, errorMessage, context = {}) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return resolve(); // 로그 기록 실패해도 계속 진행
      
      db.run(
        `INSERT INTO error_logs (error_type, error_message, context) VALUES (?, ?, ?)`,
        [errorType, errorMessage, JSON.stringify(context)],
        (err) => {
          db.close();
          resolve(); // 계속 진행
        }
      );
    });
  });
}

/**
 * Slack Webhook 알림 (옵션)
 */
async function sendSlackAlert(message) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  
  try {
    const fetch = require('node-fetch');
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[WebCrawlServer] ${message}` })
    });
  } catch (error) {
    console.error('[Retry] Slack 알림 전송 실패:', error);
  }
}

/**
 * 재시도 래퍼 - 비동기 함수
 * @param {Function} fn - 실행할 함수
 * @param {number} retries - 남은 재시도 횟수
 * @returns {Promise} 실행 결과
 */
async function withRetry(fn, retries = RETRY_CONFIG.maxRetries) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`[Retry] 재시도 남음: ${retries}회 (${error.message})`);
      await new Promise(resolve => setTimeout(resolve, getBackoffDelay(RETRY_CONFIG.maxRetries - retries)));
      return withRetry(fn, retries - 1);
    }
    
    // 실패 시 로그 및 알림
    await logError('retry_exhausted', error.message, { maxRetries: RETRY_CONFIG.maxRetries });
    if (process.env.ENABLE_SLACK_ALERT === 'true') {
      await sendSlackAlert(`최대 재시도 초과: ${error.message}`);
    }
    
    throw error;
  }
}

module.exports = {
  withRetry,
  RETRY_CONFIG
};