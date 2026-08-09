// plugins/basic-plugin/src/background.ts

/**
 * 백그라운드 서비스 워커 모듈입니다.
 * 오프스크린 문서를 생성하여 24시간 무중단 웹소켓 소유권을 위임하고,
 * 사이드바 오픈 동작 및 내부 메시지 중계를 담당합니다.
 * ADR-001: 사이드바 단일 UI & 오프스크린 무중단 소켓 아키텍처 준수
 */

/**
 * 브라우저 백그라운드에 오프스크린 문서가 미생성 상태일 경우 자동 생성합니다.
 * 이미 생성된 경우 중복 생성을 방지합니다.
 */
async function ensureOffscreenDocument(): Promise<void> {
  // 기존 오프스크린 컨텍스트 존재 여부 확인
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (existingContexts.length > 0) return;

  // 오프스크린 문서 생성 (24시간 무중단 WebSocket 소유자)
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification: "WebCrawlServer 분산 크롤링 24시간 무중단 웹소켓 유지",
  });
}

/**
 * 확장 프로그램 설치 시 초기화 작업을 수행합니다.
 * 아이콘 클릭 시 팝업 대신 사이드바가 즉시 열리도록 설정하고,
 * 오프스크린 문서를 생성하여 소켓 통신을 준비합니다.
 */
chrome.runtime.onInstalled.addListener(() => {
  // 툴바 아이콘 클릭 시 팝업 대신 사이드 패널 즉시 오픈 설정
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  ensureOffscreenDocument();
});

/**
 * 브라우저 시작 시 오프스크린 문서를 재생성합니다.
 * 서비스 워커가 종료된 후 재가동될 때도 소켓 연결이 복원됩니다.
 */
chrome.runtime.onStartup.addListener(() => {
  ensureOffscreenDocument();
});

/**
 * 크롬 내부 메시지 수신기 및 중계 라우터입니다.
 * 오프스크린에서 전달된 서버 수신 패킷을 적절한 탭/사이드바로 라우팅합니다.
 */
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  // 오프스크린 문서 생존 보장: 소켓 관련 메시지 수신 시 오프스크린이 크롬에 의해
  // 종료된 상태라면 즉시 재생성하여 24시간 무중단 소켓을 복구합니다.
  // (오프스크린이 이미 존재하면 no-op이며, 새로 생성되면 connectOffscreenSocket이 실행됨)
  if (
    message &&
    (message.type === "GET_SOCKET_STATUS" ||
      message.type === "SEND_SOCKET_PACKET" ||
      message.type === "SOCKET_PACKET_RECEIVED")
  ) {
    ensureOffscreenDocument();
  }

  // 오프스크린에서 중계된 서버 수신 패킷 처리
  if (message.type === "SOCKET_PACKET_RECEIVED" && message.packet) {
    const packet = message.packet;

    // 원격 CRAWL_START 지시 수신 시 활성 탭 콘텐츠 스크립트로 전달
    if (packet.action === "CRAWL_START") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.id) {
          chrome.tabs.sendMessage(activeTab.id, {
            command: "START_DOM_CRAWL",
            depth: packet.payload?.depth,
          });
        }
      });
    }
  }
  return false;
});
