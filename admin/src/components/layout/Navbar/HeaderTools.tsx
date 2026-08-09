import { ConnectionStatus } from '../../../types/index.js';

interface HeaderToolsProps {
  wsStatus: ConnectionStatus;
  onRefresh: () => void;
}

export function HeaderTools({ wsStatus, onRefresh }: HeaderToolsProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 bg-slate-900/70 px-3 py-2 rounded border border-slate-700 text-sm text-white">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            wsStatus === 'CONNECTED' ? 'bg-emerald-300 animate-pulse' : 'bg-rose-300'
          }`}
        ></span>
        <span>{wsStatus === 'CONNECTED' ? '연결됨' : '연결 끊김'}</span>
      </div>
      <button
        onClick={onRefresh}
        className="p-2 bg-slate-900/70 hover:bg-slate-800 rounded transition text-white"
        title="데이터 새로고침"
      >
        <span className="material-symbols-outlined">refresh</span>
      </button>
      <div className="w-8 h-8 rounded-full bg-slate-900/70 border border-slate-700 flex items-center justify-center font-semibold text-sm text-white ml-1">
        A
      </div>
    </div>
  );
}
