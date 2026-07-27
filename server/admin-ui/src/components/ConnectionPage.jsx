import React, { useState, useEffect, useCallback } from 'react';
import { fetchJSON } from '../api';

function ConnectionPage({ onNavigate }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // 5초

  // 서버 WebSocket URL
  const serverPort = window.location.port || '9600';
  const wsUrl = `ws://${window.location.hostname}:${serverPort}`;

  // 연결 정보 조회
  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // WebSocket에 연결된 클라이언트 정보 조회
      const data = await fetchJSON('/admin/api/connections');
      setConnections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ConnectionPage] 연결 정보 조회 실패:', err);
      setError('연결 정보 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 자동 새로고침 설정
  useEffect(() => {
    let interval;
    
    if (autoRefresh) {
      loadConnections(); // 초기 로드
      interval = setInterval(() => {
        loadConnections();
      }, refreshInterval * 1000);
    } else {
      loadConnections(); // 자동 새로고침 비활성화 시에도 한번 로드
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, loadConnections]);

  // 연결 종료 처리
  const handleTerminateConnection = async (connectionId) => {
    if (!window.confirm('이 연결을 종료하시겠습니까?')) return;
    
    try {
      await fetchJSON(`/admin/api/connections/${connectionId}/terminate`, { method: 'POST' });
      await loadConnections();
    } catch (err) {
      console.error('[ConnectionPage] 연결 종료 실패:', err);
      alert(`연결 종료 실패: ${err.message}`);
    }
  };

  //브라우저 아이콘 가져오기
  const getBrowserIcon = (userAgent) => {
    if (!userAgent) return '🌐';
    
    const userAgentLower = userAgent.toLowerCase();
    if (userAgentLower.includes('opera') || userAgentLower.includes('opr')) return '🎭';
    if (userAgentLower.includes('chrome')) return '🌐';
    if (userAgentLower.includes('firefox')) return '🦊';
    if (userAgentLower.includes('safari')) return '🍎';
    if (userAgentLower.includes('edge')) return '🪟';
    return '🌐';
  };

  // 브라우저 이름 추출
  const getBrowserName = (userAgent) => {
    if (!userAgent) return '알 수 없음';
    
    const userAgentLower = userAgent.toLowerCase();
    if (userAgentLower.includes('opera') || userAgentLower.includes('opr')) return 'Opera';
    if (userAgentLower.includes('chrome')) return 'Chrome';
    if (userAgentLower.includes('firefox')) return 'Firefox';
    if (userAgentLower.includes('safari')) return 'Safari';
    if (userAgentLower.includes('edge')) return 'Edge';
    return '알 수 없음';
  };

  // 브라우저 버전 추출
  const getBrowserVersion = (userAgent) => {
    if (!userAgent) return '';
    
    const chromeMatch = userAgent.match(/Chrome\/(\d+\.\d+)/);
    if (chromeMatch) return chromeMatch[1];
    
    const firefoxMatch = userAgent.match(/Firefox\/(\d+\.\d+)/);
    if (firefoxMatch) return firefoxMatch[1];
    
    const operaMatch = userAgent.match(/(Opera|OPR)\/(\d+\.\d+)/);
    if (operaMatch) return operaMatch[2];
    
    const safariMatch = userAgent.match(/Version\/(\d+\.\d+)/);
    if (safariMatch) return safariMatch[1];
    
    return '';
  };

  // 로그인 상태 표시
  const getLoginStatus = (connection) => {
    if (connection.isAuthenticated === true) return '✅ 로그인 됨';
    if (connection.isAuthenticated === false) return '❌ 미로그인';
    return '⚪ 확인 중';
  };

  // 연결 상태 스타일
  const getStatusStyle = (status) => {
    switch (status) {
      case 'connected':
        return { color: 'var(--gcp-status-green)', fontWeight: 600 };
      case 'disconnected':
        return { color: 'var(--gcp-status-red)', fontWeight: 600 };
      case 'connecting':
        return { color: 'var(--gcp-status-yellow)', fontWeight: 600 };
      default:
        return { color: 'var(--gcp-text-secondary)' };
    }
  };

  // 연결 지속 시간 계산
  const getDuration = (connectedAt) => {
    if (!connectedAt) return '—';
    
    const connectedDate = new Date(connectedAt);
    const now = new Date();
    const seconds = Math.floor((now - connectedDate) / 1000);
    
    if (seconds < 60) return `${seconds}초 전`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
    return `${Math.floor(seconds / 86400)}일 전`;
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* 상단 헤더 */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--gcp-text-primary)' }}>
            📡 접속 관리
          </h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
            현재 서버에 연결된 모든 장비와 플러그인을 실시간으로 모니터링합니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="gcp-btn gcp-btn-secondary"
            onClick={loadConnections}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {loading ? '⏳' : '🔄'} 새로고침
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ marginRight: '4px' }}
              />
              자동 새로고침
            </label>
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                style={{ 
                  padding: '4px 8px', 
                  fontSize: '12px', 
                  backgroundColor: 'var(--gcp-bg-main)',
                  color: 'var(--gcp-text-primary)',
                  border: '1px solid var(--gcp-border)',
                  borderRadius: '4px'
                }}
              >
                <option value={3}>3초</option>
                <option value={5}>5초</option>
                <option value={10}>10초</option>
                <option value={30}>30초</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* 서버 연결 정보 패널 */}
      <div style={{
        backgroundColor: 'var(--gcp-bg-card)', 
        border: '1px solid var(--gcp-border)',
        borderRadius: '4px', 
        padding: '14px 16px', 
        marginBottom: '16px'
      }}>
        <div style={{ 
          fontWeight: 600, 
          fontSize: '11px', 
          color: 'var(--gcp-text-secondary)', 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px', 
          marginBottom: '10px' 
        }}>
          📡 서버 연결 정보
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', borderRadius: '4px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', marginBottom: '4px' }}>WebSocket URL</div>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--gcp-accent)', fontWeight: 600 }}>
              {wsUrl}
            </div>
          </div>
          <div style={{ backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', borderRadius: '4px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', marginBottom: '4px' }}>현재 연결 수</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: connections.length > 0 ? 'var(--gcp-status-green)' : 'var(--gcp-text-primary)' }}>
              {connections.length} 개
            </div>
          </div>
          <div style={{ backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', borderRadius: '4px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', marginBottom: '4px' }}>서버 상태</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gcp-status-green)' }}>
              ✅ 정상 작동
            </div>
          </div>
        </div>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(234,67,53,0.1)', 
          border: '1px solid var(--gcp-status-red)',
          borderRadius: '4px', 
          padding: '10px 14px', 
          marginBottom: '12px',
          fontSize: '12px', 
          color: 'var(--gcp-status-red)'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 연결 목록 테이블 */}
      <div style={{
        backgroundColor: 'var(--gcp-bg-card)', 
        border: '1px solid var(--gcp-border)',
        borderRadius: '4px', 
        overflow: 'hidden'
      }}>
        <table className="gcp-table">
          <thead>
            <tr>
              <th style={{ width: '32px' }}>상태</th>
              <th style={{ width: '48px' }}>아이콘</th>
              <th style={{ width: '120px' }}>브라우저</th>
              <th style={{ width: '100px' }}>버전</th>
              <th>장비 정보</th>
              <th style={{ width: '120px' }}>IP 주소</th>
              <th style={{ width: '120px' }}>연결 시간</th>
              <th style={{ width: '100px' }}>로그인 상태</th>
              <th style={{ width: '100px', textAlign: 'right' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {connections.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--gcp-text-secondary)', fontSize: '13px' }}>
                  {loading ? '⏳ 불러오는 중...' : '현재 연결된 장치가 없습니다.'}
                </td>
              </tr>
            ) : (
              connections.map((conn) => (
                <tr key={conn.connectionId || conn.id}>
                  <td>
                    <span style={getStatusStyle(conn.status)}>
                      {conn.status === 'connected' ? '●' : conn.status === 'disconnected' ? '○' : '◐'}
                    </span>
                  </td>
                  <td style={{ fontSize: '18px' }}>
                    {getBrowserIcon(conn.userAgent)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--gcp-text-primary)' }}>
                      {getBrowserName(conn.userAgent)}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>
                    {getBrowserVersion(conn.userAgent) || '—'}
                  </td>
                  <td>
                    <div style={{ fontSize: '11.5px', color: 'var(--gcp-text-primary)' }}>
                      {conn.hostname || conn.extensionId || '알 수 없음'}
                    </div>
                    {conn.extensionId && (
                      <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--gcp-text-secondary)' }}>
                        ID: {conn.extensionId.slice(0, 20)}...
                      </div>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>
                    {conn.ipAddress || conn.clientIp || '—'}
                  </td>
                  <td style={{ fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>
                    {getDuration(conn.connectedAt)}
                  </td>
                  <td style={{ fontSize: '11.5px' }}>
                    <span style={getStatusStyle(conn.isAuthenticated ? 'connected' : 'disconnected')}>
                      {getLoginStatus(conn)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="gcp-btn gcp-btn-secondary"
                      style={{ padding: '3px 10px', fontSize: '11px', color: 'var(--gcp-status-red)', borderColor: 'var(--gcp-status-red)' }}
                      onClick={() => handleTerminateConnection(conn.connectionId || conn.id)}
                    >
                      ⛔ 연결 종료
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 도움말 */}
      <div style={{
        marginTop: '16px', 
        fontSize: '11.5px', 
        color: 'var(--gcp-text-secondary)', 
        lineHeight: '1.6'
      }}>
        <p>
          <strong style={{ color: 'var(--gcp-text-primary)' }}>접속 관리</strong>는 현재 서버에 WebSocket으로 연결된 모든 장치와 브라우저 플러그인을 실시간으로 모니터링합니다.
        </p>
        <p>
          플러그인이 서버에 연결을 요청하면 이 페이지에서 연결 상태, 브라우저 정보, 로그인 여부 등을 확인할 수 있습니다.
        </p>
        <p>
          <strong style={{ color: 'var(--gcp-text-primary)' }}>자동 새로고침</strong>을 활성화하면 설정된 간격으로 연결 목록이 자동으로 업데이트됩니다.
        </p>
      </div>
    </div>
  );
}

export default ConnectionPage;
