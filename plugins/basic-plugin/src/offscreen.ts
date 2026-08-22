// plugins/basic-plugin/src/offscreen.ts

import { PLUGIN_CONFIG, getWebSocketUrl } from "./config/pluginConfig.js";
import {
  WebSocketPacket,
  CrawlMediaBundlePayload,
  MediaAssetPayload,
  StorageLocationResponsePayload,
  XvideosMediaEntry,
  XvBestOfRedMediaResult,
  XvBestOfRedSavedFileInfo,
} from "./types/index.js";

/**
 * 오프스크린 문서에서 단일 소켓을 영구 보유하며 24시간 무중단 웹소켓 통신을 담당합니다.
 * ADR-001: 사이드바 단일 UI & 오프스크린 무중단 소켓 아키텍처 준수
 */

/** 현재 유지 중인 웹소켓 인스턴스 */
let socket: WebSocket | null = null;

/** 서버 저장 완료 ACK(CRAWL_MEDIA_SAVED) 대기자 맵 (bundleId → 해소 함수) */
const mediaAckWaiters = new Map<
  string,
  (ack: Record<string, unknown>) => void
>();

/**
 * 서버 페이지 저장 완료 ACK(CRAWL_PARTIAL_SAVED) 대기자 맵 (requestId → 해소 함수).
 * xvideos 페이징 액션 실행기가 "실제 파일 저장 확인 후 다음 페이지 이동"을 보장하기 위해
 * SEND_SOCKET_PACKET(CRAWL_PARTIAL) 응답을 ACK 수신까지 보류합니다.
 */
const partialSaveWaiters = new Map<
  string,
  (ack: {
    success: boolean;
    savedFilePath?: string;
    fileSize?: number;
    entriesCount?: number;
  }) => void
>();

/** 저장 위치 응답(STORAGE_LOCATION_RESPONSE) 대기자 (단일 보류 허용) */
let storageLocationWaiter: ((res: StorageLocationResponsePayload) => void) | null =
  null;

/**
 * ArrayBuffer를 Base64 문자열로 변환합니다.
 * (대용량 미디어 전송을 위해 2바이트 청크 단위 인코딩)
 *
 * @param buffer - 변환할 이진 버퍼
 * @returns Base64 인코딩 문자열
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * 원본 URL로부터 안전한 파일명을 추출합니다.
 *
 * @param src - 자산 원본 URL
 * @param fallbackName - 기본 파일명 (없을 시 사용)
 * @returns 안전한 파일명 문자열
 */
