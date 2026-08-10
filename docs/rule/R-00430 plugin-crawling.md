본 문서는 `WebCrawlServer` 브라우저 확장 플러그인의 DOM 크롤링 및 수집 개정 지침입니다. 기존 콘텐츠 스크립트 기반 수집 방식에 더해 **백그라운드 초고속 `fetch()` + `DOMParser` 인출 기술**과 **선언형 자동 페이징 루프 엔진**에 대한 규정을 정의합니다.

---

## 1. 수집 모드 개요 및 범위

플러그인은 수집 타깃 사이트의 특성 및 과부하 방지 목적에 맞춰 3가지 수집 모드를 지원해야 합니다.

1. **백그라운드 `fetch()` 인출 모드 (가장 추천)**: 유저 탭 이동 없이 `fetch()`와 `DOMParser`로 순수 HTML만 백그라운드에서 0.1초 만에 인출하여 수집 (CPU/RAM 사용량 0% 급).
2. **콘텐츠 스크립트 메타/전체 DOM 수집 모드**: 현재 탭의 `content.ts`가 DOM 전체(`outerHTML`) 또는 주요 이미지/하이퍼링크 메타 추출.
3. **선언형 페이징 수집 모드**: 서버가 보낸 JSON 행동 양식에 맞춰 `content.ts`가 다음 페이지 버튼을 자동 순차 클릭하며 연속 수집.

---

## 2. 백그라운드 `fetch()` + `DOMParser` 수집 규정

유저가 웹서핑하는 화면과 탭을 전혀 방해하지 않고, 오프스크린/사이드바 백그라운드에서 고속으로 데이터를 인출하는 표준 지침입니다.

```typescript
// plugins/basic-plugin/src/services/backgroundScraper.ts

export async function fetchAndParseInBackground(
  targetUrl: string,
  selector: string
): Promise<{ title: string; items: string[]; timestamp: number }> {
  // 1. 유저의 로그인 쿠키가 자동 포함되는 백그라운드 fetch
  const response = await fetch(targetUrl, {
    method: "GET",
    credentials: "include", // 저장된 세션 쿠키 자동 인출 동봉
  });

  if (!response.ok) {
    throw new Error(`HTTP 요청 에러: ${response.status}`);
  }

  const htmlText = await response.text();

  // 2. 가상 DOMParser 생성 (화면 렌더링 무발생)
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  // 3. CSS 셀렉터 기반 데이터 정제
  const items = Array.from(doc.querySelectorAll(selector))
    .map((el) => el.textContent?.trim() || "")
    .filter((text) => text.length > 0);

  return {
    title: doc.title || "제목 없음",
    items,
    timestamp: Date.now(),
  };
}
```

---

## 3. 선언형 페이징 순차 수집 엔진 규정 (`content.ts`)

서버에서 원격 수신한 행동 양식 패킷(`START_PAGINATION_CRAWL`)에 맞춰 1페이지부터 N페이지까지 자동 순차 클릭 및 수집을 단행합니다.

```typescript
// plugins/basic-plugin/src/content.ts

export interface PaginationCrawlPayload {
  nextPageSelector: string; // 다음 페이지 버튼 셀렉터
  contentSelector: string;  // 수집할 데이터 영역 셀렉터
  maxPages: number;         // 수집할 총 페이지 수
  delayMs: number;          // 페이지 이동 간 지연 시간
}

async function runPaginationCrawlEngine(payload: PaginationCrawlPayload): Promise<void> {
  let currentPage = 1;

  while (currentPage <= payload.maxPages) {
    // 1. 현재 페이지 수집
    const items = Array.from(document.querySelectorAll(payload.contentSelector))
      .map((el) => el.textContent?.trim() || "")
      .filter((text) => text.length > 0);

    // 2. 오프스크린 소켓으로 데이터 포워딩
    chrome.runtime.sendMessage({
      type: "RAW_DOM_DATA",
      data: {
        page: currentPage,
        url: window.location.href,
        title: document.title,
        items,
        timestamp: Date.now(),
      },
    });

    if (currentPage >= payload.maxPages) break;

    // 3. 다음 페이지 클릭
    const nextBtn = document.querySelector(payload.nextPageSelector) as HTMLElement | null;
    if (!nextBtn) break;

    nextBtn.click();
    currentPage++;

    // 4. 차단 방지를 위한 인간 모사 지연 시간 (Human-like Delay + Random Jitter)
    const jitter = Math.floor(Math.random() * 1000);
    await new Promise((resolve) => setTimeout(resolve, payload.delayMs + jitter));
  }
}
```

