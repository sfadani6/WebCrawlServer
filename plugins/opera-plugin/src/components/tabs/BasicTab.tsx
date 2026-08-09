// plugins/opera-plugin/src/components/tabs/BasicTab.tsx

import { useState } from "react";

/** DOM 전송 대상 모드 구분자 */
type DomSendMode = "full" | "element" | "frame";

/** 기본 탭 컴포넌트 Props */
interface BasicTabProps {
  /** 서버 연동 상태 */
  isServerOnline: boolean;
  /** 현재 페이지 URL (활성 탭 감시 자동 갱신) */
  currentUrl: string;
  /** 전체 DOM 전송 중 여부 */
  isSending: boolean;
  /** 처리 상태 안내 메시지 */
  statusMessage: string;
  /** 전체 DOM 전송 콜백 */
  onSendFullDom: () => void;
  /** 요소 선택 모드 활성 여부 */
  isElementPicking: boolean;
  /** 요소 선택 모드 시작 콜백 */
  onStartElementPicker: () => void;
  /** 요소 선택 모드 종료 콜백 */
  onStopElementPicker: () => void;
  /** 현재 페이지 iframe 존재 여부 */
  hasFrame: boolean;
  /** 현재 페이지 iframe 개수 */
  frameCount: number;
  /** 프레임 DOM 수집 중 여부 */
  isFrameCollecting: boolean;
  /** 프레임 DOM 수집 콜백 */
  onCollectFrameDom: () => void;
  /** 이미지 수집 중 여부 */
  isImageCollecting: boolean;
  /** 이미지 수집 콜백 */
  onCollectImages: () => void;
}

/**
 * 기본 수집 탭 컴포넌트입니다.
 * DOM 전송(전체/요소선택/프레임), 이미지 수집, 액션 실행(미개발) 섹션을
 * 아코디언+카드 형태로 제공합니다. 현재 페이지 URL은 활성 탭을 실시간 감시해 자동 갱신됩니다.
 */
