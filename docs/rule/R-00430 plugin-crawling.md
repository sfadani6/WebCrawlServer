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

## 5. 검증 체크리스트

- [ ] `fetch()` 백그라운드 수집 시 유저 활성 탭이 전환되지 않고 0.1초 만에 인출되는가?
- [ ] `DOMParser`를 통한 가상 DOM 파싱 시 메모리 누수가 발생하지 않는가?
- [ ] 페이징 자동 이동 수집 시 지연 시간(Delay)이 정상 적용되는가?
- [ ] 특수 페이지(`chrome://`)에서 수집 스크립트가 안전하게 예외 처리되는가?
