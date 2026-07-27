import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import OverviewPage from './components/OverviewPage';
import DatabaseOverviewPage from './components/DatabaseOverviewPage';
import SettingsPage from './components/SettingsPage';
import UnimplementedPage from './components/UnimplementedPage';
import ModulesPage from './components/ModulesPage';
import WorkflowsPage from './components/WorkflowsPage';
import SchedulerPage from './components/SchedulerPage';
import LogsPage from './components/LogsPage';
import CrawlerPage from './components/CrawlerPage';
import VisualWorkflowEditor from './components/VisualWorkflowEditor';
import PluginRemoteTerminal from './components/PluginRemoteTerminal';
import PluginsPage from './components/PluginsPage';
import './App.css';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');
  const [selectedDb, setSelectedDb] = useState(() => {
    try {
      const raw = sessionStorage.getItem('selectedDb');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  });
  const [selectedTable, setSelectedTable] = useState(() => sessionStorage.getItem('selectedTable') || '');

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || '/';
      setCurrentPath(path);
      if (path.startsWith('/database')) {
        try {
          const raw = sessionStorage.getItem('selectedDb');
          setSelectedDb(raw ? JSON.parse(raw) : null);
          setSelectedTable(sessionStorage.getItem('selectedTable') || '');
        } catch (_) {}
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (selectedDb) {
      sessionStorage.setItem('selectedDb', JSON.stringify(selectedDb));
    }
  }, [selectedDb]);

  useEffect(() => {
    if (selectedTable) {
      sessionStorage.setItem('selectedTable', selectedTable);
    }
  }, [selectedTable]);

  const handleNavigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    if (!path.startsWith('/database')) {
      setSelectedDb(null);
      setSelectedTable('');
      sessionStorage.removeItem('selectedDb');
      sessionStorage.removeItem('selectedTable');
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
            if (!db) {
              setSelectedTable('');
              sessionStorage.removeItem('selectedTable');
            }
          }}
          onSelectTable={(table) => setSelectedTable(table)}
        />
      );
    }

    if (currentPath.startsWith('/visual-workflow')) {
      return <VisualWorkflowEditor onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith('/remote-terminal')) {
      return <PluginRemoteTerminal />;
    }
    if (currentPath.startsWith('/plugins')) {
      return <PluginsPage onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/modules')) {
      return <ModulesPage onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith('/workflows')) {
      return <WorkflowsPage onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith('/scheduler')) {
      return <SchedulerPage onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith('/logs')) {
      return <LogsPage onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/settings')) {
      return <SettingsPage />;
    }
    if (currentPath.startsWith('/crawler')) {
      return <CrawlerPage onNavigate={handleNavigate} />;
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