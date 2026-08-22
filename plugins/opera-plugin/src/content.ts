// plugins/basic-plugin/src/content.ts

import { XvideosMediaEntry } from "./types/index.js";

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

/**
 * xvideos 페이징 URL 인식 정규식입니다.
 * 베이스 경로(/<세그먼트>/<YYYY-MM>, 후행 슬래시 유무 무관)와 선택 페이지 인덱스(/<세그먼트>/<YYYY-MM>/N)를 캡처합니다.
 * URL 기반 파싱이므로 카테고리 세그먼트가 best-of-red, best, porn 등 무엇이든 동일하게 동작합니다.
 * 예: /best/2026-03, /best-of-red/2026-06/16
 */
const XV_BEST_OF_RED_BASE_RE = /^(\/[^/]+\/\d{4}-\d{2})(?:\/(\d+))?\/?$/;

/**
 * xvideos 페이징 액션 지원 호스트 판정 함수입니다.
 * xvideos.com과 xvideos.red 및 그 서브도메인(www. 등)만 허용합니다.
 *
 * @param hostname 대상 호스트명 (예: "www.xvideos.red")
 * @returns 지원 도메인이면 true
 */
function isXvideosHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return host === "xvideos.com" || host === "xvideos.red";
}

/** xvideos 페이징 페이지 완전 로드 대기 상한 시간 (ms, 네트워크 안정 + DOM 안정) */
const XV_BEST_OF_RED_IMAGE_WAIT_MS = 20000;
/** xvideos 페이징 로드 검증 폴링 간격 (ms) */
const XV_BEST_OF_RED_READY_POLL_MS = 400;
/** xvideos 페이징 로드 안정 판정을 위한 연속 동일 관측 횟수 (폴링 간격 × 횟수 = 안정 윈도우) */
const XV_BEST_OF_RED_STABLE_POLLS = 3;
/** 기대 페이지 URL과 현재 페이지 경로가 다를 때 대기하는 최대 시간 (ms, 이전/새 페이지 구분 방어) */
const XV_BEST_OF_RED_URL_WAIT_MS = 8000;
/** 화면 밖 lazy 블록 렌더링 유도를 위한 재스크롤 간격 (ms) */
const XV_BEST_OF_RED_RESCROLL_MS = 2000;

/**
 * 페이지 AJAX/네트워크 인-플라이트 요청 카운터입니다.
 * xvideos 페이징 페이지의 비디오 블록은 lazy 로드(XHR/스크립트)로 지연 렌더링되므로,
 * 로드 완료 판정 시점에 실제로 진행 중인 요청이 남아있는지 감시하는 데 사용합니다.
 * XHR.send/fetch 시작 시점에 카운트하고, 완료(loadend) 시점에 차감합니다.
 * (open이 아니라 send 시점에 카운트해, open만 되고 전송되지 않은 재사용/폐기 XHR
 *  객체가 카운터를 누수시키는 문제를 차단합니다.)
 */
let pageInflightCount = 0;

/**
 * 페이지의 XHR/fetch 인-플라이트 요청을 감시하도록 전역 네트워크 API를 패치합니다.
 * 모듈 로드 시 1회 실행되며, 감시 자체가 페이지 로딩을 방해하지 않도록
 * 원본 구현을 호출한 뒤 카운터만 증감합니다. (예외 발생 시 원본 동작에 영향 없음)
 * 콘텐츠 스크립트가 document_start에 주입되므로 페이지 초기 XHR/fetch도 감시됩니다.
 */
function installNetworkActivityWatch(): void {
  try {
    const originalXhrSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      // 전송 시작 시점에 인-플라이트로 카운트 (open이 아닌 send 기준)
      pageInflightCount += 1;
      try {
        // loadend는 성공/실패/중단 모든 종료를 보장하는 종착 이벤트이며,
        // once 옵션으로 XHR 재사용 시 중복 차감을 방지합니다.
        this.addEventListener(
          "loadend",
          () => {
            if (pageInflightCount > 0) pageInflightCount -= 1;
          },
          { once: true },
        );
      } catch {
        // loadend 리스너 등록 실패 시 카운트는 send 시점만 유지 (큰 영향 없음)
      }
      return originalXhrSend.call(this, body);
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      pageInflightCount += 1;
      return originalFetch(input as RequestInfo, init).finally(() => {
        if (pageInflightCount > 0) pageInflightCount -= 1;
      });
    }) as typeof fetch;
  } catch {
    // 네트워크 감시 패치 실패 시 로드 검증은 리소스 타이밍 안정 판정만으로 동작합니다.
  }
}

// 콘텐츠 스크립트 주입 즉시 네트워크 감시 패치 설치
installNetworkActivityWatch();

/** 요소 선택 모드 하이라이트 색상 (파란색 테두리) */
const PICKER_HIGHLIGHT_COLOR = "#3b82f6";

