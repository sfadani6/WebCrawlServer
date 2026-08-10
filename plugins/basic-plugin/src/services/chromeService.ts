// plugins/basic-plugin/src/services/chromeService.ts

import {
  BrowserInfo,
  ProcessorInfo,
  SocketStatusResponse,
  PayloadType,
  XvideosMediaEntry,
  CrawlMediaBundlePayload,
  StorageLocationResponsePayload,
  XvBestOfRedInitData,
  XvBestOfRedPageData,
} from "../types/index.js";

/**
 * 범용 웹소켓 패킷을 오프스크린 소켓을 거쳐 서버로 송출합니다.
 * SEND_SOCKET_PACKET 메시지 타입으로 백그라운드에 중계합니다.
 *
 * @param packet - 서버로 전송할 패킷 구성 (action, targetId, payloadType, payload)
 * @returns 전송 처리 결과 객체
 */
export function sendSocketPacket(packet: {
  action: string;
  targetId?: string;
  payloadType?: PayloadType;
  payload?: unknown;
}): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "SEND_SOCKET_PACKET",
        packet: {
          action: packet.action,
          targetId: packet.targetId || "SERVER",
          payloadType: packet.payloadType || "json",
          payload: packet.payload,
          meta: { timestamp: Date.now() },
        },
      },
      (res) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            message: "전송 실패: 백그라운드 엔진 오프라인",
          });
        } else if (res && !res.success) {
          resolve({
            success: false,
            message: "전송 실패: 서버 소켓 미연결 상태입니다.",
          });
        } else {
          resolve({
            success: true,
            message: "패킷이 성공적으로 서버로 송출되었습니다.",
          });
        }
      }
    );
  });
}

/**
 * 디버그 커스텀 메시지를 오프스크린 소켓을 거쳐 서버로 송출합니다.
 * CRAWL_METADATA 액션 봉투로 감싸 서버 로그/디버그 채널로 전달합니다.
 *
 * @param parsedJson - 서버로 전송할 JSON 직렬화 가능 데이터
 * @returns 전송 처리 결과 객체
 */
export function sendDebugMessage(
  parsedJson: unknown
): Promise<{ success: boolean; message: string }> {
  return sendSocketPacket({
    action: "CRAWL_METADATA",
    payloadType: "json",
    payload: { debugMessage: parsedJson },
  });
}

/**
 * 플러그인 환경설정(별칭)을 서버로 전송하여 저장을 요청합니다.
 * CLIENT_CONFIG_UPDATE 액션으로 전송되며, 서버는 clients 테이블 alias에 반영 후
 * CLIENT_CONFIG_UPDATE_ACK를 반환합니다.
 *
 * @param alias - 새 노드 한글 별칭
 * @returns 전송 처리 결과 객체
 */
export function sendClientConfigUpdate(
  alias: string
): Promise<{ success: boolean; message: string }> {
  return sendSocketPacket({
    action: "CLIENT_CONFIG_UPDATE",
    payloadType: "json",
    payload: { alias, clientType: "plugin" },
  });
}

/**
 * 오프스크린 소켓 연결 가동 상태를 백그라운드로 질의합니다.
 *
 * @returns 소켓 연결 상태 응답 객체
 */
export function fetchSocketStatus(): Promise<SocketStatusResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_SOCKET_STATUS" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve({ connected: false });
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 현재 활성화된 탭의 URL을 인출합니다.
 *
 * @returns 활성 탭 URL 문자열
 */
export function fetchCurrentTabUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url) {
        resolve(activeTab.url);
      } else {
        resolve("URL 인출 불가");
      }
    });
  });
}

/**
 * 현재 활성 탭으로 전체 DOM 수집 지시(COLLECT_FULL_DOM)를 송출합니다.
 * 콘텐츠 스크립트가 미연결된 경우 안내 메시지를 반환합니다.
 *
 * @returns 수집 처리 결과 객체
 */
