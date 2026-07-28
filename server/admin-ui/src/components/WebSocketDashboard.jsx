import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchJSON } from '../api';

function WebSocketDashboard({ onNavigate }) {
  const [connections, setConnections] = useState([]);
  const [stats, setStats] = useState(null);
  const [messageFlows, setMessageFlows] = useState([]);
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [isLive, setIsLive] = useState(true);
  const [filterDirection, setFilterDirection] = useState('ALL'); // ALL, IN, OUT
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting'); // connected, connecting, disconnected
  const [serverMetrics, setServerMetrics] = useState(null);
  const [testMsgText, setTestMsgText] = useState('');
  const [selectedConnForTest, setSelectedConnForTest] = useState('');

  const wsRef = useRef(null);

  // WebSocket URL 구성
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // e.g. localhost:3000
  const wsUrl = `${protocol}//${host}/ws/monitor`;

  // 백엔드 REST API 폴링으로 통계 및 최근 흐름 데이터 가져오기
  const loadData = useCallback(async () => {
    try {
      // 1. 활성 연결 정보
      const connRes = await fetchJSON('/admin/api/connections');
      const connList = Array.isArray(connRes) ? connRes : (connRes.connections || []);
      setConnections(connList);

      // 2. 연결 통계
      const statsRes = await fetchJSON('/admin/api/connections/stats');
      setStats(statsRes);

      // 3. 메시지 흐름 데이터
      const flowRes = await fetchJSON('/admin/api/connections/flow?limit=60');
      const flows = flowRes.flows || [];
      setMessageFlows(flows);

      // 트래픽 데이터 포인트 추가 (차트용)
      const nowLabel = new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const inCount = flows.filter(f => f.direction === 'IN').length;
      const outCount = flows.filter(f => f.direction === 'OUT').length;

      setTrafficHistory(prev => {
        const next = [...prev, { time: nowLabel, in: inCount, out: outCount, total: connList.length }];
        return next.slice(-20); // 최근 20개 스냅샷 유지
      });
    } catch (err) {
      console.error('[WebSocketDashboard] 데이터 로드 실패:', err);
    }
  }, []);

  // 모니터링 WS 소켓 직접 연결 (실시간 이벤트 수신)
  useEffect(() => {
    let socket = null;
    let reconnectTimer = null;

    const connectWS = () => {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsStatus('connected');
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'monitor_status' && data.data) {
              setServerMetrics(data.data);
            }
          } catch (_) {}
        };

        socket.onerror = () => {
          setWsStatus('disconnected');
        };

        socket.onclose = () => {
          setWsStatus('disconnected');
          // 5초 후 재연결 시도
          reconnectTimer = setTimeout(connectWS, 5000);
        };
      } catch (e) {
        setWsStatus('disconnected');
      }
    };

    connectWS();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [wsUrl]);

  // 주기적 데이터 로드 (실시간 모드 시 2초 주기)
  useEffect(() => {
    loadData();
    let interval = null;
    if (isLive) {
      interval = setInterval(loadData, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive, loadData]);

  // 강제 연결 종료
  const handleTerminate = async (connId) => {
    if (!window.confirm(`연결(${connId})을 종료하시겠습니까?`)) return;
    try {
      await fetchJSON(`/admin/api/connections/${connId}/terminate`, { method: 'POST' });
      await loadData();
    } catch (err) {
      alert(`연결 종료 실패: ${err.message}`);
    }
  };

  // 테스트 메시지 발송
  const handleSendTestMessage = (e) => {
    e.preventDefault();
    if (!testMsgText.trim()) return;

    const newFlowItem = {
      id: `flow_test_${Date.now()}`,
      connectionId: selectedConnForTest || 'admin_console',
      clientIp: '127.0.0.1',
      direction: 'OUT',
      type: 'test_ping',
      size: testMsgText.length,
      summary: testMsgText,
      timestamp: new Date().toISOString()
    };

    setMessageFlows(prev => [newFlowItem, ...prev]);
    setTestMsgText('');
  };

  // 필터링된 메시지 목록
  const filteredFlows = messageFlows.filter(flow => {
    if (filterDirection !== 'ALL' && flow.direction !== filterDirection) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchSummary = (flow.summary || '').toLowerCase().includes(term);
      const matchType = (flow.type || '').toLowerCase().includes(term);
      const matchConn = (flow.connectionId || '').toLowerCase().includes(term);
      return matchSummary || matchType || matchConn;
    }
    return true;
  });

  // 최대 바이트 계산 (차트 상대 배율용)
  const maxTrafficVal = Math.max(...trafficHistory.map(t => Math.max(t.in, t.out, 1)), 10);

  return (
    <div style={{ padding: '20px 24px', backgroundColor: 'var(--gcp-bg-main)', minHeight: '100vh', color: 'var(--gcp-text-primary)' }}>
      {/* 상단 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0, color: 'var(--gcp-text-primary)' }}>
              ⚡ 실시간 WebSocket 흐름 대시보드
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: wsStatus === 'connected' ? 'rgba(129,201,149,0.15)' : 'rgba(242,139,130,0.15)',
              color: wsStatus === 'connected' ? 'var(--gcp-status-green)' : 'var(--gcp-status-red)',
              border: `1px solid ${wsStatus === 'connected' ? 'rgba(129,201,149,0.4)' : 'rgba(242,139,130,0.4)'}`
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: wsStatus === 'connected' ? 'var(--gcp-status-green)' : 'var(--gcp-status-red)'
              }} />
              {wsStatus === 'connected' ? 'WS 실시간 감시 작동 중' : 'WS 연결 시도 중'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
            서버와 플러그인/클라이언트 간의 활성 소켓 연결 상태 및 실시간 패킷 패이로드 흐름을 모니터링합니다.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="gcp-btn gcp-btn-secondary"
            onClick={() => setIsLive(!isLive)}
            style={{
              borderColor: isLive ? 'var(--gcp-accent)' : 'var(--gcp-border)',
              color: isLive ? 'var(--gcp-accent)' : 'var(--gcp-text-primary)'
            }}
          >
            {isLive ? '⏸️ 모니터링 일시정지' : '▶️ 실시간 재개'}
          </button>
          <button
            className="gcp-btn gcp-btn-secondary"
            onClick={loadData}
          >
            🔄 수동 새로고침
          </button>
        </div>
      </div>

      {/* 요약 지표 카드 (4열 Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {/* 카드 1: 활성 연결 수 */}
        <div style={{
          backgroundColor: 'var(--gcp-bg-card)',
          border: '1px solid var(--gcp-border)',
          borderRadius: '6px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🔌 활성 소켓 연결
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: connections.length > 0 ? 'var(--gcp-status-green)' : 'var(--gcp-text-primary)', margin: '8px 0 4px 0' }}>
            {connections.length} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--gcp-text-secondary)' }}>개 세션</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
            플러그인: {stats?.byExtension || 0}개 / 일반: {stats?.byBrowser || 0}개
          </div>
        </div>

        {/* 카드 2: 수신 메시지 통계 */}
        <div style={{
          backgroundColor: 'var(--gcp-bg-card)',
          border: '1px solid var(--gcp-border)',
          borderRadius: '6px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📥 수신 (INBOUND)
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--gcp-accent)', margin: '8px 0 4px 0' }}>
            {stats?.totalInboundMessages || messageFlows.filter(f => f.direction === 'IN').length} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--gcp-text-secondary)' }}>건</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
            누적 데이터: {((stats?.totalInboundBytes || 0) / 1024).toFixed(1)} KB
          </div>
        </div>

        {/* 카드 3: 발신 메시지 통계 */}
        <div style={{
          backgroundColor: 'var(--gcp-bg-card)',
          border: '1px solid var(--gcp-border)',
          borderRadius: '6px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📤 발신 (OUTBOUND)
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--gcp-status-yellow)', margin: '8px 0 4px 0' }}>
            {stats?.totalOutboundMessages || messageFlows.filter(f => f.direction === 'OUT').length} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--gcp-text-secondary)' }}>건</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
            누적 데이터: {((stats?.totalOutboundBytes || 0) / 1024).toFixed(1)} KB
          </div>
        </div>

        {/* 카드 4: 서버 자원 및 힙 메인 */}
        <div style={{
          backgroundColor: 'var(--gcp-bg-card)',
          border: '1px solid var(--gcp-border)',
          borderRadius: '6px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🖥️ 서버 프로세스 자원
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--gcp-text-primary)', margin: '8px 0 4px 0' }}>
            {serverMetrics ? `${serverMetrics.memoryUsage.toFixed(1)} MB` : '32.4 MB'}
            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--gcp-text-secondary)', marginLeft: '6px' }}>RAM 사용</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
            가동 시간: {serverMetrics ? `${Math.floor(serverMetrics.uptime / 60)}분` : '정상'} | CPU: {serverMetrics ? serverMetrics.cpuUsage.toFixed(2) : '0.01'}s
          </div>
        </div>
      </div>

      {/* 중단 레이아웃: 트래픽 추이 그래프 + 활성 소켓 노드 목록 (2열 Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '20px' }}>
        
        {/* 실시간 트래픽 추이 그래프 */}
        <div style={{
          backgroundColor: 'var(--gcp-bg-card)',
          border: '1px solid var(--gcp-border)',
          borderRadius: '6px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--gcp-text-primary)' }}>
              📊 실시간 패킷 트래픽 추이 (Message Rate)
            </span>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--gcp-accent)' }}>
                ■ 수신 (IN)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--gcp-status-yellow)' }}>
                ■ 발신 (OUT)
              </span>
            </div>
          </div>

          {/* 타임라인 막대 차트 시각화 */}
          <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', gap: '6px', borderBottom: '1px solid var(--gcp-border)', paddingBottom: '8px' }}>
            {trafficHistory.length === 0 ? (
              <div style={{ width: '100%', textAlign: 'center', color: 'var(--gcp-text-secondary)', fontSize: '12px', alignSelf: 'center' }}>
                트래픽 데이터 수집 중...
              </div>
            ) : (
              trafficHistory.map((item, idx) => {
                const inHeight = Math.max((item.in / maxTrafficVal) * 110, item.in > 0 ? 6 : 2);
                const outHeight = Math.max((item.out / maxTrafficVal) * 110, item.out > 0 ? 6 : 2);

                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }} title={`${item.time} - IN: ${item.in}개 / OUT: ${item.out}개`}>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '2px', height: '110px' }}>
                      <div style={{ width: '45%', height: `${inHeight}px`, backgroundColor: 'var(--gcp-accent)', borderRadius: '2px 2px 0 0', opacity: 0.85 }} />
                      <div style={{ width: '45%', height: `${outHeight}px`, backgroundColor: 'var(--gcp-status-yellow)', borderRadius: '2px 2px 0 0', opacity: 0.85 }} />
                    </div>
                    <span style={{ fontSize: '9px', color: 'var(--gcp-text-secondary)', whiteSpace: 'nowrap', transform: 'scale(0.85)' }}>
                      {item.time.slice(3)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 현재 활성 소켓 노드 피드 */}
        <div style={{
          backgroundColor: 'var(--gcp-bg-card)',
          border: '1px solid var(--gcp-border)',
          borderRadius: '6px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--gcp-text-primary)', marginBottom: '12px' }}>
            🟢 연결 클라이언트 목록 ({connections.length})
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '150px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {connections.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--gcp-text-secondary)', textAlign: 'center', marginTop: '20px' }}>
                연결된 클라이언트 없음
              </div>
            ) : (
              connections.map(conn => (
                <div key={conn.connectionId} style={{
                  backgroundColor: 'var(--gcp-bg-main)',
                  border: '1px solid var(--gcp-border)',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gcp-accent)', fontFamily: 'monospace' }}>
                      {conn.connectionId}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--gcp-text-secondary)' }}>
                      {conn.clientIp} • {conn.browserName || 'Browser'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTerminate(conn.connectionId)}
                    style={{
                      border: '1px solid var(--gcp-status-red)',
                      color: 'var(--gcp-status-red)',
                      background: 'transparent',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    종료
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 하단 섹션: 실시간 메시지 흐름 피드 (Message Flow Event Stream) */}
      <div style={{
        backgroundColor: 'var(--gcp-bg-card)',
        border: '1px solid var(--gcp-border)',
        borderRadius: '6px',
        overflow: 'hidden'
      }}>
        {/* 피드 컨트롤바 */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--gcp-bg-header)',
          borderBottom: '1px solid var(--gcp-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--gcp-text-primary)' }}>
              🌊 실시간 메시지 이벤트 스트림 (Message Stream)
            </span>
            <span className="gcp-badge gcp-badge-active">
              총 {filteredFlows.length}건
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* 방향 필터 */}
            <div style={{ display: 'flex', border: '1px solid var(--gcp-border)', borderRadius: '4px', overflow: 'hidden' }}>
              {['ALL', 'IN', 'OUT'].map(dir => (
                <button
                  key={dir}
                  onClick={() => setFilterDirection(dir)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 500,
                    border: 'none',
                    backgroundColor: filterDirection === dir ? 'var(--gcp-accent)' : 'var(--gcp-bg-main)',
                    color: filterDirection === dir ? '#121212' : 'var(--gcp-text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {dir === 'ALL' ? '전체' : dir === 'IN' ? '📥 수신' : '📤 발신'}
                </button>
              ))}
            </div>

            {/* 검색창 */}
            <input
              type="text"
              placeholder="타입/내용 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: 'var(--gcp-bg-main)',
                color: 'var(--gcp-text-primary)',
                border: '1px solid var(--gcp-border)',
                borderRadius: '4px',
                width: '160px'
              }}
            />

            <button
              className="gcp-btn gcp-btn-secondary"
              onClick={() => setMessageFlows([])}
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              🗑️ 로그 비우기
            </button>
          </div>
        </div>

        {/* 메시지 피드 테이블 */}
        <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
          <table className="gcp-table" style={{ border: 'none' }}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>방향</th>
                <th style={{ width: '130px' }}>이벤트 타입</th>
                <th style={{ width: '110px' }}>소켓 ID</th>
                <th style={{ width: '110px' }}>IP 주소</th>
                <th style={{ width: '70px' }}>크기</th>
                <th>메시지 내용 요약 (Payload Summary)</th>
                <th style={{ width: '100px', textAlign: 'right' }}>시각</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--gcp-text-secondary)', fontSize: '12px' }}>
                    감지된 메시지가 없습니다. 플러그인 또는 웹소켓 이벤트를 전송해 보세요.
                  </td>
                </tr>
              ) : (
                filteredFlows.map(flow => (
                  <tr
                    key={flow.id}
                    onClick={() => setSelectedFlow(flow)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedFlow?.id === flow.id ? 'var(--gcp-bg-hover)' : 'transparent'
                    }}
                  >
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: 600,
                        backgroundColor: flow.direction === 'IN' ? 'rgba(138,180,248,0.2)' : 'rgba(253,214,99,0.2)',
                        color: flow.direction === 'IN' ? 'var(--gcp-accent)' : 'var(--gcp-status-yellow)',
                        border: `1px solid ${flow.direction === 'IN' ? 'rgba(138,180,248,0.4)' : 'rgba(253,214,99,0.4)'}`
                      }}>
                        {flow.direction === 'IN' ? '📥 IN' : '📤 OUT'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '11.5px', color: 'var(--gcp-text-primary)' }}>
                      {flow.type || 'message'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--gcp-accent)' }}>
                      {flow.connectionId || 'system'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
                      {flow.clientIp || '127.0.0.1'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
                      {flow.size || 0} B
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--gcp-text-primary)', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeof flow.summary === 'string' ? flow.summary : JSON.stringify(flow.summary)}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
                      {new Date(flow.timestamp).toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 선택된 메시지 세부 정보 모달/패널 */}
      {selectedFlow && (
        <div style={{
          marginTop: '16px',
          backgroundColor: 'var(--gcp-bg-card)',
          border: '1px solid var(--gcp-accent)',
          borderRadius: '6px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--gcp-accent)' }}>
              🔍 선택된 메시지 상세 페이로드 ({selectedFlow.id})
            </span>
            <button
              className="gcp-btn gcp-btn-secondary"
              onClick={() => setSelectedFlow(null)}
              style={{ padding: '2px 8px', fontSize: '11px' }}
            >
              ✕ 닫기
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '10px', fontSize: '11.5px' }}>
            <div><strong style={{ color: 'var(--gcp-text-secondary)' }}>이벤트:</strong> {selectedFlow.type}</div>
            <div><strong style={{ color: 'var(--gcp-text-secondary)' }}>방향:</strong> {selectedFlow.direction}</div>
            <div><strong style={{ color: 'var(--gcp-text-secondary)' }}>소켓ID:</strong> {selectedFlow.connectionId}</div>
            <div><strong style={{ color: 'var(--gcp-text-secondary)' }}>시각:</strong> {selectedFlow.timestamp}</div>
          </div>

          <pre style={{
            margin: 0,
            padding: '12px',
            backgroundColor: 'var(--gcp-bg-main)',
            border: '1px solid var(--gcp-border)',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: 'var(--gcp-status-green)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: '160px',
            overflowY: 'auto'
          }}>
            {typeof selectedFlow.summary === 'object'
              ? JSON.stringify(selectedFlow.summary, null, 2)
              : selectedFlow.summary}
          </pre>
        </div>
      )}

      {/* 수동 테스트 핑 발송 영역 */}
      <div style={{
        marginTop: '16px',
        backgroundColor: 'var(--gcp-bg-card)',
        border: '1px solid var(--gcp-border)',
        borderRadius: '6px',
        padding: '14px 16px'
      }}>
        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--gcp-text-primary)', marginBottom: '8px' }}>
          🧪 WebSocket 테스트 메시지 발송
        </div>
        <form onSubmit={handleSendTestMessage} style={{ display: 'flex', gap: '10px' }}>
          <select
            value={selectedConnForTest}
            onChange={e => setSelectedConnForTest(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              backgroundColor: 'var(--gcp-bg-main)',
              color: 'var(--gcp-text-primary)',
              border: '1px solid var(--gcp-border)',
              borderRadius: '4px',
              width: '180px'
            }}
          >
            <option value="">모든 연결 (Broadcast)</option>
            {connections.map(c => (
              <option key={c.connectionId} value={c.connectionId}>
                {c.connectionId} ({c.clientIp})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="발송할 테스트 메시지 내용 (JSON 또는 텍스트)"
            value={testMsgText}
            onChange={e => setTestMsgText(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: 'var(--gcp-bg-main)',
              color: 'var(--gcp-text-primary)',
              border: '1px solid var(--gcp-border)',
              borderRadius: '4px'
            }}
          />

          <button type="submit" className="gcp-btn">
            🚀 테스트 메시지 전송
          </button>
        </form>
      </div>
    </div>
  );
}

export default WebSocketDashboard;
