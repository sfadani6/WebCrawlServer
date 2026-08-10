// plugins/basic-plugin/src/hooks/useBestOfRedRunner.ts

import { useState, useCallback, useEffect, useRef } from "react";
import {
  XvBestOfRedInitData,
  XvBestOfRedPageData,
  XvideosMediaEntry,
} from "../types/index.js";
import {
  requestXvBestOfRedInit,
  requestXvBestOfRedPage,
  sendSocketPacket,
} from "../services/chromeService.js";

/** 액션 실행기 로그 레벨 구분자 */
export type ActionRunnerLogLevel = "info" | "success" | "error" | "warning";

/** 액션 실행기 로그 항목 구조체 */
export interface ActionRunnerLog {
  /** 로그 고유 ID (리액트 키용) */
  id: string;
  /** 로그 메시지 본문 */
  text: string;
  /** 로그 레벨 */
  level: ActionRunnerLogLevel;
}

/** 액션 실행기 상태 구분자 */
export type ActionRunnerStatus =
  | "idle"
  | "init"
  | "running"
  | "completed"
  | "stopped"
  | "error";

/**
 * best-of-red 액션 실행기 상태 훅입니다.
 * 대상 탭을 1페이지씩 순차 이동하며 페이지별로
 * 브라우저 로딩 완료 검증 → 비디오 블록 수집 → 서버 저장을 수행하고
 * 진행 로그를 콘솔 형태로 기록합니다. (무작위 이동 없음, 순차 +1씩만 이동)
 *
 * 동작 흐름:
 *   1. INIT: 페이지네이션에서 총 페이지 수 감지
 *   2. 페이지 이동: chrome.tabs.update + onUpdated(complete) 대기
 *   3. 수집: 콘텐츠 스크립트가 이미지 로드 완료까지 검증한 뒤 메타 수집
 *   4. 저장: CRAWL_PARTIAL(pathSegments) 패킷으로 서버에 물리 저장
 */
export function useBestOfRedRunner() {
  /** 실행 상태 (idle/init/running/completed/stopped/error) */
  const [status, setStatus] = useState<ActionRunnerStatus>("idle");
  /** 콘솔 형태 로그 목록 */
  const [logs, setLogs] = useState<ActionRunnerLog[]>([]);
  /** 로그 고유 ID 카운터 */
  const logSeq = useRef(0);
  /** 초기 감지 정보 (총 페이지 수 등) */
  const [initInfo, setInitInfo] = useState<XvBestOfRedInitData | null>(null);
  /** 처리 진행도 (현재 번째/총) */
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  /** 사용자 중지 요청 여부 (루프 각 단계에서 확인) */
  const stopRequested = useRef(false);
  /** 중복 시작 방지 플래그 */
  const runningRef = useRef(false);

  /**
   * 로그 1건을 추가합니다. (최대 300건 유지)
   *
   * @param text - 로그 메시지 본문
   * @param level - 로그 레벨
   */
  const addLog = useCallback((text: string, level: ActionRunnerLogLevel = "info") => {
    logSeq.current += 1;
    setLogs((prev) => {
      const next = [...prev, { id: `action_log_${logSeq.current}`, text, level }];
      return next.length > 300 ? next.slice(next.length - 300) : next;
    });
  }, []);

  /** 실행기 열릴 때 로그/상태 초기화 */
  useEffect(() => {
    setLogs([]);
    setStatus("idle");
    setInitInfo(null);
    setProgress(null);
  }, []);

  /** 사용자 중지 요청 */
  const stop = useCallback(() => {
    stopRequested.current = true;
  }, []);

  /**
   * best-of-red 액션 실행을 시작합니다.
   * 초기 정보 조회 → 페이지 순차 이동(로드 완료 검증) → 수집 → 서버 저장 루프를 수행합니다.
   *
   * @param tabId - 대상 xvideos best-of-red 탭 ID
   * @returns Promise<void>
   */
  const start = useCallback(
    async (tabId: number) => {
      if (runningRef.current) return;
      runningRef.current = true;
      stopRequested.current = false;
      setLogs([]);
      setProgress(null);

      try {
        // 1) 초기 정보 조회 (총 페이지 수 감지)
        setStatus("init");
        addLog("best-of-red 초기 정보를 조회합니다... (페이지네이션 감지)", "info");
        const init = await requestXvBestOfRedInit(tabId);
        if (!init.success || !init.data) {
          setStatus("error");
          addLog(init.message || "best-of-red 초기 정보 조회에 실패했습니다.", "error");
          return;
        }
        setInitInfo(init.data);
        const { basePath, currentPage, maxPage, totalPages, url } = init.data;
        addLog(
          `총 ${totalPages}페이지 감지 (${currentPage}~${maxPage}) · 경로: ${basePath}`,
          "success",
        );

        // 2) 페이지 순차 이동 → 수집 → 저장 루프
        setStatus("running");
        const origin = new URL(url).origin;
        for (let page = currentPage; page <= maxPage; page += 1) {
          if (stopRequested.current) {
            setStatus("stopped");
            addLog("사용자 중지 요청으로 실행을 종료합니다.", "warning");
            return;
          }
          const step = page - currentPage + 1;
          setProgress({ current: step, total: totalPages });
          const targetPath = buildRunnerPagePath(basePath, page);

          // 2-1) 페이지 이동 (현재 페이지와 다를 때만, 무작위 없이 +1씩)
          const tab = await chrome.tabs.get(tabId).catch(() => null);
          if (!tab) {
            setStatus("error");
            addLog("대상 탭이 닫혀 실행을 종료합니다.", "error");
            return;
          }
          const currentPath = pathnameOf(tab.url || "");
          if (currentPath !== targetPath) {
            addLog(
              `[${step}/${totalPages}] ${page}페이지 이동 중... ${targetPath}`,
              "info",
            );
            await chrome.tabs
              .update(tabId, { url: origin + targetPath })
              .catch(() => null);
            const loaded = await waitForTabComplete(tabId, targetPath, () => stopRequested.current);
            addLog(
              loaded
                ? `[${step}/${totalPages}] 브라우저 로딩 완료: ${targetPath}`
                : `[${step}/${totalPages}] 로딩 완료 대기 시간 초과: ${targetPath}`,
              loaded ? "success" : "warning",
            );
          } else {
            addLog(`[${step}/${totalPages}] 이미 ${targetPath} 페이지에 있습니다.`, "info");
          }
          if (stopRequested.current) {
            setStatus("stopped");
            addLog("사용자 중지 요청으로 실행을 종료합니다.", "warning");
            return;
          }

          // 2-2) 페이지 수집 (콘텐츠 스크립트가 이미지 로드 완료까지 검증)
          addLog(`[${step}/${totalPages}] 데이터 수집 중...`, "info");
          const collect = await requestXvBestOfRedPage(tabId);
          if (!collect.success || !collect.data) {
            addLog(`[${step}/${totalPages}] 수집 실패: ${collect.message}`, "error");
            continue;
          }
          const pageData = collect.data;
          const entries = pageData.data || [];
          addLog(
            `[${step}/${totalPages}] 데이터 수집 완료: ${pageData.message}`,
            "success",
          );

          // 2-3) 서버 물리 저장 (best-of-red/<월>/<페이지>/page-<페이지>.json)
          const segments = [...basePath.split("/").filter(Boolean), String(page)];
          const fileName = `page-${page}.json`;
          const sendRes = await sendSocketPacket({
            action: "CRAWL_PARTIAL",
            payload: {
              page,
              url: pageData.url,
              title: pageData.title || "",
              data: entries,
              pathSegments: segments,
              fileName,
              timestamp: Date.now(),
            },
          });
          addLog(
            sendRes.success
              ? `[${step}/${totalPages}] 서버 저장 완료: ${segments.join("/")}/${fileName} (${entries.length}건)`
              : `[${step}/${totalPages}] 서버 저장 실패: ${sendRes.message}`,
            sendRes.success ? "success" : "error",
          );

          // 2-4) 페이지 간 최소 지연 (서버/페이지 부하 방지)
          await sleep(600);
        }

        setStatus("completed");
        setProgress(null);
        addLog(
          `전체 수집 완료 (${maxPage - currentPage + 1}페이지, 총 ${init.data.totalPages}페이지)`,
          "success",
        );
      } catch (err) {
        setStatus("error");
        addLog(`실행 중 오류가 발생했습니다: ${String(err)}`, "error");
      } finally {
        runningRef.current = false;
      }
    },
    [addLog],
  );

  return {
    status,
    logs,
    initInfo,
    progress,
    isRunning: status === "running" || status === "init",
    start,
    stop,
  };
}