export function requestCollectFullDom(): Promise<{
  success: boolean;
  message: string;
}> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || typeof activeTab.id !== "number") {
        resolve({ success: false, message: "활성화된 탭을 찾을 수 없습니다." });
        return;
      }
      // 중첩 콜백에서 타입 안정성을 보장하도록 탭 ID를 상수로 고정
      const targetTabId = activeTab.id;

      chrome.tabs.sendMessage(
        targetTabId,
        { command: "COLLECT_FULL_DOM" },
        (response) => {
          if (chrome.runtime.lastError) {
            // 콘텐츠 스크립트 미주입 탭: scripting.executeScript로 주입 후 자동 재시도
            chrome.scripting.executeScript(
              { target: { tabId: targetTabId }, files: ["content.js"] },
              () => {
                if (chrome.runtime.lastError) {
                  // chrome:// 등 보호 페이지는 주입 불가 — 명확한 안내 반환
                  resolve({
                    success: false,
                    message: "페이지 스크립트 주입 불가 (보호 페이지)",
                  });
                  return;
                }
                chrome.tabs.sendMessage(
                  targetTabId,
                  { command: "COLLECT_FULL_DOM" },
                  (_retryResponse: { success?: boolean } | undefined) => {
                    if (chrome.runtime.lastError) {
                      resolve({
                        success: false,
                        message:
                          "페이지 스크립트 미연결 (페이지 새로고침 후 재시도)",
                      });
                      return;
                    }
                    resolve({
                      success: true,
                      message: "페이지 DOM을 성공적으로 전송했습니다.",
                    });
                  }
                );
              }
            );
            return;
          }

          if (response && response.success) {
            resolve({
              success: true,
              message: "페이지 DOM을 성공적으로 전송했습니다.",
            });
          } else {
            resolve({ success: true, message: "DOM 수집 처리 완료" });
          }
        }
      );
    });
  });
}

/**
 * 특정 탭으로 콘텐츠 스크립트 명령을 송출합니다.
 * 콘텐츠 스크립트 미주입 탭은 content.js를 주입 후 자동 재시도합니다.
 *
 * @param tabId - 대상 탭 ID
 * @param command - 콘텐츠 스크립트 명령 문자열
 * @param payload - 명령에 전달할 페이로드 (선택)
 * @returns 콘텐츠 스크립트 응답 객체 또는 실패 안내
 */
function sendCommandToTab(
  tabId: number,
  command: string,
  payload?: unknown
): Promise<{ success: boolean; message: string; data?: unknown }> {
  return new Promise((resolve) => {
    const dispatch = (
      cb: (res: { success?: boolean; message?: string; data?: unknown }) => void
    ) => {
      chrome.tabs.sendMessage(tabId, { command, payload }, (response) => {
        if (chrome.runtime.lastError) {
          // 콘텐츠 스크립트 미주입 탭: scripting.executeScript로 주입 후 자동 재시도
          chrome.scripting.executeScript(
            { target: { tabId }, files: ["content.js"] },
            () => {
              if (chrome.runtime.lastError) {
                cb({
                  success: false,
                  message: "페이지 스크립트 주입 불가 (보호 페이지)",
                });
                return;
              }
              chrome.tabs.sendMessage(tabId, { command, payload }, (retry) => {
                if (chrome.runtime.lastError) {
                  cb({
                    success: false,
                    message: "페이지 스크립트 미연결 (페이지 새로고침 후 재시도)",
                  });
                  return;
                }
                cb(retry || { success: true });
              });
            }
          );
          return;
        }
        cb(response || { success: true });
      });
    };

    dispatch((response) => {
      resolve({
        success: response.success !== false,
        message: response.message || "명령이 정상 처리되었습니다.",
        data: response.data,
      });
    });
  });
}

