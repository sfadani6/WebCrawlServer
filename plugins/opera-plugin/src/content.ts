// plugins/opera-plugin/src/content.ts

/**
 * 콘텐츠 스크립트 모듈입니다.
 * 현재 페이지 DOM을 수집하거나 선언형 페이징 크롤링을 수행하며,
 * 사이드바에서 요청한 요소 선택 모드, 프레임 수집, 이미지 추출을 처리합니다.
 * 수집된 데이터는 오프스크린 소켓을 통해 서버로 전송합니다.
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

/** 요소 선택 모드 하이라이트 색상 (파란색 테두리) */
const PICKER_HIGHLIGHT_COLOR = "#3b82f6";

/** 한 번에 수집할 최대 이미지 개수 (메시지 폭주 방지) */
const MAX_IMAGE_COLLECT_COUNT = 50;

/** 요소 선택 모드 활성화 여부 */
let pickerActive = false;
/** 요소 선택 모드에서 현재 하이라이트된 요소 */
let pickerHovered: HTMLElement | null = null;
/** 요소 선택 모드에서 최종 선택된 요소 */
let pickerSelected: HTMLElement | null = null;
/** 선택된 요소에 표시되는 전송 플로팅 버튼 */
let pickerSendButton: HTMLButtonElement | null = null;

/**
 * 선언형 페이징 수집 엔진입니다.
 * 서버에서 전달받은 행동 양식에 맞춰 페이징 버튼을 순차 클릭하며 연속 수집합니다.
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
 * 전송 플로팅 버튼을 제거하고 초기화합니다.
 */
function removePickerSendButton(): void {
  if (pickerSendButton && pickerSendButton.parentElement) {
    pickerSendButton.parentElement.removeChild(pickerSendButton);
  }
  pickerSendButton = null;
}

/**
 * 현재 하이라이트된 요소의 파란 테두리 강조를 해제합니다.
 */
function clearPickerHover(): void {
  if (pickerHovered) {
    pickerHovered.style.outline = "";
    pickerHovered.style.outlineOffset = "";
    pickerHovered = null;
  }
}

/**
 * 선택된 요소의 위치(하단 우측)에 "전송" 플로팅 버튼을 생성합니다.
 * 버튼 클릭 시 해당 요소의 outerHTML 전체를 CRAWL_PARTIAL로 서버에 전송합니다.
 *
 * @param element - 최종 선택된 대상 요소
 */