function extractMediaFileName(src: string, fallbackName: string): string {
  try {
    const clean = (src || "").split(/[?#]/)[0];
    const candidate = clean.split("/").filter(Boolean).pop() || "";
    const safe = candidate.replace(/[^a-zA-Z0-9._-]/g, "_");
    return safe.length > 0 ? safe : fallbackName;
  } catch {
    return fallbackName;
  }
}

/**
 * 원격 자산 URL을 fetch하여 Base64 데이터와 MIME 타입으로 변환합니다.
 * 오프스크린 문서는 host_permissions(<all_urls>)로 CORS 우회가 가능하며,
 * 오페라 브라우저의 VPN이 네트워크 계층에서 적용되어 차단을 우회합니다.
 * 실패 시 빈 데이터를 반환해 서버가 바이너리 저장을 건너뛰게 합니다.
 *
 * @param url - 인출할 자산 URL
 * @returns MIME 타입 및 Base64 데이터 (실패 시 빈 문자열)
 */
async function fetchAssetAsBase64(
  url: string
): Promise<{ mimeType: string; data: string }> {
  if (!url) return { mimeType: "", data: "" };
  try {
    const resp = await fetch(url, { credentials: "omit" });
    if (!resp.ok) return { mimeType: "", data: "" };
    const blob = await resp.blob();
    const buffer = await blob.arrayBuffer();
    return { mimeType: blob.type || "", data: arrayBufferToBase64(buffer) };
  } catch {
    return { mimeType: "", data: "" };
  }
}

/**
 * 다운로드 매니저 창으로 항목별 진행률(0~100)을 브로드캐스트합니다.
 * 오프스크린에서 3자산 인출·전송 단계가 끝날 때마다 호출되며,
 * 매니저 페이지의 chrome.runtime.onMessage 리스너가 bundleId로 매칭해 프로그레스 바를 갱신합니다.
 * 사이드바/팝업 등 타 컨텍스트는 타입 미매칭으로 안전하게 무시됩니다.
 *
 * @param bundleId - 진행률을 갱신할 항목 추적 ID
 * @param progress - 진행률 퍼센트 (0~100)
 * @returns void
 */
function broadcastFetchProgress(bundleId: string, progress: number): void {
  try {
    chrome.runtime
      .sendMessage({
        type: "FETCH_MEDIA_BUNDLE_PROGRESS",
        payload: { bundleId, progress },
      })
      .catch(() => {
        // 수신자 미연결(매니저 창 닫힘 등) 시 예외 무시 (R-00420 예외 가드)
      });
  } catch {
    // 메시징 채널 파괴 등 예외 격리 — 진행 흐름을 중단하지 않는다.
  }
}

/**
 * xvideos 비디오 블록의 3종 자산(메인/보조 썸네일 + 프리뷰 mp4)을 순차 fetch하여
 * CRAWL_IMAGE 번들 패킷으로 서버에 전송하고, 저장 완료 ACK를 대기합니다.
 * 각 인출 단계가 끝날 때마다 매니저 창에 진행률을 브로드캐스트합니다.
 *
 * @param bundleId - 항목 추적 ID
 * @param entry - 비디오 블록 메타 항목
 * @param bundle - 미디어 번들 페이로드 (txtContent/baseName/category 등 포함)
 * @returns 저장 완료 ACK 페이로드 (실패 시 success: false)
 */
async function handleFetchMediaBundle(
  bundleId: string,
  entry: XvideosMediaEntry,
  bundle: CrawlMediaBundlePayload
): Promise<{ success: boolean; ack?: Record<string, unknown>; error?: string }> {
  const clientId = await getOrCreateClientId();

  // 3종 자산 순차 인출 (메인 썸네일 → 보조 썸네일 → 프리뷰 mp4)
  const main = await fetchAssetAsBase64(entry.mainUrl);
  broadcastFetchProgress(bundleId, 30);
  const sfw = await fetchAssetAsBase64(entry.sfwUrl);
  broadcastFetchProgress(bundleId, 55);
  const preview = await fetchAssetAsBase64(entry.previewUrl);
  broadcastFetchProgress(bundleId, 80);

  const assets: MediaAssetPayload[] = [
    {
      kind: "thumb",
      url: entry.mainUrl,
      fileName: extractMediaFileName(entry.mainUrl, "thumb.bin"),
      mimeType: main.mimeType,
      data: main.data,
    },
    {
      kind: "sfw",
      url: entry.sfwUrl,
      fileName: extractMediaFileName(entry.sfwUrl, "sfw.bin"),
      mimeType: sfw.mimeType,
      data: sfw.data,
    },
    {
      kind: "preview",
      url: entry.previewUrl,
      fileName: extractMediaFileName(entry.previewUrl, "preview.bin"),
      mimeType: preview.mimeType,
      data: preview.data,
    },
  ];

  const fullPacket: WebSocketPacket = {
    senderId: clientId,
    targetId: "SERVER",
    action: "CRAWL_IMAGE",
    payloadType: "binary_base64",
    payload: {
      ...bundle,
      bundleId,
      assets,
      timestamp: Date.now(),
    },
    meta: { timestamp: Date.now() },
  };

  // 소켓 미연결 시 즉시 재연결 시도 후 실패 반환
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    connectOffscreenSocket();
    return { success: false, error: "SOCKET_OFFLINE" };
  }
  socket.send(JSON.stringify(fullPacket));
  broadcastFetchProgress(bundleId, 95);

  // 서버 저장 완료 ACK 대기 (60초 타임아웃)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      mediaAckWaiters.delete(bundleId);
      resolve({ success: false, error: "ACK_TIMEOUT" });
    }, 60000);
    mediaAckWaiters.set(bundleId, (ack) => {
      clearTimeout(timer);
      resolve({ success: true, ack });
    });
  });
}