/**
 * 현재 활성 탭으로 콘텐츠 스크립트 명령을 송출합니다.
 * 콘텐츠 스크립트 미주입 탭은 content.js를 주입 후 자동 재시도합니다.
 *
 * @param command - 콘텐츠 스크립트 명령 문자열
 * @param payload - 명령에 전달할 페이로드 (선택)
 * @returns 콘텐츠 스크립트 응답 객체 또는 실패 안내
 */
function sendCommandToActiveTab(
  command: string,
  payload?: unknown
): Promise<{ success: boolean; message: string; data?: unknown }> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || typeof activeTab.id !== "number") {
        resolve({ success: false, message: "활성화된 탭을 찾을 수 없습니다." });
        return;
      }
      sendCommandToTab(activeTab.id, command, payload).then(resolve);
    });
  });
}

/**
 * 요소 선택 모드 시작을 현재 활성 탭의 콘텐츠 스크립트에 요청합니다.
 * 마우스 오버 시 파란색 테두리 강조 → 클릭 시 "전송" 버튼 표시 모드가 동작합니다.
 *
 * @returns 요청 처리 결과 객체
 */
export function requestStartElementPicker(): Promise<{
  success: boolean;
  message: string;
}> {
  return sendCommandToActiveTab("START_ELEMENT_PICKER");
}

/**
 * 요소 선택 모드 종료를 현재 활성 탭의 콘텐츠 스크립트에 요청합니다.
 *
 * @returns 요청 처리 결과 객체
 */
export function requestStopElementPicker(): Promise<{
  success: boolean;
  message: string;
}> {
  return sendCommandToActiveTab("STOP_ELEMENT_PICKER");
}

/**
 * 현재 페이지의 iframe 존재 여부와 개수를 콘텐츠 스크립트에 질의합니다.
 *
 * @returns 프레임 조회 결과 (frameCount 포함)
 */
export function requestFrameInfo(): Promise<{
  success: boolean;
  message: string;
  frameCount: number;
}> {
  return sendCommandToActiveTab("GET_FRAME_INFO").then((res) => ({
    success: res.success,
    message: res.message,
    frameCount:
      typeof res.data === "object" && res.data !== null
        ? Number((res.data as { frameCount?: number }).frameCount ?? 0)
        : 0,
  }));
}

/**
 * 현재 페이지의 첫 번째 iframe DOM 수집을 콘텐츠 스크립트에 요청합니다.
 * 같은 오리진 프레임은 전체 DOM을, 크로스 오리진 프레임은 src 참조를 전송합니다.
 *
 * @returns 프레임 수집 처리 결과 객체
 */
export function requestCollectFrameDom(): Promise<{
  success: boolean;
  message: string;
}> {
  return sendCommandToActiveTab("COLLECT_FRAME_DOM");
}

/**
 * 현재 페이지의 이미지 추출 및 서버 전송을 콘텐츠 스크립트에 요청합니다.
 * 카테고리(category)를 함께 전달해 서버가 도메인/카테고리별 디렉토리로 저장하게 합니다.
 * 인출 성공 이미지는 Base64로, 실패(크로스 오리진) 이미지는 src URL 참조로 전송됩니다.
 *
 * @param category - 수집 카테고리 (기본 "normal", 사이트별 album/cover 등)
 * @returns 이미지 수집 결과 요약 객체
 */
export function requestCollectImages(
  category: string = "normal"
): Promise<{
  success: boolean;
  message: string;
  total?: number;
  collected?: number;
  failed?: number;
}> {
  return sendCommandToActiveTab("COLLECT_IMAGES", { category }).then((res) => {
    const data =
      typeof res.data === "object" && res.data !== null
        ? (res.data as { total?: number; collected?: number; failed?: number; message?: string })
        : undefined;
    return {
      success: res.success,
      message: data?.message || res.message,
      total: data?.total,
      collected: data?.collected,
      failed: data?.failed,
    };
  });
}

/**
 * 현재 페이지의 사이트 정보(메타데이터) 수집을 콘텐츠 스크립트에 요청합니다.
 * 정보 수집 버튼(사이트 전용)에서 호출되며 SITE_INFO 액션으로 JSON이 서버에 전송됩니다.
 *
 * @returns 사이트 정보 수집 처리 결과 객체
 */