---

## 4. 안전성 및 차단 방지 가드

4.1 **특수 URL 침투 차단**: `chrome://`, `chrome-extension://`, `about:blank` 등 브라우저 내부 페이지에서는 스크립트 실행을 거부해야 합니다.  
4.2 **봇 차단 우회 및 랜덤 딜레이**: 페이징 수집 시 일정한 시간 간격이 아닌 무작위 지연 시간(Jitter Delay)을 추가하여 Cloudflare 등의 스팸 봇 감지를 무력화합니다.  
4.3 **동기식 응답 가드**: `content.ts` 내 `chrome.runtime.onMessage` 처리 후 동기 응답 완료 시 `return false;`를 반환하여 메시지 채널 오류를 차단합니다.  

---

## 5. 기본 탭 수집 기능 규정 (DOM 전송 모드)

기본 탭(`BasicTab.tsx`)은 DOM 전송(전체/요소선택/프레임), 이미지 수집, 액션 실행(미개발) 섹션을 아코디언+카드 형태로 제공합니다. 전송 대상 라디오 선택에 따라 콘텐츠 스크립트 명령이 활성 탭으로 송출됩니다.

### 5.1 요소 선택 모드 (`START_ELEMENT_PICKER` / `STOP_ELEMENT_PICKER`)

페이지의 DOM 요소를 마우스로 선택하여 해당 요소의 데이터만 전송하는 모드입니다.

- **파란색 테두리 강조**: 요소에 마우스를 오버하면 `outline: 3px solid #3b82f6` (파란색) 테두리와 `outline-offset: 2px`가 적용됩니다. 이전 요소는 자동 해제됩니다.
- **요소 클릭 시 "전송" 버튼**: 클릭한 요소 위치(하단 우측)에 고정 플로팅 "전송" 버튼이 표시됩니다.
- **전송 데이터**: 버튼 클릭 시 해당 요소의 **outerHTML 전체**를 `DomCapture` 페이로드(`data.tag`/`data.id`/`data.className`/`data.outerHTML`)로 서버에 전송합니다. (구형 `CRAWL_PARTIAL` 수신도 서버가 계속 수용)
- **모드 종료**: 전송 완료 또는 `ESC` 키 입력 시 모드가 종료되며, `ELEMENT_PICKER_ENDED` 메시지로 사이드바에 완료/취소를 통지합니다.
- **기본 동작 차단**: 클릭 핸들러는 `preventDefault()`/`stopPropagation()`으로 페이지 원래 동작을 차단해 선택 모드와 페이지 네비게이션 충돌을 방지합니다.

### 5.2 프레임 수집 (`GET_FRAME_INFO` / `COLLECT_FRAME_DOM`)

iframe이 존재하는 페이지의 프레임 DOM을 선택 전송하는 기능입니다.

- **iframe 존재 조회**: 사이드바가 활성 탭을 감시할 때마다 `GET_FRAME_INFO`로 iframe 개수를 조회합니다. **iframe이 0개이면 프레임 라디오와 전송 버튼이 비활성화**됩니다.
- **같은 오리진 프레임**: `frame.contentDocument.documentElement.outerHTML`을 `fullPage`(fullDom)로 전송합니다. (구형 `CRAWL_DOCUMENT` 수신도 서버가 계속 수용)
- **크로스 오리진 프레임**: `contentDocument` 접근이 `SecurityError`로 차단되면 src URL 참조만 `CRAWL_PARTIAL`로 전송합니다. (서버는 참조 보관 처리)
- **전체 페이지 전송(`fullPage`)**: 버튼을 누르는 **시점의 현재 렌더링 DOM**을 `document.documentElement.outerHTML`로 다시 캡처하여 전송합니다(페이지 이전 소스 아님). 새로 로드된 동적 콘텐츠가 포함되며, 서버는 `CRAWL_DOCUMENT || fullPage`일 때만 워커 파이프라인을 수행합니다.

