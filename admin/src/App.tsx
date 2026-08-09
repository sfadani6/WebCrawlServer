// admin/src/App.tsx

import { Suspense, lazy, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate, Routes, Route } from 'react-router-dom';
import { useAdminDbApi } from './hooks/useAdminDbApi.js';
import { useAdminSocket } from './hooks/useAdminSocket.js';
import { GcpMainLayout } from './components/layout/GcpMainLayout.js';
import { GcpClientsView } from './components/views/GcpClientsView.js';
import { GcpControlConsoleView } from './components/views/GcpControlConsoleView.js';
import { GcpCrawlLogsView } from './components/views/GcpCrawlLogsView.js';
import { WorkerManagerView } from './components/views/WorkerManagerView.js';
import { ConfigSettingsView } from './components/views/ConfigSettingsView.js';
import { ActiveTab, WebSocketMessage } from './types/index.js';

const FaviconGeneratorView = lazy(() => import('./components/views/FaviconGeneratorView.js').then((module) => ({ default: module.FaviconGeneratorView })));
const NetworkMonitorView = lazy(() => import('./components/views/NetworkMonitorView.js').then((module) => ({ default: module.NetworkMonitorView })));
const DbManagerView = lazy(() => import('./components/views/db/DbManagerView.js').then((module) => ({ default: module.DbManagerView })));

/**
 * 관리자 대시보드 최상위 조율 엔트리 컴포넌트입니다.
 * 탭 라우팅, 데이터 로딩, 웹소켓 연결, 워커 관리 등 전체 상태를 통합 조율합니다.
 */
