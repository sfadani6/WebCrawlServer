# xvideos.com + xvideos.red 이중 도메인 지원 — "xvideos 페이징 액션" 화면 문구 + URL 분석 기반 경로 생성 (ask-20260811030252)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260811030252.md`

## 완료 내용
- content.ts(basic/opera): `XV_BEST_OF_RED_BASE_RE = /^(\/[^/]+\/\d{4}-\d{2})(?:\/(\d+))?\/?$/` + `isXvideosHost()` 도메인 가드(xvideos.com/xvideos.red, `www.` 허용) — 하드코딩 `best-of-red` 기본값 제거, 현재 URL 분석으로 basePath 생성. 오류 메시지 → "xvideos 페이징 페이지에서만 실행할 수 있습니다." / "xvideos 페이징 페이지가 아닙니다."
- offscreen.ts(basic/opera): `handleFetchPageMediaBundles()` `pathSegments` → `[세그먼트, YYYY-MM, 페이지]` 해석, `pathSegments[0]` → category 분리 + `slice(1)` → 저장 계층, 번들에 `pageUrl` 포함(하드코딩 best-of-red 중복 제거 로직 제거). `FETCH_PAGE_MEDIA_BUNDLES` 수신부에 `pageUrl?` 필드 추가.
- chromeService.ts/useBestOfRedRunner.ts(basic/opera): `requestFetchPageMediaBundles()` payload에 `pageUrl: string` 전달.
- usePopupState.ts(basic/opera): 탭 탐색 `["*://*.xvideos.com/*", "*://*.xvideos.red/*"]` + 페이징 경로 `/\/(?:[^/]+)\/\d{4}-\d{2}/` 우선 매칭 + 상태 메시지 "xvideos 페이징 ..." 변경.
- actionRunner.tsx(basic/opera): 이중 도메인 폴백 탭 탐색 + initError 문구 갱신.
- BasicTab.tsx(basic/opera): `SITE_IMAGE_BUTTONS`에 `"xvideos.red": ["normal", "info"]` 추가, 액션 카드 `xvideos.com · xvideos.red` 헤더 + 버튼 라벨 `xvideos 페이징 액션` + 저장 경로 설명.
- ActionRunnerView.tsx(basic/opera): 헤더 `액션 실행기 · xvideos 페이징 액션` + 저장 루트 표기 `images/<도메인>/<세그먼트>/<월>/<N>/`(`initInfo.basePath.replace(/^\//, "")`).
- types/index.ts(basic/opera): 주석만 갱신.
- offscreen.ts(basic/opera): 잔여 "best-of-red" 주석 3건 → "xvideos 페이징"으로 변경.
- 검증: tsc --noEmit basic/opera 통과(출력 없음), 양 플러그인 빌드 56 모듈 성공, ESLint 신규 오류 0건(기존 `xvideosManager.tsx` react-hooks 2건·미사용 4건은 기존 이슈와 무관).
- 문서: R-00430 §5.5/§6, R-00420 §4.5, R-00440 §2.4+체크리스트, R-00480 §3.1, R-00208(계층 경로·분리 저장 예시) 갱신.

## 후속 확인
- 브라우저 실측: `https://www.xvideos.com/best/2026-03`에서 베이스 경로 `/best/2026-03`(기본값 없음) 표시, `images/<도메인>/<세그먼트>/<월>/<N>/` 이중 폴더 없이 저장, xvideos.red 탭 활성화·탭 탐색 — `docs/todo.md` 예정 작업에서 관리 중