### 5.3 이미지 수집 (`COLLECT_IMAGES` / `SITE_INFO`)

현재 페이지의 이미지를 추출해 서버의 전용 폴더에 저장하는 기능입니다. 기본 탭의 이미지 수집 섹션은 **항상 3그룹**(일반 이미지 수집 / xchina.co 전용 / xvideos.com 전용)을 표시하며, 비매칭 사이트 그룹은 `disabled` + "다른 도메인" 배지로 안내합니다.

- **추출 범위**: 렌더링된 DOM 내 `img` 요소를 전부 취합하되 **중복 URL을 Set으로 제거**하고 최대 500개(`MAX_IMAGE_COLLECT_COUNT`)까지 처리합니다.
- **lazy 로드 대응**: `resolveImageSource()`가 `currentSrc → src → data-src/data-original/data-lazy-src/data-url/data-lazy` 순으로 최종 이미지 URL을 결정하므로, 아직 로드되지 않은 lazy 이미지도 포함합니다.
- **같은 오리진/CORS 허용 이미지**: `fetch(src, { credentials: "include" })`로 인출 후 `ArrayBuffer → Base64` 변환하여 `CRAWL_IMAGE`(payloadType: `binary_base64`)로 전송합니다.
- **크로스 오리진 인출 실패**: `fetch` 실패 시 스킵하지 않고 `CRAWL_IMAGE`(payloadType: `json`, `error: "CORS_OR_FETCH_FAILED"`)로 원본 `url`만 전송하여 서버가 참조 파일로 보관합니다.
- **카테고리 전달**: `COLLECT_IMAGES` 페이로드의 `category`(기본 `"normal"`)를 서버가 파싱하여 저장 경로 `images/<도메인>/<카테고리>/`에 반영합니다. 사이트 전용 버튼(`xchina.co`: normal/album/cover, `xvideos.com`: normal)이 호출하며, 도메인 매칭은 `matchSiteDomain()`(호스트 정확 일치 또는 `.도메인` 접미사)을 따릅니다. 저장 폴더 도메인은 서버가 `www.`를 제거해 루트 도메인으로 통일합니다.
- **정보 수집(`SITE_INFO`)**: 정보 버튼 클릭 시 `collectAndSendSiteInfo()`가 페이지 메타(description/keywords/og/canonical 등)를 JSON으로 `SITE_INFO` 액션 전송합니다. 서버는 `images/<도메인>/info/<ts>-<seq>.json`에 물리 저장하고 crawl_logs에 기록합니다.
- **결과 요약**: 수집 완료 시 `{ success, total, collected, failed, message }`를 사이드바로 반환하며, UI 상태 메시지와 터미널 로그에 반영됩니다.
- **파일명**: 원본 URL에서 쿼리/프래그먼트를 제거한 마지막 경로 조각을 정화해 사용하며, 인출 불가 시 인덱스 기반 기본명(`image_<n>.png`)을 사용합니다.

### 5.4 xvideos 미디어 다운로드 매니저 (DownloadThemAll식, `COLLECT_XVIDEOS_MEDIA`)

xvideos.com 페이지에서 `.thumb-block` 비디오 블록(목록/검색 페이지) 또는 **단일 영상 페이지(플레이어)의 포스터 이미지**를 파싱해 다운로드 목록을 만들고, 진행 버튼으로 자산(메인·보조 썸네일 + preview.mp4, 또는 포스터 이미지 1종)을 플러그인이 직접 인출해 서버 물리 저장소에 보관하는 기능입니다.

