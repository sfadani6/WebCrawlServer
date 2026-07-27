/**
 * WebSocket 연결 관리자
 * 
 * 현재 연결된 모든 WebSocket 클라이언트를 추적하고 관리
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-004 (mcp.md): MCP 프로토콜 지원
 * R-006 (monitoring.md): 모니터링 기능
 */

// 연결 정보 저장소
const activeConnections = new Map(); // connectionId -> connectionInfo
let nextConnectionId = 1;

/**
 * 새로운 연결 등록
 * @param {WebSocket} ws - WebSocket 객체
 * @param {Object} req - HTTP 요청 객체
 * @param {Object} connectionInfo - 추가 연결 정보
 * @returns {string} 연결 ID
 */
function registerConnection(ws, req, connectionInfo = {}) {
  const connectionId = `conn_${nextConnectionId++}`;
  const clientIp = req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';
  const hostname = req.headers.host || 'unknown';
  
  const info = {
    connectionId,
    ws,
    clientIp,
    userAgent,
    hostname,
    status: 'connected',
    connectedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    isAuthenticated: true, // WebSocket 인증 통과 시 true
    extensionId: connectionInfo.extensionId,
    browserName: connectionInfo.browserName,
    browserVersion: connectionInfo.browserVersion,
    pluginRequestId: connectionInfo.pluginRequestId,
    ...connectionInfo
  };
  
  activeConnections.set(connectionId, info);
  ws.connectionId = connectionId; // WebSocket 객체에 connectionId 저장
  
  console.log(`[ConnectionManager] 새로운 연결 등록: ${connectionId} (IP: ${clientIp}, UA: ${userAgent.slice(0, 50)})`);
  
  return connectionId;
}

/**
 * 연결 종료 시 연결 정보 제거
 * @param {string|WebSocket} identifier - 연결 ID 또는 WebSocket 객체
 */
function unregisterConnection(identifier) {
  let connectionId;
  
  if (typeof identifier === 'string') {
    connectionId = identifier;
  } else if (identifier && identifier.connectionId) {
    connectionId = identifier.connectionId;
  } else {
    // WebSocket 객체에서 connectionId 찾기
    for (const [id, info] of activeConnections.entries()) {
      if (info.ws === identifier) {
        connectionId = id;
        break;
      }
    }
  }
  
  if (connectionId && activeConnections.has(connectionId)) {
    const info = activeConnections.get(connectionId);
    info.status = 'disconnected';
    info.disconnectedAt = new Date().toISOString();
    
    console.log(`[ConnectionManager] 연결 종료: ${connectionId} (IP: ${info.clientIp})`);
    
    // 5분 후 완전히 제거 (이력 유지)
    setTimeout(() => {
      activeConnections.delete(connectionId);
    }, 5 * 60 * 1000);
  }
}

/**
 * 모든 활성 연결 조회
 * @returns {Array} 연결 정보 배열
 */
