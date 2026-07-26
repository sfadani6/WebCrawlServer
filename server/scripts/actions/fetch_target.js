const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

function getDbPath() {
  return path.join(__dirname, '../../database/main.db');
}

async function fetchTarget(target) {
  const response = await axios.get(target.url, { timeout: 15000 });
  return response.data;
}

async function execute(params, context) {
  const targetId = Number(params.target_id || 0);
  const db = new sqlite3.Database(getDbPath(), sqlite3.OPEN_READONLY, (err) => {
    if (err) throw err;
  });

  const target = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM crawler_targets WHERE id = ?', [targetId], (err, row) => {
      db.close();
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!target) {
    return { status: 'error', message: `타겟을 찾을 수 없음: ${targetId}` };
  }

  try {
    const raw = await fetchTarget(target);
    context.variables.set('raw', raw);
    return { status: 'success', data: raw };
  } catch (error) {
    return { status: 'error', message: `크롤 실패: ${error.message}` };
  }
}

module.exports = { execute };