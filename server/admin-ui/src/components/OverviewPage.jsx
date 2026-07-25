import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';

function OverviewPage({ onNavigate }) {
  const [health, setHealth] = useState(null);
  const [dbCount, setDbCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJSON('/health').catch(() => null),
      fetchJSON('/admin/api/databases').catch(() => [])
    ]).then(([healthData, dbList]) => {
      setHealth(healthData);
      setDbCount(Array.isArray(dbList) ? dbList.length : 0);
      setLoading(false);
    });
  }, []);

  const services = [
    { name: 'SQLite 데이터베이스 엔진', type: 'Database Engine', status: 'RUNNING', endpoint: '/database', details: `${dbCount}개 DB 파일 활성화` },
    { name: 'Express HTTP API Server', type: 'HTTP Core', status: 'RUNNING', endpoint: '/health', details: 'Port 9600' },
    { name: 'WebSocket Server (MCP)', type: 'Realtime Protocol', status: 'RUNNING', endpoint: 'ws://localhost:9600', details: 'MCP v1.0 활성화' },
    { name: '브라우저 크롤러 플러그인 모듈', type: 'Automation', status: 'STANDBY', endpoint: '/modules', details: '플러그인 대기 중' },
    { name: 'YAML 워크플로우 엔진', type: 'Workflow', status: 'UNIMPLEMENTED', endpoint: '/workflows', details: '미구현' },
    { name: '작업 스케줄러 (Cron)', type: 'Scheduler', status: 'UNIMPLEMENTED', endpoint: '/scheduler', details: '미구현' },
    { name: '시스템 활동 및 에러 로그', type: 'Logging', status: 'UNIMPLEMENTED', endpoint: '/logs', details: '미구현' },
  ];

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header section */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--gcp-text-primary)' }}>서비스 개요 및 시스템 현황</h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
            WebCrawlServer의 활성 모듈 및 관리 서비스 목록을 한눈에 파악하고 즉시 제어합니다.
          </p>
        </div>
        <button className="gcp-btn" onClick={() => onNavigate('/database')}>
          🗄️ 데이터베이스 관리로 이동
        </button>
      </div>

      {/* Summary KPI Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)', padding: '12px 16px', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', textTransform: 'uppercase' }}>시스템 상태</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gcp-status-green)', marginTop: '4px' }}>
            ● 정상 동작 (Healthy)
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)', padding: '12px 16px', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', textTransform: 'uppercase' }}>활성 데이터베이스</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gcp-text-primary)', marginTop: '4px' }}>
            {dbCount} 개
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)', padding: '12px 16px', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', textTransform: 'uppercase' }}>서버 포트</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gcp-text-primary)', marginTop: '4px' }}>
            9600 (HTTP / WS)
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)', padding: '12px 16px', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', textTransform: 'uppercase' }}>플랫폼 버전</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gcp-text-primary)', marginTop: '4px' }}>
            v0.1.0 (SQLite WAL)
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div style={{ backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', backgroundColor: 'var(--gcp-bg-header)', borderBottom: '1px solid var(--gcp-border)', fontWeight: 600, fontSize: '13px' }}>
          등록된 서비스 및 컴포넌트 목록 ({services.length})
        </div>
        <table className="gcp-table">
          <thead>
            <tr>
              <th style={{ width: '220px' }}>서비스 / 모듈명</th>
              <th style={{ width: '140px' }}>유형</th>
              <th style={{ width: '120px' }}>상태</th>
              <th>세부 정보 및 엔드포인트</th>
              <th style={{ width: '120px', textAlign: 'right' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {services.map((srv, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600, color: 'var(--gcp-text-primary)' }}>{srv.name}</td>
                <td style={{ color: 'var(--gcp-text-secondary)' }}>{srv.type}</td>
                <td>
                  {srv.status === 'RUNNING' && <span className="gcp-badge gcp-badge-active">● RUNNING</span>}
                  {srv.status === 'STANDBY' && <span className="gcp-badge gcp-badge-warn">◐ STANDBY</span>}
                  {srv.status === 'UNIMPLEMENTED' && <span className="gcp-badge" style={{ backgroundColor: 'var(--gcp-border)', color: 'var(--gcp-text-secondary)' }}>미구현</span>}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>
                  {srv.details} ({srv.endpoint})
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button 
                    className="gcp-btn gcp-btn-secondary" 
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => onNavigate(srv.endpoint.startsWith('http') || srv.endpoint.startsWith('ws') ? '/database' : srv.endpoint)}
                  >
                    이동 →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OverviewPage;
