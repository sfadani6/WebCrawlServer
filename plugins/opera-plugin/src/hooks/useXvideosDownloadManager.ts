// plugins/opera-plugin/src/hooks/useXvideosDownloadManager.ts

import { useState, useCallback, useEffect, useRef } from "react";
import {
  XvideosDownloadItem,
  CrawlMediaBundlePayload,
  FetchMediaBundleProgressPayload,
} from "../types/index.js";
import {
  requestCollectXvideosMediaFromTab,
  requestStorageLocation,
  requestFetchMediaBundle,
} from "../services/chromeService.js";

/** 매니저 로그 레벨 구분자 */
export type XvideosManagerLogLevel = "info" | "success" | "error" | "warning";

/** 매니저 로그 항목 구조체 */
export interface XvideosManagerLog {
  /** 로그 고유 ID (리액트 키용) */
  id: string;
  /** 로그 메시지 본문 */
  text: string;
  /** 로그 레벨 */
  level: XvideosManagerLogLevel;
}

/**
 * URL 경로에서 파일 확장자를 추출합니다. (txt saved_files 목록 구성용)
 *
 * @param url - 원본 자산 URL
 * @param fallback - 확장자 추출 실패 시 기본값
 * @returns 확장자 문자열 (점 제외)
 */
export function extFromUrl(url: string, fallback: string): string {
  try {
    const clean = (url || "").split(/[?#]/)[0];
    const name = clean.split("/").filter(Boolean).pop() || "";
    const dot = name.lastIndexOf(".");
    if (dot < 0) return fallback;
    const ext = name.slice(dot + 1);
    return ext.length > 0 && ext.length <= 5 ? ext : fallback;
  } catch {
    return fallback;
  }
}

/**
 * xvideos 다운로드 항목 1건의 txt 메타 원문을 생성합니다.
 * (R-00208 확장 규격: page_url/image_url/click_url/title/보조·프리뷰 URL/저장 파일 목록)
 *
 * @param item - 다운로드 큐 항목
 * @param pageUrl - 현재 페이지 URL
 * @param relDir - 저장소 루트 기준 상대 디렉토리
 * @returns txt 메타 원문 문자열
 */
export function buildXvideosTxtContent(
  item: XvideosDownloadItem,
  pageUrl: string,
  relDir: string,
): string {
  const e = item.entry;
  const lines = [
    "# WebCrawlServer 이미지 참조 파일",
    "# 인출 방식: 플러그인 직접 다운로드 (오페라 VPN)",
    `page_url: ${pageUrl}`,
    `image_url: ${e.mainUrl}`,
    `click_url: ${e.clickUrl}`,
    `title: ${e.title}`,
  ];
  if (e.sfwUrl) lines.push(`sfw_image_url: ${e.sfwUrl}`);
  if (e.previewUrl) lines.push(`preview_video_url: ${e.previewUrl}`);
  lines.push("saved_files:");
  lines.push(`  - ${relDir}/${item.baseName}_thumb.${extFromUrl(e.mainUrl, "jpg")}`);
  if (e.sfwUrl) {
    lines.push(`  - ${relDir}/${item.baseName}_sfw.${extFromUrl(e.sfwUrl, "jpg")}`);
  }
  if (e.previewUrl) {
    lines.push(`  - ${relDir}/${item.baseName}_preview.${extFromUrl(e.previewUrl, "mp4")}`);
  }
  return lines.join("\n") + "\n";
}

/**
 * xvideos 다운로드 매니저 전용 React 훅입니다.
 * 목록 생성/순차 진행/초기화 로직과 관련 상태(목록·진행 여부·저장 위치·로그)를 캡슐화합니다.
 * 사이드바 패널이 좁은 문제를 해소하기 위해 전용 팝업 창에서 단독으로 사용됩니다.
 *
 * @returns 매니저 상태 및 액션 객체
 */
export function useXvideosDownloadManager() {
  /** 다운로드 큐 항목 목록 */
  const [downloadList, setDownloadList] = useState<XvideosDownloadItem[]>([]);
  /** 순차 다운로드 진행 여부 */
  const [isRunning, setIsRunning] = useState(false);
  /** 파싱 대상 페이지 URL */
  const [pageUrl, setPageUrl] = useState("");
  /** 저장 위치 절대 경로 (서버 조회 결과) */
  const [storageDir, setStorageDir] = useState("");
  /** 저장 위치 상대 경로 (다운로드 시 재사용) */
  const [relDir, setRelDir] = useState("");
  /** 매니저 상태 메시지 (헤더/하단 표시) */
  const [statusMessage, setStatusMessage] = useState("");
  /** 터미널성 로그 목록 */
  const [logs, setLogs] = useState<XvideosManagerLog[]>([]);
  /** 로그 고유 ID 카운터 */
  const logSeq = useRef(0);

  /**
   * 로그 1건을 추가합니다. (최대 200건 유지)
   *
   * @param text - 로그 메시지 본문
   * @param level - 로그 레벨
   */
  const addLog = useCallback((text: string, level: XvideosManagerLogLevel = "info") => {
    logSeq.current += 1;
    setLogs((prev) => {
      const next = [...prev, { id: `log_${logSeq.current}`, text, level }];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  }, []);

  // 페이지 변경 시 로그/상태 리셋 (새 목록 생성 시 깔끔한 상태 유지)
  useEffect(() => {
    setLogs([]);
    setStatusMessage("");
  }, []);

  // 오프스크린 진행률 브로드캐스트(FETCH_MEDIA_BUNDLE_PROGRESS)를 수신해
  // 해당 bundleId 항목의 프로그레스 바를 실시간 갱신합니다.
  useEffect(() => {
    const listener = (
      message: {
        type?: string;
        payload?: FetchMediaBundleProgressPayload;
      },
    ) => {
      if (
        message?.type === "FETCH_MEDIA_BUNDLE_PROGRESS" &&
        message.payload &&
        typeof message.payload.progress === "number"
      ) {
        const p = Math.max(0, Math.min(100, Math.round(message.payload.progress)));
        const targetBundleId = message.payload.bundleId;
        setDownloadList((prev) =>
          prev.map((it) =>
            it.bundleId === targetBundleId ? { ...it, progress: p } : it,
          ),
        );
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  /**
   * 대상 xvideos 탭의 콘텐츠 스크립트로 파싱을 요청해 다운로드 큐를 구성합니다.
   * clickUrl 기준 중복 제거와 저장 위치 조회를 함께 수행합니다.
   *
   * @param tabId - 대상 xvideos 탭 ID (콘텐츠 스크립트 송신 대상)
   * @returns 성공 여부 및 생성된 목록 개수
   */
  const buildList = useCallback(
    async (tabId: number) => {
      setStatusMessage("xvideos 미디어 목록 생성 중...");
      addLog("xvideos 비디오 블록 파싱을 요청합니다...", "info");
      try {
        const res = await requestCollectXvideosMediaFromTab(tabId);
        if (!res.success) {
          setStatusMessage(res.message);
          addLog(res.message, "error");
          return { success: false as const, count: 0 };
        }

        // 중복 제거 방어 (콘텐츠 스크립트 기준 + URL 기준 이중 체크)
        const seen = new Set<string>();
        const entries = res.entries.filter((entry) => {
          if (!entry.clickUrl || seen.has(entry.clickUrl)) return false;
          seen.add(entry.clickUrl);
          return true;
        });

        const ts = Date.now();
        const items: XvideosDownloadItem[] = entries.map((entry, idx) => ({
          bundleId: `${ts}_${idx}`,
          baseName: `${ts}-${String(idx + 1).padStart(4, "0")}`,
          entry,
          status: "pending",
          progress: 0,
        }));
        setDownloadList(items);
        setPageUrl(res.pageUrl);
        setStorageDir("");
        setRelDir("");
        addLog(
          `xvideos 비디오 블록 ${items.length}개 목록 생성 완료 (중복 제거 포함)`,
          "success",
        );

        // 서버에서 저장 위치 조회 (다운로드 대상 디렉토리 안내)
        const loc = await requestStorageLocation(res.pageUrl, "normal");
        if (loc.success && loc.absDir) {
          setStorageDir(loc.absDir || "");
          setRelDir(loc.relDir || "");
          addLog(`저장 위치: ${loc.absDir}`, "success");
        } else {
          addLog(`저장 위치 조회 실패: ${loc.message || "알 수 없음"}`, "warning");
        }
        setStatusMessage(`미디어 목록 ${items.length}개 생성 완료`);
        return { success: true as const, count: items.length };
      } catch {
        setStatusMessage("미디어 목록 생성 중 오류가 발생했습니다.");
        addLog("미디어 목록 생성 중 오류가 발생했습니다.", "error");
        return { success: false as const, count: 0 };
      }
    },
    [addLog],
  );

  /**
   * 다운로드 큐를 순차 진행합니다. (DownloadThemAll식: 하나씩 다운로드 후 완료 표시)
   * 각 항목은 오프스크린이 3종 자산을 fetch해 서버에 전송하고,
   * 저장 완료 ACK 수신 시 항목 상태를 완료/실패로 갱신합니다.
   *
   * @returns Promise<void>
   */
  const startQueue = useCallback(async () => {
    if (isRunning) return;
    const list = downloadList;
    if (list.length === 0) {
      addLog("다운로드할 목록이 없습니다. 먼저 목록을 생성하세요.", "warning");
      return;
    }
    const pending = list.filter(
      (it) => it.status === "pending" || it.status === "failed",
    );
    if (pending.length === 0) {
      addLog("진행 가능한 다운로드 항목이 없습니다.", "warning");
      return;
    }

    setIsRunning(true);
    const rel = relDir || "images/xvideos.com/normal";
    const url = pageUrl;
    let doneCount = 0;
    let failedCount = 0;
    setStatusMessage(`미디어 다운로드 진행 중... (${list.length}건)`);
    addLog(`미디어 다운로드를 순차 진행합니다. 총 ${list.length}건`, "info");

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (item.status === "done") continue;

      setDownloadList((prev) =>
        prev.map((it) =>
          it.bundleId === item.bundleId
            ? { ...it, status: "downloading", progress: 0 }
            : it,
        ),
      );

      const txtContent = buildXvideosTxtContent(item, url, rel);
      const bundle: CrawlMediaBundlePayload = {
        bundleId: item.bundleId,
        baseName: item.baseName,
        pageUrl: url,
        category: "normal",
        clickUrl: item.entry.clickUrl,
        title: item.entry.title,
        txtContent,
      };
      const displayTitle = item.entry.title.slice(0, 40) || item.entry.clickUrl;
      addLog(`[${i + 1}/${list.length}] 다운로드 중: ${displayTitle}`, "info");

      const result = await requestFetchMediaBundle(item.bundleId, item.entry, bundle);
      if (result.success && result.ack && result.ack.success) {
        setDownloadList((prev) =>
          prev.map((it) =>
            it.bundleId === item.bundleId
              ? {
                  ...it,
                  status: "done",
                  progress: 100,
                  savedDir: result.ack?.savedDir || "",
                  savedFiles: result.ack?.savedFiles || [],
                }
              : it,
          ),
        );
        addLog(
          `[${i + 1}/${list.length}] 저장 완료: ${result.ack.savedDir || "경로 미확인"}`,
          "success",
        );
        doneCount++;
      } else {
        setDownloadList((prev) =>
          prev.map((it) =>
            it.bundleId === item.bundleId
              ? { ...it, status: "failed", progress: 100, error: result.error || "저장 실패" }
              : it,
          ),
        );
        addLog(
          `[${i + 1}/${list.length}] 저장 실패: ${result.error || "알 수 없음"}`,
          "error",
        );
        failedCount++;
      }
    }

    setIsRunning(false);
    setStatusMessage(`미디어 다운로드 완료 (성공 ${doneCount}, 실패 ${failedCount})`);
    addLog(
      `미디어 다운로드 완료 (성공 ${doneCount}, 실패 ${failedCount})`,
      "success",
    );
  }, [isRunning, downloadList, relDir, pageUrl, addLog]);

  /**
   * 다운로드 목록과 관련 상태를 초기화합니다.
   *
   * @returns void
   */
  const reset = useCallback(() => {
    setDownloadList([]);
    setPageUrl("");
    setStorageDir("");
    setRelDir("");
    setStatusMessage("");
    addLog("미디어 다운로드 목록을 초기화했습니다.", "info");
  }, [addLog]);

  return {
    downloadList,
    isRunning,
    pageUrl,
    storageDir,
    relDir,
    statusMessage,
    logs,
    buildList,
    startQueue,
    reset,
  };
}