function getAllConnections() {
  return Array.from(activeConnections.values())
    .filter(conn => conn.status === 'connected')
    .map(conn => ({
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
}

/**
 * 특정 연결 조회
 * @param {string} connectionId - 연결 ID
 * @returns {Object|null} 연결 정보 또는 null
 */
function getConnection(connectionId) {
  return activeConnections.get(connectionId) || null;
}

/**
 * 연결 활동 로그 업데이트
 * @param {string} connectionId - 연결 ID
 */
function updateActivity(connectionId) {
  const conn = activeConnections.get(connectionId);
  if (conn) {
    conn.lastActivityAt = new Date().toISOString();
  }
}

/**
 * 특정 연결 강제 종료
 * @param {string} connectionId - 연결 ID
 * @returns {boolean} 종료 성공 여부
 */
function terminateConnection(connectionId) {
  const conn = activeConnections.get(connectionId);
  if (conn && conn.ws) {
    try {
      conn.ws.close(1000, '관리자에 의해 종료됨');
      conn.status = 'disconnected';
      conn.disconnectedAt = new Date().toISOString();
      console.log(`[ConnectionManager] 연결 강제 종료: ${connectionId}`);
      return true;
    } catch (err) {
      console.error(`[ConnectionManager] 연결 종료 실패: ${connectionId}`, err);
      return false;
    }
  }
  return false;
}


/**
 * 플러그인 요청 ID와 연결된 모든 WebSocket 연결을 강제 종료
 * @param {number|string} pluginRequestId - 플러그인 요청 ID
 * @returns {number} 종료한 연결 수
 */
function terminatePluginConnections(pluginRequestId) {
  let terminatedCount = 0;
  const normalizedId = String(pluginRequestId);

  for (const [connectionId, conn] of activeConnections.entries()) {
    if (String(conn.pluginRequestId) === normalizedId && conn.status === 'connected') {
      if (terminateConnection(connectionId)) {
        terminatedCount += 1;
      }
    }
  }

  return terminatedCount;
}

/**
 * 모든 연결 강제 종료
 */
function terminateAllConnections() {
  for (const [connectionId, conn] of activeConnections.entries()) {
    if (conn.ws && conn.status === 'connected') {
      try {
        conn.ws.close(1000, '서버 종료로 인해 모든 연결 종료');
        conn.status = 'disconnected';
        conn.disconnectedAt = new Date().toISOString();
      } catch (err) {
        console.error(`[ConnectionManager] 연결 종료 실패: ${connectionId}`, err);
      }
    }
  }
  console.log(`[ConnectionManager] 모든 연결 종료됨 (${activeConnections.size}개)`);
}

/**
 * 연결 통계 정보 조회
 * @returns {Object} 통계 정보
 */
function getConnectionStats() {
  const connections = getAllConnections();
  const totalConnections = activeConnections.size;
  const connectedCount = connections.length;
  
  // 브라우저별 통계
  const browserStats = {};
  connections.forEach(conn => {
    const browser = conn.browserName || getBrowserFromUserAgent(conn.userAgent);
    if (browser) {
      browserStats[browser] = (browserStats[browser] || 0) + 1;
    }
  });
  
  return {
    totalConnections,
    connectedCount,
    disconnectedCount: totalConnections - connectedCount,
    browserStats,
    byExtension: connections.filter(c => c.extensionId).length,
    byBrowser: connections.filter(c => !c.extensionId).length
  };
}

/**
 * User-Agent에서 브라우저 이름 추출
 * @param {string} userAgent - User-Agent 문자열
 * @returns {string} 브라우저 이름
 */
function getBrowserFromUserAgent(userAgent) {
  if (!userAgent) return 'Unknown';
  
  const ua = userAgent.toLowerCase();
  if (ua.includes('opera') || ua.includes('opr')) return 'Opera';
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('edge')) return 'Edge';
  return 'Unknown';
}

/**
 * WebSocket 서버에 연결 이벤트 리스너 등록
 * @param {WebSocketServer} wss - WebSocket 서버 인스턴스
 */
function setupConnectionTracking(wss) {
  wss.on('connection', (ws, req) => {
    // 연결 정보 추출 (verifyClient에서 이미 인증된 경우)
    const connectionInfo = {
      isAuthenticated: true, // verifyClient를 통과한 경우
      pluginRequestId: req.pluginRequestId // verifyClient에서 설정
    };
    
    // 연결 등록
    const connectionId = registerConnection(ws, req, connectionInfo);
    
    // 메시지 수신 시 활동 로그 업데이트
    ws.on('message', () => {
      updateActivity(connectionId);
    });
    
    // 연결 종료 시 연결 정보 제거
    ws.on('close', () => {
      unregisterConnection(ws);
    });
    
    // 오류 시 연결 정보 제거
    ws.on('error', () => {
      unregisterConnection(ws);
    });
  });
}

module.exports = {
  registerConnection,
  unregisterConnection,
  getAllConnections,
  getConnection,
  updateActivity,
  terminateConnection,
  terminatePluginConnections,
  terminateAllConnections,
  getConnectionStats,
  setupConnectionTracking,
  activeConnections // 테스트용 접 బహ정
};
