import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import OverviewPage from './components/OverviewPage';
import DatabaseOverviewPage from './components/DatabaseOverviewPage';
import UnimplementedPage from './components/UnimplementedPage';
import './App.css';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');
  const [selectedDb, setSelectedDb] = useState(null);
  const [selectedTable, setSelectedTable] = useState('');

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    if (!path.startsWith('/database')) {
      setSelectedDb(null);
      setSelectedTable('');
    }
  };

  const renderContent = () => {
    if (currentPath === '/' || currentPath === '/admin') {
      return <OverviewPage onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/database')) {
      return (
        <DatabaseOverviewPage
          selectedDb={selectedDb}
          selectedTable={selectedTable}
          onSelectDb={(db) => {
            setSelectedDb(db);
            if (!db) setSelectedTable('');
          }}
          onSelectTable={(table) => setSelectedTable(table)}
        />
      );
    }

    if (currentPath.startsWith('/modules')) {
      return <UnimplementedPage pageName="모듈 관리" path="/modules" onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/workflows')) {
      return <UnimplementedPage pageName="워크플로우 Engine" path="/workflows" onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/scheduler')) {
      return <UnimplementedPage pageName="스케줄러 (Cron)" path="/scheduler" onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/logs')) {
      return <UnimplementedPage pageName="활동 및 에러 로그" path="/logs" onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/settings')) {
      return <UnimplementedPage pageName="시스템 설정" path="/settings" onNavigate={handleNavigate} />;
    }

    return <OverviewPage onNavigate={handleNavigate} />;
  };

  return (
    <Layout currentPath={currentPath} onNavigate={handleNavigate}>
      {renderContent()}
    </Layout>
  );
}

export default App;
