/**
 * server/routes/api.js — 관리자 API 라우터
 *
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-001 (architecture.md): 시스템 구성 참조
 *
 * 마운트 경로: /api
 * 노출 엔드포인트:
 *   GET /api/stats      — 대시보드 통계
 *   GET /api/activities — 최근 활동 로그
 *   GET /api/status     — 시스템 상태 (서버·DB·WebSocket·MCP)
 */

const express          = require('express');
const { queryDatabase } = require('../db/helper');

/**
 * wss(WebSocketServer) 인스턴스를 받아 Express 라우터를 반환합니다.
 * 클라이언트 연결 수 조회에 wss.clients.size를 사용합니다.
 *
 * @param {import('ws').WebSocketServer} wss
 * @returns {import('express').Router}
 */
function createApiRouter(wss) {
    const router = express.Router();

    // 대시보드 통계 API
    router.get('/stats', async (req, res, next) => {
        try {
            const [modules, workflows, scheduledJobs, activityLogs] = await Promise.all([
                queryDatabase('SELECT COUNT(*) AS count FROM modules'),
                queryDatabase('SELECT COUNT(*) AS count FROM workflows'),
                queryDatabase('SELECT COUNT(*) AS count FROM scheduled_jobs'),
                queryDatabase('SELECT COUNT(*) AS count FROM activity_logs')
            ]);

            res.json({
                modules:      modules[0]?.count      || 0,
                workflows:    workflows[0]?.count    || 0,
                scheduledJobs: scheduledJobs[0]?.count || 0,
                activityLogs: activityLogs[0]?.count || 0
            });
        } catch (err) {
            next(err);
        }
    });

    // 최근 활동 API
    router.get('/activities', async (req, res, next) => {
        const rawLimit = Number.parseInt(req.query.limit, 10);
        const limit    = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 10;

        try {
            const rows = await queryDatabase(
                `SELECT source AS type,
                        COALESCE(modules.name, '-') AS module,
                        activity_logs.action AS action,
                        activity_logs.status AS status,
                        activity_logs.created_at AS timestamp
                   FROM activity_logs
                   LEFT JOIN modules ON modules.id = activity_logs.module_id
                  ORDER BY activity_logs.created_at DESC
                  LIMIT ?`,
                [limit]
            );
            res.json(rows);
        } catch (err) {
            next(err);
        }
    });

    // 시스템 상태 API (R-006 monitoring.md 참조)
    router.get('/status', async (req, res, next) => {
        let dbStatus = 'offline';
        try {
            const rows = await queryDatabase('SELECT 1 AS ok');
            dbStatus   = rows[0]?.ok === 1 ? 'online' : 'offline';
        } catch {
            dbStatus = 'offline';
        }

        res.json({
            server:           'online',
            database:         dbStatus,
            websocket:        'active',
            websocketClients: wss ? wss.clients.size : 0,
            mcp:              'ready',
            timestamp:        new Date().toISOString()
        });
    });

    return router;
}

module.exports = createApiRouter;
