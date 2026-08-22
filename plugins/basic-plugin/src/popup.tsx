// plugins/basic-plugin/src/popup.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';

import { PLUGIN_CONFIG } from './config/pluginConfig';
import { usePopupState } from './hooks/usePopupState';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { Footer } from './components/Footer';
import { TerminalConsole } from './components/TerminalConsole';
import { BasicTab } from './components/tabs/BasicTab';
import { InfoTab } from './components/tabs/InfoTab';
import { DebugTab } from './components/tabs/DebugTab';
import { SettingsTab } from './components/tabs/SettingsTab';

export default function Popup() {
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
    configSaveState,
    isElementPicking,
    isFrameCollecting,
    hasFrame,
    frameCount,
    isImageCollecting,
    handleSaveClientConfig,
    handleSendFullDom,
    handleStartElementPicker,
    handleStopElementPicker,
    handleCollectFrameDom,
    handleCollectImages,
    handleCollectSiteInfo,
    handleOpenXvideosManager,
    handleOpenXvBestOfRedAction,
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

  const popupContainerStyle: React.CSSProperties = {
    width: `${PLUGIN_CONFIG.popup.width}px`,
    height: `${PLUGIN_CONFIG.popup.height}px`,
    minWidth: `${PLUGIN_CONFIG.popup.minWidth}px`,
    minHeight: `${PLUGIN_CONFIG.popup.minHeight}px`,
    maxWidth: `${PLUGIN_CONFIG.popup.maxWidth}px`,
    maxHeight: `${PLUGIN_CONFIG.popup.maxHeight}px`,
  };

  return (
    <div className="popup-container" style={popupContainerStyle}>
      {/* 헤더 (서버 연결 상태 배지 포함) */}
      <Header isServerOnline={isServerOnline} />
      <TabBar activeTab={activeTab} onSelectTab={handleTabChange} />

      {/* 탭 콘텐츠 영역 (터미널 콘솔 위 공간) */}
      <div className="tab-content">
        {activeTab === 'basic' && (
          <BasicTab
            isServerOnline={isServerOnline}
            currentUrl={currentUrl}
            isSending={isSending}
            statusMessage={statusMessage}
            onSendFullDom={handleSendFullDom}
            isElementPicking={isElementPicking}
            onStartElementPicker={handleStartElementPicker}
            onStopElementPicker={handleStopElementPicker}
            hasFrame={hasFrame}
            frameCount={frameCount}
            isFrameCollecting={isFrameCollecting}
            onCollectFrameDom={handleCollectFrameDom}
            isImageCollecting={isImageCollecting}
            onCollectImages={(category) => handleCollectImages(category)}
            onCollectSiteInfo={handleCollectSiteInfo}
            onOpenXvideosManager={handleOpenXvideosManager}
            onOpenXvBestOfRedAction={handleOpenXvBestOfRedAction}
          />
        )}

        {activeTab === 'info' && (
          <InfoTab browserInfo={browserInfo} processorInfo={processorInfo} />
        )}

        {activeTab === 'debug' && (
          <DebugTab
            debugMessage={debugMessage}
            debugStatus={debugStatus}
            onChangeDebugMessage={setDebugMessage}
            onSendDebugMessage={handleSendDebugMessage}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            alias={alias}
            onAliasChange={setAlias}
            configSaveStatus={configSaveStatus}
            configSaveState={configSaveState}
            onSave={() => handleSaveClientConfig(alias)}
          />
        )}
      </div>

      {/* 공통 터미널 콘솔 — 모든 탭 하단 맨 아래에 배치 */}
      <TerminalConsole
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

      <Footer clientId={clientId} />
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}
