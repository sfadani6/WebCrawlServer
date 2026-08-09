// plugins/basic-plugin/src/components/tabs/BasicTab.tsx

interface BasicTabProps {
  isServerOnline: boolean;
  currentUrl: string;
  isSending: boolean;
  statusMessage: string;
  onSendFullDom: () => void;
}

export function BasicTab({
  isServerOnline,
  currentUrl,
  isSending,
  statusMessage,
  onSendFullDom
}: BasicTabProps) {
  return (
    <div className="tab-content">
      {/* 서버 연동 상태 안내 카드 */}
      <div className={`status-card ${isServerOnline ? 'online' : 'offline'}`}>
        <span className={`status-dot ${isServerOnline ? 'online' : 'offline'}`}></span>
        <span>
          {isServerOnline
            ? '서버 온라인 - WebSocket 연결됨'
            : '서버 오프라인 - WebCrawlServer 실행 필요'}
        </span>
      </div>

      {/* 현재 페이지 URL 표시 카드 */}
      <div className="url-card">
        <span className="url-label">현재 페이지 URL</span>
        <div className="url-value truncate">{currentUrl}</div>
      </div>

      {/* 메인 DOM 수집 및 전송 버튼 */}
      <button
        onClick={onSendFullDom}
        disabled={isSending || !isServerOnline}
        className="send-button"
      >
        <span className={`material-symbols-outlined text-base ${isSending ? 'animate-spin' : ''}`}>
          {isSending ? 'sync' : 'upload_file'}
        </span>
        <span>{isSending ? '전송 중...' : 'WebCrawlServer로 전송'}</span>
      </button>

      {/* 처리 상태 안내 메시지 */}
      {statusMessage && (
        <div className="text-[11px] text-center text-sky-300 bg-[#162032] p-2 rounded-lg border border-slate-700/60">
          {statusMessage}
        </div>
      )}
    </div>
  );
}