import { ActiveTab } from '../../../types/index.js';

interface BreadcrumbBarProps {
  activeTab: ActiveTab;
  onRefresh: () => void;
  onClearLogs: () => void;
}

export function BreadcrumbBar({ activeTab, onRefresh, onClearLogs }: BreadcrumbBarProps) {
  const getBreadcrumbParts = () => {
    const parts: {category: string; label: string}[] = [
      { category: '관리자 대시보드', label: '수집 노드 관리' },
      { category: '관리자 대시보드', label: '워커 관리' },
      { category: '관리자 대시보드', label: 'DB 관리' },
      { category: '관리자 대시보드', label: '원격 제어 콘솔' },
      { category: '시스템 진단', label: '네트워크 모니터링' },
      { category: '데이터 관리', label: '실시간 수집 로그' },
      { category: '유틸리티', label: '파비콘 생성기' },
      { category: '시스템 설정', label: '환경 설정' },
    ];
    
    const indexMap: Record<ActiveTab, number> = {
      clients: 0,
      workers: 1,
      db: 2,
      console: 3,
      network: 4,
      logs: 5,
      favicon: 6,
      settings: 7,
    };
    
    const index = indexMap[activeTab] ?? 0;
    return parts[index];
  };

  const parts = getBreadcrumbParts();

  return (
    <div className="h-12 bg-[#161C27] border-b border-slate-800 px-5 flex items-center justify-between text-sm text-slate-200 shadow-sm">
      <div className="flex items-center gap-2 font-medium">
        <span className="text-slate-500">WebCrawlServer</span>
        <span className="text-slate-300">›</span>
        <span className="text-slate-500">{parts.category}</span>
        <span className="text-slate-300">›</span>
        <span className="text-[#1A73E8] font-semibold">{parts.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-100 transition"
        >
          <span className="material-symbols-outlined">refresh</span>
          <span>새로고침</span>
        </button>
        {activeTab === 'logs' && (
          <button
            onClick={onClearLogs}
            className="flex items-center gap-2 px-3 py-2 bg-red-700/20 hover:bg-red-700/30 rounded text-red-200 transition border border-red-700/30"
          >
            <span className="material-symbols-outlined">delete</span>
            <span>로그 삭제</span>
          </button>
        )}
      </div>
    </div>
  );
}
