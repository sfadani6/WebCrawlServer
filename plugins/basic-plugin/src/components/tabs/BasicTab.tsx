// plugins/basic-plugin/src/components/tabs/BasicTab.tsx

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
  /** 이미지 수집 콜백 (카테고리 구분) */
  onCollectImages: (category: string) => void;
  /** 사이트 정보 수집 콜백 */
  onCollectSiteInfo: () => void;
  /** xvideos 다운로드 매니저 팝업 창 열기 콜백 */
  onOpenXvideosManager: () => void;
  /** xvideos 페이징 액션 실행기 팝업 창 열기 콜백 */
  onOpenXvBestOfRedAction: () => void;
}

/** 이미지 수집 카테고리 표시 이름 매핑 */
const CATEGORY_LABELS: Record<string, string> = {
  normal: "일반 이미지 수집",
  album: "앨범 수집",
  cover: "표지 수집",
  info: "정보 수집",
};

/** 사이트 전용 수집 버튼 구성 (도메인 → 카테고리 목록) */
const SITE_IMAGE_BUTTONS: Record<string, string[]> = {
  "xchina.co": ["normal", "album", "cover", "info"],
  "xvideos.com": ["normal", "info"],
  "xvideos.red": ["normal", "info"],
};

/**
 * 도메인별 사이트 전용 수집 설정 매칭 여부를 판별합니다.
 * 현재 페이지 호스트가 등록된 사이트 도메인의 하위 도메인인지 확인합니다.
 *
 * @param currentUrl - 현재 페이지 URL
 * @returns 매칭된 사이트 도메인 (없으면 null)
 */
