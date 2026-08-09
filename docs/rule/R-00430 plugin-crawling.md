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
- **전송 데이터**: 버튼 클릭 시 해당 요소의 **outerHTML 전체**를 `CRAWL_PARTIAL` 페이로드(`data.tag`/`data.id`/`data.className`/`data.outerHTML`)로 서버에 전송합니다.
- **모드 종료**: 전송 완료 또는 `ESC` 키 입력 시 모드가 종료되며, `ELEMENT_PICKER_ENDED` 메시지로 사이드바에 완료/취소를 통지합니다.
- **기본 동작 차단**: 클릭 핸들러는 `preventDefault()`/`stopPropagation()`으로 페이지 원래 동작을 차단해 선택 모드와 페이지 네비게이션 충돌을 방지합니다.

### 5.2 프레임 수집 (`GET_FRAME_INFO` / `COLLECT_FRAME_DOM`)

iframe이 존재하는 페이지의 프레임 DOM을 선택 전송하는 기능입니다.

- **iframe 존재 조회**: 사이드바가 활성 탭을 감시할 때마다 `GET_FRAME_INFO`로 iframe 개수를 조회합니다. **iframe이 0개이면 프레임 라디오와 전송 버튼이 비활성화**됩니다.
- **같은 오리진 프레임**: `frame.contentDocument.documentElement.outerHTML`을 `CRAWL_DOCUMENT`(fullDom)로 전송합니다.
- **크로스 오리진 프레임**: `contentDocument` 접근이 `SecurityError`로 차단되면 src URL 참조만 `CRAWL_PARTIAL`로 전송합니다. (서버는 참조 보관 처리)

### 5.3 이미지 수집 (`COLLECT_IMAGES`)

현재 페이지의 이미지를 추출해 서버의 전용 폴더에 저장하는 기능입니다.

- **추출 범위**: 페이지 내 `img` 요소를 최대 50개까지 추출합니다(`MAX_IMAGE_COLLECT_COUNT`).
- **같은 오리진/CORS 허용 이미지**: `fetch(src, { credentials: "include" })`로 인출 후 `ArrayBuffer → Base64` 변환하여 `CRAWL_IMAGE`(payloadType: `binary_base64`)로 전송합니다.
- **크로스 오리진 인출 실패**: `fetch` 실패 시 스킵하지 않고 `CRAWL_IMAGE`(payloadType: `json`, `error: "CORS_OR_FETCH_FAILED"`)로 원본 `url`만 전송하여 서버가 참조 파일로 보관합니다.
- **결과 요약**: 수집 완료 시 `{ success, total, collected, failed, message }`를 사이드바로 반환하며, UI 상태 메시지와 터미널 로그에 반영됩니다.
- **파일명**: 원본 URL에서 쿼리/프래그먼트를 제거한 마지막 경로 조각을 정화해 사용하며, 인출 불가 시 인덱스 기반 기본명(`image_<n>.png`)을 사용합니다.

---

## 6. 검증 체크리스트

- [ ] `fetch()` 백그라운드 수집 시 유저 활성 탭이 전환되지 않고 0.1초 만에 인출되는가?
- [ ] `DOMParser`를 통한 가상 DOM 파싱 시 메모리 누수가 발생하지 않는가?
- [ ] 페이징 자동 이동 수집 시 지연 시간(Delay)이 정상 적용되는가?
- [ ] 특수 페이지(`chrome://`)에서 수집 스크립트가 안전하게 예외 처리되는가?
- [ ] 요소 선택 모드에서 파란 테두리 강조 → 클릭 → 전송 버튼 → outerHTML 전송이 정상 동작하는가?
- [ ] iframe 미존재 페이지에서 프레임 라디오/버튼이 비활성화되는가?
- [ ] 크로스 오리진 이미지가 스킵되지 않고 URL 참조(`CRAWL_IMAGE` json)로 전송되는가?
