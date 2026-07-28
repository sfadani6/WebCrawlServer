import React, { useState, useEffect, useCallback, useRef } from 'react';

function Layout({ currentPath, onNavigate, children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('wcs_theme') || 'dark'); // 'dark' or 'light'
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('wcs_high_contrast') === 'true'); // true or false
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    const currentThemeMode = `${theme}${highContrast ? '-high-contrast' : ''}`;
    document.documentElement.setAttribute('data-theme', currentThemeMode);
    localStorage.setItem('wcs_theme', theme);
    localStorage.setItem('wcs_high_contrast', highContrast);
  }, [theme, highContrast]);

  const toggleHighContrast = () => {
    setHighContrast(prev => !prev);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // 핫키 리스너 (Ctrl + K, /)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 모달 열릴 때 포커스 처리
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  const handleSearchSelect = (path) => {
    onNavigate(path);
    setIsSearchOpen(false);
  };

  const closeSearch = (e) => {
    if (e.target === e.currentTarget) {
      setIsSearchOpen(false);
    }
  };

  const menuItems = [
    { id: 'home', path: '/', label: '서비스 목록 (대시보드)', icon: '🏠' },
    { id: 'connections', path: '/connections', label: '접속 관리', icon: '📡' },
    { id: 'database', path: '/database', label: '데이터베이스', icon: '🗄️' },
    { id: 'visual-workflow', path: '/visual-workflow', label: '시각적 워크플로우', icon: '⚡' },
    { id: 'remote-terminal', path: '/remote-terminal', label: '원격 터미널', icon: '🖥️' },
    { id: 'plugins', path: '/plugins', label: '플러그인 관리', icon: '🔌' },
    { id: 'modules', path: '/modules', label: '모듈 관리', icon: '🧩', badge: '미구현' },
    { id: 'workflows', path: '/workflows', label: '워크플로우', icon: '⚙️', badge: '미구현' },
    { id: 'scheduler', path: '/scheduler', label: '스케줄러', icon: '⏱️', badge: '미구현' },
    { id: 'logs', path: '/logs', label: '로그', icon: '📋', badge: '미구현' },
    { id: 'crawler', path: '/crawler', label: '크롤러', icon: '🕷️' },
    { id: 'settings', path: '/settings', label: '설정', icon: '🔧' },
  ];

  const filteredItems = menuItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              readOnly
              onClick={() => setIsSearchOpen(true)}
              placeholder="리소스, 모듈, 쿼리 검색..." 
              style={{
                backgroundColor: 'var(--gcp-bg-main)',
                border: '1px solid var(--gcp-border)',
                borderRadius: '4px',
                padding: '4px 10px 4px 28px',
                color: 'var(--gcp-text-primary)',
                fontSize: '12px',
                width: '260px',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
            <span style={{ position: 'absolute', left: '8px', top: '4px', fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>🔍</span>
            <span style={{ position: 'absolute', right: '8px', top: '4px', fontSize: '10px', color: 'var(--gcp-text-secondary)', border: '1px solid var(--gcp-border)', padding: '0 4px', borderRadius: '2px' }}>Ctrl+K</span>
          </div>

          {/* 고대비 모드 스위처 */}
          <button
            onClick={toggleHighContrast}
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
            <span>{highContrast ? '✨ 고대비 켜짐' : '🌙 고대비 꺼짐'}</span>
          </button>

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

      {/* Global Search Modal (Command Palette) */}
      {isSearchOpen && (
        <div 
          onClick={closeSearch}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', paddingTop: '80px',
            zIndex: 1000, backdropFilter: 'blur(2px)'
          }}
        >
          <div style={{
            width: '600px', backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)',
            borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', maxHeight: '450px'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--gcp-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '18px' }}>🔍</span>
              <input 
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="메뉴 이름이나 경로를 입력하세요..."
                style={{
                  flexGrow: 1, backgroundColor: 'transparent', border: 'none', color: 'var(--gcp-text-primary)',
                  fontSize: '16px', outline: 'none'
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', backgroundColor: 'var(--gcp-bg-hover)', padding: '2px 6px', borderRadius: '3px' }}>ESC</span>
            </div>
            
            <div style={{ overflowY: 'auto', padding: '8px 0' }}>
              {filteredItems.length > 0 ? (
                <>
                  <div style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--gcp-text-secondary)', textTransform: 'uppercase' }}>
                    네비게이션 메뉴
                  </div>
                  {filteredItems.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => handleSearchSelect(item.path)}
                      style={{
                        padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                        transition: 'background-color 0.1s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gcp-bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span style={{ fontSize: '16px' }}>{item.icon}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '14px', color: 'var(--gcp-text-primary)' }}>{item.label}</span>
                        <span style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>{item.path}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
            
            <div style={{ 
              padding: '12px 16px', borderTop: '1px solid var(--gcp-border)', 
              backgroundColor: 'var(--gcp-bg-header)', display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--gcp-text-secondary)' 
            }}>
              <span><kbd style={kbdStyle}>↵</kbd> 선택</span>
              <span><kbd style={kbdStyle}>↑↓</kbd> 이동</span>
              <span><kbd style={kbdStyle}>esc</kbd> 닫기</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const kbdStyle = {
  backgroundColor: 'var(--gcp-bg-main)',
  border: '1px solid var(--gcp-border)',
  borderRadius: '3px',
  padding: '1px 4px',
  fontSize: '10px',
  marginRight: '4px'
};

export default Layout;