export function requestCollectSiteInfo(): Promise<{
  success: boolean;
  message: string;
}> {
  return sendCommandToActiveTab("COLLECT_SITE_INFO");
}

/**
 * 현재 페이지(xvideos.com)의 비디오 블록 메타를 콘텐츠 스크립트에 요청해
 * 미디어 다운로드 매니저 목록 구성에 필요한 항목(클릭 URL/제목/3종 자산 URL)을 인출합니다.
 *
 * @returns 파싱 결과 객체 (entries, pageUrl 포함)
 */
export function requestCollectXvideosMedia(): Promise<{
  success: boolean;
  message: string;
  entries: XvideosMediaEntry[];
  pageUrl: string;
}> {
  return sendCommandToActiveTab("COLLECT_XVIDEOS_MEDIA").then((res) => {
    const data =
      typeof res.data === "object" && res.data !== null
        ? (res.data as {
            entries?: XvideosMediaEntry[];
            pageUrl?: string;
            message?: string;
          })
        : undefined;
    return {
      success: res.success,
      message: data?.message || res.message,
      entries: Array.isArray(data?.entries) ? (data.entries as XvideosMediaEntry[]) : [],
      pageUrl: data?.pageUrl || "",
    };
  });
}

/**
 * 특정 탭(다운로드 매니저가 대상으로 하는 xvideos 탭)의 비디오 블록 메타를
 * 콘텐츠 스크립트에 요청해 미디어 다운로드 매니저 목록 구성을 위한 항목을 인출합니다.
 * 전용 매니저 팝업 창에서 호출되므로 활성 탭이 아닌 명시적 tabId로 송신합니다.
 *
 * @param tabId - 대상 xvideos 탭 ID
 * @returns 파싱 결과 객체 (entries, pageUrl 포함)
 */
export function requestCollectXvideosMediaFromTab(tabId: number): Promise<{
  success: boolean;
  message: string;
  entries: XvideosMediaEntry[];
  pageUrl: string;
}> {
  return sendCommandToTab(tabId, "COLLECT_XVIDEOS_MEDIA").then((res) => {
    const data =
      typeof res.data === "object" && res.data !== null
        ? (res.data as {
            entries?: XvideosMediaEntry[];
            pageUrl?: string;
            message?: string;
          })
        : undefined;
    return {
      success: res.success,
      message: data?.message || res.message,
      entries: Array.isArray(data?.entries) ? (data.entries as XvideosMediaEntry[]) : [],
      pageUrl: data?.pageUrl || "",
    };
  });
}

/**
 * 대상 xvideos best-of-red 탭의 초기 정보(베이스 경로·현재/마지막 페이지·총 페이지 수)를 조회합니다.
 * 페이지네이션(data-page) 연속 블록에서 마지막 페이지를 콘텐츠 스크립트가 감지합니다.
 *
 * @param tabId - 대상 xvideos 탭 ID
 * @returns 초기 정보 응답 객체 (success/message/data)
 */
export function requestXvBestOfRedInit(tabId: number): Promise<{
  success: boolean;
  message: string;
  data: XvBestOfRedInitData | null;
}> {
  return sendCommandToTab(tabId, "COLLECT_BEST_OF_RED_INIT").then((res) => {
    const data =
      typeof res.data === "object" && res.data !== null
        ? (res.data as XvBestOfRedInitData)
        : null;
    return {
      success: res.success,
      message: res.message || "",
      data,
    };
  });
}

/**
 * 대상 xvideos best-of-red 탭의 현재 페이지 비디오 블록 메타를 수집합니다.
 * 콘텐츠 스크립트가 로드 완료(readyState complete + 썸네일 이미지 로드)를 검증한 뒤 수집하며,
 * 검증이 끝나기 전에는 수집을 미루므로 페이지의 로딩이 완전히 끝난 상태를 보장합니다.
 *
 * @param tabId - 대상 xvideos 탭 ID
 * @returns 페이지 수집 응답 객체 (success/message/data)
 */
