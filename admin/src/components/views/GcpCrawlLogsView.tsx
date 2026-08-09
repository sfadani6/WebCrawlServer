import { CrawlLog } from '../../types/index.js';

interface GcpCrawlLogsViewProps {
  logs: CrawlLog[];
  onClearLogs: () => void;
}

export function GcpCrawlLogsView({ logs, onClearLogs }: GcpCrawlLogsViewProps) {
  return (
    <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800 flex flex-col gap-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">수집 로그</h2>
          <p className="text-sm text-slate-400">실시간으로 수집된 패킷 로그를 확인합니다.</p>
        </div>
        <button
          onClick={onClearLogs}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-700/20 hover:bg-red-700/30 text-red-200 rounded-lg transition border border-red-700/30 text-sm"
        >
          <span className="material-symbols-outlined">delete</span>
          전체 로그 삭제
        </button>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[640px] font-mono text-sm text-slate-200">
        {logs.length === 0 ? (
          <div className="text-center text-slate-500 py-20">
            수집 로그가 없습니다.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 text-slate-500 text-xs">
                <span className="truncate max-w-full">출처: {log.client_id}</span>
                <span>수신 시간: {new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="mt-3 text-slate-200 break-words whitespace-pre-wrap">
                {log.log_message}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
