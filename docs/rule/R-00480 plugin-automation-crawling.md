본 문서는 `WebCrawlServer` 프로젝트의 브라우저 확장 플러그인에서 **백그라운드 초고속 경량 수집(`fetch()` + `DOMParser`)**, **선언형 자동 페이징 루프**, 및 **다중 SNS 원스톱 자동 포스팅**을 구현하기 위한 표준 기술 지침서입니다.

---

## 1. 개요 및 수집 원칙

1.1 **개요**: 유저가 보고 있는 탭을 강제로 이동시켜 발생하는 브라우저 과부하 및 유저 방해를 없애고, 백그라운드에서 사람 형태의 탐색 알고리즘으로 데이터를 고속 수집 및 멀티 포스팅합니다.  
1.2 **3대 핵심 원칙**:
   - **경량성 (Lightweight)**: 무거운 이미지/CSS/폰트를 로드하지 않고 순수 HTML만 백그라운드 인출하여 CPU/RAM 사용량 0% 급 유지.
   - **세션 보안 우회 (Anti-Bot Bypass)**: 파이썬 헤드리스와 달리 실제 사용자 브라우저의 리얼 TLS 핑거프린트와 로그인 인증 쿠키(`credentials: "include"`) 및 주거지 IP(Residential IP)를 활용하여 Cloudflare 봇 차단벽을 100% 우회.
   - **인간 모사 지연 (Human-like Delays)**: 자동 페이징 및 포스팅 시 사람과 유사한 3초~5초 랜덤 딜레이를 주어 계정 일시 정지 및 캡차 발생 원천 차단.

---

## 2. 백그라운드 `fetch()` + `DOMParser` 초고속 경량 수집 규정

유저가 웹서핑하는 화면과 탭을 전혀 방해하지 않고, 오프스크린/사이드바 백그라운드에서 순수 HTML 텍스트만 0.1초 만에 인출하여 가상 DOM으로 파싱하는 표준 가이드라인입니다.

```typescript
// plugins/basic-plugin/src/services/backgroundScraper.ts

export interface ScrapedPageResult {
  url: string;
  title: string;
  items: string[];
  timestamp: number;
}

/**
 * 유저 탭 이동 없이 백그라운드에서 순수 HTML만 인출하여 DOMParser로 파싱합니다.
 * @param targetUrl - 수집 타깃 URL
 * @param selector - 수집할 요소를 지정하는 CSS 셀렉터
 */
export async function scrapePageInBackground(
  targetUrl: string,
  selector: string
): Promise<ScrapedPageResult> {
  // 1. 유저의 로그인 쿠키가 자동 포함되는 비동기 fetch 호출
  const response = await fetch(targetUrl, {
    method: "GET",
    credentials: "include", // 저장된 세션 쿠키 자동 전송
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP 에러 발생: status ${response.status}`);
  }

  const htmlText = await response.text();

  // 2. 가상 DOMParser 생성 (화면 렌더링 무발생)
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  // 3. CSS 셀렉터 기반 데이터 정제
  const items = Array.from(doc.querySelectorAll(selector)).map(
    (el) => el.textContent?.trim() || ""
  ).filter((text) => text.length > 0);

  return {
    url: targetUrl,
    title: doc.title || "제목 없음",
    items,
    timestamp: Date.now(),
  };
}
```

---

## 3. 선언형 페이징 순차 이동 수집 엔진 규정 (`content.ts`)

서버에서 전달받은 JSON 행동 양식에 따라 1페이지부터 N페이지까지 `nextPageSelector` 버튼을 자동 클릭하고 지연 시간을 가지며 수집을 진행하는 규칙입니다.

```typescript
// plugins/basic-plugin/src/content.ts

export interface PaginationRule {
  nextPageSelector: string; // 다음 페이지 버튼 셀렉터 (예: ".pagination .next_page")
  contentSelector: string;  // 수집할 데이터 셀렉터 (예: ".board-list .item")
  maxPages: number;         // 수집할 최대 페이지 수
  delayMs: number;          // 페이지 이동 간 지연 시간 (기본값: 3000ms)
}

/**
 * 타깃 웹페이지에 주입되어 페이징 자동 클릭 및 연속 수집을 단행합니다.
 */
export async function runPaginationCrawlEngine(rule: PaginationRule): Promise<void> {
  let currentPage = 1;

  while (currentPage <= rule.maxPages) {
    // 1. 현재 페이지의 DOM 데이터 수집
    const pageItems = Array.from(document.querySelectorAll(rule.contentSelector))
      .map((el) => el.textContent?.trim() || "")
      .filter((text) => text.length > 0);

    // 2. 수집 데이터를 오프스크린 소켓으로 포워딩
    chrome.runtime.sendMessage({
      type: "RAW_DOM_DATA",
      data: {
        page: currentPage,
        url: window.location.href,
        title: document.title,
        items: pageItems,
        timestamp: Date.now(),
      },
    });

    if (currentPage >= rule.maxPages) break;

    // 3. 다음 페이지 버튼 검색 및 클릭
    const nextButton = document.querySelector(rule.nextPageSelector) as HTMLElement | null;
    if (!nextButton) {
      console.log("[수집 엔진] 다음 페이지 버튼을 찾을 수 없어 수집을 마칩니다.");
      break;
    }

    nextButton.click();
    currentPage++;

    // 4. 인간 모사 지연 시간 적용 (Human-like Random Jitter Delay)
    const jitter = Math.floor(Math.random() * 1000); // 0~1초 랜덤 추가 지연
    await new Promise((resolve) => setTimeout(resolve, rule.delayMs + jitter));
  }
}

// 서버 원격 지시 메시지 수신기
chrome.runtime.onMessage.addListener((message) => {
  if (message.command === "START_PAGINATION_CRAWL") {
    runPaginationCrawlEngine(message.payload);
  }
});
```

---

## 4. 다중 SNS 원스톱 자동 포스팅 규정 (Multi-Posting)

사이드바 단일 UI에서 작성된 글을 페이스북, 트위터(X), 핀터레스트, 네이버/티스토리 블로그로 동시 포스팅하기 위한 표준 가이드라인입니다.

4.1 **포스팅 방식 선택**:
   - **DOM 입력 자동화 방식 (권장)**: 백그라운드 비활성 탭(`active: false`)으로 포스팅 페이지를 연 뒤 `content.ts`가 글 상자에 입력 및 발행 버튼 클릭.
   - **직접 내부 API 송신 방식**: 사용자의 Session Cookie를 인출하여 각 플랫폼의 내부 작성 REST/GraphQL API로 직접 `POST` 송출.
4.2 **차단 방지 필수 규칙**:
   - 포스팅 연쇄 실행 시 무작위 5초~10초 지연 시간을 두어 스팸 봇 감지를 무력화해야 합니다.

---

## 5. 검증 체크리스트

- [ ] `fetch()` 인출 시 `credentials: "include"` 옵션이 지정되어 유저 로그인 쿠키가 정상 동봉되는가?
- [ ] 이미지/CSS가 미로드된 상태에서 `DOMParser`를 통해 가상 DOM 데이터가 정확히 인출되는가?
- [ ] 페이징 수집 엔진에서 페이지 클릭 후 `delayMs` 기반 랜덤 지연 시간이 정상 작동하는가?
- [ ] 유저의 활성 탭 화면이 전환되거나 버벅이는 현상이 완전히 차단되었는가?
