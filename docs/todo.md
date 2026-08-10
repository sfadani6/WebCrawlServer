# 실행 계획 체크리스트 (docs/todo.md)

## 현재 작업
- ask-20260810201945: best-of-red 실측 버그 2건(총 페이지 과소 감지·수집 메타 표시 오류) + 저장 경로(`images/` 제거) 수정

## 완료된 작업 (ask-20260810201945)
- [x] content.ts `detectXvBestOfRedMaxPage`: 아웃라이어 가드(차이 ≥ 20) 제거 → `.pagination a[data-page]` `Math.max` 신뢰(0..16+111 → 111), 페이지네이션 없으면 currentPage 폴백
- [x] content.ts [7-3] `COLLECT_BEST_OF_RED_PAGE`: 응답 `data` 중첩(`{ ready, page, url, title, data: entries, message }`) → `requestXvBestOfRedPage`는 `res.data` 그대로 사용
- [x] server `saveCrawlPartialToFile`: 경로에서 `images/` 제거(`resolve(rootPath, safeDomain, ...safeSegments)` = `<기본경로>/<도메인>/<pathSegments...>/<fileName>`) + index.ts 분기 주석 동기화
- [x] opera-plugin content.ts 동기화(diff 0) + 양 플러그인 빌드 성공(각 56 모듈) + server tsc 빌드 통과
- [x] 서버 pm2 재시작(새 pid 67528, 포트 9600 HTTP 200, storageRoot `E:\up\WebCrawlServer`) + `npx eslint .` 신규 문제 0건
- [x] 문서: R-00430 §5.5+§6, R-00480 §3.1, R-00420 §4.5, R-00208 §2.3+§3.2+§5, R-00440 §2.4 — 감지 규칙(최대 data-page 신뢰)·저장 경로(images/ 제거) 갱신, askLog 신규(ask-20260810201945), ask.md 초기화

## 예정 작업 (ask-20260810201945)
- [ ] 브라우저 실측: 액션 실행 xvideos.com 모듈 → 액션 실행기 팝업(900×760) → 0→111(총 112페이지) 순차 이동·행동 로그 확인 → `xvideos.com/best-of-red/<월>/<N>/page-N.json`(`images/` 없음) 물리 저장 확인, 팝업 닫기·[중지] 중단 확인

## 완료된 작업 (ask-20260810175719)
- [x] content.ts: 구 세션 엔진 제거(세션/엔진/START_XVIDEOS_BEST_OF_RED) + [7-2] `COLLECT_BEST_OF_RED_INIT` + [7-3] `COLLECT_BEST_OF_RED_PAGE` + `waitForXvBestOfRedPageReady()`(readyState complete+썸네일 로딩 완료 검증) + `detectXvBestOfRedMaxPage()` 신규
- [x] useBestOfRedRunner.ts 신규(상태머신·+1 순차 이동·`waitForTabComplete` 30s·CRAWL_PARTIAL `pathSegments`/`page-<N>.json` 전송) + action-runner.html/actionRunner.tsx/ActionRunnerView.tsx 신규(상태 배지·진행률 바·행동 로그 콘솔 300건·시작/중지·완료 배너)
- [x] chromeService.ts(`requestXvBestOfRedInit/Page`), usePopupState.ts(`handleOpenXvBestOfRedAction`), BasicTab.tsx("액션 실행" 섹션 정식화 — xvideos.com 액션모듈 카드, best-of-red 자동 이동 버튼), popup/sidepanel 배선, types/index.ts(`XvBestOfRedInitData/PageData`)
- [x] server: `saveCrawlPartialToFile()`(→ 이후 ask-20260810201945에서 images/ 제거) + index.ts CRAWL_PARTIAL `pathSegments` 분기(updateCrawlLogFile·logPluginComm) — tsc 빌드 통과
- [x] opera-plugin 동기화 12종(헤더 경로만 교체) + 양 플러그인 빌드 성공(각 56 모듈, action-runner.html 포함) + `npx eslint .` 신규 문제 0건
- [x] 문서: R-00430 §5.5+§6, R-00480 §3.1, R-00440 §2.3+신규 §2.4+§5, R-00420 §4.5+§5, R-00208 §2.3+§3.2+§5, askLog 신규(ask-20260810175719), todo.md/todo.history.md, ask.md 초기화