/**
 * xvideos 페이징 페이지의 모든 비디오 엔트리 자산(메인/보조 썸네일 + 프리뷰 mp4)을
 * 동시성 제한(3)으로 fetch 인출해 엔트리별 CRAWL_IMAGE 번들로 서버에 저장하고
 * 각각의 CRAWL_MEDIA_SAVED ACK를 확인한 뒤 집계 결과를 반환합니다.
 * 안정 우선 정책에 따라 한 번에 3개까지만 병렬로 인출·전송합니다.
 *
 * @param page - 페이지 인덱스
 * @param entries - 페이지에서 수집된 비디오 엔트리 목록
 * @param pathSegments - URL 기반 저장 계층 경로 (예: ["best","2026-03","1"])
 * @param pageUrl - 실제 페이지 URL (서버 저장 도메인 산출 기준, images/<도메인>/... 생성)
 * @returns 페이지 미디어 저장 집계 결과
 */
async function handleFetchPageMediaBundles(
  page: number,
  entries: XvideosMediaEntry[],
  pathSegments: string[],
  pageUrl: string,
): Promise<XvBestOfRedMediaResult> {
  const savedFiles: string[] = [];
  const failedEntries: Array<{ eid: string; reason: string }> = [];
  const entryFiles: XvBestOfRedSavedFileInfo[] = [];
  let savedCount = 0;
  let failedCount = 0;

  // pathSegments는 URL 기반 [세그먼트, YYYY-MM, 페이지] 구조입니다.
  // 첫 세그먼트는 카테고리로 분리하고 나머지(YYYY-MM/페이지)만 저장 계층으로 전달합니다.
  // (이전 버전은 images/common/best-of-red/best-of-red/... 이중 폴더를 생성했음)
  const category = pathSegments.length > 0 ? pathSegments[0] : "normal";
  const mediaSegments = pathSegments.slice(1);

  // 동시성 제한 (안정 우선: 최대 3개 동시 인출·전송)
  const CONCURRENCY = 3;
  let index = 0;
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, entries.length) },
    async () => {
      while (index < entries.length) {
        const current = index;
        index += 1;
        const entry = entries[current];
        const bundleId = `bofr-${page}-${current}-${entry.eid || "x"}`;
        const baseName = `page-${page}-${entry.eid || current}`;
        try {
          const result = await handleFetchMediaBundle(bundleId, entry, {
            baseName,
            category,
            clickUrl: entry.clickUrl,
            title: entry.title,
            pathSegments: mediaSegments,
            // 서버가 실제 도메인(xvideos.com/xvideos.red)으로 images/<도메인>/... 폴더를 생성하도록 전달
            pageUrl,
            timestamp: Date.now(),
          });
          const ack = result.ack as Record<string, unknown> | undefined;
          if (result.success && ack && Array.isArray(ack.savedFiles)) {
            savedCount += 1;
            const files = ack.savedFiles as string[];
            savedFiles.push(...files);

            // 엔트리별 저장 파일 매핑 구성 (page-N.json 메타 기록용)
            const info: XvBestOfRedSavedFileInfo = { eid: entry.eid };
            for (const f of files) {
              if (/_thumb\.[a-z0-9]+$/i.test(f)) info.thumb = f;
              else if (/_sfw\.[a-z0-9]+$/i.test(f)) info.sfw = f;
              else if (/_preview\.[a-z0-9]+$/i.test(f)) info.preview = f;
            }
            entryFiles.push(info);
          } else {
            failedCount += 1;
            failedEntries.push({
              eid: entry.eid,
              reason: result.error || "SAVE_FAILED",
            });
          }
        } catch (err) {
          failedCount += 1;
          failedEntries.push({ eid: entry.eid, reason: String(err) });
        }
      }
    },
  );
  await Promise.all(workers);

  return {
    success: failedCount === 0,
    savedCount,
    failedCount,
    savedFiles,
    entryFiles,
    failedEntries,
  };
}

/**
 * 크롬 로컬 스토리지에서 수집 노드 고유 UUID를 인출합니다.
 * chrome.storage 미지원 환경 및 초기화 미완료 시 localStorage Fallback을 제공합니다.
 *
 * @returns 클라이언트 고유 UUID 문자열
 */
async function getOrCreateClientId(): Promise<string> {
  try {
    // 1. chrome.storage.local 존재 여부 안전 검사 (Null Guard)
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      const result = await chrome.storage.local.get(["clientId"]);
      if (result && typeof result.clientId === "string") return result.clientId;

      const generatedId = crypto.randomUUID();
      await chrome.storage.local.set({ clientId: generatedId });
      return generatedId;
    }
  } catch {
    // 스토리지 API 예외 발생 시 하단 Fallback으로 진행
  }

  // 2. Fallback: 브라우저 기본 localStorage 사용 (안전성 확보)
  let localId = localStorage.getItem("clientId");
  if (!localId) {
    localId = crypto.randomUUID();
    localStorage.setItem("clientId", localId);
  }
  return localId;
}

