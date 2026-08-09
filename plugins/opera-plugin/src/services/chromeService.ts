// plugins/opera-plugin/src/services/chromeService.ts

import {
  BrowserInfo,
  ProcessorInfo,
  SocketStatusResponse,
  PayloadType,
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
                  (retryResponse: { success?: boolean } | undefined) => {
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
