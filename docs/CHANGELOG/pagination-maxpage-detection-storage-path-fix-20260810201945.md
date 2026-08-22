# xvideos 페이징 maxPage 감지 신뢰 개선 + 저장 경로 `images/` 중복 제거 (ask-20260810201945)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260810201945.md`

## 완료 내용
- content.ts `detectXvBestOfRedMaxPage`: 아웃라이어 가드(차이 ≥ 20) 제거 → `.pagination a[data-page]` `Math.max` 신뢰(0..16+111 → 111), 페이지네이션 없으면 currentPage 폴백
- content.ts [7-3] `COLLECT_BEST_OF_RED_PAGE`: 응답 `data` 중첩(`{ ready, page, url, title, data: entries, message }`) → `requestXvBestOfRedPage`는 `res.data` 그대로 사용
- server `saveCrawlPartialToFile`: 경로에서 `images/` 제거(`resolve(rootPath, safeDomain, ...safeSegments)` = `<기본경로>/<도메인>/<pathSegments...>/<fileName>`) + index.ts 분기 주석 동기화
- opera-plugin content.ts 동기화(diff 0) + 양 플러그인 빌드 성공(각 56 모듈) + server tsc 빌드 통과
- 서버 pm2 재시작(새 pid 67528, 포트 9600 HTTP 200, storageRoot `E:\up\WebCrawlServer`) + ESLint 신규 문제 0건
- 문서: R-00430 §5.5+§6, R-00480 §3.1, R-00420 §4.5, R-00208 §2.3+§3.2+§5, R-00440 §2.4 — 감지 규칙(최대 data-page 신뢰)·저장 경로(images/ 제거) 갱신

## 후속 확인
- 브라우저 실측: 액션 실행기 팝업에서 0→111(총 112페이지) 순차 이동·행동 로그 확인 → `xvideos.com/best-of-red/<월>/<N>/page-N.json`(`images/` 없음) 물리 저장 확인 — `docs/todo.md` 예정 작업에서 관리 중
