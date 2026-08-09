// plugins/basic-plugin/src/components/TabBar.tsx

import { TabType } from '../types';

interface TabBarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export function TabBar({ activeTab, onSelectTab }: TabBarProps) {
  return (
    <div className="tab-bar">
      <button
        onClick={() => onSelectTab('basic')}
        className={`tab-item ${activeTab === 'basic' ? 'active' : ''}`}
      >
        기본
      </button>
      <button
        onClick={() => onSelectTab('info')}
        className={`tab-item ${activeTab === 'info' ? 'active' : ''}`}
      >
        정보
      </button>
      <button
        onClick={() => onSelectTab('debug')}
        className={`tab-item ${activeTab === 'debug' ? 'active' : ''}`}
      >
        디버깅
      </button>
      <button
        onClick={() => onSelectTab('settings')}
        className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`}
      >
        설정
      </button>
    </div>
  );
}