const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../db/helper');
const { success, fail } = require('../middleware/response');

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

// ------------------- Target 목록 -------------------
// GET /admin/api/crawler/targets
router.get('/targets', (req, res, next) => {
  const db = getDb();
  db.all(`SELECT * FROM crawler_targets ORDER BY updated_at DESC`, (err, rows) => {
    db.close();
    if (err) return next(err);
    success(res, rows);
  });
});

// ------------------- Target 상세 -------------------
// GET /admin/api/crawler/targets/:id
router.get('/targets/:id', (req, res, next) => {
  const { id } = req.params;
  const db = getDb();
  db.get(`SELECT * FROM crawler_targets WHERE id = ?`, [id], (err, row) => {
    db.close();
    if (err) return next(err);
    if (!row) return fail(res, '타겟을 찾을 수 없습니다.', 404);
    success(res, row);
  });
});

// ------------------- Target 생성 -------------------
// POST /admin/api/crawler/targets
router.post('/targets', express.json(), (req, res, next) => {
  const { name, url, kind, interval_seconds } = req.body;
  if (!name || !url || !kind) {
    return fail(res, 'name, url, kind는 필수입니다.', 400);
  }
  const db = getDb();
  db.run(
    `INSERT INTO crawler_targets (name, url, kind, interval_seconds) VALUES (?, ?, ?, ?)`,
    [name, url, kind, interval_seconds || 0],
    function (err) {
      db.close();
      if (err) return next(err);
      success(res, { id: this.lastID, name, url, kind, interval_seconds: interval_seconds || 0 });
    }
  );
});

// ------------------- Target 수정 -------------------
// PUT /admin/api/crawler/targets/:id
router.put('/targets/:id', express.json(), (req, res, next) => {
  const { id } = req.params;
  const { name, url, kind, interval_seconds } = req.body;
  const db = getDb();
  db.run(
    `UPDATE crawler_targets SET name = ?, url = ?, kind = ?, interval_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, url, kind, interval_seconds, id],
    function (err) {
      db.close();
      if (err) return next(err);
      success(res, { changed: this.changes });
    }
  );
});

// ------------------- Target 삭제 -------------------
// DELETE /admin/api/crawler/targets/:id
router.delete('/targets/:id', (req, res, next) => {
  const { id } = req.params;
  const db = getDb();
  db.run(`DELETE FROM crawler_targets WHERE id = ?`, [id], function (err) {
    db.close();
    if (err) return next(err);
    success(res, { deleted: this.changes });
  });
});

// ------------------- Item 목록 -------------------
// GET /admin/api/crawler/items
router.get('/items', (req, res, next) => {
  const targetId = req.query.target_id;
  const db = getDb();
  const params = [];
  let sql = `SELECT * FROM crawler_items WHERE 1=1`;
  if (targetId) {
    sql += ` AND target_id = ?`;
    params.push(targetId);
  }
  sql += ` ORDER BY fetched_at DESC LIMIT 200`;
  db.all(sql, params, (err, rows) => {
    db.close();
    if (err) return next(err);
    success(res, rows);
  });
});

module.exports = router;