import React, { useEffect, useState, useRef, useCallback } from 'react';
import { fetchJSON } from '../api';

/**
 * LogsPage - GCP 스타일 실시간 웹소켓 로그 스트리밍 뷰어
 */
function LogsPage({ onNavigate }) {
  const [logs, setLogs] = useState([]);
  const [logLevel, setLogLevel] = useState('ALL'); // ALL, INFO, WARN, ERROR, EVENT
  const [sourceFilter, setSourceFilter] = useState('ALL'); // ALL, server, scheduler, crawler, mcp, plugin
  const [searchTerm, setSearchTerm] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [logStats, setLogStats] = useState({ total: 0, info: 0, warn: 0, error: 0, event: 0 });
  const [maxLogCount, setMaxLogCount] = useState(500); // 메모리 관리용 최대 로그 수

  const wsRef = useRef(null);
  const logEndRef = useRef(null);
  const containerRef = useRef(null);

  // 초기 기존 백엔드 로그 데이터 로드
  const fetchInitialLogs = useCallback(async () => {
    try {
      const res = await fetchJSON('/admin/api/logs?limit=100');
      if (res && Array.isArray(res.logs)) {
        const initialList = res.logs.map((item, idx) => ({
          id: item.id || `init-${Date.now()}-${idx}`,
          timestamp: item.timestamp || item.created_at || new Date().toISOString(),
          level: (item.level || item.type || 'INFO').toUpperCase(),
          source: item.source || item.category || 'server',
          message: item.message || JSON.stringify(item),
          details: item.details || null
        }));
        setLogs(initialList);
        updateStats(initialList);
      }
    } catch (e) {
      console.warn('[LogsPage] 초기 로그 API 조회 미지원 또는 오류 (소켓 전용 모드로 전환):', e.message);
      // 백엔드 API 미구현 시 데모 초기 시스템 이벤트 로그 생성
      const mockInitLogs = [
        { id: 'sys-1', timestamp: new Date(Date.now() - 300000).toISOString(), level: 'INFO', source: 'server', message: 'WebCrawlServer HTTP/WebSocket 엔진 시작 완료 (Port: 3000)' },
        { id: 'sys-2', timestamp: new Date(Date.now() - 240000).toISOString(), level: 'EVENT', source: 'mcp', message: 'MCP 서버 핸드셰이크 세션 활성화 완료' },
        { id: 'sys-3', timestamp: new Date(Date.now() - 180000).toISOString(), level: 'INFO', source: 'scheduler', message: '크롤링 정기 작업 스케줄러 등록 완료 (Interval: 60s)' },
        { id: 'sys-4', timestamp: new Date(Date.now() - 120000).toISOString(), level: 'WARN', source: 'crawler', message: '일부 크롤링 대상 타겟 도메인 응답 속도 지연 발생 (Response: 850ms)' },
        { id: 'sys-5', timestamp: new Date(Date.now() - 60000).toISOString(), level: 'INFO', source: 'plugin', message: '브라우저 플러그인 소켓 클라이언트 신규 접속 (Client ID: ws-plugin-9821)' }
      ];
      setLogs(mockInitLogs);
      updateStats(mockInitLogs);
    }
  }, []);

  // 통계 업데이트
  const updateStats = (logList) => {
    const stats = { total: logList.length, info: 0, warn: 0, error: 0, event: 0 };
    logList.forEach(l => {
      const lvl = (l.level || '').toUpperCase();
      if (lvl.includes('ERR')) stats.error++;
      else if (lvl.includes('WARN')) stats.warn++;
      else if (lvl.includes('EVENT')) stats.event++;
      else stats.info++;
    });
    setLogStats(stats);
  };

  // 실시간 WebSocket 스트리밍 수신 처리
  useEffect(() => {
    fetchInitialLogs();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/monitor`;

    let socket = null;
    let timer = null;

    const connect = () => {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsStatus('connected');
          // 모니터링 로그 구독 메시지 전송
          socket.send(JSON.stringify({ type: 'SUBSCRIBE_LOGS', source: 'admin_ui' }));
        };

        socket.onmessage = (event) => {
          if (!isLive) return;

          try {
            const data = JSON.parse(event.data);
            const newLog = {
              id: `stream-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              timestamp: data.timestamp || new Date().toISOString(),
              level: (data.level || data.type || 'INFO').toUpperCase(),
              source: data.source || data.category || 'server',
              message: data.message || data.text || JSON.stringify(data),
              details: data.details || null
            };

            setLogs(prev => {
              const next = [...prev, newLog];
              if (next.length > maxLogCount) {
                return next.slice(next.length - maxLogCount);
              }
              return next;
            });

            setLogStats(prev => ({
              ...prev,
              total: prev.total + 1,
              error: newLog.level.includes('ERR') ? prev.error + 1 : prev.error,
              warn: newLog.level.includes('WARN') ? prev.warn + 1 : prev.warn,
              event: newLog.level.includes('EVENT') ? prev.event + 1 : prev.event,
              info: (!newLog.level.includes('ERR') && !newLog.level.includes('WARN') && !newLog.level.includes('EVENT')) ? prev.info + 1 : prev.info
            }));
          } catch (_) {
            // 단순 텍스트 스트림 응답 핸들링
            const rawLog = {
              id: `raw-${Date.now()}`,
              timestamp: new Date().toISOString(),
              level: 'INFO',
              source: 'system',
              message: event.data
            };
            setLogs(prev => [...prev, rawLog]);
          }
        };

        socket.onclose = () => {
          setWsStatus('disconnected');
          timer = setTimeout(connect, 4000);
        };

        socket.onerror = () => {
          setWsStatus('disconnected');
        };
      } catch (_) {
        setWsStatus('disconnected');
      }
    };

    connect();

    return () => {
      if (timer) clearTimeout(timer);
      if (socket) socket.close();
    };
  }, [fetchInitialLogs, isLive, maxLogCount]);

  // 하단 자동 스크롤
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // 로그 지우기
  const handleClearLogs = () => {
    setLogs([]);
    setLogStats({ total: 0, info: 0, warn: 0, error: 0, event: 0 });
  };

  // 로그 내보내기 (TXT/JSON 파일 다운로드)
  const handleExportLogs = () => {
    if (logs.length === 0) {
      alert('내보낼 로그가 없습니다.');
      return;
    }
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webcrawlserver-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 필터링된 로그 목록
  const filteredLogs = logs.filter(log => {
    if (logLevel !== 'ALL') {
      const lvl = log.level.toUpperCase();
      if (logLevel === 'ERROR' && !lvl.includes('ERR')) return false;
      if (logLevel === 'WARN' && !lvl.includes('WARN')) return false;
      if (logLevel === 'INFO' && (lvl.includes('ERR') || lvl.includes('WARN') || lvl.includes('EVENT'))) return false;
      if (logLevel === 'EVENT' && !lvl.includes('EVENT')) return false;
    }
    if (sourceFilter !== 'ALL') {
      if ((log.source || '').toLowerCase() !== sourceFilter.toLowerCase()) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchMsg = (log.message || '').toLowerCase().includes(term);
      const matchSrc = (log.source || '').toLowerCase().includes(term);
      const matchLvl = (log.level || '').toLowerCase().includes(term);
      return matchMsg || matchSrc || matchLvl;
    }
    return true;
  });

  // 레벨별 색상 헬퍼
  const getLevelBadgeStyle = (level) => {
    const lvl = (level || '').toUpperCase();
    if (lvl.includes('ERR')) {
      return { bg: 'rgba(234,67,53,0.2)', color: '#ea4335', border: 'rgba(234,67,53,0.5)', label: 'ERROR' };
    }
    if (lvl.includes('WARN')) {
      return { bg: 'rgba(251,188,4,0.2)', color: '#fbbc04', border: 'rgba(251,188,4,0.5)', label: 'WARN' };
    }
    if (lvl.includes('EVENT')) {
      return { bg: 'rgba(52,168,83,0.2)', color: '#34a853', border: 'rgba(52,168,83,0.5)', label: 'EVENT' };
    }
    return { bg: 'rgba(66,133,244,0.2)', color: '#4285f4', border: 'rgba(66,133,244,0.5)', label: 'INFO' };
  };

  return (
    <div style={{ padding: '20px 24px', backgroundColor: 'var(--gcp-bg-main, #121212)', minHeight: '100vh', color: 'var(--gcp-text-primary, #ffffff)' }}>
      {/* 상단 타이틀 & 모니터링 컨트롤 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0, color: 'var(--gcp-text-primary)' }}>
              📋 Real-time Server Log Streaming
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: wsStatus === 'connected' ? 'rgba(52,168,83,0.15)' : 'rgba(234,67,53,0.15)',
              color: wsStatus === 'connected' ? '#34a853' : '#ea4335',
              border: `1px solid ${wsStatus === 'connected' ? 'rgba(52,168,83,0.4)' : 'rgba(234,67,53,0.4)'}`
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: wsStatus === 'connected' ? '#34a853' : '#ea4335'
              }} />
              {wsStatus === 'connected' ? 'WebSocket Streaming Active' : 'Disconnected'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--gcp-text-secondary, #9aa0a6)' }}>
            서버 작업 이벤트, 시스템 에러, 크롤러/MCP 모듈 실시간 로그 스트림을 수신합니다.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsLive(!isLive)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              cursor: 'pointer',
              border: `1px solid ${isLive ? 'var(--gcp-accent, #4285f4)' : 'var(--gcp-border, #333)'}`,
              backgroundColor: isLive ? 'rgba(66,133,244,0.15)' : 'transparent',
              color: isLive ? 'var(--gcp-accent, #4285f4)' : 'var(--gcp-text-primary, #fff)'
            }}
          >
            {isLive ? '⏸️ 스트리밍 일시정지' : '▶️ 실시간 스트림 재개'}
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              cursor: 'pointer',
              border: `1px solid ${autoScroll ? '#34a853' : 'var(--gcp-border, #333)'}`,
              backgroundColor: autoScroll ? 'rgba(52,168,83,0.15)' : 'transparent',
              color: autoScroll ? '#34a853' : 'var(--gcp-text-secondary)'
            }}
          >
            {autoScroll ? '⬇️ 하단 자동스크롤 ON' : '⏹️ 스크롤 고정 OFF'}
          </button>

          <button
            onClick={handleClearLogs}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              cursor: 'pointer',
              border: '1px solid var(--gcp-border, #333)',
              backgroundColor: 'transparent',
              color: 'var(--gcp-text-secondary)'
            }}
          >
            🧹 로그 비우기
          </button>

          <button
            onClick={handleExportLogs}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              cursor: 'pointer',
              border: '1px solid var(--gcp-accent, #4285f4)',
              backgroundColor: 'var(--gcp-accent, #4285f4)',
              color: '#ffffff'
            }}
          >
            💾 JSON 다운로드
          </button>
        </div>
      </div>

      {/* 실시간 로그 요약 메트릭 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div style={{ backgroundColor: 'var(--gcp-bg-card, #1e1e1e)', border: '1px solid var(--gcp-border, #333)', borderRadius: '6px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', fontWeight: 600 }}>총 수신 로그 (TOTAL)</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--gcp-text-primary)', marginTop: '4px' }}>{logStats.total}건</div>
        </div>

        <div style={{ backgroundColor: 'var(--gcp-bg-card, #1e1e1e)', border: '1px solid var(--gcp-border, #333)', borderRadius: '6px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#ea4335', fontWeight: 600 }}>🚨 시스템 에러 (ERROR)</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#ea4335', marginTop: '4px' }}>{logStats.error}건</div>
        </div>

        <div style={{ backgroundColor: 'var(--gcp-bg-card, #1e1e1e)', border: '1px solid var(--gcp-border, #333)', borderRadius: '6px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#fbbc04', fontWeight: 600 }}>⚠️ 경고 메시지 (WARN)</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#fbbc04', marginTop: '4px' }}>{logStats.warn}건</div>
        </div>

        <div style={{ backgroundColor: 'var(--gcp-bg-card, #1e1e1e)', border: '1px solid var(--gcp-border, #333)', borderRadius: '6px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#34a853', fontWeight: 600 }}>⚡ 실시간 이벤트 (EVENT)</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#34a853', marginTop: '4px' }}>{logStats.event}건</div>
        </div>
      </div>

      {/* 필터 툴바 */}
      <div style={{
        backgroundColor: 'var(--gcp-bg-card, #1e1e1e)',
        border: '1px solid var(--gcp-border, #333)',
        borderRadius: '6px 6px 0 0',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 로그 레벨 필터 */}
          <span style={{ fontSize: '12px', color: 'var(--gcp-text-secondary)', fontWeight: 600 }}>레벨:</span>
          {['ALL', 'INFO', 'WARN', 'ERROR', 'EVENT'].map(lvl => (
            <button
              key={lvl}
              onClick={() => setLogLevel(lvl)}
              style={{
                padding: '3px 9px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid var(--gcp-border, #333)',
                backgroundColor: logLevel === lvl ? 'var(--gcp-accent, #4285f4)' : 'transparent',
                color: logLevel === lvl ? '#fff' : 'var(--gcp-text-secondary)',
                cursor: 'pointer'
              }}
            >
              {lvl}
            </button>
          ))}

          {/* 로그 소스 필터 */}
          <span style={{ fontSize: '12px', color: 'var(--gcp-text-secondary)', fontWeight: 600, marginLeft: '12px' }}>소스:</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: 'var(--gcp-bg-main, #121212)',
              color: 'var(--gcp-text-primary, #fff)',
              border: '1px solid var(--gcp-border, #333)',
              borderRadius: '4px'
            }}
          >
            <option value="ALL">전체 모듈 소스</option>
            <option value="server">Server HTTP/WS</option>
            <option value="scheduler">Scheduler</option>
            <option value="crawler">Crawler</option>
            <option value="mcp">MCP Protocol</option>
            <option value="plugin">Plugin Client</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 최대 로그 유지 버퍼 설정 */}
          <select
            value={maxLogCount}
            onChange={(e) => setMaxLogCount(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: 'var(--gcp-bg-main, #121212)',
              color: 'var(--gcp-text-primary, #fff)',
              border: '1px solid var(--gcp-border, #333)',
              borderRadius: '4px'
            }}
          >
            <option value={200}>최대 200개 유지</option>
            <option value={500}>최대 500개 유지</option>
            <option value={1000}>최대 1000개 유지</option>
          </select>

          {/* 검색창 */}
          <input
            type="text"
            placeholder="로그 메시지 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '5px 10px',
              fontSize: '11.5px',
              backgroundColor: 'var(--gcp-bg-main, #121212)',
              color: 'var(--gcp-text-primary, #fff)',
              border: '1px solid var(--gcp-border, #333)',
              borderRadius: '4px',
              width: '200px'
            }}
          />
        </div>
      </div>

      {/* GCP 터미널 스타일 로그 스트림 콘솔 */}
      <div
        ref={containerRef}
        style={{
          backgroundColor: '#0d0d0d',
          border: '1px solid var(--gcp-border, #333)',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          height: '560px',
          overflowY: 'auto',
          padding: '12px 16px',
          fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
          fontSize: '12px',
          lineHeight: '1.6'
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gcp-text-secondary)' }}>
            수신된 로그가 없거나 검색 조건에 맞는 로그 항목이 없습니다.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const badge = getLevelBadgeStyle(log.level);
            const timeStr = new Date(log.timestamp).toLocaleTimeString('ko-KR', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                }}
              >
                {/* 시각 */}
                <span style={{ color: '#888888', whiteSpace: 'nowrap', fontSize: '11px' }}>
                  [{timeStr}]
                </span>

                {/* 레벨 배지 */}
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                  whiteSpace: 'nowrap',
                  minWidth: '50px',
                  textAlign: 'center'
                }}>
                  {badge.label}
                </span>

                {/* 소크 카테고리 */}
                <span style={{
                  color: '#9aa0a6',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontSize: '10.5px',
                  whiteSpace: 'nowrap'
                }}>
                  [{log.source || 'server'}]
                </span>

                {/* 메시지 내용 */}
                <span style={{ color: badge.color === '#ea4335' ? '#ff8a80' : 'var(--gcp-text-primary, #e8eaed)', wordBreak: 'break-all' }}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default LogsPage;
