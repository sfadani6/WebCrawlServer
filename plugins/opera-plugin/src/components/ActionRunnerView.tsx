// plugins/opera-plugin/src/components/ActionRunnerView.tsx

import { useMemo, useEffect, useState } from "react";
import {
  useBestOfRedRunner,
  ActionRunnerLog,
} from "../hooks/useBestOfRedRunner.js";
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

/** 로그 레벨별 텍스트 색상 클래스 매핑 */
const LOG_LEVEL_CLASSES: Record<string, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-slate-400",
};

/** 전역(페이지 미귀속) 로그 그룹 키 */
const GLOBAL_GROUP_KEY = "__global__";

/**
 * 액션 실행기 뷰 컴포넌트입니다.
 * 전용 팝업 창에서 감지된 페이지 수/진행 상황/시작·중지 버튼과
 * 페이지별 행동 로그(이동 중/로딩 완료/수집/저장)를 **페이지별 트리 구조**로
 * 렌더링합니다. 각 페이지는 `<ul>` 하위에 작업 로그를 담고 열고 펼칠 수 있으며,
 * 현재 처리 중인 페이지는 자동으로 펼쳐집니다. (스크롤 길이 방지)
 *
 * @param runner - useBestOfRedRunner() 반환 상태·액션
 * @param tabId - 대상 xvideos 페이징 탭 ID
 */