/**
 * 사이드바 열림/닫힘 상태 업데이트 패킷을 서버로 송출합니다.
 * 크롬 포트 연결 기반으로 사이드바 창 닫힘을 100% 감지합니다.
 *
 * @param isOpen - 사이드바 활성화 여부
 */
async function sendSidebarStatusToServer(isOpen: boolean): Promise<void> {
  const clientId = await getOrCreateClientId();
  const statusPacket: WebSocketPacket = {
    senderId: clientId,
    targetId: "SERVER",
    action: "CLIENT_STATUS_UPDATE",
    payloadType: "json",
    payload: { isSidebarOpen: isOpen },
    meta: { timestamp: Date.now() },
  };

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(statusPacket));
  }
}

/**
 * 백엔드 포트(9600)와 24시간 무중단 단일 웹소켓 통신망을 수립합니다.
 * 연결 끊김 시 3초 주기로 자동 재연결을 시도합니다.
 */
async function connectOffscreenSocket(): Promise<void> {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  )
    return;

  const clientId = await getOrCreateClientId();
  const wsUrl = getWebSocketUrl(clientId);
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    const helloPacket: WebSocketPacket = {
      senderId: clientId,
      targetId: "SERVER",
      action: "CRAWL_METADATA",
      payloadType: "json",
      payload: {
        system: "오프스크린 24시간 무중단 수집 엔진 정상 안착",
        browserInfo: navigator.userAgent,
      },
      meta: { timestamp: Date.now() },
    };
    socket?.send(JSON.stringify(helloPacket));
  };

  socket.onmessage = async (event) => {
    try {
      const packet: WebSocketPacket = JSON.parse(event.data);

      // 플러그인으로 전달된 PING_TEST 요청 수신 시 즉시 PONG_RESPONSE를 반환합니다.
      if (
        packet.action === "PING_TEST" &&
        packet.senderId &&
        packet.targetId !== "SERVER"
      ) {
        const pongPacket: WebSocketPacket = {
          senderId: clientId,
          targetId: packet.senderId,
          action: "PONG_RESPONSE",
          payloadType: "json",
          payload: {
            originalTimestamp: packet.meta?.timestamp || Date.now(),
            responseTimestamp: Date.now(),
            clientId,
          },
          meta: { timestamp: Date.now() },
        };

        // 소켓이 아직 살아있는 경우에만 PONG 응답을 반환합니다 (nullable 가드)
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(pongPacket));
        }
      }

      // 서버 푸시 인증 토큰 갱신 수용 (방어 코드 포함)
      if (packet.action === "UPDATE_AUTH_TOKEN" && packet.payload) {
        const { tokenType, token } = packet.payload as {
          tokenType: string;
          token: string;
        };
        if (
          typeof chrome !== "undefined" &&
          chrome.storage &&
          chrome.storage.local
        ) {
          await chrome.storage.local.set({ [tokenType]: token });
        } else {
          localStorage.setItem(tokenType, token);
        }
      }

      // 환경설정 저장 ACK 수신 시 성공 여부를 알리는 채널 메시지 중계
      // 사이드바 설정 탭에서 별칭 저장 결과 표시에 사용됩니다.
      if (packet.action === "CLIENT_CONFIG_UPDATE_ACK") {
        chrome.runtime
          .sendMessage({ type: "CLIENT_CONFIG_ACK_RECEIVED", packet })
          .catch(() => {
            // 수신자 미존재(사이드바 닫힘) 시 무시
          });
      }

      // 미디어 번들 저장 완료 ACK(CRAWL_MEDIA_SAVED) 수신 시 대기 중인 promise 해소
      if (
        packet.action === "CRAWL_MEDIA_SAVED" &&
        packet.payload &&
        typeof packet.payload === "object"
      ) {
        const ackPayload = packet.payload as Record<string, unknown>;
        if (
          typeof ackPayload.bundleId === "string" &&
          mediaAckWaiters.has(ackPayload.bundleId)
        ) {
          const resolveAck = mediaAckWaiters.get(ackPayload.bundleId);
          mediaAckWaiters.delete(ackPayload.bundleId);
          if (resolveAck) resolveAck(ackPayload);
        }
      }

      // 페이지 단위 JSON 저장 완료 ACK(CRAWL_PARTIAL_SAVED) 수신 시 대기 중인 promise 해소
      // (xvideos 페이징 액션 실행기의 실제 파일 저장 확인용)
      if (
        packet.action === "CRAWL_PARTIAL_SAVED" &&
        packet.payload &&
        typeof packet.payload === "object"
      ) {
        const ackPayload = packet.payload as Record<string, unknown>;
        const requestId =
          typeof ackPayload.requestId === "string"
            ? ackPayload.requestId
            : "";
        if (requestId && partialSaveWaiters.has(requestId)) {
          const resolveAck = partialSaveWaiters.get(requestId);
          partialSaveWaiters.delete(requestId);
          if (resolveAck) {
            resolveAck({
              success: ackPayload.success !== false,
              savedFilePath:
                typeof ackPayload.savedFilePath === "string"
                  ? ackPayload.savedFilePath
                  : undefined,
              fileSize:
                typeof ackPayload.fileSize === "number"
                  ? ackPayload.fileSize
                  : undefined,
              entriesCount:
                typeof ackPayload.entriesCount === "number"
                  ? ackPayload.entriesCount
                  : undefined,
            });
          }
        }
      }

      // 저장 위치 응답(STORAGE_LOCATION_RESPONSE) 수신 시 대기 중인 promise 해소
      if (
        packet.action === "STORAGE_LOCATION_RESPONSE" &&
        packet.payload &&
        storageLocationWaiter
      ) {
        const locationRes = storageLocationWaiter;
        storageLocationWaiter = null;
        locationRes(packet.payload as StorageLocationResponsePayload);
      }

      // 수신 패킷을 백그라운드로 중계하여 사이드바/탭에서 후속 처리를 수행합니다.
      chrome.runtime
        .sendMessage({ type: "SOCKET_PACKET_RECEIVED", packet })
        .catch(() => {
          // 사이드바 미오픈 상태에서의 sendMessage 실패는 정상 동작
        });
    } catch {
      // 패킷 파싱 예외 가드
    }
  };

  socket.onclose = () => {
    socket = null;
    setTimeout(connectOffscreenSocket, 3000);
  };

  socket.onerror = () => {
    socket = null;
  };
}

