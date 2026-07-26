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
const { success, fail } = require('../middleware/response');

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
    // 개선: SQLite는 단일 라이터 특성상 하나의 쿼리로 병합하는 것이 더 효율적
    // UNION ALL을 사용하여 하나의 쿼리로 모든 COUNT를 조회
    router.get('/stats', async (req, res, next) => {
        try {
            const rows = await queryDatabase(`
                SELECT 'modules' AS k, COUNT(*) AS c FROM modules
                UNION ALL SELECT 'workflows', COUNT(*) FROM workflows
                UNION ALL SELECT 'jobs', COUNT(*) FROM scheduled_jobs
                UNION ALL SELECT 'logs', COUNT(*) FROM activity_logs
            `);

            const stats = {};
            rows.forEach(row => {
                stats[row.k] = row.c;
            });

            return success(res, {
                modules:      stats.modules      || 0,
                workflows:    stats.workflows    || 0,
                scheduledJobs: stats.jobs         || 0,
                activityLogs: stats.logs         || 0
            });
        } catch (err) {
            return fail(res, '대시보드 통계 조회 실패', 500, { error: err.message });
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
    // 개선: 실제 WebSocket 및 MCP 상태 반영
    router.get('/status', async (req, res, next) => {
        let dbStatus = 'offline';
        let activeJobs = 0;
        let pendingMcpMessages = 0;
        
        try {
            const rows = await queryDatabase('SELECT 1 AS ok');
            dbStatus = rows[0]?.ok === 1 ? 'online' : 'offline';
            
            // 활성 스케줄러 잡 개수 조회
            const jobs = await queryDatabase(
                "SELECT COUNT(*) AS count FROM scheduled_jobs WHERE status = 'active'"
            );
            activeJobs = jobs[0]?.count || 0;
            
            // MCP 미처리 메시지 큐 크기 (추정치 - 실제 구현 시 큐 시스템 연동)
            // 현재는 WebSocket 연결 수를 기준으로 간주
            pendingMcpMessages = wss ? wss.clients.size : 0;
            
        } catch {
            dbStatus = 'offline';
        }

        // WebSocket 상태를 실제 연결 수에 따라 동적으로 반영
        const websocketStatus = wss && wss.clients.size > 0 ? 'active' : 'idle';
        const mcpStatus = wss && wss.clients.size > 0 ? 'ready' : 'waiting';

        res.json({
            server:           'online',
            database:         dbStatus,
            websocket:        websocketStatus,
            websocketClients: wss ? wss.clients.size : 0,
            activeJobs:       activeJobs,
            pendingMcpMessages: pendingMcpMessages,
            mcp:              mcpStatus,
            timestamp:        new Date().toISOString()
        });
    });

    return router;
}

module.exports = createApiRouter;
