import { ActiveTab } from '../../types/index.js';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  clientCount: number;
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  activeTab,
  onSelectTab,
  clientCount
}: SidebarProps) {
  return (
    <aside
      className={`bg-gray-900 border-r border-gray-800 flex flex-col justify-between transition-all duration-200 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="flex flex-col py-3">
        <button
          onClick={() => onSelectTab('clients')}
          className={`flex items-center gap-3 px-4 py-3 text-xs font-medium transition ${
            activeTab === 'clients'
              ? 'bg-blue-950 text-blue-400 border-l-4 border-blue-500'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          }`}
        >
          <span className="text-base">🖥️</span>
          {!isCollapsed && (
            <div className="flex justify-between items-center w-full">
              <span>수집 노드 관리</span>
              <span className="bg-gray-800 text-gray-300 text-[10px] px-1.5 py-0.5 rounded-full">
                {clientCount}
              </span>
            </div>
          )}
        </button>

        <button
          onClick={() => onSelectTab('console')}
          className={`flex items-center gap-3 px-4 py-3 text-xs font-medium transition ${
            activeTab === 'console'
              ? 'bg-blue-950 text-blue-400 border-l-4 border-blue-500'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          }`}
        >
          <span className="text-base">📡</span>
          {!isCollapsed && <span>원격 지시 콘솔</span>}
        </button>

        <button
          onClick={() => onSelectTab('logs')}
          className={`flex items-center gap-3 px-4 py-3 text-xs font-medium transition ${
            activeTab === 'logs'
              ? 'bg-blue-950 text-blue-400 border-l-4 border-blue-500'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          }`}
        >
          <span className="text-base">📜</span>
          {!isCollapsed && <span>실시간 수집 로그</span>}
        </button>
      </div>

      <div className="border-t border-gray-800 p-2">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-2 text-gray-400 hover:bg-gray-800 rounded text-xs transition"
        >
          {isCollapsed ? '▶' : '◀ 패널 접기'}
        </button>
      </div>
    </aside>
  );
}