function showPickerSendButton(element: HTMLElement): void {
  removePickerSendButton();

  const rect = element.getBoundingClientRect();
  const button = document.createElement("button");
  button.textContent = "전송";
  button.style.position = "fixed";
  button.style.left = `${Math.min(rect.left + rect.width - 60, window.innerWidth - 80)}px`;
  button.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 40)}px`;
  button.style.zIndex = "2147483647";
  button.style.padding = "6px 14px";
  button.style.fontSize = "13px";
  button.style.fontWeight = "700";
  button.style.color = "#ffffff";
  button.style.background = "linear-gradient(135deg, #1d4ed8, #3b82f6)";
  button.style.border = "none";
  button.style.borderRadius = "6px";
  button.style.boxShadow = "0 4px 12px rgba(29, 78, 216, 0.5)";
  button.style.cursor = "pointer";

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    // 선택된 요소의 outerHTML 전체를 서버로 전송 (결정 사항: outerHTML 전체 전송)
    const outerHTML = element.outerHTML;
    chrome.runtime.sendMessage({
      type: "SEND_SOCKET_PACKET",
      packet: {
        action: "CRAWL_PARTIAL",
        payloadType: "json",
        payload: {
          url: window.location.href,
          title: document.title,
          data: {
            tag: element.tagName.toLowerCase(),
            id: element.id || undefined,
            className: typeof element.className === "string" ? element.className : "",
            outerHTML,
          },
          timestamp: Date.now(),
        },
        meta: { timestamp: Date.now() },
      },
    });

    // 요소 선택 모드 종료 및 사이드바에 완료 알림 전송
    stopElementPicker();
    chrome.runtime.sendMessage({
      type: "ELEMENT_PICKER_ENDED",
      payload: {
        message: `요소 전송 완료 (${element.tagName.toLowerCase()})`,
        bytes: new Blob([outerHTML]).size,
      },
    });
  });

  document.documentElement.appendChild(button);
  pickerSendButton = button;
}

/**
 * 요소 선택 모드를 시작합니다.
 * 페이지의 DOM 요소에 마우스를 올리면 파란색 테두리로 강조되고,
 * 클릭하면 해당 위치에 "전송" 플로팅 버튼이 나타납니다.
 */
function startElementPicker(): void {
  if (pickerActive) return;
  pickerActive = true;

  document.addEventListener("mousemove", handlePickerMouseMove, true);
  document.addEventListener("click", handlePickerClick, true);
  document.addEventListener("keydown", handlePickerKeyDown, true);
}

/**
 * 요소 선택 모드를 종료하고 모든 강조/버튼/리스너를 정리합니다.
 */
function stopElementPicker(): void {
  if (!pickerActive && !pickerSelected) return;
  pickerActive = false;
  pickerSelected = null;

  clearPickerHover();
  removePickerSendButton();
  document.removeEventListener("mousemove", handlePickerMouseMove, true);
  document.removeEventListener("click", handlePickerClick, true);
  document.removeEventListener("keydown", handlePickerKeyDown, true);
}

/**
 * 요소 선택 모드의 마우스 이동 핸들러.
 * 포인터 아래 요소에 파란 테두리(outline)를 적용하고 이전 요소는 해제합니다.
 *
 * @param event - 마우스 이동 이벤트
 */
function handlePickerMouseMove(event: MouseEvent): void {
  if (!pickerActive || pickerSelected) return;
  const target = event.target as HTMLElement | null;
  if (!target || target === pickerSendButton) return;

  if (pickerHovered !== target) {
    clearPickerHover();
    pickerHovered = target;
    target.style.outline = `${PICKER_HIGHLIGHT_COLOR} solid 3px`;
    target.style.outlineOffset = "2px";
  }
}

/**
 * 요소 선택 모드의 클릭 핸들러.
 * 페이지 기본 동작을 차단하고 클릭한 요소를 선택하여 전송 버튼을 표시합니다.
 *
 * @param event - 클릭 이벤트
 */
function handlePickerClick(event: MouseEvent): void {
  if (!pickerActive) return;
  const target = event.target as HTMLElement | null;
  if (!target || target === pickerSendButton) return;

  event.preventDefault();
  event.stopPropagation();

  // 선택 고정: 하이라이트 유지 + 전송 버튼 표시
  pickerSelected = target;
  clearPickerHover();
  target.style.outline = `${PICKER_HIGHLIGHT_COLOR} solid 3px`;
  target.style.outlineOffset = "2px";
  showPickerSendButton(target);
}

/**
 * 요소 선택 모드의 키보드 핸들러 (ESC 키로 모드 종료).
 *
 * @param event - 키보드 이벤트
 */
function handlePickerKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape" && pickerActive) {
    stopElementPicker();
    chrome.runtime.sendMessage({ type: "ELEMENT_PICKER_ENDED", payload: { message: "요소 선택 취소" } });
  }
}

/**
 * ArrayBuffer를 Base64 문자열로 변환합니다.
 * (대용량 이미지 전송을 위해 2바이트 청크 단위 인코딩)
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
 * 이미지 소스 URL로부터 안전한 파일명을 추출합니다.
 * URL이 없거나 정화 결과가 빈 문자열이면 인덱스 기반 기본명을 반환합니다.
 *
 * @param src - 이미지 소스 URL
 * @param fallbackName - 기본 파일명 (없을 시 인덱스 번호 사용)
 * @returns 안전한 파일명 문자열
 */
function extractImageFileName(src: string, fallbackName: string): string {
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
 * 페이지 내 이미지들을 추출하여 서버로 전송합니다.
 * 같은 오리진/CORS 허용 이미지는 fetch→Base64 변환 후 CRAWL_IMAGE(binary_base64)로,
 * 인출 실패(크로스 오리진) 이미지는 src URL만 CRAWL_IMAGE(json)로 전송합니다.
 *
 * @returns 수집 결과 요약 객체
 */
async function collectAndSendImages(): Promise<{
  success: boolean;
  total: number;
  collected: number;
  failed: number;
  message: string;
}> {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>("img"));
  const targets = images.slice(0, MAX_IMAGE_COLLECT_COUNT);
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  let collected = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const img = targets[i];
    const src = img.currentSrc || img.src || "";
    const fileName = extractImageFileName(src, `image_${i + 1}.png`);
    const timestamp = Date.now();

    if (!src) continue;

    // data: 스킴 이미지는 즉시 Base64 데이터로 전송
    if (src.startsWith("data:")) {
      const mimeMatch = src.match(/^data:([^;]+);/);
      chrome.runtime.sendMessage({
        type: "SEND_SOCKET_PACKET",
        packet: {
          action: "CRAWL_IMAGE",
          payloadType: "binary_base64",
          payload: {
            fileName,
            mimeType: mimeMatch ? mimeMatch[1] : "image/png",
            url: src,
            pageUrl,
            data: src.split(",")[1] || "",
            timestamp,
          },
          meta: { timestamp },
        },
      });
      collected++;
      continue;
    }

    // http(s) 이미지: fetch로 인출 시도 (같은 오리진 쿠키 자동 포함)
    // 기본 cors 모드를 사용해 CORS 허용 CDN 이미지는 인출 성공, 미허용 크로스 오리진은 실패 처리
    try {
      const resp = await fetch(src, { credentials: "include" });
      const blob = await resp.blob();
      const buffer = await blob.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);

      chrome.runtime.sendMessage({
        type: "SEND_SOCKET_PACKET",
        packet: {
          action: "CRAWL_IMAGE",
          payloadType: "binary_base64",
          payload: {
            fileName,
            mimeType: blob.type || "image/png",
            url: src,
            pageUrl,
            data: base64,
            timestamp,
          },
          meta: { timestamp },
        },
      });
      collected++;
    } catch {
      // 크로스 오리진 등 인출 실패: src URL만 전송 (서버가 참조 파일로 보관)
      chrome.runtime.sendMessage({
        type: "SEND_SOCKET_PACKET",
        packet: {
          action: "CRAWL_IMAGE",
          payloadType: "json",
          payload: {
            fileName,
            mimeType: "",
            url: src,
            pageUrl,
            error: "CORS_OR_FETCH_FAILED",
            timestamp,
          },
          meta: { timestamp },
        },
      });
      failed++;
    }
  }

  return {
    success: true,
    total: targets.length,
    collected,
    failed,
    message: `이미지 수집 완료: ${collected}개 전송, ${failed}개 URL 참조 (${pageTitle})`,
  };
}

/**
 * 현재 페이지의 iframe 존재 여부와 개수를 반환합니다.
 *
 * @returns 프레임 조회 결과 객체
 */
function getFrameInfo(): { success: boolean; frameCount: number } {
  const frames = document.querySelectorAll("iframe");
  return { success: true, frameCount: frames.length };
}

/**
 * 현재 페이지의 첫 번째 iframe DOM을 수집하여 서버로 전송합니다.
 * 같은 오리진 프레임은 outerHTML을 CRAWL_DOCUMENT로 전송하고,
 * 크로스 오리진 프레임은 접근 불가 시 src URL만 CRAWL_PARTIAL로 전송합니다.
 *
 * @returns 프레임 수집 결과 객체
 */
function collectAndSendFrame(): {
  success: boolean;
  message: string;
  frameSrc?: string;
} {
  const frame = document.querySelector("iframe");
  if (!frame) {
    return { success: false, message: "iframe이 존재하지 않습니다." };
  }

  const frameSrc = frame.src || "about:blank";
  try {
    const frameDoc = frame.contentDocument;
    if (!frameDoc || !frameDoc.documentElement) {
      throw new Error("FRAME_DOCUMENT_INACCESSIBLE");
    }
    const frameHtml = frameDoc.documentElement.outerHTML;
    chrome.runtime.sendMessage({
      type: "SEND_SOCKET_PACKET",
      packet: {
        action: "CRAWL_DOCUMENT",
        payloadType: "json",
        payload: {
          url: frameSrc,
          title: frameDoc.title || "iframe 문서",
          fullDom: frameHtml,
          pageUrl: window.location.href,
          timestamp: Date.now(),
        },
        meta: { timestamp: Date.now() },
      },
    });
    return {
      success: true,
      message: `iframe DOM 전송 완료: ${frameSrc}`,
      frameSrc,
    };
  } catch {
    // 크로스 오리진 iframe: 접근 불가 → src URL만 전송
    chrome.runtime.sendMessage({
      type: "SEND_SOCKET_PACKET",
      packet: {
        action: "CRAWL_PARTIAL",
        payloadType: "json",
        payload: {
          url: frameSrc,
          title: "iframe (크로스 오리진)",
          data: {
            tag: "iframe",
            outerHTML: frame.outerHTML,
            note: "크로스 오리진 프레임으로 DOM 접근 불가 — src URL 참조 저장",
          },
          timestamp: Date.now(),
        },
        meta: { timestamp: Date.now() },
      },
    });
    return {
      success: true,
      message: `크로스 오리진 iframe src 참조 전송: ${frameSrc}`,
      frameSrc,
    };
  }
}

/**
 * 크롬 메시지 수신기: 백그라운드 및 사이드바로부터의 DOM 수집/요소 선택/프레임/이미지 지시를 처리합니다.
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

  // [4] 요소 선택 모드 시작 지시
  if (request.command === "START_ELEMENT_PICKER") {
    startElementPicker();
    sendResponse({ success: true, message: "요소 선택 모드 시작" });
    return false;
  }

  // [5] 요소 선택 모드 종료 지시
  if (request.command === "STOP_ELEMENT_PICKER") {
    stopElementPicker();
    sendResponse({ success: true, message: "요소 선택 모드 종료" });
    return false;
  }

  // [6] iframe 존재 여부 조회 지시
  if (request.command === "GET_FRAME_INFO") {
    sendResponse(getFrameInfo());
    return false;
  }

  // [7] iframe DOM 수집 지시
  if (request.command === "COLLECT_FRAME_DOM") {
    sendResponse(collectAndSendFrame());
    return false;
  }

  // [8] 페이지 이미지 추출 및 전송 지시 (비동기 → return true)
  if (request.command === "COLLECT_IMAGES") {
    collectAndSendImages().then((result) => {
      try {
        sendResponse(result);
      } catch {
        // 메시지 채널 파괴 방어
      }
    });
    return true;
  }

  return false;
});
