const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDbPath() {
  return path.join(__dirname, '../../../../database/main.db');
}

async function saveItems(items, targetId, targetName) {
  const db = new sqlite3.Database(getDbPath(), (err) => {
    if (err) throw err;
  });

  const insert = `INSERT INTO crawler_items (target_id, external_id, title, content, published_at) VALUES (?, ?, ?, ?, ?)`;
  const stmt = db.prepare(insert);
  let saved = 0;

  for (const item of items) {
    await new Promise((resolve, reject) => {
      stmt.run([targetId, item.external_id || item.link || null, item.title || '', item.content || item.description || '', item.published_at || null], function (err) {
        if (err) return reject(err);
        saved += this.changes;
        resolve();
      });
    });
  }

  stmt.finalize((err) => {
    if (err) throw err;
    db.close();
  });

  return saved;
}

async function execute(params, context) {
  const items = context.variables.get('parsedItems') || [];
  const targetId = Number(context.variables.get('targetId') || 0);
  const targetName = context.variables.get('targetName') || '';
  if (!items.length || !targetId) {
    return { status: 'error', message: '저장할 아이템 또는 타겟 ID가 없습니다.' };
  }
  const saved = await saveItems(items, targetId, targetName);
  return { status: 'success', saved, targetName };
}

module.exports = { execute };