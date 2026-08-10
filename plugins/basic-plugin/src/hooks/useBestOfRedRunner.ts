// plugins/basic-plugin/src/hooks/useBestOfRedRunner.ts

import { useState, useCallback, useEffect, useRef } from "react";
import {
  XvBestOfRedInitData,
  XvBestOfRedPageData,
  XvBestOfRedSavedFileInfo,
} from "../types/index.js";
import {
  requestXvBestOfRedInit,
  requestXvBestOfRedPage,
  requestFetchPageMediaBundles,
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

/** best-of-red 실행 완료 요약 구조체 (완료 배너 표시용) */
export interface XvBestOfRedRunSummary {
  /** 성공 처리 페이지 수 */
  okPages: number;
  /** 실패 처리 페이지 수 (수집 재시도 초과/JSON 저장 실패/미디어 실패) */
  failedPages: number;
  /** 실패 페이지 인덱스 목록 */
  failedPageList: number[];
  /** 실제 저장된 페이지 JSON 개수 */
  savedJsonCount: number;
  /** 성공 저장 미디어 엔트리 수 */
  savedMediaCount: number;
  /** 실패 미디어 엔트리 수 */
  failedMediaCount: number;
  /** 처리 시작 시각 (ISO 8601) */
  startedAt: string;
  /** 처리 종료 시각 (ISO 8601) */
  finishedAt: string;
}

/** 페이지별 수집 시 최대 재시도 횟수 (로드 검증 실패/0건 대비, 안정 우선) */
const MAX_COLLECT_ATTEMPTS = 3;
/** 수집 재시도 사이 대기 시간 (ms) */
const COLLECT_RETRY_DELAY_MS = 1000;
/** 페이지 간 최소 대기 시간 (ms, 서버/페이지 부하 방지) */
const PAGE_BREATH_DELAY_MS = 600;

/**
 * best-of-red 액션 실행기 상태 훅입니다.
 * 대상 탭을 0페이지(베이스)부터 maxPage까지 전체 순회하며 페이지별로
 * 브라우저 로딩 완료 검증 → 비디오 블록 수집(재시도 포함) → 미디어 실제
 * 다운로드(썸네일+프리뷰 mp4 저장 ACK 확인) → JSON 저장(서버 ACK 확인)을
 * 순차 수행하고 진행 로그를 콘솔 형태로 기록합니다. (무작위 이동 없음, 순차 +1씩)
 *
 * 안정 우선 정책: 페이지당 실제 물리 파일 저장(미디어/JSON)이 확인된 뒤에만
 * 다음 페이지로 이동하며, 각 단계 실패는 개별 페이지 실패로 집계되어
 * 완료 배너에 보고됩니다.
 *
 * 동작 흐름:
 *   1. INIT: 페이지네이션에서 총 페이지 수 감지 (totalPages = maxPage + 1)
 *   2. 페이지 이동: chrome.tabs.update + onUpdated(complete) 대기
 *   3. 수집: 콘텐츠 스크립트가 이미지 로드 완료까지 검증한 뒤 메타 수집 (재시도)
 *   4. 미디어 다운로드: FETCH_PAGE_MEDIA_BUNDLES → 엔트리별 3자산 실제 저장 ACK 확인
 *   5. JSON 저장: CRAWL_PARTIAL(requestId) 패킷 → CRAWL_PARTIAL_SAVED ACK(실제 파일 경로) 확인
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
  /** 완료 배너용 실행 요약 (완료 시에만 채워짐) */
  const [summary, setSummary] = useState<XvBestOfRedRunSummary | null>(null);
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
    setSummary(null);
  }, []);

  /** 사용자 중지 요청 */
  const stop = useCallback(() => {
    stopRequested.current = true;
  }, []);

  /**
   * best-of-red 액션 실행을 시작합니다.
   * 초기 정보 조회 → 0..maxPage 전체 순회(이동→수집→미디어 다운로드→JSON 저장) 루프를 수행합니다.
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
      setSummary(null);
      const startedAt = new Date().toISOString();

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
        const { basePath, maxPage, totalPages, url } = init.data;
        addLog(
          `총 ${totalPages}페이지 감지 (0~${maxPage} 전체 순회) · 경로: ${basePath}`,
          "success",
        );

        // 2) 0..maxPage 전체 페이지 인덱스 목록 구성
        const pageList = Array.from({ length: totalPages }, (_, i) => i);
        setStatus("running");
        const origin = new URL(url).origin;

        // 실행 집계 변수
        const failedPageList: number[] = [];
        let savedJsonCount = 0;
        let savedMediaCount = 0;
        let failedMediaCount = 0;

        // 3) 페이지 전체 순회 루프 (페이지당 저장 ACK 확인 후에만 다음 이동)
        for (let step = 0; step < pageList.length; step += 1) {
          const page = pageList[step];
          if (stopRequested.current) {
            setStatus("stopped");
            addLog("사용자 중지 요청으로 실행을 종료합니다.", "warning");
            return;
          }
          setProgress({ current: step + 1, total: totalPages });
          const targetPath = buildRunnerPagePath(basePath, page);
          let pageFailed = false;

          // 3-1) 페이지 이동 (현재 페이지와 다를 때만, 무작위 없이 +1씩)
          const tab = await chrome.tabs.get(tabId).catch(() => null);
          if (!tab) {
            setStatus("error");
            addLog("대상 탭이 닫혀 실행을 종료합니다.", "error");
            return;
          }
          const currentPath = pathnameOf(tab.url || "");
          if (currentPath !== targetPath) {
            addLog(
              `[${step + 1}/${totalPages}] ${page}페이지 이동 중... ${targetPath}`,
              "info",
            );
            await chrome.tabs
              .update(tabId, { url: origin + targetPath })
              .catch(() => null);
            const loaded = await waitForTabComplete(tabId, targetPath, () => stopRequested.current);
            addLog(
              loaded
                ? `[${step + 1}/${totalPages}] 브라우저 로딩 완료: ${targetPath}`
                : `[${step + 1}/${totalPages}] 로딩 완료 대기 시간 초과: ${targetPath}`,
              loaded ? "success" : "warning",
            );
          } else {
            addLog(`[${step + 1}/${totalPages}] 이미 ${targetPath} 페이지에 있습니다.`, "info");
          }
          if (stopRequested.current) {
            setStatus("stopped");
            addLog("사용자 중지 요청으로 실행을 종료합니다.", "warning");
            return;
          }

          // 3-2) 페이지 수집 (로드 검증 실패/0건 시 최대 재시도, 안정 우선)
          let pageData: XvBestOfRedPageData | null = null;
          let collectMessage = "";
          for (let attempt = 1; attempt <= MAX_COLLECT_ATTEMPTS; attempt += 1) {
            addLog(
              `[${step + 1}/${totalPages}] 데이터 수집 중... (시도 ${attempt}/${MAX_COLLECT_ATTEMPTS})`,
              "info",
            );
            const collect = await requestXvBestOfRedPage(tabId);
            if (!collect.success || !collect.data) {
              collectMessage = collect.message || "수집 실패";
              addLog(
                `[${step + 1}/${totalPages}] 수집 실패: ${collectMessage}`,
                "warning",
              );
            } else {
              pageData = collect.data;
              collectMessage = pageData.message;
              const entries = pageData.data || [];
              if (pageData.ready && entries.length > 0) {
                addLog(
                  `[${step + 1}/${totalPages}] 데이터 수집 완료: ${collectMessage} (${entries.length}건)`,
                  "success",
                );
                break;
              }
              // 로드 검증은 끝났지만 항목이 0건일 수 있음 → 재시도로 안정 확인
              if (entries.length === 0) {
                addLog(
                  `[${step + 1}/${totalPages}] 수집 항목이 0건입니다. 재시도합니다. (${collectMessage})`,
                  "warning",
                );
              } else if (!pageData.ready) {
                addLog(
                  `[${step + 1}/${totalPages}] 로드 검증이 완료되지 않았습니다. 재시도합니다.`,
                  "warning",
                );
              }
            }
            if (attempt < MAX_COLLECT_ATTEMPTS) {
              await sleep(COLLECT_RETRY_DELAY_MS);
            }
          }
          if (stopRequested.current) {
            setStatus("stopped");
            addLog("사용자 중지 요청으로 실행을 종료합니다.", "warning");
            return;
          }

          // 재시도를 모두 소진해도 실패한 경우 → 페이지 실패 집계 후 다음 페이지
          const entries = (pageData && pageData.data) || [];
          if (!pageData) {
            failedPageList.push(page);
            addLog(
              `[${step + 1}/${totalPages}] ${page}페이지 수집 최종 실패: ${collectMessage}`,
              "error",
            );
            continue;
          }

          // 3-3) 미디어 실제 다운로드·저장 (썸네일 2 + 프리뷰 mp4, 서버 ACK 확인)
          const segments = [...basePath.split("/").filter(Boolean), String(page)];
          let mediaEntryFiles: XvBestOfRedSavedFileInfo[] = [];
          if (entries.length > 0) {
            addLog(
              `[${step + 1}/${totalPages}] 미디어 ${entries.length}건 다운로드·저장 중... (동시성 3 제한)`,
              "info",
            );
            const media = await requestFetchPageMediaBundles({
              page,
              entries,
              pathSegments: segments,
            });
            mediaEntryFiles = media.entryFiles || [];
            savedMediaCount += media.savedCount;
            failedMediaCount += media.failedCount;
            addLog(
              `[${step + 1}/${totalPages}] 미디어 저장 완료: ${media.savedCount}건 성공 / ${media.failedCount}건 실패`,
              media.failedCount === 0 ? "success" : "warning",
            );
            if (media.failedCount > 0) pageFailed = true;
            if (stopRequested.current) {
              setStatus("stopped");
              addLog("사용자 중지 요청으로 실행을 종료합니다.", "warning");
              return;
            }
          } else {
            addLog(
              `[${step + 1}/${totalPages}] 수집 항목이 0건이라 미디어 저장을 건너뜁니다.`,
              "warning",
            );
          }

          // 3-4) 페이지 JSON 메타 저장 (서버 CRAWL_PARTIAL_SAVED ACK로 실제 파일 경로 확인)
          const fileName = `page-${page}.json`;
          const requestId = `bofr-${page}-${Date.now()}`;
          const sendRes = await sendSocketPacket({
            action: "CRAWL_PARTIAL",
            payload: {
              page,
              url: pageData.url,
              title: pageData.title || "",
              data: entries,
              fileMap: mediaEntryFiles,
              pathSegments: segments,
              fileName,
              requestId,
              timestamp: Date.now(),
            },
          });
          if (sendRes.success) {
            savedJsonCount += 1;
            addLog(
              `[${step + 1}/${totalPages}] JSON 서버 저장 완료: ${segments.join("/")}/${fileName} (${entries.length}건)`,
              "success",
            );
            if (sendRes.savedFilePath) {
              addLog(
                `[${step + 1}/${totalPages}] 실제 저장 파일: ${sendRes.savedFilePath} (${sendRes.fileSize ?? 0} bytes)`,
                "info",
              );
            }
          } else {
            pageFailed = true;
            addLog(
              `[${step + 1}/${totalPages}] JSON 서버 저장 실패: ${sendRes.message}`,
              "error",
            );
          }

          if (pageFailed) failedPageList.push(page);

          // 3-5) 페이지 간 최소 지연 (서버/페이지 부하 방지)
          await sleep(PAGE_BREATH_DELAY_MS);
        }

        // 4) 완료 처리
        setStatus("completed");
        setProgress(null);
        setSummary({
          okPages: totalPages - failedPageList.length,
          failedPages: failedPageList.length,
          failedPageList,
          savedJsonCount,
          savedMediaCount,
          failedMediaCount,
          startedAt,
          finishedAt: new Date().toISOString(),
        });
        addLog(
          `전체 순회 완료 (${pageList.length}페이지) · 실패 페이지 ${failedPageList.length}개` +
            (failedPageList.length > 0
              ? ` (${failedPageList.join(", ")})`
              : ""),
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
    summary,
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