export default function App() {
  /** 현재 활성화된 메인 탭 상태 */
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('clients');
  /** 원격 지시 콘솔의 타깃 노드 ID 상태 */
  const [targetId, setTargetId] = useState<string>('ALL');
  /** 관리 소켓으로 수신된 최근 이벤트 */
  const [socketMessages, setSocketMessages] = useState<WebSocketMessage[]>([]);

  // REST API 통신 및 데이터 상태 관리 훅
  const {
    clients,
    workers,
    logs,
    configs,
    setLogs,
    loadClients,
    loadWorkers,
    loadLogs,
    loadConfigs,
    executeClearLogs,
    executePurgeClient,
    executePurgeOfflineClients,
    executeUpdateClientConfig,
    executeUpdateConfig,
    executeCreateWorker
  } = useAdminDbApi();

  // 최초 진입 시 전체 데이터 일괄 로딩
  useEffect(() => {
    loadClients();
    loadWorkers();
    loadLogs();
    loadConfigs();
  }, [loadClients, loadWorkers, loadLogs, loadConfigs]);

  // URL 경로를 탭 상태로 매핑
  useEffect(() => {
    const path = location.pathname.replace(/\/$/, '');
    const map: Record<string, ActiveTab> = {
      '': 'clients',
      '/': 'clients',
      '/clients': 'clients',
      '/workers': 'workers',
      '/db': 'db',
      '/console': 'console',
      '/network': 'network',
      '/logs': 'logs',
      '/favicon': 'favicon',
      '/settings': 'settings',
    };
    setActiveTab(map[path] ?? 'clients');
  }, [location.pathname]);

  /**
   * 웹소켓 재연결 시 데이터 일괄 갱신 콜백
   */
  const handleConnect = useCallback(() => {
    loadClients();
    loadWorkers();
    loadLogs();
    loadConfigs();
  }, [loadClients, loadWorkers, loadLogs, loadConfigs]);

  const handleAdminMessage = useCallback((message: WebSocketMessage) => {
    // 서버가 브로드캐스트한 노드 상태 변화(CLIENTS_UPDATED) 수신 시
    // 온라인 노드 목록을 실시간 재조회하여 대시보드에 즉시 반영합니다.
    if (message.action === 'CLIENTS_UPDATED') {
      loadClients();
      return;
    }
    setSocketMessages((prev) => [message, ...prev].slice(0, 50));
  }, [loadClients]);

  // 관리자 웹소켓 연결 훅 (실시간 로그 수신 및 커맨드 전송)
  const { wsStatus, dispatchCommand } = useAdminSocket(
    setLogs,
    handleConnect,
    handleAdminMessage,
  );

  /**
   * 수집 노드를 원격 지시 콘솔의 타깃으로 선택하고 콘솔 탭으로 이동합니다.
   *
   * @param clientId - 선택할 노드 UUID
   */
  const handleSelectTarget = (clientId: string) => {
    setTargetId(clientId);
    setActiveTab('console');
  };

  // 탭 변경 시 URL 업데이트
  const onSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const pathMap: Record<ActiveTab, string> = {
      clients: '/clients',
      workers: '/workers',
      db: '/db',
      console: '/console',
      network: '/network',
      logs: '/logs',
      favicon: '/favicon',
      settings: '/settings',
    };
    const to = pathMap[tab] ?? '/';
    if (location.pathname !== to) navigate(to);
  };

  /** configs에서 데이터 저장 기본 경로(data_path) 값을 추출해 저장/노드 경로 안내에 사용 */
  const defaultStoragePath =
    configs.find((c) => c.key === 'data_path')?.value ?? '';

  return (
    <GcpMainLayout
      wsStatus={wsStatus}
      clientCount={clients.length}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      onRefresh={() => {
        loadClients();
        loadWorkers();
        loadLogs();
        loadConfigs();
      }}
      onClearLogs={executeClearLogs}
    >
      <Routes>
        <Route
          path="/"
          element={<GcpClientsView
            clients={clients}
            logs={logs}
            logCount={logs.length}
            onSelectTarget={handleSelectTarget}
            onPurgeClient={executePurgeClient}
            onPurgeOfflineClients={executePurgeOfflineClients}
            onSaveNodeConfig={executeUpdateClientConfig}
          />}
        />
        <Route path="/clients/*" element={<GcpClientsView
          clients={clients}
          logs={logs}
          logCount={logs.length}
          onSelectTarget={handleSelectTarget}
          onPurgeClient={executePurgeClient}
          onPurgeOfflineClients={executePurgeOfflineClients}
          onSaveNodeConfig={executeUpdateClientConfig}
        />} />
        <Route path="/workers/*" element={<WorkerManagerView workers={workers} defaultStoragePath={defaultStoragePath} onCreateWorker={executeCreateWorker} />} />
        <Route
          path="/db/*"
          element={
            <Suspense fallback={<div className="text-slate-300">DB 관리 로딩 중...</div>}>
              <DbManagerView clients={clients} />
            </Suspense>
          }
        />
        <Route path="/console/*" element={<GcpControlConsoleView targetId={targetId} setTargetId={setTargetId} onDispatch={dispatchCommand} clients={clients} socketMessages={socketMessages} />} />
        <Route
          path="/network/*"
          element={
            <Suspense fallback={<div className="text-slate-300">네트워크 모니터링 로딩 중...</div>}>
              <NetworkMonitorView onDispatch={dispatchCommand} clientCount={clients.length} socketEvents={socketMessages} />
            </Suspense>
          }
        />
        <Route path="/logs/*" element={<GcpCrawlLogsView logs={logs} onClearLogs={executeClearLogs} />} />
        <Route path="/settings/*" element={<ConfigSettingsView configs={configs} onSaveConfig={executeUpdateConfig} />} />
        <Route
          path="/favicon/*"
          element={
            <Suspense fallback={<div className="text-slate-300">파비콘 생성기 로딩 중...</div>}>
              <FaviconGeneratorView />
            </Suspense>
          }
        />
        <Route path="*" element={<GcpClientsView
          clients={clients}
          logs={logs}
          logCount={logs.length}
          onSelectTarget={handleSelectTarget}
          onPurgeClient={executePurgeClient}
          onPurgeOfflineClients={executePurgeOfflineClients}
          onSaveNodeConfig={executeUpdateClientConfig}
        />} />
      </Routes>
    </GcpMainLayout>
  );
}