function matchSiteDomain(currentUrl: string): string | null {
  try {
    const hostname = new URL(currentUrl).hostname.toLowerCase();
    const entries = Object.keys(SITE_IMAGE_BUTTONS);
    return entries.find((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) || null;
  } catch {
    return null;
  }
}

/**
 * 기본 수집 탭 컴포넌트입니다.
 * DOM 전송(전체/요소선택/프레임), 이미지 수집, 액션 실행 섹션을
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
  onCollectSiteInfo,
  onOpenXvideosManager,
  onOpenXvBestOfRedAction,
}: BasicTabProps) {
  // 섹션 아코디언 열림/닫힘 상태 (기본 DOM 전송 섹션 열림)
  const [openSection, setOpenSection] = useState<string>("dom");
  // DOM 전송 대상 모드 (라디오 선택)
  const [sendMode, setSendMode] = useState<DomSendMode>("full");
  // 현재 페이지와 매칭된 사이트 전용 도메인 (없으면 null)
  const matchedSite = matchSiteDomain(currentUrl);

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
        <span className="url-label">
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
          <span className="flex-1 text-left font-semibold">DOM 전송</span>
          <span className="text-slate-400 text-sm leading-none">
            {openSection === "dom" ? "▼" : "▶"}
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
              className={`btn-primary mt-3 ${
                sendMode === "element" && !isElementPicking ? "btn-accent" : ""
              }`}
            >
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
          <span className="flex-1 text-left font-semibold">이미지 수집</span>
          <span className="text-slate-400 text-sm leading-none">
            {openSection === "images" ? "▼" : "▶"}
          </span>
        </button>

        {openSection === "images" && (
          <div className="section-body">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              현재 페이지의 렌더링된 이미지를 추출해 서버의 도메인/카테고리별 폴더에
              저장합니다. 크로스 오리진 이미지는 원본 URL 참조 파일로 보관됩니다.
            </p>

            {/* [1] 일반 이미지 수집 (모든 페이지) */}
            <button
              onClick={() => onCollectImages("normal")}
              disabled={isImageCollecting || !isServerOnline}
              className="btn-primary mt-3"
            >
              <span>
                {isImageCollecting
                  ? "이미지 수집 중..."
                  : "일반 이미지 수집 (normal)"}
              </span>
            </button>

            {/* [2] 사이트 전용 수집 버튼 그룹 (항상 3그룹 표시, 비매칭 사이트는 비활성화) */}
            {Object.entries(SITE_IMAGE_BUTTONS).map(([site, categories]) => {
              const isMatched = matchedSite === site;
              return (
                <div
                  key={site}
                  className="mt-3 rounded-lg border border-slate-700/60 bg-[#162032] p-3"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[11px] font-semibold text-slate-200">
                      {site} 전용 수집
                    </span>
                    <span
                      className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
                        isMatched
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-slate-700/40 text-slate-400 border-slate-600"
                      }`}
                    >
                      {isMatched ? "현재 도메인" : "다른 도메인"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((category) => {
                      const isInfo = category === "info";
                      // xvideos.com "normal"은 전용 팝업 창 다운로드 매니저 열기로 연결
                      const isXvideosManager = site === "xvideos.com" && category === "normal";
                      return (
                        <button
                          key={category}
                          onClick={() =>
                            isInfo
                              ? onCollectSiteInfo()
                              : isXvideosManager
                              ? onOpenXvideosManager()
                              : onCollectImages(category)
                          }
                          disabled={!isMatched || isImageCollecting || !isServerOnline}
                          title={
                            isMatched
                              ? isXvideosManager
                                ? "전용 팝업 창에서 비디오 블록 미디어(썸네일+mp4) 다운로드 매니저 열기"
                                : CATEGORY_LABELS[category]
                              : `${site} 페이지에서만 사용할 수 있습니다`
                          }
                          className="btn-secondary"
                        >
                          {isXvideosManager
                            ? "다운로드 매니저 열기"
                            : CATEGORY_LABELS[category]}
                        </button>
                      );
                    })}
                  </div>

                  {/* xvideos 다운로드 매니저 안내 (목록은 전용 팝업 창에서 표시) */}
                  {site === "xvideos.com" && isMatched && (
                    <p className="mt-3 border-t border-slate-700/60 pt-3 text-[10px] text-slate-500 leading-relaxed">
                      "다운로드 매니저 열기" 버튼으로 새 팝업 창을 열어 넓은
                      목록에서 순차 다운로드를 진행합니다. xvideos 페이징 액션은
                      아래 "액션 실행" 섹션의 xvideos.com · xvideos.red 액션
                      모듈에서 실행합니다.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* [3] 액션 실행 아코디언 섹션 (액션 모듈 실행 영역) */}
      <div className="section-card">
        <button
          onClick={() => toggleSection("actions")}
          className="section-header"
        >
          <span className="flex-1 text-left font-semibold">액션 실행</span>
          <span className="text-slate-400 text-sm leading-none">
            {openSection === "actions" ? "▼" : "▶"}
          </span>
        </button>

        {openSection === "actions" && (
          <div className="section-body">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              사이트별 페이지 자동화 액션 모듈을 실행하는 영역입니다. 각 액션은
              전용 팝업 창에서 진행 로그(이동/로딩 완료/수집/저장)를 콘솔처럼
              출력하며 실행됩니다.
            </p>

            {/* xvideos.com · xvideos.red 페이징 액션 모듈 */}
            <div className="mt-3 rounded-lg border border-slate-700/60 bg-[#121a26] p-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                <h3 className="text-[11px] font-bold text-slate-200 shrink-0">
                  xvideos.com · xvideos.red
                </h3>
                <span className="text-[10px] text-slate-500 truncate min-w-0">
                  {matchedSite === "xvideos.com" || matchedSite === "xvideos.red"
                    ? "현재 페이지와 일치"
                    : "xvideos 페이징 페이지에서 활성화"}
                </span>
              </div>

              <button
                onClick={onOpenXvBestOfRedAction}
                disabled={
                  (matchedSite !== "xvideos.com" && matchedSite !== "xvideos.red") ||
                  !isServerOnline
                }
                title={
                  matchedSite === "xvideos.com" || matchedSite === "xvideos.red"
                    ? "현재 페이지의 카테고리·월(예: /best/2026-03)부터 마지막 페이지까지 순차 이동하며 각 페이지 비디오 메타를 수집·저장 (전용 팝업 창)"
                    : "xvideos.com 또는 xvideos.red 페이징 페이지에서 사용할 수 있습니다"
                }
                className="btn-secondary w-full mt-2"
              >
                xvideos 페이징 액션
              </button>
              <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
                페이지 수를 감지해 1페이지씩 순차 이동합니다. 각 페이지는 이미지
                로딩이 완전히 끝난 뒤 수집하며, 저장 경로는 현재 URL을 분석해
                도메인/카테고리/월/페이지 규칙(예: images/xvideos.red/best/2026-03/1/)
                으로 자동 분리됩니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