## 예정 작업 (ask-20260810175719)
- [ ] 브라우저 실측: 액션 실행 xvideos.com 모듈 → 액션 실행기 팝업(900×760) 열림 → 검출 총 페이지 수 표시 → 페이지별 이동/로딩 완료/수집/서버 저장 로그 순차 출력 → `xvideos.com/best-of-red/<월>/<N>/page-N.json` 물리 저장, 팝업 닫기·[중지] 중단 확인

## 완료된 작업 (ask-20260810163514)
- [x] content.ts: best-of-red 상수/타입 + 세션 저장·URL 파싱·maxPage 감지·전송·엔진·재개·시작 함수 + `START_XVIDEOS_BEST_OF_RED` [7-2] 분기 + 최하단 `maybeResumeXvBestOfRed()`
- [x] content.ts: `collectXvideosMediaEntries()` 셀렉터 `.thumb-block:not(.thumb-ad)` 보강(광고 제외)
- [x] chromeService.ts: `requestStartXvideosBestOfRed()` 래퍼
- [x] usePopupState.ts: `handleRunXvBestOfRed()` 핸들러
- [x] BasicTab.tsx: `onRunXvBestOfRed` prop + `isXvBestOfRedUrl()` + xvideos 그룹 best-of-red 자동 이동 버튼
- [x] popup.tsx/sidepanel.tsx: `onRunXvBestOfRed` props 배선
- [x] opera-plugin 동기화 6종(헤더 교체) + 양 플러그인 빌드 성공(각 52 모듈) + eslint 12종 통과
- [x] 문서: R-00430 §5.5+§6, R-00480 §3.1, R-00440 §2.3, R-00420 §4.5, askLog 신규(ask-20260810163514)

## 예정 작업 (ask-20260810163514)
- [ ] ~~브라우저 실측(구 세션 방식)~~ → ask-20260810175719 재설계(팝업 주도 순차 이동)로 대체됨

## 완료된 작업 (ask-20260810071013)
- [x] content.ts: `isXvideosVideoPage()`(URL/DOM 판별) + `collectXvideosVideoPageEntry()`(포스터·타이틀·EID)
- [x] content.ts: COLLECT_XVIDEOS_MEDIA 핸들러에 비디오 페이지 폴백(1건, sfw/preview 빈 문자열)
- [x] types/index.ts: sfwUrl/previewUrl JSDoc에 단일 영상 페이지 빈 문자열 명시
- [x] XvideosManagerView.tsx: 빈 목록 안내 문구에 단일 영상 페이지 파싱 추가
- [x] opera-plugin 동기화 3종 + 양 플러그인 빌드 성공
- [x] 문서: R-00430 §5.4(단일 영상 페이지 폴백), R-00420 §4.5, askLog 신규(ask-20260810071013)

## 예정 작업 (ask-20260810071013)
- [ ] 브라우저 실측: 영상 재생 페이지에서 매니저 → 현재 영상 1건 목록 → 포스터 이미지 1종 + txt만 저장 확인

