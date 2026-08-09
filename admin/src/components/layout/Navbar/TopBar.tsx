import { ProjectSelector } from './ProjectSelector.js';
import { GlobalSearchBar } from './GlobalSearchBar.js';
import { HeaderTools } from './HeaderTools.js';
import { ConnectionStatus } from '../../../types/index.js';

interface TopBarProps {
  wsStatus: ConnectionStatus;
  onToggleSidebar: () => void;
  onRefresh: () => void;
}

export function TopBar({ wsStatus, onToggleSidebar, onRefresh }: TopBarProps) {
  return (
    <header className="h-14 bg-[#0F172A] text-white flex items-center justify-between px-4 shadow-sm z-50">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-blue-600/90 rounded transition text-white"
          title="네비게이션 메뉴"
        >
          <span className="material-symbols-outlined text-lg">menu</span>
        </button>
        <div className="flex items-center gap-2 font-medium text-sm tracking-tight pr-3 border-r border-blue-300/20">
          <span className="bg-slate-900/70 text-[#1A73E8] font-black text-xs px-2 py-1 rounded">
            GCP
          </span>
          <span>WebCrawlServer 관리자</span>
        </div>
        <ProjectSelector />
      </div>
      <GlobalSearchBar />
      <HeaderTools wsStatus={wsStatus} onRefresh={onRefresh} />
    </header>
  );
}