/**
 * best-of-red 페이지 인덱스에 대응하는 이동 경로를 생성합니다.
 * 0은 베이스 경로(예: /best-of-red/2026-06), N은 베이스/N(예: /best-of-red/2026-06/16)입니다.
 *
 * @param basePath 베이스 경로 (후행 슬래시 없음)
 * @param pageIndex 이동할 페이지 인덱스
 * @returns 이동할 페이지 경로
 */
function buildRunnerPagePath(basePath: string, pageIndex: number): string {
  return pageIndex === 0 ? basePath : `${basePath}/${pageIndex}`;
}

/**
 * URL에서 후행 슬래시를 제거한 pathname을 반환합니다.
 * 페이지 경로 비교용 헬퍼입니다.
 *
 * @param url 대상 URL
 * @returns 정규화된 pathname (파싱 실패 시 빈 문자열)
 */
function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, "");
  } catch {
    return "";
  }
}

/**
 * 탭이 목표 페이지로 로드 완료(status=complete)가 될 때까지 대기합니다.
 * 탭 이동 후 콘텐츠 스크립트 수집이 유효하려면 실제 로드 완료 상태를 기다려야 합니다.
 * (중지 요청 또는 타임아웃 시 false 반환)
 *
 * @param tabId 대상 탭 ID
 * @param expectedPathname 대기할 목표 경로 (후행 슬래시 무관 비교)
 * @param isStopped 중지 요청 확인 함수
 * @param timeoutMs 최대 대기 시간 (기본 30초)
 * @returns 목표 경로 로드 완료 여부
 */
function waitForTabComplete(
  tabId: number,
  expectedPathname: string,
  isStopped: () => boolean,
  timeoutMs = 30000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const expected = expectedPathname.replace(/\/$/, "");

    const cleanup = () => {
      clearInterval(timer);
      chrome.tabs.onUpdated.removeListener(listener);
    };

    const timer = setInterval(() => {
      if (Date.now() - started >= timeoutMs || isStopped()) {
        cleanup();
        resolve(false);
      }
    }, 300);

    const listener = (
      id: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (id !== tabId || changeInfo.status !== "complete") return;
      try {
        const actual = tab.url ? new URL(tab.url).pathname.replace(/\/$/, "") : "";
        if (actual === expected) {
          cleanup();
          resolve(true);
        }
      } catch {
        // URL 파싱 실패는 무시하고 계속 대기합니다.
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * 지정한 시간(ms) 동안 비동기 대기합니다.
 *
 * @param ms 대기 시간 (ms)
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
