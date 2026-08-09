// plugins/opera-plugin/src/sidepanel.tsx

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';

import { usePopupState } from './hooks/usePopupState';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { Footer } from './components/Footer';
import { BasicTab } from './components/tabs/BasicTab';
import { InfoTab } from './components/tabs/InfoTab';
import { DebugTab } from './components/tabs/DebugTab';
import { SettingsTab } from './components/tabs/SettingsTab';

/**
 * 브라우저 툴바 아이콘 클릭 시 즉시 켜지는 단일 메인 사이드바 대시보드 엔트리 컴포넌트입니다.
 * 크롬 포트 연결(chrome.runtime.connect)로 사이드바 창 생명주기를 오프스크린에 알립니다.
 * ADR-001: 사이드바 단일 UI & 오프스크린 무중단 소켓 아키텍처 준수
 */
export default function SidePanel() {
  const {
    activeTab,
    clientId,
    currentUrl,
    isServerOnline,
    statusMessage,
    isSending,
    debugMessage,
    setDebugMessage,
    debugStatus,
    browserInfo,
    processorInfo,
    alias,
    setAlias,
    configSaveStatus,
    handleSaveClientConfig,
    handleSendFullDom,
    handleSendDebugMessage,
    handleTabChange,
    terminalLogs,
    autoScroll,
    setAutoScroll,
    commandInput,
    setCommandInput,
    consoleHeight,
    executePluginCommand,
    handleClearTerminal,
    handleConsoleResizeStart,
    handleConsoleResizeMove,
    handleConsoleResizeEnd,
  } = usePopupState();

  useEffect(() => {
    // 크롬 포트 연결 기반 사이드바 창 생명주기 알림
    // 연결 즉시 오프스크린에서 isSidebarOpen: true 서버 전송
    // 창 닫힐 때 포트 끊김으로 자동으로 isSidebarOpen: false 서버 전송
    const port = chrome.runtime.connect({ name: "sidepanel-port" });

    return () => {
      port.disconnect();
    };
  }, []);

  return (
    <div className="w-full h-screen bg-[#0d131f] text-slate-100 flex flex-col p-4 box-border overflow-hidden select-text font-sans">
      {/* 사이드바 상단 헤더 */}
      <Header />

      {/* 탭 전환 바 */}
      <div className="my-2">
        <TabBar activeTab={activeTab} onSelectTab={handleTabChange} />
      </div>

      {/* 탭 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto my-2 pr-1">
        {/* 기본 수집 탭 */}
        {activeTab === 'basic' && (
          <BasicTab
            isServerOnline={isServerOnline}
            currentUrl={currentUrl}
            isSending={isSending}
            statusMessage={statusMessage}
            onSendFullDom={handleSendFullDom}
          />
        )}

        {/* 브라우저 정보 탭 */}
        {activeTab === 'info' && (
          <InfoTab browserInfo={browserInfo} processorInfo={processorInfo} />
        )}

        {/* 디버그 메시지 송출 탭 */}
        {activeTab === 'debug' && (
          <DebugTab
            debugMessage={debugMessage}
            debugStatus={debugStatus}
            onChangeDebugMessage={setDebugMessage}
            onSendDebugMessage={handleSendDebugMessage}
            terminalLogs={terminalLogs}
            autoScroll={autoScroll}
            setAutoScroll={setAutoScroll}
            commandInput={commandInput}
            setCommandInput={setCommandInput}
            consoleHeight={consoleHeight}
            onRunCommand={executePluginCommand}
            onClearTerminal={handleClearTerminal}
            onConsoleResizeStart={handleConsoleResizeStart}
            onConsoleResizeMove={handleConsoleResizeMove}
            onConsoleResizeEnd={handleConsoleResizeEnd}
          />
        )}

        {/* 환경 설정 탭 (노드 별칭 저장) */}
        {activeTab === 'settings' && (
          <SettingsTab
            alias={alias}
            onAliasChange={setAlias}
            configSaveStatus={configSaveStatus}
            onSave={() => handleSaveClientConfig(alias)}
          />
        )}
      </div>

      {/* 사이드바 하단 푸터 (클라이언트 UUID 표시) */}
      <Footer clientId={clientId} />
    </div>
  );
}

// React 앱 루트 마운트
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <SidePanel />
    </React.StrictMode>
  );
}