## 완료된 작업 (ask-20260810065244)
- [x] offscreen.ts: `broadcastFetchProgress()` 신설 + 인출 단계별(메인30/보조55/프리뷰80/전송95) `FETCH_MEDIA_BUNDLE_PROGRESS` 브로드캐스트(.catch 가드)
- [x] types/index.ts: `XvideosDownloadItem.progress` + `FetchMediaBundleProgressPayload` 신설
- [x] useXvideosDownloadManager.ts: progress 초기 0/진행 리셋/done·failed 100, onMessage 리스너(bundleId 매칭 갱신)
- [x] XvideosManagerView.tsx: `.manager-list-scroll` + 항목별 image_url/sfw_image_url/preview_video_url 3줄 + 프로그레스 바(0% 쉬머→%→완료/실패 100)
- [x] popup.css: 가시 스크롤바(thumb #475569) + `progress-bar-indeterminate` 쉬머 애니메이션
- [x] opera-plugin 동기화 5종 + 양 플러그인 빌드 성공(각 52 모듈, offscreen.js 5.33 kB·xvideosManager.js 10.42 kB)
- [x] 문서: R-00440 §2.3, R-00420 §4.5·§5, R-00430 §5.4·§6, askLog 신규(ask-20260810064441)

## 예정 작업 (ask-20260810064441)
- [ ] 브라우저 실측: 매니저 창 목록 스크롤바 표시, 항목별 이미지 URL 주소 3줄 표시, 진행 시 프로그레스 바(쉬머→%→완료) 및 저장 배지 갱신 확인

## 완료된 작업 (ask-20260810061757)
- [x] vite.config.ts: `rollupOptions.input`에 xvideosManager 엔트리(`xvideos-manager.html`) 추가(기존 sidepanel/offscreen/background/content 유지, 엔트리 5종) + `xvideos-manager.html` 신규
- [x] `useXvideosDownloadManager.ts` 신규: `extFromUrl`/`buildXvideosTxtContent` 이관 + 훅(목록/순차진행/초기화/로그 200건 상한)
- [x] chromeService.ts: `sendCommandToActiveTab` 일반화 `sendCommandToTab(tabId)` 신설(주입+재시도), `requestCollectXvideosMediaFromTab(tabId)` 추가
- [x] `xvideosManager.tsx` 신규(React root, tabId 쿼리 검증·폴백, initError, 최초 자동 목록 생성) + `XvideosManagerView.tsx` 신규(2열 그리드·상태 배지·버튼 3종·로그 터미널)
- [x] BasicTab.tsx: xvideos Props 6종 → `onOpenXvideosManager` 1종, "다운로드 매니저 열기" 버튼만 유지
- [x] usePopupState.ts: xvideos state 5종 제거, `handleOpenXvideosManager`(xvideos 탭 검색→windows.create) 신규 + return 반영
- [x] sidepanel.tsx/popup.tsx props 교체 + manifest `windows` 권한 추가(basic/opera)
- [x] opera-plugin 동기화(신규 3종+html+vite.config+수정 5종 헤더 교체) + 양 플러그인 빌드 성공(각 52 모듈, xvideosManager.js 8.73 kB)
- [x] 문서: R-00440 §2.3(매니저 창 UI 규격), R-00430 §5.4·§6, R-00420 §4.5, R-00450(엔트리 4→5), askLog 신규(ask-20260810061757)

## 예정 작업 (ask-20260810061757)
- [ ] 브라우저 실측: 사이드바 버튼→매니저 창(900×760) 열림, 대상 탭 목록 자동 생성(중복 제거·상한 없음), 진행 시 txt+썸네일2종+preview.mp4 저장 및 완료/실패 배지, 닫기·초기화·로그 출력 확인

## 완료된 작업 (ask-20260810051720)
- [x] 서버 fileStorageService: 실패 참조 `.url`→`.txt`(clickUrl/title 라인), `mimeToExtension` mp4/webm 추가, 신규 `saveCrawledMediaBundle()`(txt+자산 일괄 저장·실패 자산 스킵·savedDir/savedFiles 반환)
- [x] 서버 index.ts: `GET_STORAGE_LOCATION`→`STORAGE_LOCATION_RESPONSE`(absDir/relDir) 신설, CRAWL_IMAGE assets 배열 감지 시 번들 저장+`CRAWL_MEDIA_SAVED` ACK 응답
- [x] 플러그인 content.ts: `collectXvideosMediaEntries()`(`.thumb-block` 상한 없음·no-img 제외·clickUrl 중복 제거·eid/clickUrl/title/sfw/메인/preview 수집) + `COLLECT_XVIDEOS_MEDIA` 핸들러
- [x] 플러그인 offscreen.ts: `mediaAckWaiters`(60s)/`storageLocationWaiter`(15s), `fetchAssetAsBase64()`(실패 시 빈 data), `handleFetchMediaBundle()` 3자산 인출→번들 전송→ACK 대기
- [x] 플러그인 usePopupState.ts: xvideos 매니저 state 5종 + `buildXvideosTxtContent`/목록 생성/순차 진행(done·failed 집계)/초기화, `getPacketLogType` ACK success 처리
- [x] BasicTab.tsx: DownloadThemAll식 매니저 패널(저장 위치 절대경로·항목 상태 배지·진행/초기화) + sidepanel/popup props 전달
- [x] opera-plugin 동기화 8종(헤더 교체, background.ts는 `chrome.sidePanel?.` 차이로 유지) + 양 플러그인 빌드 성공(각 48 모듈)
- [x] 검증: server 빌드(tsc)+pm2 재시작 online(9600), dist에 신규 핸들러 포함 확인
- [x] 문서: R-00208 §2.1/§2.2/§3.1, R-00430 §5.4, R-00420 §4.5 갱신, askLog 신규(ask-20260810051720)

## 예정 작업 (ask-20260810051720)
- [ ] (ask-20260810061757 예정 작업으로 대체) 브라우저 실측: xvideos.com 목록 생성(중복 제거·상한 없음)→진행 시 txt+썸네일2종+preview.mp4 저장 및 항목 완료/실패 배지 갱신 확인

## 완료된 작업 (ask-20260810033437)
- [x] popup.css: Material Symbols `@import` 제거, 공통 버튼 토큰 신설(`btn-primary`/`btn-accent`/`btn-secondary`/`btn-mini`, 비활성 opacity→명시 고대비), `terminal-log-line`/`terminal-input` 스타일 추가
- [x] 폰트 아이콘 22곳 전면 제거(Header/TerminalConsole/BasicTab 16/DebugTab/InfoTab 2/SettingsTab) + 아코디언 `▼/▶` 유니코드 전환 + HTML 3종 CDN 제거
- [x] 터미널 정돈: 로그 행 타임스탬프/본문 분리·호버, 입력줄 박스형(sky 포커스 링), 헤더 버튼 `btn-mini` 통일
- [x] 버튼 일관화: 설정탭 `#1A73E8`→`btn-primary`(파랑 그라데이션), 요소 선택 앰버 유지, 사이트 카테고리 `btn-secondary` 통일
- [x] opera-plugin 동기화(10종 복사 + 헤더 교체) + 양 플러그인 빌드 성공(각 48 모듈)
- [x] 문서: R-00440 §1.3 아이콘 배제 원칙·§1.4 버튼 색상 체계 신설, §2 도식·§4.2 갱신

## 예정 작업 (ask-20260810033437)
- [ ] 브라우저 수동 확인: 아이콘 제거·버튼 가시성·색상 통일, 터미널 출력/입력 스타일, 이미지 수집 카테고리 버튼 활성/비활성 대비

## 완료된 작업 (ask-20260810031128)
- [x] content.ts: `MAX_IMAGE_COLLECT_COUNT` 50→500, `resolveImageSource()` lazy 폴백(data-src/data-original/data-lazy-src/data-url/data-lazy), `collectAndSendImages` 중복 URL Set 제거
- [x] BasicTab.tsx: 사이트 전용 그리드 → 항상 3그룹 표시(일반/xchina.co/xvideos.com), 비매칭 그룹 disabled + "다른 도메인" 배지 + title 안내
- [x] 서버 index.ts: `normalizeRootDomain()` 신규 — `www.` 제거한 루트 도메인으로 저장 폴더/crawl_logs domain 통일
- [x] opera-plugin 동기화(2종: content.ts, BasicTab.tsx) + 양 플러그인 빌드 성공
- [x] 문서: R-00208 §2.1(카테고리 하위 폴더·info·루트 도메인), R-00430 §5.3·§6 갱신
- [x] 검증: server 빌드 + pm2 재시작 online, 플러그인 빌드 성공

## 예정 작업 (ask-20260810031128)
- [ ] 브라우저 수동 확인: 3그룹 상시 표시/비매칭 비활성화 배지, lazy 포함·중복 제거·500 상한, `images/<루트도메인>/normal/` 저장

## 완료된 작업 (ask-20260810024611)
- [x] 플러그인 액션 개편: 전체 페이지 → `fullPage`(버튼 누를 때 현재 렌더링 DOM 재캡처 outerHTML), 요소 선택 → `DomCapture`, 구형 CRAWL_DOCUMENT/PARTIAL 하위 호환 유지 (content.ts/chromeService/usePopupState/BasicTab/sidepanel/popup)
- [x] 이미지 수집 3버튼: 일반 상시 + xchina.co(normal/album/cover/info)·xvideos.com(normal/info) 사이트 전용, `matchSiteDomain()` 호스트 정확/접미사 매칭, category 페이로드 전달
- [x] 정보 수집 `SITE_INFO` 액션 신규: 메타 JSON → `<기본경로>/images/<도메인>/info/<ts>-<seq>.json` 물리 저장
- [x] 서버: `saveCrawledImage` `images/<도메인>/<카테고리>` 저장, CRAWL_IMAGE category 전달, SITE_INFO 분기, 워커 파이프라인 조건 `CRAWL_DOCUMENT || fullPage`
- [x] 서버: `fetchTableRows` searchField/orderBy/orderDir 파라미터 + 컬럼 화이트리스트 + `%`/`_` LIKE `ESCAPE '\'` + rows 라우트 파싱
- [x] admin 데이터 브라우저: 컬럼 헤더 ▲▼ 서버 정렬(onSortChange) + 검색 필드 드롭다운(전체/개별 컬럼) + 테이블 전환 시 리셋
- [x] admin SQL 실행기: 예제 쿼리 20개 드롭다운(선택 시 에디터 삽입) + 결과 그리드 `clientSort` 클라이언트 정렬
- [x] opera-plugin 동기화(6종 복사 + 헤더 교체) + 양 플러그인 빌드 성공
- [x] 문서: R-00203(rows API 규격), R-00304(§3.1/§3.3/체크리스트) 갱신
- [x] 검증: server 빌드 + pm2 재시작 online, admin vite build, API 수동(정렬/검색/이스케이프/주입 안전)

## 예정 작업 (ask-20260810024611)
- [ ] 브라우저 수동 확인: 사이트 전용 이미지 버튼/카테고리 저장, fullPage 재캡처, admin 헤더 정렬/필드 검색/예제 쿼리

## 완료된 작업 (ask-20260809231120)
- [x] server/configs.json: `db_page_size`(20), `db_cell_preview_chars`(200) 시드 추가 (누락 키 자동 INSERT, admin 환경설정 자동 노출)
- [x] server: `POST /api/admin/fs/open-explorer` 신규 (파일이면 부모 디렉토리, 디렉토리면 그대로, win32 explorer.exe/비Win xdg-open, 미존재 404, 관리자 활동 로그)
- [x] server: `/api/admin/db/rows` 및 `fetchTableRows` size 미지정 기본값 50→20 (최대 200 유지)
- [x] admin ValuePreviewModal.tsx 신규: 창 높이 기준 maxHeight(`innerHeight - 120px`) + 본문 스크롤 + 닫기/backdrop/ESC + 글자수·줄수 표시
- [x] admin DbDataGrid.tsx: 셀 길이 제한(기본 200) + `더보기` 링크 + `file_path` 컬럼 정확 일치 시 folder_open 탐색기 버튼 + 실패 배너
- [x] admin apiService.ts: openExplorerApi() 추가
- [x] admin useDbManager.ts: selectTable(table, size=20) size 파라미터화
- [x] admin DbBrowserPanel.tsx: dbPageSize 기본값 + 페이지당 행 수 드롭다운(20/50/100/200) + cellPreviewChars 전달
- [x] admin SqlQueryPanel.tsx: cellPreviewChars → DbDataGrid 전달
- [x] admin DbManagerView.tsx: dbPageSize/cellPreviewChars props 수신·전달, selectTable(table, dbPageSize)
- [x] admin App.tsx: configs에서 두 키 파싱 → DbManagerView props 전달
- [x] 검증: server tsc/빌드 통과 + pm2 재시작 online(9600), admin tsc 신규 에러 0건 + vite build 성공
- [x] API 수동: configs 시드 확인(20/200), rows 기본 size=20·page2·size=50 정상, open-explorer 파일→부모 디렉토리 성공/미존재 404
- [x] 이력 기록: docs/askLogs/ask-20260809231120.md, docs/todo.history.md, docs/ask.md 초기화

## 완료된 작업 (ask-20260809205823)
- [x] 기본 탭 개편: DOM 전송(라디오 전체/요소선택/프레임), 이미지 수집, 액션 실행(미개발 disabled) 아코디언+카드 구성 (BasicTab.tsx)
- [x] 요소 선택 모드, 프레임 수집, 이미지 수집(최대 50개, CORS 실패 시 URL 참조)
- [x] 터미널 공통화(TerminalConsole.tsx) + 현재 페이지 URL 자동 갱신(활성 탭 감시)
- [x] opera-plugin 동기화 + 서버 CRAWL_IMAGE 저장 + 문서/이력 기록

## 완료된 작업 (ask-20260809100542)
- [x] plugins/opera-plugin 신설 (sidebar_action, basic 기능 동일), 문서/ADR-006/이력 기록

## 완료된 작업 (ask-20260809)
- [x] 클라이언트 4컬럼 재구성 + 플러그인 메시지 원장/파일 저장 + CLIENT_CONFIG_UPDATE/ACK 근본 수정
- [x] 노드/워커 저장 경로 파일 브라우저 + data_path 폴백 연동
- [x] serverlogs DB(systemlog) + 초기 값 검증 + 파일 브라우저 버튼
- [x] configs 테이블 신설 + admin 환경 설정 메뉴

## 예정 작업 (ask-20260809)
- (없음)
