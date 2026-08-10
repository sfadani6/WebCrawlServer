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
 * best-of-red URL 인식 정규식입니다.
 * 베이스 경로(/best-of-red/<월>, 후행 슬래시 유무 무관)와 선택 페이지 인덱스(/best-of-red/<월>/N)를 캡처합니다.
 */
const XV_BEST_OF_RED_BASE_RE = /^(\/best-of-red\/[^/]+)(?:\/(\d+))?\/?$/;

/** best-of-red 페이지 썸네일 이미지 로드 대기 상한 시간 (ms) */
const XV_BEST_OF_RED_IMAGE_WAIT_MS = 4000;
/** best-of-red 로드 검증 폴링 간격 (ms) */
const XV_BEST_OF_RED_READY_POLL_MS = 200;

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
function resolveImageSource(img: HTMLImageElement): string {
  const src = img.currentSrc || img.src || "";
  if (src) return src;
  const lazyAttrs = ["data-src", "data-original", "data-lazy-src", "data-url", "data-lazy"];
  for (const attr of lazyAttrs) {
    const value = img.getAttribute(attr);
    if (value) return value;
  }
  return "";
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

    // 제목 추출 (title 속성 우선)
    const titleEl = block.querySelector<HTMLAnchorElement>(
      ".thumb-under .title a[title]"
    );
    const title =
      titleEl?.getAttribute("title") ||
      block.querySelector<HTMLElement>("a[title]")?.getAttribute("title") ||
      "";

    // 비디오 EID 파싱 (예: /video.kavfihb169e/... → kavfihb169e)
    const eidMatch = clickUrl.match(/\/video\.([a-z0-9]+)\//i);
    const eid = eidMatch ? eidMatch[1] : "";

    entries.push({
      eid,
      clickUrl,
      title,
      mainUrl,
      sfwUrl: img.getAttribute("data-sfwthumb") || "",
      previewUrl: img.getAttribute("data-pvv") || "",
    });
  }

  return entries;
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
 * best-of-red 페이지 인덱스에 대응하는 이동 URL을 생성합니다.
 * 0은 베이스 URL(예: /best-of-red/2026-06), N은 베이스/N(예: /best-of-red/2026-06/16)입니다.
 *
 * @param basePath 베이스 경로 (예: "/best-of-red/2026-06", 후행 슬래시 없음)
 * @param pageIndex 이동할 페이지 인덱스
 * @returns 이동할 페이지 URL
 */
function buildXvBestOfRedPageUrl(basePath: string, pageIndex: number): string {
  return pageIndex === 0 ? basePath : `${basePath}/${pageIndex}`;
}

/**
 * 현재 URL에서 best-of-red 베이스 경로와 페이지 인덱스를 파싱합니다.
 * best-of-red 페이지가 아니면 null을 반환합니다.
 *
 * 파싱 규칙:
 * - 베이스 경로: /best-of-red/<한 세그먼트> 형태 (후행 슬래시 유무 무관, 예: /best-of-red/2026-06)
 * - 페이지 인덱스: 베이스 경로 뒤 /N (없으면 0)
 *
 * @returns 베이스 경로·현재 페이지 인덱스 또는 null
 */
function parseXvBestOfRedUrl(): { basePath: string; currentPage: number } | null {
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
 * best-of-red 페이지 로드 완료를 검증합니다.
 * document.readyState가 complete가 될 때까지 기다린 뒤,
 * .thumb-block 썸네일 이미지들이 완전히 로드(complete)될 때까지 폴링합니다.
 * (이미지 로드는 상한 시간 XV_BEST_OF_RED_IMAGE_WAIT_MS를 넘기면 포기합니다.)
 *
 * @returns 로드 완료 여부 (이미지 로드 상한 초과 시 false)
 */
async function waitForXvBestOfRedPageReady(): Promise<boolean> {
  // readyState complete 대기 (탭 이동 직후 프레임 진입 방어)
  if (document.readyState !== "complete") {
    await new Promise<void>((resolve) => {
      window.addEventListener("load", () => resolve());
      // 예비 폴백: 3초 내 load 이벤트가 없으면 진행 (로드 이벤트 누락 방어)
      setTimeout(() => resolve(), 3000);
    });
  }

  // 썸네일 이미지 로드 검증 폴링
  const deadline = Date.now() + XV_BEST_OF_RED_IMAGE_WAIT_MS;
  while (Date.now() < deadline) {
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>(".thumb-block:not(.thumb-ad) img"),
    );
    // 이미지가 아직 DOM에 없는 경우에도 로드 대기 (동적 렌더 전)
    if (images.length === 0) {
      await sleep(XV_BEST_OF_RED_READY_POLL_MS);
      continue;
    }
    if (images.every((img) => img.complete && img.naturalWidth > 0)) {
      return true;
    }
    await sleep(XV_BEST_OF_RED_READY_POLL_MS);
  }
  return false;
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

  // [7-2] xvideos best-of-red 초기 정보 조회 지시 (액션 실행기 팝업용)
  // 페이지네이션 연속 블록에서 총 페이지 수를 감지해 베이스 경로·현재 페이지 인덱스와 함께 반환합니다.
  if (request.command === "COLLECT_BEST_OF_RED_INIT") {
    const parsed = parseXvBestOfRedUrl();
    if (!parsed) {
      sendResponse({
        success: false,
        message: "best-of-red 페이지에서만 실행할 수 있습니다.",
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
        totalPages: maxPage - parsed.currentPage + 1,
        url: window.location.href,
      },
    });
    return false;
  }

  // [7-3] xvideos best-of-red 페이지 수집 지시 (액션 실행기 팝업용)
  // 페이지 로드 완료(readyState complete + 썸네일 이미지 로드)를 검증한 뒤
  // 비디오 블록 메타를 수집해 data 하위에 중첩해 반환합니다. 서버 전송은 팝업(오프스크린 경유)이 담당합니다.
  if (request.command === "COLLECT_BEST_OF_RED_PAGE") {
    waitForXvBestOfRedPageReady().then((ready) => {
      const parsed = parseXvBestOfRedUrl();
      if (!parsed) {
        sendResponse({
          success: false,
          message: "best-of-red 페이지가 아닙니다.",
        });
        return;
      }
      const entries = ready ? collectXvideosMediaEntries() : [];
      const message = ready
        ? `페이지 로드 완료 · 비디오 블록 ${entries.length}건 수집`
        : "로드 완료 검증 시간 초과 (수집 결과 미포함)";
      sendResponse({
        success: true,
        message,
        data: {
          ready,
          page: parsed.currentPage,
          url: window.location.href,
          title: document.title,
          data: entries,
          message,
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
