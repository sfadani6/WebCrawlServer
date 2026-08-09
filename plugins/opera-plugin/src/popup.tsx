// plugins/opera-plugin/src/popup.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';

import { PLUGIN_CONFIG } from './config/pluginConfig';
import { usePopupState } from './hooks/usePopupState';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { Footer } from './components/Footer';
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
      <Header />
      <TabBar activeTab={activeTab} onSelectTab={handleTabChange} />

      {activeTab === 'basic' && (
        <BasicTab
          isServerOnline={isServerOnline}
          currentUrl={currentUrl}
          isSending={isSending}
          statusMessage={statusMessage}
          onSendFullDom={handleSendFullDom}
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

      {activeTab === 'settings' && (
        <SettingsTab
          alias={alias}
          onAliasChange={setAlias}
          configSaveStatus={configSaveStatus}
          onSave={() => handleSaveClientConfig(alias)}
        />
      )}

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