// plugins/opera-plugin/src/components/ActionRunnerView.tsx

import { useBestOfRedRunner } from "../hooks/useBestOfRedRunner.js";
import { XvBestOfRedInitData } from "../types/index.js";

/** 실행기 훅 반환 타입 중 뷰가 사용할 형태 (원본 훅 리턴 타입 축약) */
export type ActionRunnerApi = ReturnType<typeof useBestOfRedRunner>;

/** 상태별 표시 라벨 매핑 */
const STATUS_LABELS: Record<string, string> = {
  idle: "대기",
  init: "초기 정보 조회",
  running: "실행 중",
  completed: "완료",
  stopped: "중지됨",
  error: "오류",
};

/** 상태별 배지 색상 클래스 매핑 */
const STATUS_CLASSES: Record<string, string> = {
  idle: "bg-slate-700/40 text-slate-400 border-slate-600",
  init: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  running: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  stopped: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  error: "bg-red-500/20 text-red-300 border-red-500/40",
};

/**
 * 액션 실행기 뷰 컴포넌트입니다.
 * 전용 팝업 창에서 감지된 페이지 수/진행 상황/시작·중지 버튼과
 * 페이지별 행동 로그(이동 중/로딩 완료/수집/저장) 콘솔을 렌더링합니다.
 *
 * @param runner - useBestOfRedRunner() 반환 상태·액션
 * @param tabId - 대상 xvideos best-of-red 탭 ID
 */
export function ActionRunnerView({
  runner,
  tabId,
}: {
  runner: ActionRunnerApi;
  tabId: number;
}) {
  const { status, logs, initInfo, progress, isRunning, start, stop } = runner;

  return (
    <div className="w-full min-h-screen bg-[#0d131f] text-slate-100 flex flex-col p-4 box-border select-text font-sans">
      {/* 실행기 헤더 */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-700/60">
        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
        <h1 className="text-sm font-bold text-slate-100 shrink-0">
          액션 실행기 · best-of-red 자동 이동
        </h1>
        <span
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${STATUS_CLASSES[status] || STATUS_CLASSES.idle}`}
        >
          {STATUS_LABELS[status] || status}
        </span>
        <button
          onClick={() => window.close()}
          className="btn-mini ml-auto"
          title="실행기 창 닫기 (진행 중이면 중단됨)"
        >
          닫기
        </button>
      </div>

      {/* 감지된 페이지 수 + 진행 바 */}
      <div className="py-2 space-y-1.5">
        {initInfo && <InitInfoView initInfo={initInfo} />}
        {progress && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] text-slate-400">
              {progress.current}/{progress.total}
            </span>
          </div>
        )}
        {status === "completed" && (
          <div className="text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">
            전체 수집이 완료되었습니다. 저장 경로: images/xvideos.com/
            {initInfo ? initInfo.basePath.replace(/^\//, "") : "best-of-red"}/...
          </div>
        )}
      </div>

      {/* 실행/중지 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={() => void start(tabId)}
          disabled={isRunning}
          className="btn-primary flex-1"
        >
          <span>{isRunning ? "실행 중..." : "액션 시작"}</span>
        </button>
        <button
          onClick={stop}
          disabled={!isRunning}
          className="btn-secondary flex-1"
        >
          <span>중지</span>
        </button>
      </div>

      {/* 행동 로그 콘솔 (창 전체 페이지 스크롤로 자연 높이 펼침) */}
      <div className="mt-3 rounded-lg border border-slate-700/60 bg-[#0a101a] overflow-hidden flex-1">
        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 border-b border-slate-700/60">
          행동 로그
        </div>
        <div className="p-2 space-y-1">
          {logs.length === 0 && (
            <p className="text-[10px] text-slate-600">
              로그가 없습니다. "액션 시작"을 누르면 페이지별 이동/로딩 완료/수집/저장
              로그가 콘솔처럼 출력됩니다.
            </p>
          )}
          {logs.map((log) => (
            <div
              key={log.id}
              className={`text-[10px] leading-relaxed ${
                log.level === "success"
                  ? "text-emerald-400"
                  : log.level === "error"
                  ? "text-red-400"
                  : log.level === "warning"
                  ? "text-amber-400"
                  : "text-slate-400"
              }`}
            >
              {log.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 감지된 best-of-red 초기 정보(총 페이지 수·베이스 경로·시작 페이지)를 렌더링합니다.
 *
 * @param initInfo - 초기 정보 응답 데이터
 */
function InitInfoView({ initInfo }: { initInfo: XvBestOfRedInitData }) {
  return (
    <div className="text-[11px] text-sky-300/90 bg-sky-500/10 border border-sky-500/30 rounded px-2 py-1 space-y-0.5">
      <div className="break-all">
        베이스 경로: <span className="text-slate-200">{initInfo.basePath}</span>
      </div>
      <div>
        감지된 총 페이지 수:{" "}
        <span className="text-slate-200">{initInfo.totalPages}페이지</span>
        <span className="text-slate-500">
          {" "}
          (시작 {initInfo.currentPage} ~ 마지막 {initInfo.maxPage})
        </span>
      </div>
    </div>
  );
}
