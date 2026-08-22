// plugins/basic-plugin/src/components/Header.tsx

/** Header 컴포넌트 Props */
interface HeaderProps {
  /** 로컬 서버 WebSocket 연결 온라인 여부 (상태 배지 표시에 사용) */
  isServerOnline: boolean;
}

/**
 * 사이드바 최상단 헤더 컴포넌트입니다.
 * 플러그인 식별 타이틀과 서버 연결 상태 배지를 한 행에 표시해
 * 어떤 플러그인인지, 서버에 연결되어 있는지 최상단에서 즉시 확인할 수 있습니다.
 *
 * @param props - isServerOnline 참조
 * @returns 헤더 바 JSX
 */
export function Header({ isServerOnline }: HeaderProps) {
  return (
    <div className="popup-header">
      <div className="popup-title-row">
        <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.8)] flex-shrink-0" />
        <span className="popup-title">WebCrawlServer opera</span>
        {/* 서버 연결 상태 배지 — 온라인(초록)/오프라인(빨강)을 색상으로 즉시 구별 */}
        <span
          role="status"
          aria-label={isServerOnline ? "서버 온라인" : "서버 오프라인"}
          title={
            isServerOnline
              ? "로컬 서버에 연결되어 있습니다"
              : "로컬 서버 연결이 끊겼습니다"
          }
          className={`server-status-badge ${isServerOnline ? "on" : "off"}`}
        >
          {isServerOnline ? "서버 연결" : "서버 끊김"}
        </span>
      </div>
    </div>
  );
}
