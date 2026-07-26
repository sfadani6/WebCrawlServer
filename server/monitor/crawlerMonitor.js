const { queryOne, execute, DB_PATH } = require('../db/helper');
const axios = require('axios');

const POLL_INTERVAL_MS = 60 * 1000;
let timer = null;

async function pollOnce(wss) {
  try {
    const now = new Date().toISOString();
    const targets = await queryOne(
      `SELECT * FROM crawler_targets WHERE interval_seconds > 0 AND (last_checked_at IS NULL OR last_checked_at <= ?)`,
      [now]
    );
    if (!targets) return;

    const target = targets;
    try {
      const response = await axios.get(target.url, { timeout: 15000 });
      await execute(
        `UPDATE crawler_targets SET last_checked_at = ?, last_result = ?, updated_at = ? WHERE id = ?`,
        [now, 'ok', now, target.id]
      );
    } catch (error) {
      await execute(
        `UPDATE crawler_targets SET last_checked_at = ?, last_result = ?, updated_at = ? WHERE id = ?`,
        [now, `error: ${error.message}`, now, target.id]
      );
    }
  } catch (error) {
    console.error('[CrawlerMonitor] 폴링 오류:', error);
  }
}

function startCrawlerMonitor(wss) {
  if (timer) return;
  console.log('[CrawlerMonitor] 자동 폴링 시작');
  timer = setInterval(() => {
    pollOnce(wss);
  }, POLL_INTERVAL_MS);
}

function stopCrawlerMonitor() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startCrawlerMonitor, stopCrawlerMonitor };