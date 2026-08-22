# xvideos 페이징 액션 로드 검증 강화 — 네트워크 안정 기반 대기 + 페이지별 트리 로그 UI (ask-20260811001627)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260811001627.md`

## 완료 내용
- content.ts: `installNetworkActivityWatch()` 재작성 — XHR `send()`+1 / `loadend`(once)-1(open 누수 제거) + manifest `run_at: "document_start"`(초기 요청 감시)
- content.ts: `waitForXvBestOfRedPageReady(expectedPath)` 재작성 — 기대 URL 검증(8초, 불일치 시 ready:false+사유) + readyState complete + 강제 렌더링(lazy→eager·data-src→src + 2초 간격 재스크롤, 끝 도달 시 맨 위 복귀) + DOM 안정(블록 3연속 동일) + 네트워크 안정(인플라이트 0 + 리소스 3연속 동일), 이미지 로드 조건 제거, 백그라운드 탭 800ms·35초 보정, 응답에 `network{inflight,resources,stable}`·`waitedMs`·`visibilityState`
- content.ts: `resolveImageSource()` 재작성 + `isPlaceholderUrl()` 신규(no-img/about:blank/1×1 gif 무시, data-src 계열 우선) + COLLECT_BEST_OF_RED_PAGE `expectedPath` 수신
- types/index.ts: `XvBestOfRedPageData.network/waitedMs/visibilityState` + chromeService.ts `requestXvBestOfRedPage(tabId, expectedPath)` + 실패 분기 `entryFiles: []`
- useBestOfRedRunner.ts: `ActionRunnerLog.page` 그룹 키·페이지 귀속 로그 + "브라우저 로드 검증 대기 중...(네트워크 모니터링)" 로그 + 검증 완료 로그(네트워크 안정·인플라이트·리소스·대기 시간·블록 수) + `ready=false` 2회 연속 시 `chrome.tabs.reload()` 후 재대기
- ActionRunnerView.tsx 전면 재작성: 페이지 등장순 그룹 + 전역 `__global__` 트리, ▾/▸ 토글 + 배지(오류>경고>완료) + 로그 수, 현재 페이지 자동 펼침·자동 스크롤, "전체 펼치기/접기" 버튼
- offscreen.ts: best-of-red `pathSegments[0]`일 때 `slice(1)`로 중복 세그먼트 제거 — `best-of-red/best-of-red/` 이중 폴더 버그 수정
- opera-plugin 7종 동기화(content/offscreen/types/chromeService/useBestOfRedRunner/ActionRunnerView/manifest, diff 0) + 양 플러그인 빌드 성공(각 56 모듈) + server tsc 통과 + ESLint 플러그인 이슈 0건 + pm2 재시작(포트 9600 HTTP 200)
- 문서: R-00430 §5.5+§6, R-00420 §4.5, R-00440 §2.4+체크리스트

## 후속 확인
- 브라우저 실측: 확장 프로그램 리로드 후 0페이지부터 액션 실행 → 페이지 1+ 수집 건수 전체(≈27건), 네트워크 안정 대기 로그, 페이지별 트리 로그 UI, 미디어 저장 경로 이중 폴더 없음 — `docs/todo.md` 예정 작업에서 관리 중
