import { ConnectionStatus } from '../../types/index.js';

interface HeaderProps {
  wsStatus: ConnectionStatus;
  onRefresh: () => void;
}

export function Header({ wsStatus, onRefresh }: HeaderProps) {
  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 text-white font-black text-xs px-2 py-1 rounded tracking-wider">
          GCP STYLE
        </div>
        <span className="font-bold text-sm text-gray-100 tracking-tight">
          WebCrawlServer Console
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={onRefresh}
          className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs px-3 py-1.5 rounded transition border border-gray-700"
        >
          수동 갱신
        </button>
        <div className="flex items-center gap-2 bg-gray-950 px-3 py-1.5 rounded border border-gray-800 text-xs">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              wsStatus === 'CONNECTED' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          ></span>
          <span className="text-gray-300">
            {wsStatus === 'CONNECTED' ? '통신 연결됨' : '통신 단절됨'}
          </span>
        </div>
      </div>
    </header>
  );
}
