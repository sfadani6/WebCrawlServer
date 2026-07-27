/**
 * 관리자 API 라우터
 * 접속 관리, 플러그인 모니터링 등 관리자 전용 API 제공
 * 
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-007 (database.md): DB 스키마 및 API
 */

const express = require('express');
const router = express.Router();
const { basicAuth } = require('../middleware/auth');
const { success, fail } = require('../middleware/response');
const {
  getAllConnections,
  getConnection,
  terminateConnection,
  getConnectionStats
} = require('../monitor/connectionManager');

// ============================================================
// 접속 관리 API
// ============================================================

/**
 * GET /admin/api/connections
 * 현재 연결된 모든 클라이언트 조회
 */
router.get('/connections', basicAuth, async (req, res, next) => {
  try {
    const connections = getAllConnections();
    
    // 응답 데이터 포맷팅
    const formattedConnections = connections.map(conn => ({
      connectionId: conn.connectionId,
      clientIp: conn.clientIp,
      userAgent: conn.userAgent,
      hostname: conn.hostname,
      status: conn.status,
      connectedAt: conn.connectedAt,
      lastActivityAt: conn.lastActivityAt,
      isAuthenticated: conn.isAuthenticated,
      extensionId: conn.extensionId,
      browserName: conn.browserName,
      browserVersion: conn.browserVersion,
      pluginRequestId: conn.pluginRequestId
    }));
    
    return success(res, '연결 목록 조회 성공', {
      connections: formattedConnections,
      count: formattedConnections.length
    });
  } catch (err) {
    console.error('[admin.connections] 오류:', err);
    return fail(res, '연결 목록 조회 실패', 500, { error: err.message });
  }
});

/**
 * GET /admin/api/connections/:id
 * 특정 연결 정보 조회
 */
router.get('/connections/:id', basicAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = getConnection(id);
    
    if (!connection) {
      return fail(res, '연결을 찾을 수 없습니다.', 404);
    }
    
    return success(res, '연결 정보 조회 성공', {
      connection: {
        connectionId: connection.connectionId,
        clientIp: connection.clientIp,
        userAgent: connection.userAgent,
        hostname: connection.hostname,
        status: connection.status,
        connectedAt: connection.connectedAt,
        lastActivityAt: connection.lastActivityAt,
        isAuthenticated: connection.isAuthenticated,
        extensionId: connection.extensionId,
        browserName: connection.browserName,
        browserVersion: connection.browserVersion,
        pluginRequestId: connection.pluginRequestId
      }
    });
  } catch (err) {
    console.error('[admin.connections.get] 오류:', err);
    return fail(res, '연결 정보 조회 실패', 500, { error: err.message });
  }
});

/**
 * POST /admin/api/connections/:id/terminate
 * 특정 연결 강제 종료
 */
router.post('/connections/:id/terminate', basicAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = terminateConnection(id);
    
    if (!result) {
      return fail(res, '연결을 찾을 수 없습니다.', 404);
    }
    
    return success(res, '연결 종료 성공', {
      connectionId: id,
      terminated: true
    });
  } catch (err) {
    console.error('[admin.connections.terminate] 오류:', err);
    return fail(res, '연결 종료 실패', 500, { error: err.message });
  }
});

/**
 * GET /admin/api/connections/stats
 * 연결 통계 정보 조회
 */
router.get('/connections/stats', basicAuth, async (req, res, next) => {
  try {
    const stats = getConnectionStats();
    return success(res, '연결 통계 조회 성공', stats);
  } catch (err) {
    console.error('[admin.connections.stats] 오류:', err);
    return fail(res, '연결 통계 조회 실패', 500, { error: err.message });
  }
});

// ============================================================
// 플러그인 연결 현황 API (레거시PluginsPage 호환용)
// ============================================================

/**
 * GET /admin/api/plugins/pending
 * 승인 대기 중인 플러그인 요청 목록 조회
 * (레거시: /api/plugin/pending 과 동일하지만 관리자 API 경로에서 제공)
 */
router.get('/plugins/pending', basicAuth, async (req, res, next) => {
  try {
    const dbHelper = require('../db/helper');
    const requests = await dbHelper.getPluginRequests({ status: 'pending' });
    return success(res, '승인 대기 목록 조회 성공', requests);
  } catch (err) {
    console.error('[admin.plugins.pending] 오류:', err);
    return fail(res, '승인 대기 목록 조회 실패', 500, { error: err.message });
  }
});

/**
 * GET /admin/api/plugins/approved
 * 승인된 플러그인 목록 조회
 */
router.get('/plugins/approved', basicAuth, async (req, res, next) => {
  try {
    const dbHelper = require('../db/helper');
    const requests = await dbHelper.getPluginRequests({ status: 'approved' });
    return success(res, '승인된 플러그인 목록 조회 성공', requests);
  } catch (err) {
    console.error('[admin.plugins.approved] 오류:', err);
    return fail(res, '승인된 플러그인 목록 조회 실패', 500, { error: err.message });
  }
});

/**
 * POST /admin/api/plugins/:id/approve
 * 플러그인 요청 승인 및 토큰 발급
 */
router.post('/plugins/:id/approve', basicAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const dbHelper = require('../db/helper');
    const approvedToken = await dbHelper.approvePluginRequest(id);
    return success(res, '플러그인 승인 성공', { token: approvedToken });
  } catch (err) {
    console.error('[admin.plugins.approve] 오류:', err);
    return fail(res, '플러그인 승인 실패', 500, { error: err.message });
  }
});

/**
 * POST /admin/api/plugins/:id/reject
 * 플러그인 요청 거절
 */
router.post('/plugins/:id/reject', basicAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const dbHelper = require('../db/helper');
    await dbHelper.updatePluginRequestStatus(id, 'rejected');
    return success(res, '플러그인 거절 성공');
  } catch (err) {
    console.error('[admin.plugins.reject] 오류:', err);
    return fail(res, '플러그인 거절 실패', 500, { error: err.message });
  }
});

/**
 * POST /admin/api/plugins/:id/disconnect
 * 플러그인 연결 종료
 */
router.post('/plugins/:id/disconnect', basicAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const dbHelper = require('../db/helper');
    await dbHelper.updatePluginRequestStatus(id, 'disconnected');
    return success(res, '플러그인 연결 종료 성공');
  } catch (err) {
    console.error('[admin.plugins.disconnect] 오류:', err);
    return fail(res, '플러그인 연결 종료 실패', 500, { error: err.message });
  }
});

/**
 * GET /admin/api/plugins/status/:requestId
 * 플러그인 승인 상태 확인
 */
router.get('/plugins/status/:requestId', async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const dbHelper = require('../db/helper');
    const request = await dbHelper.queryOne(
      `SELECT status, approved_token FROM plugin_requests WHERE id = ?`,
      [requestId]
    );
    
    if (!request) {
      return fail(res, '요청을 찾을 수 없습니다.', 404);
    }
    
    return success(res, '플러그인 상태 조회 성공', {
      status: request.status,
      token: request.status === 'approved' ? request.approved_token : null
    });
  } catch (err) {
    console.error('[admin.plugins.status] 오류:', err);
    return fail(res, '플러그인 상태 조회 실패', 500, { error: err.message });
  }
});

module.exports = router;
