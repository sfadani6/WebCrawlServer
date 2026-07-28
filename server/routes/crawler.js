const express = require('express');
const router = express.Router();
const { queryDatabase, queryOne, execute } = require('../db/helper');
const { success, fail } = require('../middleware/response');

// ------------------- Target 목록 -------------------
// GET /admin/api/crawler/targets
router.get('/targets', async (req, res, next) => {
  try {
    const rows = await queryDatabase(`SELECT * FROM crawler_targets ORDER BY updated_at DESC`);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
});

// ------------------- Target 상세 -------------------
// GET /admin/api/crawler/targets/:id
router.get('/targets/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await queryOne(`SELECT * FROM crawler_targets WHERE id = ?`, [id]);
    if (!row) return fail(res, '타겟을 찾을 수 없습니다.', 404);
    return success(res, row);
  } catch (err) {
    next(err);
  }
});

// ------------------- Target 생성 -------------------
// POST /admin/api/crawler/targets
router.post('/targets', express.json(), async (req, res, next) => {
  try {
    const { name, url, kind, interval_seconds } = req.body;
    if (!name || !url || !kind) {
      return fail(res, 'name, url, kind는 필수입니다.', 400);
    }
    const result = await execute(
      `INSERT INTO crawler_targets (name, url, kind, interval_seconds) VALUES (?, ?, ?, ?)`,
      [name, url, kind, interval_seconds || 0]
    );
    return success(res, { id: result.lastID, name, url, kind, interval_seconds: interval_seconds || 0 });
  } catch (err) {
    next(err);
  }
});

// ------------------- Target 수정 -------------------
// PUT /admin/api/crawler/targets/:id
router.put('/targets/:id', express.json(), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, url, kind, interval_seconds } = req.body;
    const result = await execute(
      `UPDATE crawler_targets SET name = ?, url = ?, kind = ?, interval_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, url, kind, interval_seconds, id]
    );
    return success(res, { changed: result.changes });
  } catch (err) {
    next(err);
  }
});

// ------------------- Target 삭제 -------------------
// DELETE /admin/api/crawler/targets/:id
router.delete('/targets/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await execute(`DELETE FROM crawler_targets WHERE id = ?`, [id]);
    return success(res, { deleted: result.changes });
  } catch (err) {
    next(err);
  }
});

// ------------------- Item 목록 (중복 제거 필터 지원) -------------------
// GET /admin/api/crawler/items
router.get('/items', async (req, res, next) => {
  try {
    const targetId = req.query.target_id;
    const dedupe = req.query.dedupe === 'true' || req.query.dedupe === '1';
    const params = [];
    let sql = '';

    if (dedupe) {
      sql = `
        SELECT * FROM crawler_items
        WHERE id IN (
          SELECT MAX(id)
          FROM crawler_items
          WHERE 1=1
      `;
      if (targetId) {
        sql += ` AND target_id = ?`;
        params.push(targetId);
      }
      sql += `
          GROUP BY COALESCE(NULLIF(external_id, ''), title)
        )
        ORDER BY fetched_at DESC LIMIT 200
      `;
    } else {
      sql = `SELECT * FROM crawler_items WHERE 1=1`;
      if (targetId) {
        sql += ` AND target_id = ?`;
        params.push(targetId);
      }
      sql += ` ORDER BY fetched_at DESC LIMIT 200`;
    }

    const rows = await queryDatabase(sql, params);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
});

// ------------------- Item 중복 원클릭 자동 정리 -------------------
// POST /admin/api/crawler/items/deduplicate
router.post('/items/deduplicate', async (req, res, next) => {
  try {
    const targetId = req.body && req.body.target_id;
    let sql = `
      DELETE FROM crawler_items
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM crawler_items
        GROUP BY COALESCE(NULLIF(external_id, ''), title)
      )
    `;
    const params = [];
    if (targetId) {
      sql += ` AND target_id = ?`;
      params.push(targetId);
    }
    const result = await execute(sql, params);
    return success(res, '중복 크롤링 수집 데이터 정리가 완료되었습니다.', {
      deletedCount: result.changes
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;