export function ActionRunnerView({
  runner,
  tabId,
}: {
  runner: ActionRunnerApi;
  tabId: number;
}) {
  const { status, logs, initInfo, progress, summary, isRunning, start, stop } =
    runner;
  // 사용자가 명시적으로 펼친/접은 페이지 인덱스 집합 (기본은 현재 페이지만 펼침)
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  // 로그를 페이지 그룹 순서대로 묶습니다 (등장 순서 유지, 전역 로그 포함)
  const groups = useMemo(() => {
    const list: Array<{
      key: string;
      page: number | null;
      logs: ActionRunnerLog[];
    }> = [];
    const index = new Map<string, number>();
    for (const log of logs) {
      const key = log.page === null ? GLOBAL_GROUP_KEY : `p_${log.page}`;
      const existing = index.get(key);
      if (existing === undefined) {
        index.set(key, list.length);
        list.push({ key, page: log.page, logs: [] });
      }
      list[index.get(key)!].logs.push(log);
    }
    return list;
  }, [logs]);

  // 현재 처리 중(마지막 페이지 로그가 속한) 페이지 인덱스
  const currentPage = useMemo(() => {
    let latest: number | null = null;
    for (const log of logs) {
      if (log.page !== null) latest = log.page;
    }
    return latest;
  }, [logs]);

  // 현재 페이지로 변경되면 해당 그룹을 화면 안으로 자동 스크롤합니다.
  useEffect(() => {
    if (currentPage === null) return;
    document
      .getElementById(`bofr-page-group-${currentPage}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [currentPage]);

  /** 페이지 그룹의 유효 펼침 상태 계산 (사용자 토글 → 기본 현재 페이지만 펼침) */
  const isPageOpen = (page: number) => {
    if (expanded.has(page)) return true;
    if (collapsed.has(page)) return false;
    return page === currentPage;
  };

  /** 페이지 그룹 펼침/접기 토글 처리 (사용자 명시 상태 기록) */
  const togglePage = (page: number) => {
    if (isPageOpen(page)) {
      // 현재 펼침 → 접기 명시
      setCollapsed((prev) => new Set(prev).add(page));
    } else {
      // 현재 접힘 → 펼치기 명시
      setExpanded((prev) => new Set(prev).add(page));
    }
  };

  /** 전체 페이지 그룹 펼치기 */
  const expandAll = () => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const g of groups) if (g.page !== null) next.add(g.page);
      return next;
    });
    setCollapsed(new Set());
  };

  /** 전체 페이지 그룹 접기 */
  const collapseAll = () => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const g of groups) if (g.page !== null) next.add(g.page);
      return next;
    });
    setExpanded(new Set());
  };

  /**
   * 진행 바에 표시할 총 페이지 수.
   * 실행 중에는 runner progress 기준, 대기 중에는 초기 감지 정보(initInfo) 기준을 사용해
   * 실행 전에도 예상 순회 규모를 항상 확인할 수 있습니다.
   */
  const progressTotal = progress?.total ?? initInfo?.totalPages ?? null;
  /** 진행 바 현재 처리 페이지 (실행 전에는 0으로 표시) */
  const progressCurrent = progress?.current ?? 0;

  return (
    <div className="w-full min-h-screen bg-[#0d131f] text-slate-100 flex flex-col p-4 box-border select-text font-sans">
      {/* 실행기 헤더 */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-700/60">
        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
        <h1 className="text-sm font-bold text-slate-100 shrink-0">
          액션 실행기 · xvideos 페이징 액션
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

      {/* 감지된 페이지 수 + 전체 진행률 바 (실행 전에도 총 페이지 기준 0%로 상시 노출) */}
      <div className="py-2 space-y-1.5">
        {initInfo && <InitInfoView initInfo={initInfo} />}
        {progressTotal !== null && (
          <div className="flex items-center gap-2">
            <div
              role="progressbar"
              aria-label="전체 페이지 순회 진행률"
              aria-valuemin={0}
              aria-valuemax={progressTotal}
              aria-valuenow={progressCurrent}
              className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-300"
                style={{ width: `${(progressCurrent / progressTotal) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] text-slate-400">
              {progress
                ? `${progressCurrent}/${progressTotal}`
                : `0/${progressTotal} (대기)`}
            </span>
          </div>
        )}
        {status === "completed" && summary && (
          <div className="text-[11px] bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1.5 space-y-0.5">
            <div className="text-emerald-300/90 font-semibold">
              전체 순회가 완료되었습니다.
            </div>
            <div className="text-slate-300">
              성공 페이지 {summary.okPages}개 / 실패 페이지 {summary.failedPages}개
              {summary.failedPageList.length > 0 && (
                <span className="text-amber-300">
                  {" "}
                  (실패 페이지: {summary.failedPageList.join(", ")})
                </span>
              )}
            </div>
            <div className="text-slate-400">
              JSON 저장 {summary.savedJsonCount}개 · 미디어 저장 {summary.savedMediaCount}
              건 성공 / {summary.failedMediaCount}건 실패
            </div>
            <div className="text-slate-500">
              저장 루트: images/&lt;도메인&gt;/
              {initInfo ? initInfo.basePath.replace(/^\//, "") : "카테고리/월"}
              /&lt;페이지&gt;/
            </div>
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

      {/* 행동 로그 콘솔 (페이지별 트리 구조) */}
      <div className="mt-3 rounded-lg border border-slate-700/60 bg-[#0a101a] overflow-hidden flex-1">
        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 border-b border-slate-700/60 flex items-center gap-2">
          <span>행동 로그 (페이지별 트리)</span>
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              disabled={groups.length === 0}
              className="btn-mini"
              title="모든 페이지 그룹 펼치기"
            >
              전체 펼치기
            </button>
            <button
              type="button"
              onClick={collapseAll}
              disabled={groups.length === 0}
              className="btn-mini"
              title="모든 페이지 그룹 접기"
            >
              전체 접기
            </button>
          </span>
        </div>

        {logs.length === 0 && (
          <p className="p-2 text-[10px] text-slate-600">
            로그가 없습니다. "액션 시작"을 누르면 페이지별 이동/로딩 완료/수집/저장
            로그가 페이지 트리로 출력됩니다.
          </p>
        )}

        {/* 그룹(페이지/전역)별 트리 렌더링 */}
        <div className="p-2 space-y-1.5">
          {groups.map((group) => {
            const page = group.page;
            return page === null ? (
              <GlobalLogGroup key={group.key} logs={group.logs} />
            ) : (
              <PageLogGroup
                key={group.key}
                page={page}
                totalPages={initInfo?.totalPages ?? 0}
                logs={group.logs}
                open={isPageOpen(page)}
                onToggle={() => togglePage(page)}
                groupId={`bofr-page-group-${page}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * 페이지 단위 로그 트리 그룹입니다.
 * 페이지 헤더(펼침/접기 버튼 + 배지)와 `<ul>` 작업 로그 목록으로 구성됩니다.
 *
 * @param page - 페이지 인덱스
 * @param totalPages - 총 페이지 수 (헤더 [n/total] 표시용)
 * @param logs - 해당 페이지 로그 목록
 * @param open - 펼침 상태
 * @param onToggle - 헤더 클릭 시 토글 콜백
 * @param groupId - 자동 스크롤 대상 DOM id
 */
function PageLogGroup({
  page,
  totalPages,
  logs,
  open,
  onToggle,
  groupId,
}: {
  page: number;
  totalPages: number;
  logs: ActionRunnerLog[];
  open: boolean;
  onToggle: () => void;
  groupId: string;
}) {
  const { success, warning, error } = useMemo(() => {
    let s = 0;
    let w = 0;
    let e = 0;
    for (const log of logs) {
      if (log.level === "success") s += 1;
      else if (log.level === "warning") w += 1;
      else if (log.level === "error") e += 1;
    }
    return { success: s, warning: w, error: e };
  }, [logs]);

  const badgeClass =
    error > 0
      ? "text-red-300 bg-red-500/15"
      : warning > 0
        ? "text-amber-300 bg-amber-500/15"
        : "text-emerald-300 bg-emerald-500/15";

  return (
    <div
      id={groupId}
      className="rounded-md border border-slate-700/50 overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-[10px] font-semibold transition-colors ${
          open ? "bg-slate-800/60" : "bg-slate-800/20 hover:bg-slate-800/50"
        }`}
        title={open ? "작업 로그 접기" : "작업 로그 펼치기"}
      >
        <span className="shrink-0 text-slate-500">
          {open ? "▾" : "▸"}
        </span>
        <span className="text-slate-100">
          [{page + 1}/{totalPages}] {page}페이지
        </span>
        <span
          className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-[9px] font-normal ${badgeClass}`}
        >
          {error > 0
            ? `오류 ${error}`
            : warning > 0
              ? `경고 ${warning}`
              : "처리 완료"}
          {` · 로그 ${logs.length}건`}
        </span>
      </button>
      {open && (
        <ul className="px-2 pb-2 pt-1 space-y-1">
          {logs.map((log) => (
            <li
              key={log.id}
              className={`text-[10px] leading-relaxed break-all ${
                LOG_LEVEL_CLASSES[log.level] || LOG_LEVEL_CLASSES.info
              }`}
            >
              {log.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * 전역(페이지 미귀속) 로그 그룹입니다.
 * 초기 정보 조회/완료·중지 등 페이지에 속하지 않는 로그를 표시합니다.
 * 항상 펼쳐진 상태로 유지합니다.
 *
 * @param logs - 전역 로그 목록
 */
function GlobalLogGroup({ logs }: { logs: ActionRunnerLog[] }) {
  return (
    <div className="rounded-md border border-slate-700/50 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold bg-slate-800/40">
        <span className="text-slate-500">▾</span>
        <span className="text-slate-200">전역 (실행/완료)</span>
        <span className="ml-auto text-slate-500 font-normal">
          로그 {logs.length}건
        </span>
      </div>
      <ul className="px-2 pb-2 pt-1 space-y-1">
        {logs.map((log) => (
          <li
            key={log.id}
            className={`text-[10px] leading-relaxed break-all ${
              LOG_LEVEL_CLASSES[log.level] || LOG_LEVEL_CLASSES.info
            }`}
          >
            {log.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 감지된 xvideos 페이징 초기 정보(총 페이지 수·베이스 경로·시작 페이지)를 렌더링합니다.
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
