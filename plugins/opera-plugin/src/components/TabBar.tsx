// plugins/opera-plugin/src/components/TabBar.tsx

import { TabType } from '../types';

interface TabBarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

/**
 * 사이드바 탭 전환 바 컴포넌트입니다.
 * WAI-ARIA 탭 패턴(role="tablist"/role="tab" + aria-selected)을 적용해
 * 스크린 리더가 현재 선택 탭과 전체 탭 구조를 인식할 수 있습니다.
 *
 * @param props - activeTab/onSelectTab 참조
 * @returns 탭 바 JSX
 */
export function TabBar({ activeTab, onSelectTab }: TabBarProps) {
  return (
    <div className="tab-bar" role="tablist" aria-label="사이드바 메뉴 탭">
      <button
        onClick={() => onSelectTab('basic')}
        role="tab"
        aria-selected={activeTab === 'basic'}
        className={`tab-item ${activeTab === 'basic' ? 'active' : ''}`}
      >
        기본
      </button>
      <button
        onClick={() => onSelectTab('info')}
        role="tab"
        aria-selected={activeTab === 'info'}
        className={`tab-item ${activeTab === 'info' ? 'active' : ''}`}
      >
        정보
      </button>
      <button
        onClick={() => onSelectTab('debug')}
        role="tab"
        aria-selected={activeTab === 'debug'}
        className={`tab-item ${activeTab === 'debug' ? 'active' : ''}`}
      >
        디버깅
      </button>
      <button
        onClick={() => onSelectTab('settings')}
        role="tab"
        aria-selected={activeTab === 'settings'}
        className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`}
      >
        설정
      </button>
    </div>
  );
}
