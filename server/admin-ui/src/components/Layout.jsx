import React, { useState, useEffect } from 'react';

function Layout({ currentPath, onNavigate, children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('wcs_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wcs_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const menuItems = [
    { id: 'home', path: '/', label: '서비스 목록 (대시보드)', icon: '🏠' },
    { id: 'database', path: '/database', label: '데이터베이스', icon: '🗄️' },
    { id: 'visual-workflow', path: '/visual-workflow', label: '시각적 워크플로우', icon: '⚡' },
    { id: 'remote-terminal', path: '/remote-terminal', label: '원격 터미널', icon: '🖥️' },
    { id: 'modules', path: '/modules', label: '모듈 관리', icon: '🧩', badge: '미구현' },
    { id: 'workflows', path: '/workflows', label: '워크플로우', icon: '⚙️', badge: '미구현' },
    { id: 'scheduler', path: '/scheduler', label: '스케줄러', icon: '⏱️', badge: '미구현' },
    { id: 'logs', path: '/logs', label: '로그', icon: '📋', badge: '미구현' },
    { id: 'crawler', path: '/crawler', label: '크롤러', icon: '🕷️' },
    { id: 'settings', path: '/settings', label: '설정', icon: '🔧' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', backgroundColor: 'var(--gcp-bg-main)' }}>
      {/* Top Console Navigation Bar */}
      <header style={{
        height: '48px',
        backgroundColor: 'var(--gcp-bg-header)',
        borderBottom: '1px solid var(--gcp-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => onNavigate('/')}>
            <span style={{ fontSize: '18px' }}>☁️</span>
            <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--gcp-text-primary)', letterSpacing: '-0.3px' }}>WebCrawlServer</span>
            <span style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', backgroundColor: 'var(--gcp-bg-hover)', padding: '2px 6px', borderRadius: '3px' }}>Console v0.1</span>
          </div>
          <div style={{ height: '16px', width: '1px', backgroundColor: 'var(--gcp-border)' }} />
          <div style={{ fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
            프로젝트: <strong style={{ color: 'var(--gcp-text-primary)' }}>sfadani4/WebCrawlServer</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* 콤팩트 검색 입력창 */}
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="리소스, 모듈, 쿼리 검색..." 
              style={{
                backgroundColor: 'var(--gcp-bg-main)',
                border: '1px solid var(--gcp-border)',
                borderRadius: '4px',
                padding: '4px 10px 4px 28px',
                color: 'var(--gcp-text-primary)',
                fontSize: '12px',
                width: '260px',
                outline: 'none'
              }}
            />
            <span style={{ position: 'absolute', left: '8px', top: '4px', fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>🔍</span>
          </div>

          {/* 테마 스위처 */}
          <button
            onClick={toggleTheme}
            style={{
              background: 'transparent',
              border: '1px solid var(--gcp-border)',
              borderRadius: '4px',
              padding: '3px 8px',
              color: 'var(--gcp-text-primary)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{theme === 'dark' ? '🌙 다크' : '☀️ 라이트'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="gcp-badge gcp-badge-active">● 서버 정상 (9600)</span>
          </div>
        </div>
      </header>

      {/* Main Body (Sidebar + Content View) */}
      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Left Console Navigation Sidebar */}
        <aside style={{
          width: '220px',
          backgroundColor: 'var(--gcp-bg-sidebar)',
          borderRight: '1px solid var(--gcp-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 0',
          flexShrink: 0
        }}>
          <div style={{ padding: '0 12px 8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--gcp-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            서비스 네비게이션
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {menuItems.map(item => {
              const isActive = (item.path === '/' && currentPath === '/') || 
                               (item.path !== '/' && currentPath.startsWith(item.path));
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px',
                    border: 'none',
                    backgroundColor: isActive ? 'rgba(138, 180, 248, 0.12)' : 'transparent',
                    color: isActive ? 'var(--gcp-accent)' : 'var(--gcp-text-primary)',
                    borderLeft: isActive ? '3px solid var(--gcp-accent)' : '3px solid transparent',
                    fontSize: '12.5px',
                    fontWeight: isActive ? 600 : 400,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s'
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--gcp-bg-hover)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {item.badge && (
                    <span style={{ fontSize: '10px', backgroundColor: 'var(--gcp-border)', color: 'var(--gcp-text-secondary)', padding: '1px 5px', borderRadius: '3px' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Main Content Area */}
        <main style={{ flexGrow: 1, overflow: 'auto', backgroundColor: 'var(--gcp-bg-main)', position: 'relative' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