export function requestXvBestOfRedPage(tabId: number): Promise<{
  success: boolean;
  message: string;
  data: XvBestOfRedPageData | null;
}> {
  return sendCommandToTab(tabId, "COLLECT_BEST_OF_RED_PAGE").then((res) => {
    const data =
      typeof res.data === "object" && res.data !== null
        ? (res.data as XvBestOfRedPageData)
        : null;
    return {
      success: res.success,
      message: res.message || (data && data.message) || "",
      data,
    };
  });
}

/**
 * 대상 저장 디렉토리(images/<도메인>/<카테고리>)를 서버에 조회합니다.
 * 오프스크린이 GET_STORAGE_LOCATION 패킷을 서버에 전송하고 STORAGE_LOCATION_RESPONSE를 대기합니다.
 *
 * @param pageUrl - 대상 페이지 URL (도메인 산출 기준)
 * @param category - 수집 카테고리 (기본 "normal")
 * @returns 저장 위치 응답 객체
 */
export function requestStorageLocation(
  pageUrl: string,
  category: string = "normal"
): Promise<StorageLocationResponsePayload> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_STORAGE_LOCATION", payload: { pageUrl, category } },
      (res) => {
        if (chrome.runtime.lastError || !res) {
          resolve({ success: false, message: "저장 위치 조회 실패 (오프스크린 오프라인)" });
          return;
        }
        resolve(res as StorageLocationResponsePayload);
      }
    );
  });
}

/**
 * xvideos 비디오 블록 1건의 미디어 번들 다운로드를 오프스크린에 요청합니다.
 * 오프스크린이 3종 자산(썸네일 2 + 프리뷰 mp4)을 fetch 후 서버에 전송하고,
 * 저장 완료 ACK(CRAWL_MEDIA_SAVED)를 대기해 결과를 반환합니다.
 *
 * @param bundleId - 항목 추적 ID
 * @param entry - 비디오 블록 메타 항목
 * @param bundle - 미디어 번들 페이로드 (txtContent/baseName/category 등 포함)
 * @returns 저장 완료 결과 (ack에 저장 경로 포함)
 */
export function requestFetchMediaBundle(
  bundleId: string,
  entry: XvideosMediaEntry,
  bundle: CrawlMediaBundlePayload
): Promise<{
  success: boolean;
  ack?: { success?: boolean; savedDir?: string; savedFiles?: string[]; bundleId?: string };
  error?: string;
}> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "FETCH_MEDIA_BUNDLE", payload: { bundleId, entry, bundle } },
      (res) => {
        if (chrome.runtime.lastError || !res) {
          resolve({ success: false, error: "오프스크린 오프라인" });
          return;
        }
        const data = res as {
          success?: boolean;
          ack?: { success?: boolean; savedDir?: string; savedFiles?: string[]; bundleId?: string };
          error?: string;
        };
        resolve({
          success: data.success === true,
          ack: data.ack,
          error: data.error,
        });
      }
    );
  });
}

/**
 * 브라우저 플랫폼 및 시스템 스펙 정보를 추출합니다.
 *
 * @returns 브라우저 스펙 정보 객체
 */
export function extractBrowserInfo(): BrowserInfo {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform || "알 수 없음",
    vendor: navigator.vendor || "알 수 없음",
    cookieEnabled: navigator.cookieEnabled,
    onlineStatus: navigator.onLine,
  };
}

/**
 * 브라우저 프로세서 및 디바이스 성능 스펙 정보를 추출합니다.
 *
 * @returns 프로세서 성능 정보 객체
 */
export function extractProcessorInfo(): ProcessorInfo {
  // deviceMemory는 비표준 속성으로 타입 캐스팅 처리
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    deviceMemory: nav.deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints || 0,
  };
}
