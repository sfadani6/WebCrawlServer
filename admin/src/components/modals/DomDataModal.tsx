import { CrawlLog } from '../../types/index.js';

interface DomDataModalProps {
  isOpen: boolean;
  clientId: string;
  log: CrawlLog | null;
  onClose: () => void;
}

interface ParsedDomPayload {
  url?: string;
  title?: string;
  fullDom?: string;
  links?: string[];
  timestamp?: number;
  [key: string]: unknown;
}

export function DomDataModal({ isOpen, clientId, log, onClose }: DomDataModalProps) {
  if (!isOpen || !log) return null;

  let parsedPayload: ParsedDomPayload = {};
  try {
    parsedPayload = typeof log.log_message === 'string' 
      ? JSON.parse(log.log_message) 
      : log.log_message;
  } catch {
    parsedPayload = { fullDom: log.log_message };
  }

  const fullDomText = parsedPayload.fullDom || JSON.stringify(parsedPayload, null, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1E293B] border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 bg-[#111827] border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">code_blocks</span>
            <h3 className="font-bold text-sm text-slate-100">
              수신받은 DOM 데이터 내용 [<span className="text-blue-300 font-mono">{clientId}</span>]
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* 모달 본문 정보 */}
        <div className="p-6 overflow-y-auto flex flex-col gap-4 font-sans text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#111827] p-4 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-500 font-semibold block mb-1">페이지 제목</span>
              <span className="text-slate-200 font-medium">{parsedPayload.title || '제목 없음'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-1">수신 URL</span>
              <a
                href={parsedPayload.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline truncate block"
              >
                {parsedPayload.url || 'N/A'}
              </a>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-1">수신 타임스탬프</span>
              <span className="text-slate-300 font-mono">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-1">데이터 크기</span>
              <span className="text-emerald-400 font-mono">
                {(fullDomText.length / 1024).toFixed(2)} KB
              </span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-slate-300 text-xs">페이지 전체 DOM 원본 (HTML Source)</span>
              <button
                onClick={() => navigator.clipboard.writeText(fullDomText)}
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded transition border border-slate-700 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">content_copy</span>
                클립보드 복사
              </button>
            </div>
            <pre className="bg-[#0F172A] p-4 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-[400px] whitespace-pre-wrap break-all leading-relaxed">
              {fullDomText}
            </pre>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-3 bg-[#111827] border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-4 py-2 rounded-lg transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}