import React from 'react';

function UnimplementedPage({ pageName, path, onNavigate }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justify: 'center',
      height: '80%',
      padding: '40px',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: 'var(--gcp-bg-card)',
        border: '1px solid var(--gcp-border)',
        borderRadius: '8px',
        padding: '36px 48px',
        maxWidth: '480px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>🚧</div>
        <h2 style={{ fontSize: '18px', margin: '0 0 8px 0', color: 'var(--gcp-text-primary)' }}>
          {pageName || '서비스 모듈'} <span style={{ color: 'var(--gcp-status-yellow)' }}>[미구현]</span>
        </h2>
        <p style={{ fontSize: '12.5px', color: 'var(--gcp-text-secondary)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
          해당 서비스 페이지({path})는 현재 개발 예정 상태입니다.<br />
          필요한 경우 백엔드 모듈 스펙(R-003 / R-004)에 맞추어 점진적으로 구현될 예정입니다.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button className="gcp-btn gcp-btn-secondary" onClick={() => onNavigate('/')}>
            🏠 콘솔 홈으로 이동
          </button>
          <button className="gcp-btn" onClick={() => onNavigate('/database')}>
            🗄️ 데이터베이스 관리로 이동
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnimplementedPage;
