// plugins/basic-plugin/src/services/backgroundScraper.ts

/** 백그라운드 스크래핑 결과 구조체 */
export interface ScrapedPageResult {
  /** 수집 대상 URL */
  url: string;
  /** 페이지 타이틀 */
  title: string;
  /** CSS 셀렉터로 추출된 텍스트 항목 배열 */
  items: string[];
  /** 수집 시점 타임스탬프 */
  timestamp: number;
}

/**
 * 유저의 탭 화면을 이동시키지 않고 백그라운드에서 순수 HTML만 fetch로 인출하여
 * DOMParser로 파싱 및 CSS 셀렉터 기반 요소를 추출합니다.
 * ADR-003: 백그라운드 페치 스크래핑 규격 준수
 *
 * @param targetUrl - 수집 대상 타깃 URL
 * @param selector - 수집할 요소를 지정하는 CSS 셀렉터
 * @returns 인출 정제 결과 객체
 */
export async function scrapePageInBackground(
  targetUrl: string,
  selector: string
): Promise<ScrapedPageResult> {
  // 유저 저장 쿠키 세션을 자동 동봉하여 인증이 필요한 페이지도 수집 가능
  const response = await fetch(targetUrl, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP 요청 에러 발생: status ${response.status}`);
  }

  const htmlText = await response.text();

  // 가상 DOMParser 인스턴스 기동 (화면 렌더링 미발생 - 백그라운드 전용)
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  // CSS 셀렉터로 요소 추출 후 텍스트 정제
  const items = Array.from(doc.querySelectorAll(selector))
    .map((el) => el.textContent?.trim() || "")
    .filter((text) => text.length > 0);

  return {
    url: targetUrl,
    title: doc.title || "제목 없음",
    items,
    timestamp: Date.now(),
  };
}