/** 한 번에 수집할 최대 이미지 개수 (메시지 폭주 방지, 요청 규격에 따라 상향 조정) */
const MAX_IMAGE_COLLECT_COUNT = 500;

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
    // 액션명: DomCapture (요소 선택 DOM 캡처)
    const outerHTML = element.outerHTML;
    chrome.runtime.sendMessage({
      type: "SEND_SOCKET_PACKET",
      packet: {
        action: "DomCapture",
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
 * lazy 로드 이미지의 실제 소스 URL을 결정합니다.
 * 로드가 완료된 이미지는 currentSrc(반응형 srcset) 우선, 로드 전 lazy 이미지는
 * data-src/data-original/data-lazy-src 등 data 속성 폴백으로 최종 이미지 URL을 얻습니다.
 *
 * @param img - 대상 img 요소
 * @returns 최종 이미지 URL (없으면 빈 문자열)
 */
/**
 * 이미지 요소에서 실제 표시할 소스 URL을 해석합니다.
 * lazy 로드 이미지는 src 속성이 플레이스홀더(no-img 등)를 가리키고 실 URL을
 * data-src 계열 속성에 보관하므로, 플레이스홀더 src는 무시하고 속성을 우선합니다.
 * 이미지가 아직 로드되지 않은 상태에서도 HTML 속성만으로 실 URL을 확보할 수 있습니다.
 *
 * @param img 대상 이미지 요소
 * @returns 해석된 소스 URL (없으면 빈 문자열)
 */
function resolveImageSource(img: HTMLImageElement): string {
  // 실제 로드된 currentSrc를 최우선으로 사용합니다.
  const currentSrc = img.currentSrc || "";
  if (currentSrc && !isPlaceholderUrl(currentSrc)) return currentSrc;

  // lazy 로드 속성(실 URL)을 플레이스홀더 src보다 우선합니다.
  const lazyAttrs = [
    "data-src",
    "data-original",
    "data-lazy-src",
    "data-url",
    "data-lazy",
    "data-poster",
  ];
  for (const attr of lazyAttrs) {
    const value = img.getAttribute(attr);
    if (value && !isPlaceholderUrl(value)) return value;
  }

  // 최후 폴백: src 속성 (플레이스홀더 제외)
  const src = img.getAttribute("src") || "";
  if (src && !isPlaceholderUrl(src)) return src;
  return "";
}

/**
 * 플레이스홀더/더미 이미지 URL 여부를 판정합니다.
 * lazy 로드 대기 상태를 나타내는 no-img 계열, 1x1 투명 gif, about:blank를 걸러냅니다.
 *
 * @param url 판정 대상 URL
 * @returns 플레이스홀더 여부
 */
function isPlaceholderUrl(url: string): boolean {
  return (
    /no-img(\.|$)/.test(url) ||
    url === "about:blank" ||
    (/^data:image\/(gif|png);base64,/i.test(url) && url.length < 200)
  );
}

/**
 * 페이지 내 이미지들을 추출하여 서버로 전송합니다.
 * 같은 오리진/CORS 허용 이미지는 fetch→Base64 변환 후 CRAWL_IMAGE(binary_base64)로,
 * 인출 실패(크로스 오리진) 이미지는 src URL만 CRAWL_IMAGE(json)로 전송합니다.
 * 페이로드에 category를 실어 서버가 도메인/카테고리별 디렉토리로 분리 저장하게 합니다.
 * 중복 URL은 Set으로 제거하고, lazy 로드 이미지(data-src 등)도 포함합니다.
 *
 * @param category - 수집 카테고리 (기본 "normal", 사이트별 album/cover 등)
 * @returns 수집 결과 요약 객체
 */
async function collectAndSendImages(
  category: string = "normal"
): Promise<{
  success: boolean;
  total: number;
  collected: number;
  failed: number;
  message: string;
}> {
  // 렌더링된 DOM 내 img 요소를 전부 취합하되, 중복 URL은 제거하고 상한(500)까지만 처리
  const seenUrls = new Set<string>();
  const targets: Array<{ img: HTMLImageElement; src: string }> = [];
  const allImages = Array.from(document.querySelectorAll<HTMLImageElement>("img"));
  for (const img of allImages) {
    const src = resolveImageSource(img);
    if (!src || seenUrls.has(src)) continue;
    seenUrls.add(src);
    targets.push({ img, src });
    if (targets.length >= MAX_IMAGE_COLLECT_COUNT) break;
  }
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  let collected = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const src = target.src;
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
            category,
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
            category,
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
            category,
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
    message: `이미지 수집 완료(${category}): ${collected}개 전송, ${failed}개 URL 참조 (${pageTitle})`,
  };
}

/**
 * 현재 페이지의 사이트 정보(메타데이터)를 추출해 서버로 전송합니다.
 * 정보 수집 버튼(사이트 전용)에서 호출되며 SITE_INFO 액션으로 JSON을 전송합니다.
 *
 * @returns 수집 결과 객체
 */
function collectAndSendSiteInfo(): { success: boolean; message: string } {
  const meta = document.querySelector('meta[name="description"]');
  const keywords = document.querySelector('meta[name="keywords"]');
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogImage = document.querySelector('meta[property="og:image"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  const canonical = document.querySelector('link[rel="canonical"]');

  const info = {
    url: window.location.href,
    title: document.title,
    description: meta?.getAttribute("content") || "",
    keywords: keywords?.getAttribute("content") || "",
    ogTitle: ogTitle?.getAttribute("content") || "",
    ogImage: ogImage?.getAttribute("content") || "",
    ogDescription: ogDescription?.getAttribute("content") || "",
    canonical: canonical?.getAttribute("href") || "",
    timestamp: Date.now(),
  };

  chrome.runtime.sendMessage({
    type: "SEND_SOCKET_PACKET",
    packet: {
      action: "SITE_INFO",
      payloadType: "json",
      payload: info,
      meta: { timestamp: Date.now() },
    },
  });

  return { success: true, message: `사이트 정보 전송 완료: ${document.title}` };
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
 * 같은 오리진 프레임은 outerHTML을 fullPage(전체 문서)로 전송하고,
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
        action: "fullPage",
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
 * xvideos.com 페이지의 비디오 블록(.thumb-block)에서 미디어 다운로드 매니저용
 * 메타 정보(클릭 URL/제목/썸네일 2종/프리뷰 mp4)를 추출합니다.
 *
 * 파싱 규칙:
 * - 클릭 URL: .videopv a[href] 우선, 없으면 썸네일 앵커(closest a[href]) 사용, 절대 경로로 변환
 * - 제목: .thumb-under .title a[title] 우선, 없으면 블록 내 a[title] 사용
 * - 메인 썸네일: img의 currentSrc/src(또는 data-src 폴백), no-img.png 플레이스홀더 제외
 * - 보조 썸네일/프리뷰: data-sfwthumb / data-pvv 속성
 * - 중복 제거: clickUrl 기준 Set 관리
 * - 상한 없음: 페이지에 존재하는 비디오 블록 전부를 대상으로 합니다.
 *
 * @returns 추출된 비디오 블록 항목 목록
 */
function collectXvideosMediaEntries(): XvideosMediaEntry[] {
  const pageUrl = window.location.href;
  const entries: XvideosMediaEntry[] = [];
  const seenClickUrls = new Set<string>();

  // 광고 블록(thumb-ad)은 img 없이 CSS 배경/영상 요소로 구성되어 있어 제외 대상이며,
  // 명시적으로 제외해 수집 품질을 보장합니다.
  const blocks = document.querySelectorAll<HTMLElement>(
    ".thumb-block:not(.thumb-ad)",
  );
  for (const block of blocks) {
    const img = block.querySelector<HTMLImageElement>("img");
    if (!img) continue;

    const mainUrl = resolveImageSource(img);
    // 섬네일 없음 플레이스홀더(no-img.png) 및 정적 자산 호스트는 추출 제외
    if (!mainUrl) continue;
    if (/no-img(\.|$)/.test(mainUrl) || mainUrl.includes("assets-cdn77")) continue;

    // 클릭 URL 추출 (절대 경로로 정규화)
    const clickAnchor =
      block.querySelector<HTMLAnchorElement>(".videopv a[href]") ||
      img.closest<HTMLAnchorElement>("a[href]") ||
      block.querySelector<HTMLAnchorElement>('a[href][class*="thumb"]');
    if (!clickAnchor) continue;
    const clickUrl = new URL(
      clickAnchor.getAttribute("href") || "",
      pageUrl
    ).href;
    if (!clickUrl || seenClickUrls.has(clickUrl)) continue;
    seenClickUrls.add(clickUrl);

    // 제목 추출: title 속성 우선, 없으면 .thumb-under .title 링크 텍스트 폴백
    const titleAnchor = block.querySelector<HTMLAnchorElement>(
      ".thumb-under .title a"
    );
    const title =
      titleAnchor?.getAttribute("title") ||
      block.querySelector<HTMLElement>("a[title]")?.getAttribute("title") ||
      (titleAnchor?.textContent || "").trim() ||
      "";

    // data-video JSON 속성 파싱 (sfwThumbUrl/previewVideo 등 정확한 자산 URL 포함)
    const dataVideo = parseXvThumbBlockDataVideo(block);

    // 보조(무해) 썸네일: img data-sfwthumb 우선, data-video.sfwThumbUrl 폴백
    const sfwUrl =
      img.getAttribute("data-sfwthumb") ||
      dataVideo.sfwThumbUrl ||
      "";

    // 프리뷰 mp4: .videopv video[src] 우선, data-video.previewVideo 폴백, data-pvv 마지막 폴백
    const previewVideoEl = block.querySelector<HTMLVideoElement>(
      ".videopv video"
    );
    const previewUrl =
      (previewVideoEl?.currentSrc || previewVideoEl?.getAttribute("src") || "") ||
      dataVideo.previewVideo ||
      img.getAttribute("data-pvv") ||
      "";

    // 비디오 EID 파싱 (예: /video.kavfihb169e/... → kavfihb169e)
    const eidMatch = clickUrl.match(/\/video\.([a-z0-9]+)\//i);
    const eid = eidMatch ? eidMatch[1] : "";

    entries.push({
      eid,
      clickUrl,
      title,
      mainUrl,
      sfwUrl,
      previewUrl,
    });
  }

  return entries;
}

/**
 * xvideos 페이징 비디오 블록(.thumb-block[data-video])의 data-video JSON 속성을 파싱합니다.
 * xvideos는 썸네일/보조썸네일/프리뷰 mp4 등의 정확한 자산 URL을 JSON으로 내장합니다.
 *
 * @param block - 비디오 블록 DOM 요소
 * @returns 파싱된 자산 URL 필드 (파싱 실패 시 전부 빈 문자열)
 */
function parseXvThumbBlockDataVideo(block: HTMLElement): {
  sfwThumbUrl: string;
  previewVideo: string;
} {
  try {
    const raw = block.getAttribute("data-video");
    if (!raw) return { sfwThumbUrl: "", previewVideo: "" };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      sfwThumbUrl:
        typeof parsed.sfwThumbUrl === "string" ? parsed.sfwThumbUrl : "",
      previewVideo:
        typeof parsed.previewVideo === "string" ? parsed.previewVideo : "",
    };
  } catch {
    // JSON 파싱 실패(HTML 엔티티 등)는 무시하고 빈 값 반환
    return { sfwThumbUrl: "", previewVideo: "" };
  }
}

/**
 * xvideos.com 단일 영상 페이지(플레이어) 여부를 판별합니다.
 * URL 경로(/video 접두사) 또는 플레이어 DOM(#html5video/.video-bg-pic 등) 존재로 판단하며,
 * 비디오 블록 목록(.thumb-block)이 없는 영상 재생 페이지를 목록 페이지와 구분합니다.
 *
 * @returns 단일 영상 페이지 여부
 */
function isXvideosVideoPage(): boolean {
  return (
    /^\/video(\d+|\.)/i.test(window.location.pathname) ||
    Boolean(
      document.querySelector(
        "#html5video, #hlsplayer, .video-bg-pic, .video-pic",
      ),
    )
  );
}

/**
 * xvideos.com 단일 영상 페이지(플레이어)에서 포스터 이미지와 타이틀을 추출합니다.
 * 영상 자체(blob 스트리밍)는 다운로드하지 않고, 재생 영역의 미리보기 포스터 이미지 1종만 항목으로 구성합니다.
 *
 * 파싱 규칙:
 * - 포스터 이미지: .video-bg-pic .video-pic img (resolveImageSource, no-img 플레이스홀더 제외)
 * - 타이틀: 플레이어 영역(#html5video/#hlsplayer)의 .video-title 텍스트
 * - 클릭 URL: 현재 영상 페이지 URL / EID: URL에서 파싱
 * - 보조/프리뷰 URL은 빈 문자열 (이미지 1종만 다운로드, 여긴 이미지 하나면 충분)
 *
 * @returns 추출된 단일 영상 항목 (추출 실패 시 null)
 */
function collectXvideosVideoPageEntry(): XvideosMediaEntry | null {
  const pageUrl = window.location.href;

  const posterImg = document.querySelector<HTMLImageElement>(
    ".video-bg-pic .video-pic img, .video-bg-pic img",
  );
  if (!posterImg) return null;
  const mainUrl = resolveImageSource(posterImg);
  // 섬네일 없음 플레이스홀더(no-img.png)는 추출 제외
  if (!mainUrl || /no-img(\.|$)/.test(mainUrl)) return null;

  const titleEl = document.querySelector<HTMLElement>(
    "#html5video .video-title, #hlsplayer .video-title, .video-bg-pic .video-title, .video-title",
  );
  const title = (titleEl?.textContent || "").trim();

  const eidMatch =
    pageUrl.match(/\/video\.([a-z0-9]+)\//i) || pageUrl.match(/\/video(\d+)/i);
  const eid = eidMatch ? eidMatch[1] : "";

  return {
    eid,
    clickUrl: pageUrl,
    title,
    mainUrl,
    sfwUrl: "",
    previewUrl: "",
  };
}

/**
 * 지정한 시간(ms) 동안 비동기 대기합니다. 로드 검증 폴링과 페이지 이동 간 대기에 사용됩니다.
 *
 * @param ms 대기 시간 (ms)
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * xvideos 페이징 페이지 인덱스에 대응하는 이동 URL을 생성합니다.
 * 0은 베이스 URL(예: /best/2026-03), N은 베이스/N(예: /best/2026-03/16)입니다.
 *
 * @param basePath 베이스 경로 (예: "/best/2026-03", 후행 슬래시 없음)
 * @param pageIndex 이동할 페이지 인덱스
 * @returns 이동할 페이지 URL
 */
function buildXvBestOfRedPageUrl(basePath: string, pageIndex: number): string {
  return pageIndex === 0 ? basePath : `${basePath}/${pageIndex}`;
}

/**
 * 현재 URL에서 xvideos 페이징 베이스 경로와 페이지 인덱스를 파싱합니다.
 * xvideos.com/xvideos.red 페이징 페이지가 아니면 null을 반환합니다.
 *
 * 파싱 규칙:
 * - 도메인 가드: 호스트가 xvideos.com 또는 xvideos.red여야 합니다.
 * - 베이스 경로: /<세그먼트>/<YYYY-MM> 형태 (후행 슬래시 유무 무관, 예: /best/2026-03)
 * - 페이지 인덱스: 베이스 경로 뒤 /N (없으면 0)
 *
 * @returns 베이스 경로·현재 페이지 인덱스 또는 null
 */
function parseXvBestOfRedUrl(): { basePath: string; currentPage: number } | null {
  // xvideos.com/xvideos.red 외 호스트는 페이징 액션 대상이 아닙니다.
  if (!isXvideosHost(window.location.hostname)) return null;
  const match = window.location.pathname.match(XV_BEST_OF_RED_BASE_RE);
  if (!match) return null;
  return {
    basePath: match[1],
    currentPage: match[2] ? parseInt(match[2], 10) : 0,
  };
}

/**
 * 페이지네이션(.pagination a[data-page])에서 마지막 페이지 인덱스를 감지합니다.
 *
 * 감지 규칙:
 * - data-page 값 중 **최댓값**을 마지막 페이지로 신뢰합니다. xvideos 페이지네이션은
 *   항상 마지막 페이지 링크(예: data-page="111", 라벨 "112")를 함께 렌더링하므로
 *   윈도우(일부 페이지만 노출) 방식이라도 그 값이 실제 끝 페이지입니다.
 *   (이전의 "차이 20 이상 → 아웃라이어" 가드는 진짜 마지막 링크를 버려서
 *   총 페이지 수를 과소 감지했으므로 제거합니다. 예: 0~16 + 111 → 111)
 * - 페이지네이션이 없으면 현재 페이지를 반환해 현재 페이지만 처리합니다.
 *
 * @param currentPage 현재 페이지 인덱스
 * @returns 마지막 페이지 인덱스
 */
function detectXvBestOfRedMaxPage(currentPage: number): number {
  const anchors = document.querySelectorAll<HTMLAnchorElement>(
    ".pagination a[data-page]",
  );
  const pages = new Set<number>();
  for (const anchor of anchors) {
    const value = parseInt(anchor.getAttribute("data-page") || "", 10);
    if (Number.isInteger(value) && value >= 0) pages.add(value);
  }
  if (pages.size === 0) return currentPage;

  // 최대 data-page 값 = 실제 마지막 페이지 (마지막 페이지 링크 신뢰)
  return Math.max(...pages);
}

/**
 * xvideos 페이징 페이지 로드 검증 결과 보고 구조체입니다.
 * 검증 상세(네트워크 인-플라이트/리소스 수/안정 여부/대기 시간)를
 * 수집 응답과 함께 반환해 팝업 실행기 로그에 노출합니다.
 */
export interface XvBestOfRedReadyReport {
  /** 최종 완전 로드 여부 */
  ready: boolean;
  /** 최종 DOM 비디오 블록(.thumb-block:not(.thumb-ad)) 개수 */
  blockCount: number;
  /** 검증 시점 페이지 내 인-플라이트 네트워크 요청 수 */
  inflight: number;
  /** 검증 시점 성능 리소스 엔트리 수 */
  resources: number;
  /** 네트워크 안정 판정 여부 (인-플라이트 0 + 리소스 수 연속 동일) */
  networkStable: boolean;
  /** 로드 검증에 소요된 대기 시간 (ms) */
  waitedMs: number;
  /** 실패 사유 (ready=false 시 원인 메시지) */
  reason: string;
}

/**
 * xvideos 페이징 페이지 완전 로드 여부를 검증합니다.
 * "브라우저가 실제 모든 요소를 로드한 상태"를 보장하기 위해 아래 조건을 충족할 때
 * 로드 완료로 판정하며, 데드라인(XV_BEST_OF_RED_IMAGE_WAIT_MS) 내에 끝나지 않으면
 * 실패 사유가 담긴 보고 객체를 반환합니다. (백그라운드 탭은 폴링 간격·데드라인 확장)
 *
 * 검증 조건:
 * 1. 기대 URL 검증: 현재 pathname이 기대 경로(예: /best/2026-03/1)와 일치해야 합니다.
 *    탭 이동 직후 이전 페이지 DOM이 남아 응답하는 혼동을 차단하기 위한 첫 관문입니다.
 * 2. document.readyState === "complete" (load 이벤트 대기, 누락 시 3초 폴백)
 * 3. 강제 렌더링: 화면 밖 lazy 블록/이미지가 렌더링되도록 반복 스크롤과
 *    lazy→eager 전환을 수행합니다. (백그라운드 탭에서도 전체 블록 DOM 확보)
 * 4. DOM 안정: .thumb-block(광고 제외) 개수가 재스크롤 후 연속 XV_BEST_OF_RED_STABLE_POLLS회
 *    동일 (지연 렌더 완료 신호)
 * 5. 네트워크 안정: XHR/fetch 인-플라이트가 0이고, performance 리소스 엔트리 수가
 *    연속 XV_BEST_OF_RED_STABLE_POLLS회 증가하지 않음 (lazy 로드 종료 신호)
 *
 * 이미지 자체의 로드(complete/naturalWidth)는 완료 판정에 요구하지 않습니다.
 * 수집은 HTML 속성(src/data-src/data-video JSON)에서 URL을 추출하고, 실제 미디어
 * 다운로드는 오프스크린 fetch로 수행되므로 페이지의 이미지 네트워크 로드를 기다릴
 * 필요가 없습니다. (백그라운드 탭 이미지 지연과 무관하게 전체 항목 수집 가능)
 *
 * @param expectedPath 기대 페이지 경로 (예: "/best/2026-03/1")
 * @returns 로드 검증 결과 보고 객체
 */
async function waitForXvBestOfRedPageReady(
  expectedPath: string,
): Promise<XvBestOfRedReadyReport> {
  const startedAt = Date.now();
  // 백그라운드 탭은 타이머가 ~1초로 스로틀링되어 폴링 간격·데드라인을 확장합니다.
  const hidden = document.visibilityState === "hidden";
  const pollMs = hidden ? 800 : XV_BEST_OF_RED_READY_POLL_MS;
  const deadlineMs = hidden ? 35000 : XV_BEST_OF_RED_IMAGE_WAIT_MS;
  const expected = normalizePathname(expectedPath);

  // 1) 기대 URL 검증 (이전/새 페이지 구분 — 불일치 시 최대 대기 후 즉시 실패)
  const urlDeadline = Date.now() + XV_BEST_OF_RED_URL_WAIT_MS;
  while (normalizePathname(window.location.pathname) !== expected) {
    if (Date.now() > urlDeadline) {
      return {
        ready: false,
        blockCount: 0,
        inflight: pageInflightCount,
        resources: performance.getEntriesByType("resource").length,
        networkStable: false,
        waitedMs: Date.now() - startedAt,
        reason: `기대 페이지(${expectedPath})와 현재 페이지(${window.location.pathname})가 다릅니다.`,
      };
    }
    await sleep(300);
  }

  // 2) readyState complete 대기 (탭 이동 직후 프레임 진입 방어)
  if (document.readyState !== "complete") {
    await new Promise<void>((resolve) => {
      window.addEventListener("load", () => resolve(), { once: true });
      // 예비 폴백: 3초 내 load 이벤트가 없으면 진행 (로드 이벤트 누락 방어)
      setTimeout(() => resolve(), 3000);
    });
  }

  // 3) 최초 강제 렌더링 (lazy 블록·이미지 eager 전환 + 스크롤)
  forceRenderBestOfRedContent();
  forceScrollThroughPage();

  // 4) 네트워크·DOM 안정 통합 폴링
  const deadline = Date.now() + deadlineMs;
  let prevBlockCount = -1;
  let stableBlockCount = 0;
  let lastScrollAt = 0;

  while (Date.now() < deadline) {
    const blocks = queryXvBestOfRedBlocks();

    // 화면 밖 lazy 렌더링 유도 (재스크롤 + eager 전환 반복)
    if (Date.now() - lastScrollAt > XV_BEST_OF_RED_RESCROLL_MS) {
      forceScrollThroughPage();
      forceRenderBestOfRedContent();
      lastScrollAt = Date.now();
    }

    // 4-1) 네트워크 안정 판정 (인-플라이트 0 + 리소스 타이밍 증가 없음)
    const inflight = pageInflightCount;
    const resources = performance.getEntriesByType("resource").length;
    const netIdle = inflight === 0 && networkResourcesStable(resources);

    // 4-2) DOM 안정 판정 (블록 개수 연속 동일)
    if (blocks.length === prevBlockCount) {
      stableBlockCount += 1;
    } else {
      prevBlockCount = blocks.length;
      stableBlockCount = 0;
    }
    const domStable = stableBlockCount >= XV_BEST_OF_RED_STABLE_POLLS;

    // 아직 블록이 전혀 렌더되지 않았으면 계속 대기 (동적 렌더 전 단계)
    if (blocks.length === 0) {
      await sleep(pollMs);
      continue;
    }

    // 모든 조건 충족 시 완전 로드 판정
    if (netIdle && domStable) {
      return {
        ready: true,
        blockCount: blocks.length,
        inflight,
        resources,
        networkStable: true,
        waitedMs: Date.now() - startedAt,
        reason: "",
      };
    }
    await sleep(pollMs);
  }

  // 데드라인 초과 — 마지막 관측 값을 담아 실패 보고
  return {
    ready: false,
    blockCount: prevBlockCount < 0 ? 0 : prevBlockCount,
    inflight: pageInflightCount,
    resources: performance.getEntriesByType("resource").length,
    networkStable: pageInflightCount === 0,
    waitedMs: Date.now() - startedAt,
    reason: "로드 검증 데드라인 초과 (DOM/네트워크 안정 미달)",
  };
}

/**
 * xvideos 페이징 비디오 블록 목록(.thumb-block)을 광고(thumb-ad)를 제외해 반환합니다.
 *
 * @returns 비디오 블록 DOM 요소 배열
 */
function queryXvBestOfRedBlocks(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".thumb-block:not(.thumb-ad)"),
  );
}

/**
 * xvideos 페이징 lazy 렌더링을 강제로 진행하도록 이미지를 eager로 전환합니다.
 * 화면 밖 블록이 지연 렌더되는 구조에서 백그라운드 탭이어도 전체 블록이
 * DOM에 들어오도록 lazy 속성의 실 URL을 src로 복사하고 loading을 eager로 바꿉니다.
 */
function forceRenderBestOfRedContent(): void {
  try {
    document
      .querySelectorAll<HTMLImageElement>(
        ".thumb-block:not(.thumb-ad) img[loading='lazy'], .thumb-block:not(.thumb-ad) img[data-src]",
      )
      .forEach((img) => {
        const lazy =
          img.getAttribute("data-src") ||
          img.getAttribute("data-original") ||
          "";
        if (lazy && !isPlaceholderUrl(lazy)) {
          img.setAttribute("src", lazy);
        }
        img.setAttribute("loading", "eager");
      });
  } catch {
    // 강제 렌더링 실패 시 자연 렌더링에 의존합니다.
  }
}

/**
 * 페이지 전체를 강제 스크롤해 화면 밖 lazy 블록 렌더링을 유도합니다.
 * 백그라운드 탭에서도 scrollTo는 동작하므로 IntersectionObserver 기반 지연
 * 렌더가 전체 콘텐츠를 DOM에 배치하게 합니다. 끝까지 내려간 뒤 다시 맨 위로
 * 올려 재렌더링을 유도합니다.
 */
function forceScrollThroughPage(): void {
  try {
    const maxScroll = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0,
    );
    const y = window.scrollY || document.documentElement?.scrollTop || 0;
    if (y < maxScroll - window.innerHeight) {
      // 아래로 일정 폭 이동 (한 화면 분량)
      window.scrollTo(0, y + Math.max(300, Math.floor(window.innerHeight * 0.8)));
    } else {
      // 끝 도달 시 맨 위로 복귀 (렌더 트리거 재연)
      window.scrollTo(0, 0);
    }
  } catch {
    // 스크롤 실패는 무시 (렌더에 영향 없음)
  }
}

/**
 * 경로 문자열의 후행 슬래시를 제거해 비교용으로 정규화합니다.
 * xvideos 페이징 베이스 경로는 후행 슬래시 유무가 무관하므로 동일하게 취급합니다.
 *
 * @param path 대상 경로 문자열
 * @returns 정규화된 경로
 */
function normalizePathname(path: string): string {
  return path.replace(/\/$/, "");
}

/**
 * 페이지의 리소스 타이밍 엔트리가 최근 안정적으로 증가하지 않는지 판정합니다.
 * lazy 로드가 모두 끝나면 새 리소스가 발생하지 않으므로 엔트리 수가 멈춥니다.
 *
 * @param resourceCount 현재 성능 리소스 엔트리 수
 * @returns 리소스 수 안정 여부 (연속 XV_BEST_OF_RED_STABLE_POLLS회 동일 시 true)
 */
let lastResourceStableCount = 0;
let lastResourceCountValue = -1;
function networkResourcesStable(resourceCount: number): boolean {
  if (resourceCount === lastResourceCountValue) {
    lastResourceStableCount += 1;
  } else {
    lastResourceCountValue = resourceCount;
    lastResourceStableCount = 0;
  }
  return lastResourceStableCount >= XV_BEST_OF_RED_STABLE_POLLS;
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

  // [3] 전체 DOM HTML 수집 지시 (물리 파일 저장소 연동용 → fullPage 액션)
  // 버튼을 누르는 시점에 현재 렌더링된 DOM(document.documentElement.outerHTML)을
  // 재캡처하므로 AJAX 등으로 동적 로드된 부분까지 포함됩니다.
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
        action: "fullPage",
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

  // [7-1] xvideos 비디오 블록/단일 영상 페이지 메타 파싱 지시 (미디어 다운로드 매니저 목록 생성용)
  // 파싱만 수행하며 실제 다운로드는 사이드바→오프스크린→서버 저장 흐름으로 진행됩니다.
  // 비디오 블록(.thumb-block)이 없으면 단일 영상 페이지(플레이어)로 폴백해 포스터 이미지 1종을 파싱합니다.
  if (request.command === "COLLECT_XVIDEOS_MEDIA") {
    // 1) 목록/검색 페이지의 비디오 블록 파싱
    let entries = collectXvideosMediaEntries();
    let sourceLabel = "비디오 블록";
    // 2) 블록이 없으면 단일 영상 페이지(플레이어) 파싱 폴백 — 포스터 이미지 1종 + 타이틀
    if (entries.length === 0 && isXvideosVideoPage()) {
      const single = collectXvideosVideoPageEntry();
      if (single) {
        entries = [single];
        sourceLabel = "현재 영상 페이지";
      }
    }
    const message = `xvideos ${sourceLabel}에서 미디어 ${entries.length}건 파싱 완료`;
    sendResponse({
      success: true,
      data: {
        entries,
        pageUrl: window.location.href,
        message,
      },
      message,
    });
    return false;
  }

  // [7-2] xvideos 페이징 초기 정보 조회 지시 (액션 실행기 팝업용)
  // 페이지네이션 연속 블록에서 총 페이지 수를 감지해 베이스 경로·현재 페이지 인덱스와 함께 반환합니다.
  if (request.command === "COLLECT_BEST_OF_RED_INIT") {
    const parsed = parseXvBestOfRedUrl();
    if (!parsed) {
      sendResponse({
        success: false,
        message: "xvideos 페이징 페이지에서만 실행할 수 있습니다.",
      });
      return false;
    }
    const maxPage = detectXvBestOfRedMaxPage(parsed.currentPage);
    sendResponse({
      success: true,
      data: {
        basePath: parsed.basePath,
        currentPage: parsed.currentPage,
        maxPage,
        // 처리 대상은 항상 0(베이스 URL)부터 maxPage까지 전체 순회합니다.
        totalPages: maxPage + 1,
        url: window.location.href,
      },
    });
    return false;
  }

  // [7-3] xvideos 페이징 페이지 수집 지시 (액션 실행기 팝업용)
  // 실행기가 전달한 기대 경로(expectedPath)로 이전/새 페이지를 구분한 뒤,
  // 브라우저 상태 검증(네트워크 안정 + DOM 안정 + 강제 렌더링)을 거쳐
  // 비디오 블록 메타를 수집해 data 하위에 중첩해 반환합니다.
  // 검증 상세(네트워크 인-플라이트/리소스 수/대기 시간)도 함께 반환해 로그에 노출합니다.
  // 서버 전송은 팝업(오프스크린 경유)이 담당합니다.
  if (request.command === "COLLECT_BEST_OF_RED_PAGE") {
    const payload = request.payload as
      | { expectedPath?: string }
      | undefined;
    const expectedPath =
      payload && typeof payload.expectedPath === "string"
        ? payload.expectedPath
        : "";
    waitForXvBestOfRedPageReady(expectedPath).then((report) => {
      const parsed = parseXvBestOfRedUrl();
      if (!parsed) {
        sendResponse({
          success: false,
          message: "xvideos 페이징 페이지가 아닙니다.",
        });
        return;
      }
      const entries = report.ready ? collectXvideosMediaEntries() : [];
      const message = report.ready
        ? `페이지 로드 완료 · 비디오 블록 ${entries.length}건 수집`
        : `로드 완료 검증 실패: ${report.reason} (수집 결과 미포함)`;
      sendResponse({
        success: true,
        message,
        data: {
          ready: report.ready,
          page: parsed.currentPage,
          url: window.location.href,
          title: document.title,
          data: entries,
          message,
          // 브라우저 네트워크 상태 모니터링 결과 (팝업 로그 가시화용)
          network: {
            inflight: report.inflight,
            resources: report.resources,
            stable: report.networkStable,
          },
          waitedMs: report.waitedMs,
          visibilityState: document.visibilityState,
        },
      });
    });
    return true;
  }

  // [8] 페이지 이미지 추출 및 전송 지시 (비동기 → return true)
  // payload.category로 카테고리(일반/앨범/표지 등)를 전달받아 저장소 분리를 지원합니다.
  if (request.command === "COLLECT_IMAGES") {
    const category =
      request.payload &&
      typeof request.payload === "object" &&
      typeof (request.payload as { category?: string }).category === "string"
        ? (request.payload as { category: string }).category
        : "normal";
    collectAndSendImages(category).then((result) => {
      try {
        sendResponse(result);
      } catch {
        // 메시지 채널 파괴 방어
      }
    });
    return true;
  }

  // [9] 사이트 정보(메타데이터) 수집 및 전송 지시 (정보 수집 버튼)
  if (request.command === "COLLECT_SITE_INFO") {
    sendResponse(collectAndSendSiteInfo());
    return false;
  }

  return false;
});