/**
 * 크롬 포트 연결 기반 사이드바 창 닫힘 100% 감지 리스너
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel-port") {
    sendSidebarStatusToServer(true);

    port.onDisconnect.addListener(() => {
      sendSidebarStatusToServer(false);
    });
  }
});

/**
 * 크롬 내부 메시지 수신기
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_SOCKET_STATUS") {
    getOrCreateClientId().then((clientId) => {
      try {
        sendResponse({
          connected: socket !== null && socket.readyState === WebSocket.OPEN,
          clientId,
          port: PLUGIN_CONFIG.server.port,
        });
      } catch {
        // 채널 파괴 방어
      }
    });
    return true;
  }

  if (message.type === "SEND_SOCKET_PACKET" && message.packet) {
    getOrCreateClientId().then((clientId) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const fullPacket: WebSocketPacket = {
          senderId: clientId,
          targetId: message.packet.targetId || "SERVER",
          action: message.packet.action || "CRAWL_METADATA",
          payloadType: message.packet.payloadType || "json",
          payload: message.packet.payload,
          meta: message.packet.meta || { timestamp: Date.now() },
        };
        socket.send(JSON.stringify(fullPacket));

        // CRAWL_PARTIAL에 requestId가 있으면 서버의 CRAWL_PARTIAL_SAVED ACK까지
        // 응답을 보류해 실제 물리 파일 저장을 확인한 뒤 결과를 반환합니다.
        // (xvideos 페이징 액션 실행기: "서버 저장 완료 확인 후 다음 페이지 이동" 보장)
        const partialPayload =
          message.packet.payload && typeof message.packet.payload === "object"
            ? (message.packet.payload as Record<string, unknown>)
            : null;
        const requestId =
          fullPacket.action === "CRAWL_PARTIAL" &&
          partialPayload &&
          typeof partialPayload.requestId === "string"
            ? (partialPayload.requestId as string)
            : "";

        if (requestId) {
          const timer = setTimeout(() => {
            partialSaveWaiters.delete(requestId);
            try {
              sendResponse({
                success: false,
                error: "PARTIAL_SAVE_TIMEOUT",
              });
            } catch {
              // 채널 파괴 방어
            }
          }, 30000);
          partialSaveWaiters.set(requestId, (ack) => {
            clearTimeout(timer);
            try {
              sendResponse({
                success: ack.success,
                savedFilePath: ack.savedFilePath,
                fileSize: ack.fileSize,
                entriesCount: ack.entriesCount,
              });
            } catch {
              // 채널 파괴 방어
            }
          });
        } else {
          try {
            sendResponse({ success: true });
          } catch {
            // 채널 파괴 방어
          }
        }
      } else {
        connectOffscreenSocket();
        try {
          sendResponse({ success: false, reason: "SOCKET_OFFLINE" });
        } catch {
          // 채널 파괴 방어
        }
      }
    });
    return true;
  }

  // 저장 위치 조회: 서버에 GET_STORAGE_LOCATION 전송 후 응답을 대기해 반환
  if (message.type === "GET_STORAGE_LOCATION" && message.payload) {
    getOrCreateClientId().then((clientId) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const fullPacket: WebSocketPacket = {
          senderId: clientId,
          targetId: "SERVER",
          action: "GET_STORAGE_LOCATION",
          payloadType: "json",
          payload: message.payload,
          meta: { timestamp: Date.now() },
        };
        socket.send(JSON.stringify(fullPacket));

        const timer = setTimeout(() => {
          if (storageLocationWaiter) storageLocationWaiter = null;
          try {
            sendResponse({ success: false, error: "STORAGE_LOCATION_TIMEOUT" });
          } catch {
            // 채널 파괴 방어
          }
        }, 15000);

        storageLocationWaiter = (res) => {
          clearTimeout(timer);
          try {
            sendResponse(res);
          } catch {
            // 채널 파괴 방어
          }
        };
      } else {
        connectOffscreenSocket();
        try {
          sendResponse({ success: false, reason: "SOCKET_OFFLINE" });
        } catch {
          // 채널 파괴 방어
        }
      }
    });
    return true;
  }

  // 미디어 번들 수집: 3자산 fetch → 서버 전송 → 저장 완료 ACK 대기
  if (message.type === "FETCH_MEDIA_BUNDLE" && message.payload) {
    const payload = message.payload as {
      bundleId: string;
      entry: XvideosMediaEntry;
      bundle: CrawlMediaBundlePayload;
    };
    handleFetchMediaBundle(payload.bundleId, payload.entry, payload.bundle)
      .then((result) => {
        try {
          sendResponse(result);
        } catch {
          // 채널 파괴 방어
        }
      })
      .catch(() => {
        try {
          sendResponse({ success: false, error: "FETCH_MEDIA_BUNDLE_ERROR" });
        } catch {
          // 채널 파괴 방어
        }
      });
    return true;
  }

  // xvideos 페이징 페이지 미디어 전체 인출·저장: 페이지의 모든 엔트리 자산을
  // 동시성 제한으로 서버에 번들 저장하고 집계 결과를 반환합니다.
  if (message.type === "FETCH_PAGE_MEDIA_BUNDLES" && message.payload) {
    const payload = message.payload as {
      page: number;
      entries: XvideosMediaEntry[];
      pathSegments: string[];
      pageUrl?: string;
    };
    handleFetchPageMediaBundles(
      typeof payload.page === "number" ? payload.page : 0,
      Array.isArray(payload.entries) ? payload.entries : [],
      Array.isArray(payload.pathSegments) ? payload.pathSegments : [],
      typeof payload.pageUrl === "string" ? payload.pageUrl : "",
    )
      .then((result) => {
        try {
          sendResponse(result);
        } catch {
          // 채널 파괴 방어
        }
      })
      .catch(() => {
        try {
          sendResponse({
            success: false,
            savedCount: 0,
            failedCount: Array.isArray(payload.entries)
              ? payload.entries.length
              : 0,
            savedFiles: [],
            failedEntries: [{ eid: "", reason: "FETCH_PAGE_MEDIA_ERROR" }],
          });
        } catch {
          // 채널 파괴 방어
        }
      });
    return true;
  }

  return false;
});

// 오프스크린 문서 로드 즉시 소켓 연결 초기화
connectOffscreenSocket();