export function BasicTab({
  isServerOnline,
  currentUrl,
  isSending,
  statusMessage,
  onSendFullDom,
  isElementPicking,
  onStartElementPicker,
  onStopElementPicker,
  hasFrame,
  frameCount,
  isFrameCollecting,
  onCollectFrameDom,
  isImageCollecting,
  onCollectImages,
}: BasicTabProps) {
  // 섹션 아코디언 열림/닫힘 상태 (기본 DOM 전송 섹션 열림)
  const [openSection, setOpenSection] = useState<string>("dom");
  // DOM 전송 대상 모드 (라디오 선택)
  const [sendMode, setSendMode] = useState<DomSendMode>("full");

  /** 섹션 아코디언 토글 핸들러 */
  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? "" : section));
  };

  /** 요소 선택 모드 토글 (진행 중이면 중지, 아니면 시작) */
  const handleElementPickToggle = () => {
    if (isElementPicking) {
      onStopElementPicker();
    } else {
      onStartElementPicker();
    }
  };

  /** DOM 전송 모드별 실행 버튼 클릭 핸들러 */
  const handleDomSendExecute = () => {
    if (sendMode === "full") {
      onSendFullDom();
    } else if (sendMode === "element") {
      handleElementPickToggle();
    } else if (sendMode === "frame") {
      onCollectFrameDom();
    }
  };

  /** 실행 버튼 라벨 (모드별 상태 반영) */
  const getSendButtonLabel = () => {
    if (sendMode === "element") {
      return isElementPicking ? "요소 선택 취소 (ESC)" : "요소 선택 시작";
    }
    if (sendMode === "frame") {
      return isFrameCollecting ? "프레임 전송 중..." : "프레임 DOM 전송";
    }
    return isSending ? "전송 중..." : "전체 DOM 전송";
  };

  /** 실행 버튼 아이콘 (모드별 구분) */
  const getSendButtonIcon = () => {
    if (isSending || isElementPicking || isFrameCollecting) return "sync";
    if (sendMode === "element") return "ads_click";
    if (sendMode === "frame") return "web_stories";
    return "upload_file";
  };

  return (
    <div className="tab-content">
      {/* 서버 연동 상태 안내 카드 */}
      <div className={`status-card ${isServerOnline ? "online" : "offline"}`}>
        <span className={`status-dot ${isServerOnline ? "online" : "offline"}`}></span>
        <span>
          {isServerOnline
            ? "서버 온라인 - WebSocket 연결됨"
            : "서버 오프라인 - WebCrawlServer 실행 필요"}
        </span>
      </div>

      {/* 현재 페이지 URL 표시 카드 */}
      <div className="url-card">
        <span className="url-label flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-sky-400">link</span>
          현재 페이지 URL <span className="text-sky-400/80">(자동 갱신)</span>
        </span>
        <div className="url-value truncate">{currentUrl}</div>
      </div>

      {/* 처리 상태 안내 메시지 */}
      {statusMessage && (
        <div className="text-[11px] text-center text-sky-300 bg-[#162032] p-2 rounded-lg border border-slate-700/60">
          {statusMessage}
        </div>
      )}

      {/* [1] DOM 전송 아코디언 섹션 */}
      <div className="section-card">
        <button
          onClick={() => toggleSection("dom")}
          className="section-header"
        >
          <span className="material-symbols-outlined text-base text-sky-400">data_object</span>
          <span className="flex-1 text-left font-semibold">DOM 전송</span>
          <span className="material-symbols-outlined text-base text-slate-400 transition-transform">
            {openSection === "dom" ? "expand_more" : "chevron_right"}
          </span>
        </button>

        {openSection === "dom" && (
          <div className="section-body">
            {/* 전송 대상 라디오 선택 */}
            <div className="flex flex-col gap-2">
              <label className={`radio-item ${sendMode === "full" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="dom-send-mode"
                  checked={sendMode === "full"}
                  onChange={() => setSendMode("full")}
                />
                <span className="material-symbols-outlined text-sm">web</span>
                <span className="flex-1">
                  <span className="block text-[12px] font-semibold">전체</span>
                  <span className="block text-[10px] text-slate-400">
                    현재 페이지 전체 DOM을 서버로 전송
                  </span>
                </span>
              </label>

              <label className={`radio-item ${sendMode === "element" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="dom-send-mode"
                  checked={sendMode === "element"}
                  onChange={() => setSendMode("element")}
                />
                <span className="material-symbols-outlined text-sm">ads_click</span>
                <span className="flex-1">
                  <span className="block text-[12px] font-semibold">요소 선택</span>
                  <span className="block text-[10px] text-slate-400">
                    마우스로 요소 선택 후 해당 요소만 전송
                  </span>
                </span>
              </label>

              <label
                className={`radio-item ${sendMode === "frame" ? "active" : ""} ${
                  !hasFrame ? "disabled" : ""
                }`}
              >
                <input
                  type="radio"
                  name="dom-send-mode"
                  checked={sendMode === "frame"}
                  disabled={!hasFrame}
                  onChange={() => setSendMode("frame")}
                />
                <span className="material-symbols-outlined text-sm">web_stories</span>
                <span className="flex-1">
                  <span className="block text-[12px] font-semibold">프레임</span>
                  <span className="block text-[10px] text-slate-400">
                    {hasFrame
                      ? `현재 페이지 iframe ${frameCount}개 중 첫 번째 프레임 전송`
                      : "iframe이 존재하지 않아 사용 불가"}
                  </span>
                </span>
              </label>
            </div>

            {/* 모드별 실행 버튼 */}
            <button
              onClick={handleDomSendExecute}
              disabled={
                !isServerOnline ||
                isSending ||
                (sendMode === "element" && isElementPicking)
                || (sendMode === "frame" && (!hasFrame || isFrameCollecting))
              }
              className={`send-button mt-3 ${
                sendMode === "element" && !isElementPicking ? "send-button-accent" : ""
              }`}
            >
              <span
                className={`material-symbols-outlined text-base ${
                  isSending || isElementPicking || isFrameCollecting ? "animate-spin" : ""
                }`}
              >
                {getSendButtonIcon()}
              </span>
              <span>{getSendButtonLabel()}</span>
            </button>

            {sendMode === "element" && isElementPicking && (
              <div className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/30 mt-2">
                페이지에서 원하는 요소 위에 마우스를 올려 파란 테두리를 확인한 뒤 클릭하세요. 전송 버튼을 누르면 해당 요소만 전송됩니다.
              </div>
            )}
          </div>
        )}
      </div>

      {/* [2] 이미지 수집 아코디언 섹션 */}
      <div className="section-card">
        <button onClick={() => toggleSection("images")} className="section-header">
          <span className="material-symbols-outlined text-base text-emerald-400">image</span>
          <span className="flex-1 text-left font-semibold">이미지 수집</span>
          <span className="material-symbols-outlined text-base text-slate-400 transition-transform">
            {openSection === "images" ? "expand_more" : "chevron_right"}
          </span>
        </button>

        {openSection === "images" && (
          <div className="section-body">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              현재 페이지의 모든 이미지를 추출해 서버의 지정 폴더에 저장합니다.
              크로스 오리진 이미지는 원본 URL 참조 파일로 보관됩니다.
            </p>
            <button
              onClick={onCollectImages}
              disabled={isImageCollecting || !isServerOnline}
              className="send-button mt-3"
            >
              <span
                className={`material-symbols-outlined text-base ${
                  isImageCollecting ? "animate-spin" : ""
                }`}
              >
                {isImageCollecting ? "sync" : "photo_library"}
              </span>
              <span>{isImageCollecting ? "이미지 수집 중..." : "이미지 수집 및 전송"}</span>
            </button>
          </div>
        )}
      </div>

      {/* [3] 액션 실행 아코디언 섹션 (미개발) */}
      <div className="section-card">
        <button
          onClick={() => toggleSection("actions")}
          className="section-header opacity-80"
        >
          <span className="material-symbols-outlined text-base text-purple-400">play_circle</span>
          <span className="flex-1 text-left font-semibold">액션 실행</span>
          <span className="text-[10px] text-slate-500 border border-slate-600 rounded px-1.5 py-0.5">
            미개발
          </span>
          <span className="material-symbols-outlined text-base text-slate-400 transition-transform">
            {openSection === "actions" ? "expand_more" : "chevron_right"}
          </span>
        </button>

        {openSection === "actions" && (
          <div className="section-body">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              페이지 자동화 액션(다중 포스팅, 자동 크롤링 등)을 실행하는 영역입니다.
              현재 설계 단계이며, 완성 후 활성화됩니다.
            </p>
            <button
              disabled
              className="send-button mt-3 opacity-60 cursor-not-allowed"
              title="액션 실행은 아직 개발되지 않았습니다."
            >
              <span className="material-symbols-outlined text-base">play_circle</span>
              <span>액션 실행 (개발 예정)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
