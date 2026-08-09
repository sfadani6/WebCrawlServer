import { CrawlLog } from '../../types/index.js';

interface CrawlLogsViewProps {
  logs: CrawlLog[];
  onClearLogs: () => void;
}

export function CrawlLogsView({ logs, onClearLogs }: CrawlLogsViewProps) {
  return (
    <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-gray-800 pb-2">
        <h2 className="text-lg font-bold text-yellow-400">
          실시간 데이터 수집 패킷 로그
        </h2>
        <button
          onClick={onClearLogs}
          className="bg-red-900/50 hover:bg-red-800 border border-red-700 text-xs px-3 py-1.5 rounded transition text-red-200"
        >
          데이터베이스 로그 일괄 소거
        </button>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[600px] font-mono text-xs">
        {logs.map((log) => (
          <div
            key={log.id}
            className="bg-gray-800 p-3 rounded flex flex-col gap-1 border-l-4 border-yellow-500"
          >
            <div className="flex justify-between text-gray-400 text-[10px]">
              <span className="truncate max-w-[300px]">출처: {log.client_id}</span>
              <span>시각: {new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="text-yellow-100 break-all mt-1">
              {log.log_message}
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-center text-gray-500 py-20">
            수신된 실시간 수집 패킷이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