- **목록 생성**: 콘텐츠 스크립트 `collectXvideosMediaEntries()`가 `.thumb-block`을 전부 파싱합니다(상한 없음). 항목별로 다음을 수집합니다.
  - **clickUrl**: `.videopv a` href 우선, 없으면 `closest(a[href])`, 없으면 `.thumb a[href]` 순으로 결정합니다.
  - **title**: `.thumb-under .title a[title]` 속성 우선 사용.
  - **eid**: `href`에서 정규식 `/video\.([a-z0-9]+)\//i`로 추출해 중복 제거에 사용.
  - **이미지 소스**: 기존 `resolveImageSource()` 재사용 — `no-img.png`(`assets-cdn77`)는 제외하고, `data-sfwthumb`(보조)와 `src`(메인)를 분리 수집.
  - **preview**: `data-pvv`(preview.mp4 URL)를 수집.
- **단일 영상 페이지 폴백**: `.thumb-block`이 없고 `isXvideosVideoPage()`(URL `/video` 접두사 또는 `#html5video`/`.video-bg-pic` DOM 존재)가 참이면 `collectXvideosVideoPageEntry()`가 **현재 영상 페이지에서 포스터 이미지 1종 + 타이틀**을 추출해 1개 항목을 구성합니다.
  - **포스터 이미지**: `.video-bg-pic .video-pic img`의 `resolveImageSource()` 결과(플레이스홀더 제외). 영상 자체(blob 스트리밍)는 다운로드하지 않습니다.
  - **title**: 플레이어 영역(`#html5video`/`#hlsplayer`)의 `.video-title` 텍스트(예: "Japanese horny unknown teen -what is her name ?").
  - **clickUrl**: 현재 영상 페이지 URL, **sfwUrl/previewUrl는 빈 문자열** → 오프스크린이 빈 자산을 fetch하지 않고(빈 데이터 반환) 서버가 빈 자산을 건너뛰어 **이미지 1종만 저장**(txt의 sfw/preview 라인도 생략). 매니저는 이미지 URL 표시/프로그레스 바/저장 결과를 기존 흐름 그대로 재사용합니다.
- **중복 제거**: 콘텐츠 스크립트와 `useXvideosDownloadManager` 훅에서 clickUrl 기준 이중 체크로 중복 항목을 제거합니다.
- **목록 UI**: 다운로드 매니저는 **전용 팝업 창(`chrome.windows.create` type: "popup", 900×760)**에서 표시하며, `<html class="manager-scrollable">`로 **창 전체 페이지가 통째로 스크롤**됩니다(`popup.css`의 전역 `overflow:hidden` 해제 + 가시 스크롤바, 루트 `min-h-screen`). 항목별로 상태 배지, 제목, clickUrl과 함께 **다운로드 대상 이미지 URL 주소 3종**(`image_url`/`sfw_image_url`/`preview_video_url`, 썸네일 미리보기 아님·`break-all`+선택 복사 가능)과 **프로그레스 바**(오프스크린 단계 이벤트로 실제 % 갱신, 완료 100%/실패 100%)를 표시합니다(DownloadThemAll 스타일 순차 진행). 사이드바/팝업의 xvideos 그룹은 **"다운로드 매니저 열기" 버튼만** 유지하며, 창 열기 시 `chrome.tabs.query`로 대상 xvideos 탭을 찾아 `tabId` 쿼리로 전달합니다(UI 상세는 R-00440 §2.3).
- **저장 위치 조회**: 매니저 창이 목록 생성 시 `GET_STORAGE_LOCATION`으로 서버 저장 위치를 조회해 안내하고, 진행 시 `relDir`(기본 `images/xvideos.com/normal`)을 재사용합니다.
- **진행 흐름**: 매니저 창이 대상 탭으로 `requestCollectXvideosMediaFromTab(tabId)`를 호출해 목록을 구성하며, 항목별로 `buildXvideosTxtContent()`가 메타 txt(page_url/click_url/title/자산 URL)를 생성하고, 오프스크린이 3자산을 fetch(base64) 후 `CRAWL_IMAGE` assets 배열 + `txtContent` 번들로 전송 → `CRAWL_MEDIA_SAVED` ACK 수신 시 완료 처리합니다(자세한 통신 규격은 R-00208 §2.2, R-00420 참조).
- **상한 없음**: 기존 일반 이미지 수집의 500개 상한과 무관하게 블록 개수만큼 목록을 생성합니다.

