import React, { useState, useEffect } from 'react';

function PluginRemoteTerminal() {
  const [logs, setLogs] = useState([
    { id: 1, type: 'info', time: '21:14:02', text: '[Plugin:Background] WebSocket MCP 연결 성공 (ws://localhost:9600)' },
    { id: 2, type: 'info', time: '21:14:03', text: '[Plugin:ContentScript] 활성 탭 DOM 매핑 준비 완료' },
    { id: 3, type: 'warn', time: '21:14:15', text: '[Plugin:Monitor] 메모리 사용량 42MB 감지' }
  ]);
  const [jsCode, setJsCode] = useState('document.title = "원격 주입 실행 완료";\nconsole.log("플러그인 터미널에서 주입된 코드입니다.");');
  const [selectedPlugin, setSelectedPlugin] = useState('Default Chrome Extension (ID: plugin_01)');

  const handleInjectJs = () => {
    if (!jsCode.trim()) return;
    const newLog = {
      id: Date.now(),
      type: 'inject',
      time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      text: `▶ JS Code Injected: ${jsCode.replace(/\n/g, ' ')}`
    };
    const resultLog = {
      id: Date.now() + 1,
      type: 'success',
      time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      text: `◀ [Execution Result]: { success: true, injectedLength: ${jsCode.length} }`
    };
    setLogs(prev => [...prev, newLog, resultLog]);
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      {/* 터미널 상단 툴바 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px', backgroundColor: 'var(--gcp-bg-card)',
        padding: '12px 16px', border: '1px solid var(--gcp-border)', borderRadius: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🖥️</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--gcp-text-primary)' }}>
              플러그인 원격 터미널 & 디버거 (Remote Console)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
              연결된 브라우저 플러그인의 실시간 콘솔 로그 모니터링 및 동적 JS 스크립트 주입 도구
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={selectedPlugin}
            onChange={e => setSelectedPlugin(e.target.value)}
            style={{
              padding: '6px 10px', backgroundColor: 'var(--gcp-bg-main)',
              border: '1px solid var(--gcp-border)', color: 'var(--gcp-text-primary)',
              borderRadius: '4px', fontSize: '12px'
            }}
          >
            <option value="Default Chrome Extension (ID: plugin_01)">Default Chrome Extension (ID: plugin_01)</option>
            <option value="Firefox WebExtension (ID: plugin_02)">Firefox WebExtension (ID: plugin_02)</option>
          </select>
          <button className="gcp-btn gcp-btn-secondary" onClick={handleClearLogs}>
            🗑️ 로그 지우기
          </button>
        </div>
      </div>

      {/* 터미널 분할 화면 */}
      <div style={{ display: 'flex', flexGrow: 1, gap: '16px', overflow: 'hidden' }}>
        {/* 실시간 로그 터미널 모니터 */}
        <div style={{
          flex: 1.2, backgroundColor: '#0d0e11', border: '1px solid var(--gcp-border)',
          borderRadius: '6px', padding: '14px', display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{
            fontSize: '11px', fontWeight: 600, color: 'var(--gcp-text-secondary)',
            marginBottom: '10px', display: 'flex', justifyContent: 'space-between'
          }}>
            <span>LIVE CONSOLE STREAM ({logs.length} entries)</span>
            <span style={{ color: 'var(--gcp-status-green)' }}>● STREAMING</span>
          </div>

          <div style={{
            flexGrow: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '11.5px',
            display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            {logs.map(log => {
              let color = '#e8eaed';
              if (log.type === 'warn') color = 'var(--gcp-status-yellow)';
              if (log.type === 'error') color = 'var(--gcp-status-red)';
              if (log.type === 'inject') color = 'var(--gcp-accent)';
              if (log.type === 'success') color = 'var(--gcp-status-green)';

              return (
                <div key={log.id} style={{ color, wordBreak: 'break-all' }}>
                  <span style={{ color: '#5f6368', marginRight: '8px' }}>[{log.time}]</span>
                  {log.text}
                </div>
              );
            })}
          </div>
        </div>

        {/* 원격 JS 주입 입력창 */}
        <div style={{
          flex: 0.8, backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)',
          borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
        }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--gcp-text-primary)' }}>
            💉 원격 자바스크립트 주입 (Code Injection)
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>
            선택한 플러그인이 실행 중인 활성 브라우저 페이지의 콘솔 context에 임의의 JS를 즉시 실행시킵니다.
          </div>

          <textarea
            value={jsCode}
            onChange={e => setJsCode(e.target.value)}
            rows={12}
            style={{
              flexGrow: 1, width: '100%', backgroundColor: 'var(--gcp-bg-main)',
              border: '1px solid var(--gcp-border)', color: 'var(--gcp-text-primary)',
              fontFamily: 'monospace', fontSize: '12px', padding: '10px', borderRadius: '4px', outline: 'none'
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="gcp-btn" onClick={handleInjectJs}>
              🚀 스크립트 실행 (Inject & Run)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PluginRemoteTerminal;
