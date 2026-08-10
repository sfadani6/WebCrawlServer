// plugins/basic-plugin/src/components/XvideosManagerView.tsx

import {
  XvideosManagerLog,
  useXvideosDownloadManager,
} from "../hooks/useXvideosDownloadManager.js";
import { XvideosDownloadItem } from "../types/index.js";

/** 매니저 훅 반환 타입 중 뷰가 사용할 형태 (원본 훅 리턴 타입 축약) */
export type XvideosManagerApi = ReturnType<typeof useXvideosDownloadManager>;

/**
 * xvideos 다운로드 매니저 뷰 컴포넌트입니다.
 * 전용 팝업 창에서 넓은 목록/저장 위치/진행·초기화 버튼/로그를 렌더링합니다.
 * (사이드바 패널의 좁은 폭 문제를 해소하기 위해 전용 창에서 독립 동작)
 *
 * @param manager - useXvideosDownloadManager() 반환 상태·액션
 * @param tabId - 대상 xvideos 탭 ID
 * @param onAutoBuild - 최초 자동 목록 생성 여부 콜백 (false 처리용)
 */
export function XvideosManagerView({
  manager,
  tabId,
}: {
  manager: XvideosManagerApi;
  tabId: number;
}) {
  const {
    downloadList,
    isRunning,
    pageUrl,
    storageDir,
    statusMessage,
    logs,
    buildList,
    startQueue,
    reset,
  } = manager;

  return (
    <div className="w-full min-h-screen bg-[#0d131f] text-slate-100 flex flex-col p-4 box-border select-text font-sans">
      {/* 매니저 헤더 */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-700/60">
        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
        <h1 className="text-sm font-bold text-slate-100 shrink-0">
          xvideos 다운로드 매니저
        </h1>
        {pageUrl && (
          <span className="text-[10px] text-slate-500 truncate min-w-0">
            {pageUrl}
          </span>
        )}
        <button
          onClick={() => window.close()}
          className="btn-mini ml-auto"
          title="매니저 창 닫기"
        >
          닫기
        </button>
      </div>

      {/* 저장 위치 + 상태 메시지 */}
      <div className="py-2 space-y-1.5">
        {storageDir && (
          <div className="text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1 break-all">
            저장 위치: {storageDir}
          </div>
        )}
        {statusMessage && (
          <div className="text-[11px] text-sky-300/90 bg-sky-500/10 border border-sky-500/30 rounded px-2 py-1">
            {statusMessage}
          </div>
        )}
      </div>

      {/* 다운로드 목록 (창 전체 페이지 스크롤로 자연 높이 펼침) */}
      <div className="rounded-lg border border-slate-700/60 bg-[#121a26] divide-y divide-slate-700/40">
        {downloadList.length === 0 ? (
          <div className="p-4 text-[11px] text-slate-500 leading-relaxed">
            다운로드 목록이 비어 있습니다.
            <br />
            아래 "목록 생성" 버튼으로 xvideos 페이지의 비디오 블록(썸네일 2종 +
            프리뷰 mp4) 또는 현재 영상 페이지의 포스터 이미지(1종)를 파싱한 뒤
            진행 버튼으로 순차 다운로드합니다.
          </div>
        ) : (
          downloadList.map((item) => (
            <DownloadListItem key={item.bundleId} item={item} />
          ))
        )}
      </div>

      {/* 진행/초기화/목록 생성 버튼 */}
      <div className="flex gap-2 pt-3">
        <button
          onClick={() => void buildList(tabId)}
          disabled={isRunning}
          className="btn-secondary flex-1"
        >
          <span>목록 생성</span>
        </button>
        <button
          onClick={() => void startQueue()}
          disabled={isRunning || downloadList.length === 0}
          className="btn-primary flex-[2]"
        >
          <span>{isRunning ? "진행 중..." : "다운로드 진행"}</span>
        </button>
        <button
          onClick={reset}
          disabled={isRunning}
          className="btn-mini"
        >
          초기화
        </button>
      </div>

      {/* 로그 터미널 */}
      <div className="mt-3 rounded-lg border border-slate-700/60 bg-[#0a101a] overflow-hidden">
        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 border-b border-slate-700/60">
          로그
        </div>
        <div className="max-h-32 overflow-y-auto p-2 space-y-1">
          {logs.length === 0 && (
            <p className="text-[10px] text-slate-600">로그가 없습니다.</p>
          )}
          {logs.map((log) => (
            <LogLine key={log.id} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 다운로드 항목 상태의 표시 라벨/색상 클래스를 반환합니다.
 *
 * @param status - 항목 다운로드 상태
 * @returns 표시 라벨 및 CSS 클래스
 */
function getDownloadStatusInfo(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case "downloading":
      return {
        label: "다운로드",
        className: "bg-sky-500/20 text-sky-300 border-sky-500/40",
      };
    case "done":
      return {
        label: "완료",
        className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      };
    case "failed":
      return {
        label: "실패",
        className: "bg-red-500/20 text-red-300 border-red-500/40",
      };
    default:
      return {
        label: "대기",
        className: "bg-slate-700/40 text-slate-400 border-slate-600",
      };
  }
}

/**
 * 다운로드 목록 항목 1건을 렌더링합니다.
 * (상태 배지 + 제목 + 클릭 URL + 다운로드 대상 이미지 URL 3종 + 진행률 바 + 저장 결과)
 *
 * @param item - 다운로드 큐 항목
 */
function DownloadListItem({ item }: { item: XvideosDownloadItem }) {
  const statusInfo = getDownloadStatusInfo(item.status);
  const progress = item.progress || 0;
  const isDownloading = item.status === "downloading";

  const progressBarClass =
    item.status === "done"
      ? "bg-emerald-500"
      : item.status === "failed"
      ? "bg-red-500"
      : "bg-sky-500";

  return (
    <div className="flex items-start gap-2 px-2 py-2">
      <span
        className={`mt-0.5 shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${statusInfo.className}`}
      >
        {statusInfo.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-slate-200 truncate">
          {item.entry.title || "(제목 없음)"}
        </div>
        <div className="text-[10px] text-slate-500 truncate">
          {item.entry.clickUrl}
        </div>

        {/* 다운로드 대상 이미지 URL 주소 (선택·복사 가능) */}
        <div className="mt-1 space-y-0.5">
          {item.entry.mainUrl && (
            <div className="text-[10px] text-slate-400 break-all leading-relaxed">
              <span className="text-slate-500 select-none">image_url: </span>
              {item.entry.mainUrl}
            </div>
          )}
          {item.entry.sfwUrl && (
            <div className="text-[10px] text-slate-400 break-all leading-relaxed">
              <span className="text-slate-500 select-none">sfw_image_url: </span>
              {item.entry.sfwUrl}
            </div>
          )}
          {item.entry.previewUrl && (
            <div className="text-[10px] text-slate-400 break-all leading-relaxed">
              <span className="text-slate-500 select-none">preview_video_url: </span>
              {item.entry.previewUrl}
            </div>
          )}
        </div>

        {/* 항목별 다운로드 진행률 바 */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
            {isDownloading && progress === 0 ? (
              <div className="progress-bar-indeterminate h-full w-full" />
            ) : (
              <div
                className={`h-full rounded-full transition-all duration-300 ${progressBarClass}`}
                style={{ width: `${progress}%` }}
              />
            )}
          </div>
          <span className="shrink-0 w-8 text-right text-[10px] text-slate-400">
            {progress}%
          </span>
        </div>

        {item.status === "done" && item.savedDir && (
          <div className="text-[10px] text-emerald-400/90 truncate mt-1">
            {item.savedDir}
          </div>
        )}
        {item.status === "failed" && item.error && (
          <div className="text-[10px] text-red-400/90 truncate mt-1">
            {item.error}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 로그 1줄을 렌더링합니다. (레벨별 색상 구분)
 *
 * @param log - 로그 항목
 */
function LogLine({ log }: { log: XvideosManagerLog }) {
  const colorClass =
    log.level === "success"
      ? "text-emerald-400"
      : log.level === "error"
      ? "text-red-400"
      : log.level === "warning"
      ? "text-amber-400"
      : "text-slate-400";
  return (
    <div className={`text-[10px] leading-relaxed ${colorClass}`}>{log.text}</div>
  );
}