### 5.5 xvideos best-of-red 자동 이동 액션 (`COLLECT_BEST_OF_RED_INIT` / `COLLECT_BEST_OF_RED_PAGE`)

`xvideos.com/best-of-red/<월>/` 월간 페이지를 **액션 실행기 전용 팝업 창**이 1페이지씩 순차 이동하며, 각 페이지의 비디오 메타(제목/clickUrl/썸네일 2종/프리뷰)를 수집·물리 저장하는 액션 모듈입니다. 베이스 탭의 **"액션 실행"** 섹션 하위 `xvideos.com` 모듈에서 실행합니다. 이전 §5.4의 `collectXvideosMediaEntries()` 파싱 규칙을 그대로 재사용합니다.

- **트리거**: 베이스 탭 "액션 실행" 섹션의 `xvideos.com` → **"best-of-red 자동 이동"** → `usePopupState.handleOpenXvBestOfRedAction()`이 `chrome.windows.create({ url: "action-runner.html?module=best-of-red&tabId=N", type: "popup", width: 900, height: 760 })`로 **액션 실행기 팝업 창**을 엽니다. 콘텐츠 스크립트의 `COLLECT_BEST_OF_RED_INIT`는 현재 URL이 `/best-of-red/<세그먼트>/`(정규식 `XV_BEST_OF_RED_BASE_RE`)와 일치하지 않으면 `{ success: false }`를 응답합니다.
- **페이지 범위 감지(init)**: `.pagination a[data-page]` 값 집합의 **최댓값(`Math.max`)을 그대로 마지막 페이지로 신뢰**합니다(아웃라이어 간주·대체 로직 없음, 예: `0..16,111` → 111). 윈도우 페이지네이션(일부 페이지만 노출)에서도 마지막 페이지 링크가 있으면 해당 값을 감지하며, `.pagination`이 없으면 현재 페이지를 마지막 페이지로 폴백합니다.
- **이동 방식(팝업 주도)**: 진행 상태는 **팝업 창(`actionRunner.tsx` + `useBestOfRedRunner`)이 보유**합니다. 무작위 이동 없이 현재 페이지부터 `+1`씩 순차 이동하며, `chrome.tabs.update(tabId, { url })` 후 `chrome.tabs.onUpdated`의 `status === "complete"` + 경로 일치까지 대기합니다. 팝업 창을 닫으면 실행이 중단됩니다.
- **로드 완료 검증**: 콘텐츠 스크립트 `COLLECT_BEST_OF_RED_PAGE` 핸들러의 `waitForXvBestOfRedPageReady()`가 `readyState === "complete"`(load 이벤트 최대 3초 대기) + `.thumb-block:not(.thumb-ad) img` 전부 `complete && naturalWidth > 0`(최대 4초 폴링)인지 검증한 뒤에만 수집합니다. 이미지 로딩이 끝나지 않으면 `ready: false`로 반환합니다.
- **페이지 URL 규칙**: 페이지 0은 베이스 URL(`/best-of-red/<월>`), N은 `/best-of-red/<월>/N`입니다. 베이스 URL의 후행 슬래시 유무는 무관하게 인식합니다(정규식 `XV_BEST_OF_RED_BASE_RE`).
- **전송·저장 규격**: 각 페이지마다 `CRAWL_PARTIAL`(payloadType: `json`)로 `{ page, url, title, data: entries[], pathSegments: ["best-of-red","<월>","<N>"], fileName: "page-<N>.json", timestamp }`를 전송합니다(오프스크린 소켓 포워딩, R-00420 §4.5 참조). 서버는 `pathSegments`가 있으면 `saveCrawlPartialToFile()`로 `<기본 저장 경로>/<도메인>/<pathSegments...>/page-<N>.json`에 물리 저장합니다(`images/` 없이 도메인 직하, R-00208 §3 참조). 광고 블록은 `.thumb-block:not(.thumb-ad)` 셀렉터로 제외합니다.
- **진행 로그**: 팝업 창의 "행동 로그" 콘솔에 페이지별 `[n/총] N페이지 이동 중 → 브라우저 로딩 완료 → 데이터 수집 중 → 데이터 수집 완료 → 서버 저장 완료(best-of-red/<월>/<N>/page-N.json)` 로그를 순서대로 출력합니다. 진행률 바(현재/총)와 감지된 총 페이지 수를 함께 표시하며 [중지] 버튼으로 중단할 수 있습니다.

