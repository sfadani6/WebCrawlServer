// plugins/basic-plugin/src/content.ts

/**
 * 콘텐츠 스크립트 모듈입니다.
 * 현재 페이지 DOM을 수집하거나 선언형 페이징 크롤링을 수행하며,
 * 수집된 데이터를 오프스크린 소켓을 통해 서버로 전송합니다.
 */

/** 선언형 페이징 수집 파라미터 구조체 */
export interface PaginationCrawlPayload {
  /** 다음 페이지 클릭 버튼 CSS 셀렉터 */
  nextPageSelector: string;
  /** 수집할 요소를 지정하는 CSS 셀렉터 */
  contentSelector: string;
  /** 수집할 최대 페이지 수 */
  maxPages: number;
  /** 페이지 클릭 후 대기 시간 (ms) */
  delayMs: number;
}

/**
 * 서버에서 전달받은 선언형 행동 양식에 맞춰 페이징 버튼을 순차 클릭하며
 * 연속 페이지에 걸친 데이터를 수집합니다.
 * 차단 방지를 위한 인간 모사 지연(Human-like Jitter Delay)을 내장합니다.
 *
 * @param payload - 페이징 수집 파라미터 객체
 */
async function runPaginationCrawlEngine(payload: PaginationCrawlPayload): Promise<void> {
  let currentPage = 1;

  while (currentPage <= payload.maxPages) {
    // 현재 페이지에서 지정 셀렉터로 텍스트 항목 수집
    const items = Array.from(document.querySelectorAll(payload.contentSelector))
      .map((el) => el.textContent?.trim() || "")
      .filter((text) => text.length > 0);

    // 오프스크린 소켓으로 수집 데이터 포워딩 (일부 데이터 → CRAWL_PARTIAL)
    chrome.runtime.sendMessage({
      type: "SEND_SOCKET_PACKET",
      packet: {
        action: "CRAWL_PARTIAL",
        payloadType: "json",
        payload: {
          page: currentPage,
          url: window.location.href,
          title: document.title,
          data: items,
          timestamp: Date.now(),
        },
        meta: { timestamp: Date.now() },
      },
    });

    // 마지막 페이지 도달 시 반복 종료
    if (currentPage >= payload.maxPages) break;

    // 다음 페이지 버튼 탐색 및 클릭
    const nextBtn = document.querySelector(payload.nextPageSelector) as HTMLElement | null;
    if (!nextBtn) break;

    nextBtn.click();
    currentPage++;

    // 차단 방지 인간 모사 지연 시간 (Human-like Random Jitter Delay)
    const jitter = Math.floor(Math.random() * 1000);
    await new Promise((resolve) => setTimeout(resolve, payload.delayMs + jitter));
  }
}

/**
 * 크롬 메시지 수신기: 백그라운드 및 사이드바로부터의 DOM 수집 지시를 처리합니다.
 */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {

  // [1] 선언형 페이징 크롤링 지시
  if (request.command === "START_PAGINATION_CRAWL" && request.payload) {
    runPaginationCrawlEngine(request.payload);
    sendResponse({ success: true });
    return false;
  }

  // [2] 기본 DOM 크롤링 지시 (링크 및 타이틀 수집)
  if (request.command === "START_DOM_CRAWL") {
    const pageTitle = document.title;
    const hyperlinks: string[] = [];

    // 현재 페이지의 첫 15개 하이퍼링크 수집
    const anchors = document.querySelectorAll("a");
    anchors.forEach((a, idx) => {
      if (idx < 15 && a.href) hyperlinks.push(a.href);
    });

    // 오프스크린 소켓으로 포워딩 (일부 데이터 → CRAWL_PARTIAL)
    chrome.runtime.sendMessage({
      type: "SEND_SOCKET_PACKET",
      packet: {
        action: "CRAWL_PARTIAL",
        payloadType: "json",
        payload: {
          url: window.location.href,
          title: pageTitle,
          data: { links: hyperlinks },
          timestamp: Date.now(),
        },
        meta: { timestamp: Date.now() },
      },
    });
    return false;
  }

  // [3] 전체 DOM HTML 수집 지시 (물리 파일 저장소 연동용 → CRAWL_DOCUMENT)
  if (request.command === "COLLECT_FULL_DOM") {
    const fullDomHtml = document.documentElement.outerHTML;
    const domData = {
      url: window.location.href,
      title: document.title,
      fullDom: fullDomHtml,
      timestamp: Date.now(),
    };

    // 오프스크린 소켓으로 포워딩 (서버에서 물리 파일 분리 저장 처리)
    chrome.runtime.sendMessage({
      type: "SEND_SOCKET_PACKET",
      packet: {
        action: "CRAWL_DOCUMENT",
        payloadType: "json",
        payload: domData,
        meta: { timestamp: Date.now() },
      },
    });

    sendResponse({ success: true, data: domData });
    return false;
  }

  return false;
});