---

## 6. 검증 체크리스트

- [ ] `fetch()` 백그라운드 수집 시 유저 활성 탭이 전환되지 않고 0.1초 만에 인출되는가?
- [ ] `DOMParser`를 통한 가상 DOM 파싱 시 메모리 누수가 발생하지 않는가?
- [ ] 페이징 자동 이동 수집 시 지연 시간(Delay)이 정상 적용되는가?
- [ ] 특수 페이지(`chrome://`)에서 수집 스크립트가 안전하게 예외 처리되는가?
- [ ] 요소 선택 모드에서 파란 테두리 강조 → 클릭 → 전송 버튼 → outerHTML 전송이 정상 동작하는가?
- [ ] iframe 미존재 페이지에서 프레임 라디오/버튼이 비활성화되는가?
- [ ] 크로스 오리진 이미지가 스킵되지 않고 URL 참조(`CRAWL_IMAGE` json)로 전송되는가?
- [ ] 전체 페이지 전송 시 버튼을 누를 때 현재 렌더링 DOM(`fullPage`)이 재캡처되어 전송되는가?
- [ ] 사이트 전용 버튼 도메인 매칭(xchina.co/xvideos.com)과 카테고리 저장 경로가 정상 동작하는가?
- [ ] 정보 수집(`SITE_INFO`)이 메타 JSON으로 `images/<도메인>/info/`에 저장되는가?
- [ ] 이미지 수집 섹션에 3그룹(일반/xchina.co/xvideos.com)이 항상 표시되고, 비매칭 사이트 그룹이 비활성화·"다른 도메인" 배지로 안내되는가?
- [ ] lazy 로드 이미지(`data-src` 등)가 포함되고, 중복 URL이 제거되며, 최대 500개 상한이 동작하는가?
- [ ] `www.xchina.co` 페이지 수집 시 저장 폴더가 `images/xchina.co/normal/`(루트 도메인)으로 통일되는가?
- [ ] xvideos.com에서 목록 생성 시 `.thumb-block` 전체(상한 없음)와 clickUrl/title/sfw/메인 썸네일/preview가 파싱되고 중복 clickUrl이 제거되는가?
- [ ] "다운로드 매니저 열기" 버튼이 전용 팝업 창(900×760)을 열고, 대상 xvideos 탭의 목록이 자동 생성되는가?
- [ ] 매니저 목록에 스크롤바가 표시되고, 항목별로 이미지 URL 주소(image_url/sfw_image_url/preview_video_url)가 표시되는가?
- [ ] 항목별 프로그레스 바가 진행 단계(30/55/80/95%)를 실시간 갱신하고 완료/실패 시 100%로 표시되는가?
- [ ] 목록 진행 시 항목별 txt+썸네일2종+preview.mp4가 `images/xvideos.com/normal/`에 저장되고 상태 배지가 완료/실패로 갱신되는가?
- [ ] 베이스 탭 "액션 실행" 섹션의 xvideos.com 모듈에서 "best-of-red 자동 이동" 버튼이 서버 온라인 시 활성화되고, 액션 실행기 팝업 창(900×760)이 열리는가?
- [ ] best-of-red 자동 이동 시 액션 실행기 팝업이 현재 페이지부터 마지막 페이지까지 +1씩 순차 이동하며 각 페이지의 비디오 메타(`CRAWL_PARTIAL`)가 서버에 `<도메인>/best-of-red/<월>/<N>/page-N.json`(`images/` 없음)으로 물리 저장되는가?
- [ ] 이미지 로딩 완료 검증(`waitForXvBestOfRedPageReady`) 실패 시 해당 페이지가 스킵되고 다음 페이지로 계속 진행되는가?
- [ ] 액션 실행기 팝업 창을 닫으면 자동 이동이 중단되고, [중지] 버튼으로도 중단할 수 있는가?
