# 작업 이력

---

## 2026-08-10 | best-of-red 안정 우선 재설계 — 0페이지부터 전체 순회 + 실제 미디어 다운로드 + 저장 ACK 확인 후 이동

### 요청
- 16페이지가 아닌 **0페이지부터** 전체 순회할 것(`pageList = 0..maxPage`).
- 각 페이지의 `.thumb-block` 이미지(메인/보조 썸네일)와 `.videopv video` **프리뷰 mp4를 실제로 다운로드**해 저장할 것(JSON URL만 아님).
- HTML 문서만 로드되고 이동하지 말고, **네트워크/XHR 감시로 로드 완료를 검증**하고 페이지 정보 수집·파일 다운로드를 완벽하게 한 뒤 **재검증 후 다음 페이지로 이동**할 것.
- 총 이동할 페이징 정보를 **배열로 저장**해 하나씩 이동하며 수집·다운로드 완료 확인 후 이동하는 안정된 플로우 구성.
- (사용자 확정) 썸네일+preview 실제 다운로드 저장, 0건이어도 **빈 JSON 저장**.

### 확정된 상세 규격
- **페이지 범위**: `totalPages = maxPage + 1`, 페이지 0 = 베이스 URL(`/best-of-red/<월>`).
- **페이지당 안정 플로우(ACK 확인 후 다음 이동)**: 이동+로드 대기 → 수집(로드 검증, 최대 3회 재시도) → 미디어 실제 다운로드(`FETCH_PAGE_MEDIA_BUNDLES`, 오프스크린 동시성 3, `CRAWL_MEDIA_SAVED` ACK) → JSON 저장(`CRAWL_PARTIAL`+requestId → `CRAWL_PARTIAL_SAVED` ACK) → 600ms 후 다음 페이지.
- **로드 검증**: readyState complete + 네트워크 안정(XHR/fetch 인플라이트 0 + 리소스 엔트리 3회 동일) + DOM 안정(블록 수 3회) + 이미지 완료(no-img 제외), 400ms 폴링, 20초 데드라인.

### 완료된 작업 목록
- `plugins/basic-plugin/src/content.ts`: `installNetworkActivityWatch()`(XHR/fetch 패치 인플라이트), `waitForXvBestOfRedPageReady()` 재작성(네트워크+DOM+이미지 통합), `collectXvideosMediaEntries()` 보강(data-video 파싱·title/sfw/preview 폴백), INIT `totalPages = maxPage + 1`.
- `plugins/basic-plugin/src/types/index.ts`: `XvBestOfRedMediaResult`/`XvBestOfRedSavedFileInfo` 신규, `CrawlMediaBundlePayload.pathSegments` 추가.
- `plugins/basic-plugin/src/services/chromeService.ts`: `sendSocketPacket` ACK 반환 확장, `requestFetchPageMediaBundles()` 신규.
- `plugins/basic-plugin/src/offscreen.ts`: `partialSaveWaiters` + CRAWL_PARTIAL_SAVED ACK 해소, SEND_SOCKET_PACKET CRAWL_PARTIAL(requestId) ACK 보류(30초), `handleFetchPageMediaBundles()`(동시성 3, entryFiles 매핑, pathSegments 번들), FETCH_PAGE_MEDIA_BUNDLES 핸들러.
- `plugins/basic-plugin/src/hooks/useBestOfRedRunner.ts` 전면 개편: 0..maxPage 순회·3회 재시도·미디어 단계·JSON ACK 확인 후 이동·`XvBestOfRedRunSummary` + `ActionRunnerView.tsx` 완료 배너.
- `server/src/services/fileStorageService.ts`: `saveCrawledMediaBundle()` `pathSegments` 계층 저장. `server/src/index.ts`: CRAWL_IMAGE 번들 pathSegments 전달 + CRAWL_PARTIAL `CRAWL_PARTIAL_SAVED` ACK.
- opera-plugin 동기화 6종 + 양 플러그인 빌드 성공(각 56 모듈) + server tsc 빌드 통과 + pm2 재시작(포트 9600 HTTP 200) + `npx eslint .` 신규 문제 0건.
- 문서: R-00430 §5.5+§6, R-00480 §3.1, R-00420 §4.5, R-00208 §2.2/§2.3/§3.1/§3.2/§5, R-00440 §2.4+체크리스트, askLog 신규(ask-20260810225335), ask.md 초기화.

### 변경된 파일
- `plugins/basic-plugin/src/content.ts`, `plugins/basic-plugin/src/types/index.ts`, `plugins/basic-plugin/src/services/chromeService.ts`, `plugins/basic-plugin/src/offscreen.ts`, `plugins/basic-plugin/src/hooks/useBestOfRedRunner.ts`, `plugins/basic-plugin/src/components/ActionRunnerView.tsx`
- `plugins/opera-plugin/src/` 동일 6종
- `server/src/services/fileStorageService.ts`, `server/src/index.ts`
- `docs/rule/R-00430 plugin-crawling.md`, `docs/rule/R-00480 plugin-automation-crawling.md`, `docs/rule/R-00420 plugin-communication.md`, `docs/rule/R-00208 local-file-storage-system.md`, `docs/rule/R-00440 plugin-ui-ux.md`
- `docs/askLogs/ask-20260810225335.md`(신규), `docs/todo.md`

### 검증 결과
- 양 플러그인 `npm run build` 성공(각 56 모듈), server tsc 빌드 통과 → pm2 재시작(포트 9600 HTTP 200).
- `npx eslint .` 변경 파일 신규 문제 0건(기존 admin 오류·경고만 존재), opera-plugin 동기화 diff 0 확인.

### 보류 항목
- 브라우저 실측: 액션 실행기 팝업 → 0페이지부터 maxPage 전체 순회, 페이지별 로드 검증→수집→미디어 실제 다운로드(ACK)→JSON 저장(ACK) 로그, `<도메인>/best-of-red/<월>/<N>/` 물리 저장, 0건 빈 JSON, 완료 배너 실패 집계, [중지]/팝업 닫힘 중단 확인.

---

## 2026-08-10 | best-of-red 실측 버그 2건 + 저장 경로(`images/` 제거) 수정

### 요청
- best-of-red 자동 이동 실측에서 총 페이지가 과소 감지됨(`data-page="111"` 라벨 "112"까지 있는데 "전체 수집 완료 (17페이지, 총 17페이지)" 조기 종료).
- 진행 로그가 `데이터 수집 완료: undefined`·`서버 저장 완료: ... (0건)`으로 오표시됨.
- 저장 경로가 로그 표기와 달리 실제 저장 폴더에 없음. **기본 저장 폴더 → 도메인 폴더 → `best-of-red/2026-06/16/`** 아래 페이지별 저장을 요구(`images/` 없음).

### 확정된 상세 규격
- **마지막 페이지 111까지 전부 수집**: `.pagination` 최대 `data-page` 값을 그대로 신뢰(아웃라이어 대체 없음).
- **저장 경로**: `<기본경로>/xvideos.com/best-of-red/2026-06/16/page-16.json`.

### 원인 진단
1. `detectXvBestOfRedMaxPage`가 최댓값 111과 다음 값 16의 차이 ≥ 20을 아웃라이어로 간주해 16으로 대체 → 조기 종료.
2. 콘텐츠 스크립트가 페이지 메타를 응답 최상위로 반환, `requestXvBestOfRedPage`가 `res.data`(entries 배열)를 페이지 객체로 오인(`typeof [] === "object"`).
3. 서버 분기 코드가 pm2 실행 프로세스에 미반영 + `saveCrawlPartialToFile` 경로가 `images/` 포함.
   참고: `sendSocketPacket`은 오프스크린 수신 즉시 `success:true`이므로 "서버 저장 완료" 로그는 실제 저장을 보장하지 않는다.

### 완료된 작업 목록
- `plugins/basic-plugin/src/content.ts`: `detectXvBestOfRedMaxPage` 아웃라이어 가드 제거(`Math.max` 신뢰), [7-3] `COLLECT_BEST_OF_RED_PAGE` 응답 `data` 중첩.
- `server/src/services/fileStorageService.ts`: `saveCrawlPartialToFile` 경로 `resolve(rootPath, safeDomain, ...safeSegments)`로 `images/` 제거. `server/src/index.ts` 분기 주석 동기화.
- `plugins/opera-plugin/src/content.ts` 동기화(diff 0), 양 플러그인 재빌드 성공(각 56 모듈), server tsc 빌드 통과, pm2 재시작(포트 9600 HTTP 200), `npx eslint .` 신규 문제 0건.
- 문서: R-00430 §5.5+§6, R-00480 §3.1, R-00420 §4.5, R-00208 §2.3+§3.2+§5, R-00440 §2.4 — 감지 규칙("최대 data-page 신뢰")·저장 경로("`images/` 제거") 갱신, askLog 신규, ask.md 초기화.

### 변경된 파일
- `plugins/basic-plugin/src/content.ts`, `plugins/opera-plugin/src/content.ts`
- `server/src/services/fileStorageService.ts`, `server/src/index.ts`
- `docs/rule/R-00430 plugin-crawling.md`, `docs/rule/R-00480 plugin-automation-crawling.md`, `docs/rule/R-00420 plugin-communication.md`, `docs/rule/R-00208 local-file-storage-system.md`, `docs/rule/R-00440 plugin-ui-ux.md`
- `docs/askLogs/ask-20260810201945.md`(신규)

### 검증 결과
- 양 플러그인 `npm run build` 성공(각 56 모듈, content.js 11.18 kB / actionRunner.js 7.71 kB).
- server tsc 빌드 통과 → pm2 재시작(새 pid 67528) → `GET /api/admin/storage/status` HTTP 200.
- `npx eslint .` 변경 파일 신규 문제 0건, opera-plugin 동기화 diff 0 확인.

### 보류 항목
- 브라우저 실측: 0→111(총 112페이지) 순차 이동·행동 로그, `xvideos.com/best-of-red/2026-06/<N>/page-<N>.json` 물리 저장(`images/` 없음) 확인.

---

## 2026-08-10 | xvideos best-of-red 자동 이동 재설계 — 액션 실행기 팝업 주도 순차 이동

### 요청
- best-of-red 자동 이동이 **16페이지까지 진행하지 않는** 원인을 파악해 재설계한다. 페이지 전체를 수집한 뒤 **페이지 수대로 순차 이동**하고, 이미지 등이 모두 로드된 뒤 이동하도록 **로드 완료 상태를 검증**해야 한다.
- "best-of-red 자동 이동" 버튼을 이미지 수집이 아닌 **"액션 실행"**(정식 명칭) 하위 `xvideos.com` **액션 모듈**로 이동하고, 클릭 시 "다운로드 매니저 열기"처럼 **스크롤되는 팝업 창**에 **행동 로그**가 콘솔처럼 출력되어야 한다.
- 저장 경로: `https://www.xvideos.com/best-of-red/2026-06/16` → `best-of-red/2026-06/16` 아래 저장.

### 확정된 상세 규격
- **팝업 종료 시 중단 OK**: 진행 상태는 액션 실행기 전용 팝업 창(`action-runner.html?module=best-of-red&tabId=N`, 900×760)이 보유하며, 팝업을 닫으면 중단된다.
- **파일명 규칙**: 페이지별 저장 파일명 `page-<N>.json`.
- **원인 진단·대응**: 구 `detectXvBestOfRedMaxPage`는 현재 페이지부터 +1 연속 블록 끝값만 사용해 윈도우 페이지네이션에서 마지막 페이지를 놓칠 수 있었음 → ① 최댓값(차이 ≥ 20 아웃라이어 대체)과 ② 연속 블록 끝값 중 **큰 값** 채택. 무작위 이동 제거, +1 순차 이동, `chrome.tabs.onUpdated` complete+경로 일치(30초 타임아웃) 대기, 콘텐츠 스크립트 `waitForXvBestOfRedPageReady()`(readyState complete + 썸네일 이미지 로딩 완료, 4초 상한) 검증 후 수집.
- **저장 규격**: `CRAWL_PARTIAL` payload에 `pathSegments: ["best-of-red","<월>","<N>"]`+`fileName: "page-<N>.json"` → 서버 `saveCrawlPartialToFile()`로 `images/<도메인>/best-of-red/<월>/<N>/page-<N>.json` 물리 저장.

### 완료된 작업 목록
- `plugins/basic-plugin/src/content.ts`: 구 세션 엔진(세션 영속화/엔진/`START_XVIDEOS_BEST_OF_RED`) 제거, `COLLECT_BEST_OF_RED_INIT`/`COLLECT_BEST_OF_RED_PAGE` 핸들러, `waitForXvBestOfRedPageReady()`, `detectXvBestOfRedMaxPage()` 강화.
- `plugins/basic-plugin/src/hooks/useBestOfRedRunner.ts`(신규): 상태머신(idle/init/running/completed/stopped/error), +1 순차 이동, `waitForTabComplete`, `CRAWL_PARTIAL pathSegments` 전송, 로그 300건 상한.
- `plugins/basic-plugin/src/actionRunner.tsx`+`src/components/ActionRunnerView.tsx`+`action-runner.html`(신규): 모듈/탭 쿼리 파싱, 상태 배지·진행률 바·행동 로그 콘솔·시작/중지·완료 배너.
- `plugins/basic-plugin/vite.config.ts`: `actionRunner` 엔트리 추가.
- `plugins/basic-plugin/src/services/chromeService.ts`: `requestXvBestOfRedInit/Page` 추가(`requestStartXvideosBestOfRed` 제거).
- `plugins/basic-plugin/src/hooks/usePopupState.ts`: `handleOpenXvBestOfRedAction`(xvideos 탭 탐색→windows.create) 신규.
- `plugins/basic-plugin/src/components/tabs/BasicTab.tsx`: "액션 실행" 섹션 정식화(xvideos.com 액션모듈 카드·best-of-red 자동 이동 버튼) + popup/sidepanel/types 반영.
- `server/src/services/fileStorageService.ts`: `saveCrawlPartialToFile()` + `server/src/index.ts` CRAWL_PARTIAL `pathSegments` 분기.
- `plugins/opera-plugin/` 동일 12종 동기화(복사 + 헤더 주석 교체).
- 문서: R-00430 §5.5+§6, R-00480 §3.1, R-00440 §2.3+§2.4+§5, R-00420 §4.5+§5, R-00208 §2.3+§3.2+§5 갱신, askLog 신규.

### 변경된 파일
- `plugins/basic-plugin/src/content.ts`, `src/hooks/useBestOfRedRunner.ts`(신규), `src/actionRunner.tsx`(신규), `src/components/ActionRunnerView.tsx`(신규), `action-runner.html`(신규), `src/services/chromeService.ts`, `src/hooks/usePopupState.ts`, `src/components/tabs/BasicTab.tsx`, `src/popup.tsx`, `src/sidepanel.tsx`, `src/types/index.ts`, `vite.config.ts`
- `plugins/opera-plugin/` 동일 12종 (동기화)
- `server/src/services/fileStorageService.ts`, `server/src/index.ts`
- `docs/rule/R-00430 plugin-crawling.md`, `docs/rule/R-00480 plugin-automation-crawling.md`, `docs/rule/R-00440 plugin-ui-ux.md`, `docs/rule/R-00420 plugin-communication.md`, `docs/rule/R-00208 local-file-storage-system.md`
- `docs/askLogs/ask-20260810175719.md`(신규)

### 검증 결과
- server `npm run build`(tsc) 통과.
- basic-plugin/opera-plugin `npm run build` 성공(각 56 모듈, `action-runner.html`+`actionRunner.js` 포함).
- dist/content.js에서 구 세션 엔진 문자열(`xvBofR`/`maybeResumeXvBestOfRed`/`START_XVIDEOS_BEST_OF_RED`) 완전 제거 확인, `COLLECT_BEST_OF_RED_INIT`/`waitForXvBestOfRedPageReady` 포함 확인.
- `npx eslint .`: 변경 파일 신규 문제 0건(기존 admin/ 파일 에러와 server/index.ts 기존 경고만 존재).
- opera-plugin 동기화 12종 일치(헤더 경로만 교체) 확인.

### 보류 항목
- 브라우저 실측: 액션 실행 xvideos.com 모듈 → 액션 실행기 팝업(900×760) 열림 → 총 페이지 감지 → 페이지별 이동/로딩 완료/수집/서버 저장 로그 → `page-<N>.json` 물리 저장, 팝업 닫기·[중지] 중단 확인.

---



## 2026-08-10 | xvideos best-of-red 자동 페이징 이동 수집

### 요청
- `https://www.xvideos.com/best-of-red/<월>/` 주소에서 액션 실행 버튼을 누르면 **0페이지부터 16페이지까지 자동으로 이동하며 각 페이지의 비디오 메타를 수집**한다.

### 확정된 상세 규격
- 사이드바/팝업 xvideos 그룹에 **"best-of-red 자동 이동"** 버튼을 추가하고, 현재 페이지부터 페이지네이션(`.pagination a[data-page]` 연속 블록)의 마지막 페이지까지 **URL 직접 이동**하며 `.thumb-block` 비디오 메타를 기존 `collectXvideosMediaEntries()` 규칙으로 수집해 `CRAWL_PARTIAL`(json)로 서버에 누적 전송한다.
- 페이지 이동으로 콘텐츠 스크립트 컨텍스트가 파괴·재주입되므로 진행 상태를 `sessionStorage` 키 `xvBofR`에 영속화하고, 재주입 시 `maybeResumeXvBestOfRed()`가 세션을 이어받는다. 완료 시 세션 정리, 예상 URL 불일치(사용자 이탈) 시 중단한다.

### 완료된 작업 목록
- `plugins/basic-plugin/src/content.ts`: best-of-red 상수/타입(`XvBestOfRedState` 등) + 세션 저장/정리·URL 파싱·maxPage 감지·패킷 전송·엔진·재개·시작 함수, `START_XVIDEOS_BEST_OF_RED` [7-2] 메시지 분기(동기 응답), 최하단 `maybeResumeXvBestOfRed()` 호출, `collectXvideosMediaEntries()` 셀렉터 `.thumb-block:not(.thumb-ad)` 보강.
- `plugins/basic-plugin/src/services/chromeService.ts`: `requestStartXvideosBestOfRed()` — `sendCommandToActiveTab("START_XVIDEOS_BEST_OF_RED")` 래퍼.
- `plugins/basic-plugin/src/hooks/usePopupState.ts`: `handleRunXvBestOfRed()` 핸들러 + return 반영.
- `plugins/basic-plugin/src/components/tabs/BasicTab.tsx`: `onRunXvBestOfRed` prop + `isXvBestOfRedUrl()` 판별 + xvideos 그룹 best-of-red 자동 이동 버튼(best-of-red 페이지에서만 활성화).
- `plugins/basic-plugin/src/popup.tsx`/`src/sidepanel.tsx`: `onRunXvBestOfRed` props 배선.
- `plugins/opera-plugin/` 동일 6종 동기화(복사 + 헤더 주석 교체).
- 문서: R-00430 §5.5+§6, R-00480 §3.1, R-00440 §2.3, R-00420 §4.5 갱신.

### 변경된 파일
- `plugins/basic-plugin/src/content.ts`, `src/services/chromeService.ts`, `src/hooks/usePopupState.ts`, `src/components/tabs/BasicTab.tsx`, `src/popup.tsx`, `src/sidepanel.tsx`
- `plugins/opera-plugin/` 동일 6종 (동기화)
- `docs/rule/R-00430 plugin-crawling.md`, `docs/rule/R-00480 plugin-automation-crawling.md`, `docs/rule/R-00440 plugin-ui-ux.md`, `docs/rule/R-00420 plugin-communication.md`
- `docs/askLogs/ask-20260810163514.md`(신규)

### 검증 결과
- basic-plugin/opera-plugin `npm run build` 성공(각 52 모듈).
- 동기화 6종 일치(헤더 경로만 교체) 확인.
- `eslint` 전체 수정 파일 12종 통과(exit 0).
- dist/content.js에 `START_XVIDEOS_BEST_OF_RED`/`xvBofR` 포함 확인.

### 잔여 사항
- 브라우저 실측: best-of-red 월간 페이지에서 버튼 활성화 → 클릭 시 현재~마지막 페이지 자동 이동 → 각 페이지 비디오 메타 서버 누적 저장, 완료 시 세션 정리·이탈 시 중단 확인.

---

## 2026-08-10 | xvideos 단일 영상 페이지(플레이어) 포스터 이미지·타이틀 추출

### 요청
- xvideos.com 미디어 다운로드에서 단일 영상 페이지(플레이어)의 포스터 이미지(`.video-bg-pic .video-pic img`)와 타이틀(`.video-title`)을 추출하고, **이미지 1개만** 다운로드한다.

### 확정된 상세 규격
- 단일 영상 페이지에서 **포스터 이미지 1종 + 타이틀**을 목록 1건으로 구성한다. 영상 자체(blob 스트리밍)는 다운로드하지 않는다.
- `sfwUrl`/`previewUrl`는 빈 문자열로 두고, 기존 흐름(오프스크린 빈 자산 스킵 → 서버 빈 자산 건너뜀 → 이미지 1종 + txt만 저장)을 그대로 재사용한다.

### 완료된 작업 목록
- `plugins/basic-plugin/src/content.ts`: `isXvideosVideoPage()`(URL `/video` 접두사 또는 `#html5video`/`.video-bg-pic` DOM 존재) + `collectXvideosVideoPageEntry()`(포스터 `.video-bg-pic .video-pic img`/타이틀 `.video-title`/현재 URL/EID) 추가, `COLLECT_XVIDEOS_MEDIA` 핸들러에 단일 영상 페이지 폴백(응답 message에 소스 명시).
- `plugins/basic-plugin/src/types/index.ts`: `XvideosMediaEntry` JSDoc에 "단일 영상 페이지에서는 빈 문자열" 명시.
- `plugins/basic-plugin/src/components/XvideosManagerView.tsx`: 빈 목록 안내 문구에 단일 영상 페이지(포스터 1종) 파싱 안내 추가.
- `plugins/opera-plugin/` 동일 3종 동기화(복사 + 헤더 주석 교체).
- 문서: R-00430 §5.4(단일 영상 페이지 폴백 규격), R-00420 §4.5(명령 규격) 갱신.

### 변경된 파일
- `plugins/basic-plugin/src/content.ts`, `src/types/index.ts`, `src/components/XvideosManagerView.tsx`
- `plugins/opera-plugin/` 동일 3종 (동기화)
- `docs/rule/R-00430 plugin-crawling.md`, `docs/rule/R-00420 plugin-communication.md`
- `docs/askLogs/ask-20260810071013.md`(신규)

### 검증 결과
- basic-plugin/opera-plugin `npm run build` 성공.
- 동기화 3종 일치(헤더 경로만 교체) 확인.
- dist/content.js에 `video-bg-pic` 셀렉터 문자열 포함 확인(미니파이드).

### 잔여 사항
- 브라우저 실측: 영상 재생 페이지에서 매니저 열기 → 현재 영상 1건 목록 생성 → 다운로드 진행 → 포스터 이미지 1종 + txt만 저장 확인.

---

## 2026-08-10 | xvideos 다운로드 매니저 새창 페이지 전체 스크롤

### 요청
- "xvideos 다운로드 매니저 새창이 스크롤 될게 해달라고 아래 데이터를 확인 할수가 없어."

### 확정된 상세 규격
- 매니저 창을 **페이지 레벨로 통째로 스크롤** — 목록·버튼·로그를 포함한 아래 데이터까지 항상 확인 가능하게 한다.
- 원인: `popup.css` 전역 `html, body { overflow: hidden }`이 매니저 페이지에도 적용되어 페이지 스크롤이 원천 차단됨.

### 완료된 작업 목록
- `plugins/basic-plugin/xvideos-manager.html`: `<html lang="ko">` → `<html lang="ko" class="manager-scrollable">` (Vite 빌드 시 클래스 유지, dist 반영 확인).
- `plugins/basic-plugin/src/popup.css`: `html.manager-scrollable { overflow-y: auto }` + 웹킷/파이어폭스 가시 스크롤바(thumb `#475569`·hover `#64748b`, track `#0a0e17`) 추가 — 클래스 선택자가 전역 `html` 규칙보다 높은 특이성으로 우선 적용.
- `plugins/basic-plugin/src/components/XvideosManagerView.tsx`: 루트 `w-full h-screen … overflow-hidden` → `w-full min-h-screen …`(overflow-hidden 제거), 목록 컨테이너에서 `flex-1 min-h-0 overflow-y-auto` 제거 → 자연 높이로 펼쳐지고 창 스크롤로 전 항목 도달.
- `plugins/basic-plugin/src/xvideosManager.tsx`: 로딩/에러 뷰의 `h-screen` → `min-h-screen` 통일.
- `plugins/opera-plugin/` 동일 4종 동기화(복사 + 헤더 주석 교체).
- 문서: R-00440 §2.3(페이지 전체 스크롤 규격), R-00430 §5.4 갱신.

### 변경된 파일
- `plugins/basic-plugin/xvideos-manager.html`, `src/popup.css`, `src/components/XvideosManagerView.tsx`, `src/xvideosManager.tsx`
- `plugins/opera-plugin/` 동일 4종 (동기화)
- `docs/rule/R-00440 plugin-ui-ux.md`, `docs/rule/R-00430 plugin-crawling.md`
- `docs/askLogs/ask-20260810065244.md`(신규)

### 검증 결과
- basic-plugin/opera-plugin `npm run build` 성공(각 52 모듈).
- dist `xvideos-manager.html`에 `class="manager-scrollable"` 유지 확인(양 플러그인).
- 동기화 검증: opera-plugin 4종이 헤더 경로만 제외하고 basic-plugin과 동일.

### 잔여 사항
- 브라우저 실측 확인: 매니저 새창에서 페이지 전체(목록→버튼→로그)가 스크롤되고 아래 데이터가 확인되는지, 가시 스크롤바 표시 여부 확인.

---

## 2026-08-10 | xvideos 다운로드 매니저 개선 — 목록 스크롤바·이미지 URL 주소 표시·항목별 프로그레스 바

### 요청
- "플러그인에서 xvideos.com 미디어 목록 하게 되면 다운로드목록 창이 나오는데 스크롤 바가 없어. 스크롤 바가 생기게 해주고."
- "이미지 리스트가 안 보여."
- "하나씩 다운로드 진행되고 완료된다는 프로그래스 바도 있어야 되지 않겠어? 각 개체마다."
- 추가 설명: "이미지 리스트란 이미지 다운로드 받을 이미지 주소야. 이미지 썸네일을 미리 보는 건 아니야."

### 확정된 상세 규격 (사용자 승인)
- 스크롤바: 목록 컨테이너에 커스텀 가시 스크롤바(`.manager-list-scroll`, thumb `#475569`·hover `#64748b`, track `#0a0e17`) 적용 — `color-scheme: dark` 기본 다크 스크롤바가 어두운 배경과 구분 안 되는 문제 해소.
- 이미지 리스트: 썸네일 미리보기가 아니라 **다운로드 대상 이미지 URL 주소 3종**(`image_url`/`sfw_image_url`/`preview_video_url`)을 항목별로 `break-all`+선택 복사 가능하게 표시.
- 프로그레스 바: 오프스크린 단계 이벤트 기반 실제 % — 시작 0% 스카이 쉬머(`progress-bar-indeterminate`) → 메인 30/보조 55/프리뷰 80/서버 전송 95 → 완료·실패 100%.

### 완료된 작업 목록
- `plugins/basic-plugin/src/offscreen.ts`: `broadcastFetchProgress(bundleId, progress)` 헬퍼 신설(`chrome.runtime.sendMessage` + `.catch()` 가드), `handleFetchMediaBundle`에서 메인 인출 30/보조 55/프리뷰 80/서버 전송 95 단계마다 `FETCH_MEDIA_BUNDLE_PROGRESS` 브로드캐스트.
- `plugins/basic-plugin/src/types/index.ts`: `XvideosDownloadItem`에 `progress: number`(0~100) 추가, 신규 `FetchMediaBundleProgressPayload` 타입 정의.
- `plugins/basic-plugin/src/hooks/useXvideosDownloadManager.ts`: 항목 생성 시 `progress: 0`, 진행 시작 시 리셋, `chrome.runtime.onMessage` 리스너(FETCH_MEDIA_BUNDLE_PROGRESS를 bundleId로 매칭해 progress 갱신, 0~100 클램프), done/failed 시 progress 100 확정.
- `plugins/basic-plugin/src/components/XvideosManagerView.tsx`: 목록 컨테이너에 `.manager-list-scroll`, `DownloadListItem`에 이미지 URL 3줄(라벨+break-all)과 항목별 프로그레스 바(진행 0% 쉬머 인디케이터/이후 실제 % 스카이 바/완료 에메랄드 100/실패 레드 100, 우측 % 숫자) 추가.
- `plugins/basic-plugin/src/popup.css`: `.manager-list-scroll` 웹킷/파이어폭스 스크롤바 + `.progress-bar-indeterminate`/`@keyframes manager-progress-shimmer` 애니메이션 추가.
- `plugins/opera-plugin/` 동일 5종 동기화(복사 + 헤더 주석 교체).
- 문서: R-00440 §2.3(URL 주소 표시·프로그레스 바·스크롤바), R-00420 §4.5(FETCH_MEDIA_BUNDLE_PROGRESS 규격)·§5, R-00430 §5.4·§6 갱신.

### 변경된 파일
- `plugins/basic-plugin/src/offscreen.ts`, `src/types/index.ts`, `src/hooks/useXvideosDownloadManager.ts`, `src/components/XvideosManagerView.tsx`, `src/popup.css`
- `plugins/opera-plugin/` 동일 5종 (동기화)
- `docs/rule/R-00440 plugin-ui-ux.md`, `docs/rule/R-00420 plugin-communication.md`, `docs/rule/R-00430 plugin-crawling.md`
- `docs/askLogs/ask-20260810064441.md`(신규)

### 검증 결과
- basic-plugin/opera-plugin `npm run build` 성공(각 52 모듈, offscreen.js 5.33 kB·xvideosManager.js 10.42 kB로 진행 이벤트·URL·바 반영).
- 동기화 검증: opera-plugin 5종이 헤더 경로만 제외하고 basic-plugin과 동일.

### 잔여 사항
- 브라우저 실측 확인: 매니저 창 목록 스크롤바 표시, 항목별 이미지 URL 주소 3줄 표시, 진행 시 프로그레스 바(쉬머→%→완료) 및 저장 배지 갱신 확인.

---

## 2026-08-10 | xvideos 다운로드 매니저 전용 팝업 창 분리 — 사이드바 버튼만 유지·2열 그리드 목록

### 요청
- "xvideos.com 미디어 목록 하게 되면 패널 아래로 주르륵 나오는데 창 범위를 벗어난다. 오픈 창으로 새롭게 나오던지 아니면 브라우저에 블랭크 가상 페이지를 만들고 거기서 출력하고 진행 버튼을 만들던지 해야지 패널 안으로 리스트가 나오면 화면이 좁아서 안 된다."

### 확정된 상세 규격 (사용자 승인)
- 사이드바 xvideos 그룹은 **"다운로드 매니저 열기" 버튼만** 유지하고, 목록·진행·초기화 UI는 **전용 팝업 창(`chrome.windows.create`, type: "popup", 900×760)**으로 분리한다.
- 매니저 창은 대상 xvideos 탭(`?tabId=`)을 쿼리로 전달받아 `requestCollectXvideosMediaFromTab(tabId)`로 목록을 생성하며, 오프스크린 기존 파이프라인(`mediaAckWaiters` 60초 / `storageLocationWaiter` 15초)을 무수정 재사용한다.

### 완료된 작업 목록
- `plugins/basic-plugin/vite.config.ts`: `rollupOptions.input`에 `xvideosManager: resolve(__dirname, "xvideos-manager.html")` 엔트리 추가(기존 sidepanel/offscreen/background/content 유지 → 엔트리 5종).
- `plugins/basic-plugin/xvideos-manager.html` 신규: root div + Noto Sans CDN + `./src/xvideosManager.tsx` 로드.
- `plugins/basic-plugin/src/hooks/useXvideosDownloadManager.ts` 신규: 모듈 함수 `extFromUrl`/`buildXvideosTxtContent`(usePopupState에서 이관) + `useXvideosDownloadManager()` 훅 — state(`downloadList`/`isRunning`/`pageUrl`/`storageDir`/`relDir`/`statusMessage`/`logs`), `addLog`(200건 상한), `buildList(tabId)`(목록 생성+중복 제거+저장 위치 조회), `startQueue()`(순차 진행, done/failed 집계), `reset()`, 타입 `XvideosManagerLog`/`XvideosManagerLogLevel`.
- `plugins/basic-plugin/src/services/chromeService.ts`: `sendCommandToActiveTab` 일반화 `sendCommandToTab(tabId, command, payload)` 신설(콘텐츠 스크립트 미주입 탭은 content.js 주입 후 자동 재시도), 기존 active-tab 함수는 이를 호출하도록 리팩터, `requestCollectXvideosMediaFromTab(tabId)` 추가.
- `plugins/basic-plugin/src/xvideosManager.tsx` 신규: React root(`StrictMode`+`createRoot`), `tabId` 쿼리 파싱(`chrome.tabs.get` 검증 → `chrome.tabs.query` 폴백) → initError 표시("xvideos.com 탭을 찾을 수 없습니다..."), 최초 자동 목록 생성(`builtOnce`).
- `plugins/basic-plugin/src/components/XvideosManagerView.tsx` 신규: `XvideosManagerApi` 타입, 전체 레이아웃(헤더/제목+pageUrl+닫기, 저장 위치+상태 메시지, 2열 그리드 항목 목록, 버튼 3종(목록 생성/진행/초기화), 로그 터미널), `getDownloadStatusInfo`(대기/다운로드/완료/실패)/`DownloadListItem`/`LogLine` 컴포넌트. `popup.css`의 `btn-primary`/`btn-secondary`/`btn-mini` 토큰 재사용.
- `plugins/basic-plugin/src/components/tabs/BasicTab.tsx`: xvideos Props 6종 → `onOpenXvideosManager` 1종 교체, 카테고리 버튼 라벨을 "다운로드 매니저 열기"로 변경, 인라인 목록/진행/초기화/저장위치 JSX 제거.
- `plugins/basic-plugin/src/hooks/usePopupState.ts`: xvideos state 5종 및 관련 import 제거, 기존 목록/진행 핸들러를 `handleOpenXvideosManager`(xvideos 탭 검색 → `chrome.windows.create` 팝업)로 교체, return 객체 반영.
- `plugins/basic-plugin/src/sidepanel.tsx`/`popup.tsx`: BasicTab props를 `onOpenXvideosManager={handleOpenXvideosManager}`로 교체, `public/manifest.json`(basic·opera 양쪽)에 `"windows"` 권한 추가.
- `plugins/opera-plugin/` 동기화(신규 3종 + `xvideos-manager.html` + `vite.config.ts` + 수정 5종 복사 및 헤더 주석 교체), `background.ts`는 `chrome.sidePanel?.` 옵셔널 처리 차이로 의도적 유지.
- 문서: R-00440 §2.3(매니저 팝업 창 UI 규격 신설), R-00430 §5.4(목록 이관·`requestCollectXvideosMediaFromTab` 반영)·§6, R-00420 §4.5(주체 사이드바→매니저 창), R-00450(엔트리 4→5) 갱신.

### 변경된 파일
- `plugins/basic-plugin/vite.config.ts`, `xvideos-manager.html`, `src/xvideosManager.tsx`, `src/components/XvideosManagerView.tsx`, `src/hooks/useXvideosDownloadManager.ts`
- `plugins/basic-plugin/src/services/chromeService.ts`, `src/hooks/usePopupState.ts`, `src/components/tabs/BasicTab.tsx`, `src/sidepanel.tsx`, `src/popup.tsx`
- `plugins/basic-plugin/public/manifest.json`, `plugins/opera-plugin/public/manifest.json`
- `plugins/opera-plugin/` 신규 3종 + html + vite.config + 수정 5종 (동기화)
- `docs/rule/R-00440 plugin-ui-ux.md`, `docs/rule/R-00430 plugin-crawling.md`, `docs/rule/R-00420 plugin-communication.md`, `docs/rule/R-00450 plugin-build-env.md`
- `docs/askLogs/ask-20260810061757.md`(신규)

### 검증 결과
- basic-plugin/opera-plugin `npm run build` 성공(각 52 모듈, `xvideos-manager.html` + `xvideosManager.js` 8.73 kB 생성, 공용 CSS `chromeService.css` 공유 청크).
- 동기화 검증: opera-plugin 파일이 헤더 경로만 제외하고 basic-plugin과 동일, `plugins/basic-plugin` 잔존 참조 0건.

### 잔여 사항
- 브라우저 실측 확인: 사이드바 버튼 → 매니저 창(900×760) 열림, 대상 탭 목록 자동 생성(중복 제거·상한 없음), 진행 시 txt+썸네일2종+preview.mp4 저장 및 완료/실패 배지, 닫기·초기화·로그 출력 확인.

---

## 2026-08-10 | xvideos.com 미디어 다운로드 매니저 — txt 참조 저장·3자산 번들 저장·DownloadThemAll식 목록 UI

### 요청
- "xvideos.com 이미지 수집 시 `.url` 참조 파일 대신 `.txt` 파일로 저장되게 하고, txt에 `click_url`/`title` 메타를 수집해서 추가하고 싶다."
- "실제 이미지(`xv_24_t.jpg` 메인·`xv_3_t.jpg` 보조)와 프리뷰 `preview.mp4`를 플러그인에서 서버 저장 위치를 받아 직접 다운로드해 저장하고 싶다. 서버 다운로드는 차단되고 오페라 브라우저 VPN 기능이 있으므로 오페라 플러그인에서 직접 내려받아 저장하는 방식을 쓰겠다."
- "다운로드 상한 없이 DownloadThemAll처럼 다운로드 목록을 만들고 진행 버튼을 누르면 순차 다운로드하면서 완료 표시, 동일 주소 중복 제거를 원한다."

### 확정된 상세 규격 (사용자 협의)
- 흐름: 콘텐츠 스크립트가 `.thumb-block` 전량 파싱(상한 없음, `no-img.png` 제외, clickUrl 중복 제거) → 사이드바 목록 UI → [진행] 시 오프스크린이 3자산 fetch(CORS 우회 + 오페라 VPN) → `CRAWL_IMAGE` 번들(assets[3] + txtContent) WebSocket 전송 → 서버가 `images/xvideos.com/normal/<ts>-<seq>.txt` + `<baseName>_thumb/sfw/preview.<ext>` 저장 → `CRAWL_MEDIA_SAVED` ACK(저장 경로) → 항목 상태 완료 표시.
- 다운로드 폴더 변경 불가 → `chrome.downloads` 직접 저장 포기, **오프스크린 fetch → 서버 물리 저장** 채택. txt는 플러그인이 생성(서버는 원문 그대로 저장). 상한 없음.
- txt 포맷: `# WebCrawlServer 이미지 참조 파일` / `# 인출 방식: 플러그인 직접 다운로드 (오페라 VPN)` / page_url / image_url / click_url / title / [sfw_image_url] / [preview_video_url] / saved_files 목록.

### 완료된 작업 목록
- `server/src/services/fileStorageService.ts`: 실패 참조 확장자 `.url`→`.txt`(전역), `SaveCrawledImageOptions`에 `clickUrl`/`title` 추가, `mimeToExtension`에 `video/mp4`/`video/webm` 추가, 신규 `saveCrawledMediaBundle()`(txt+자산 일괄 저장, 실패 자산 data 빈 문자열 스킵, `savedDir`/`savedFiles` 반환).
- `server/src/index.ts`: `GET_STORAGE_LOCATION` 액션 신설(→`STORAGE_LOCATION_RESPONSE` absDir/relDir 응답). CRAWL_IMAGE 분기에서 `payloadObj.assets` 배열 감지 시 번들 저장 + `CRAWL_MEDIA_SAVED` ACK(bundleId/savedDir/savedFiles) 응답, 기존 단일 이미지 분기 유지.
- `plugins/basic-plugin/src/types/index.ts`: `XvideosMediaEntry`/`MediaAssetPayload`/`CrawlMediaBundlePayload`/`StorageLocationRequestPayload`/`StorageLocationResponsePayload`/`CrawlMediaSavedAckPayload`/`XvideosDownloadStatus`/`XvideosDownloadItem` 신설.
- `plugins/basic-plugin/src/content.ts`: 신규 `collectXvideosMediaEntries()`(`.thumb-block` 전량 파싱, `resolveImageSource` 재사용, no-img/assets-cdn77 제외, `.videopv a`→closest a[href]→thumb a 순 clickUrl, `.thumb-under .title a[title]` 우선 title, eid 정규식 `/video\.([a-z0-9]+)\//i`) + `COLLECT_XVIDEOS_MEDIA` 명령 핸들러(entries+pageUrl 응답).
- `plugins/basic-plugin/src/offscreen.ts`: `mediaAckWaiters` Map(bundleId→해소, 60초 타임아웃)/`storageLocationWaiter`(15초 타임아웃), `arrayBufferToBase64()`/`extractMediaFileName()`/`fetchAssetAsBase64()`(credentials:"omit", 실패 시 빈 data), `handleFetchMediaBundle()`(3자산 순차 인출→번들 전송→ACK 대기), `GET_STORAGE_LOCATION`/`FETCH_MEDIA_BUNDLE` 메시지 핸들러, `CRAWL_MEDIA_SAVED`/`STORAGE_LOCATION_RESPONSE` 수신 해소 로직.
- `plugins/basic-plugin/src/services/chromeService.ts`: `requestCollectXvideosMedia()`/`requestStorageLocation()`/`requestFetchMediaBundle()` 신설.
- `plugins/basic-plugin/src/hooks/usePopupState.ts`: xvideos 매니저 state 5종(`xvideosDownloadList`/`isXvideosQueueRunning`/`xvideosPageUrl`/`xvideosStorageDir`/`xvideosRelDir`) + `extFromUrl`/`buildXvideosTxtContent`/`handleBuildXvideosDownloadList`(목록 생성+저장 위치 조회)/`handleStartXvideosDownloads`(순차 진행, done/failed 실시간 집계)/`handleResetXvideosDownloadList`, `getPacketLogType`에 `CRAWL_MEDIA_SAVED`/`STORAGE_LOCATION_RESPONSE` success 처리.
- `plugins/basic-plugin/src/components/tabs/BasicTab.tsx`: Props 6종 추가, `getDownloadStatusInfo()`(대기/다운로드/완료/실패 배지), xvideos.com "normal" 버튼을 미디어 다운로드 목록 생성으로 연결, DownloadThemAll식 매니저 패널(저장 위치 절대경로/항목 상태 목록/진행·초기화 버튼) JSX 추가.
- `plugins/basic-plugin/src/sidepanel.tsx`/`popup.tsx`: BasicTab에 xvideos 6종 props 전달.
- `plugins/opera-plugin/` 동일 8종 동기화(복사 + 헤더 주석 교체), `background.ts`는 `chrome.sidePanel?.` 옵셔널 처리 차이로 의도적 유지.
- 문서: R-00208 §2.1(참조 `.txt`/click_url·title 포맷)·§2.2(미디어 번들 저장 규격)·§3.1(`saveCrawledMediaBundle` API)·§5, R-00430 §5.4(xvideos 파싱)·§6, R-00420 §4.5(번들 통신 규격·ACK 대기)·§5 갱신.

### 변경된 파일
- `server/src/services/fileStorageService.ts`, `server/src/index.ts`
- `plugins/basic-plugin/src/types/index.ts`, `content.ts`, `offscreen.ts`, `services/chromeService.ts`, `hooks/usePopupState.ts`, `components/tabs/BasicTab.tsx`, `sidepanel.tsx`, `popup.tsx`
- `plugins/opera-plugin/src/` 동일 8종 (동기화)
- `docs/rule/R-00208 local-file-storage-system.md`, `docs/rule/R-00430 plugin-crawling.md`, `docs/rule/R-00420 plugin-communication.md`
- `docs/askLogs/ask-20260810051720.md`(신규)

### 검증 결과
- basic-plugin/opera-plugin `npm run build` 성공(각 48 모듈, offscreen.js 5.11 kB·content.js 8.98 kB·sidepanel.js 225.30 kB).
- server `npm run build`(tsc) 성공 → pm2 `WebCrawlServer` 재시작 후 online(9600), dist에 `GET_STORAGE_LOCATION`/`STORAGE_LOCATION_RESPONSE`/`CRAWL_MEDIA_SAVED`/`saveCrawledMediaBundle` 포함 확인.

### 잔여 사항
- 브라우저 실측 확인: xvideos.com에서 목록 생성(clickUrl 중복 제거·상한 없음) → 진행 시 txt+썸네일2종+preview.mp4가 `images/xvideos.com/normal/`에 저장되고 항목 상태 배지가 완료/실패로 갱신되는지 확인.

---

## 2026-08-10 | 플러그인 UI/스타일 정비 — 폰트 아이콘 제거·터미널·이미지 수집 정돈·버튼 가시성

### 요청
- "플러그인에 폰트 아이콘 등은 제거해 줬으면 좋겠다. 터미널 출력 부분·입력 부분, 이미지 수집 부분들의 스타일이 정돈되어야 한다."
- "버튼인데 흰글씨에 흰바탕이면 보이지도 않는다. 일관적인 스타일, 가급적 아이콘 배제."
- "플러그인의 UI 디자인을 보고 개선점을 찾아라. 특히 스타일 부분, 버튼들의 색과 폰트 색 등이 엉망인 것 같다."

### 확정된 상세 규격 (사용자 협의)
- Material Symbols 폰트 아이콘 **전부 제거**(22곳), 아코디언 열림/닫힘만 유니코드 `▼`/`▶` 허용
- 버튼 색상: **파랑 단일화 + 앰버 유지** — 주 실행 파랑 그라데이션 통일, `요소 선택` 모드만 앰버, 설정탭 `#1A73E8` 제거
- 버튼 가시성: 비활성 상태를 `opacity` 대신 **명시적 고대비 색상**으로 표시

### 완료된 작업 목록
- `plugins/basic-plugin/src/popup.css`: Material Symbols `@import`(google fonts CDN) 제거. 공통 버튼 토큰 신설 — `btn-primary`(파랑 그라데이션, 비활성 `#1e293b`/`#334155` 테두리/`#94a3b8` 글씨), `btn-accent`(앰버), `btn-secondary`(보조 그리드, 비활성 `#64748b`), `btn-mini`(소형 다크, ON 에메랄드). `terminal-log-line`/`terminal-log-time`(타임스탬프 계층 + 호버) 및 `terminal-input`(박스형 + sky 포커스 링) 추가. 기존 `.send-button`/`.send-button-accent` 제거.
- 폰트 아이콘 22곳 전면 제거: `Header.tsx`(로고→파랑 도트 배지), `TerminalConsole.tsx`(terminal), `BasicTab.tsx` 16곳(data_object/image/play_circle/link/web/ads_click/web_stories/photo_library/public/카테고리 4종/스피너) → 텍스트 레이블 + `▼/▶`, `getSendButtonIcon()` 삭제, `DebugTab.tsx`(send), `InfoTab.tsx` 2곳, `SettingsTab.tsx`(settings). HTML 3종(popup.html, sidepanel.html, public/sidepanel.html) Material CDN `<link>` 제거.
- `BasicTab.tsx`/`DebugTab.tsx`/`SettingsTab.tsx`: 실행 버튼 `btn-primary`(+요소선택 `btn-accent`), 사이트 카테고리 `btn-secondary`, 설정탭 저장 `#1A73E8`→`btn-primary`, 설정탭 input 포커스 `#1A73E8`→`#38bdf8`.
- `TerminalConsole.tsx`: 로그 행 타임스탬프/본문 분리(`terminal-log-time`), 호버 배경, 헤더 버튼 `btn-mini`(자동 스크롤 ON 에메랄드), 입력줄 박스형(`>` 프롬프트 + sky 포커스 링).
- `plugins/opera-plugin/` 동일 10종 동기화(복사 + 헤더 주석 `plugins/opera-plugin/` 교체), 내용 MATCH(헤더 제외) 확인.
- 문서: `docs/rule/R-00440 plugin-ui-ux.md` §1.3 "아이콘 시스템(Material Symbols)" → **아이콘 배제 원칙**(텍스트 레이블 중심, `▼/▶`만 예외 허용), §1.4 버튼 색상 체계 신설, §2 레이아웃 도식(● 도트 배지), §4.2 진행 표시(아이콘 스피너→텍스트) 갱신.

### 변경된 파일
- `plugins/basic-plugin/src/popup.css`, `components/Header.tsx`, `components/TerminalConsole.tsx`, `components/tabs/BasicTab.tsx`, `components/tabs/DebugTab.tsx`, `components/tabs/InfoTab.tsx`, `components/tabs/SettingsTab.tsx`
- `plugins/basic-plugin/popup.html`, `sidepanel.html`, `public/sidepanel.html`
- `plugins/opera-plugin/` 동일 10종 (동기화)
- `docs/rule/R-00440 plugin-ui-ux.md`
- `docs/askLogs/ask-20260810033437.md`(신규)

### 검증 결과
- basic-plugin/opera-plugin `npm run build` 성공(각 48 모듈, sidepanel.css 6.55→8.08 kB — 버튼 토큰/터미널 스타일 추가분).
- 소스에서 `material`/`send-button`/`#1A73E8` 참조 0건(grep), opera 동기화 10종 MATCH 확인.

### 잔여 사항
- 브라우저 수동 확인: 아이콘 사라짐, 버튼 가시성·색상 통일, 터미널 출력/입력 스타일, 이미지 수집 카테고리 버튼 활성/비활성 대비.

---

## 2026-08-10 | 이미지 수집 3그룹 정렬 개선 — 전체 추출·lazy 대응·중복 제거·www 루트 도메인 저장

### 요청
- "플러그인에 이미지 수집 하위에 버튼을 3개: ① 일반 이미지 수집 ② xchina.co — 일반/앨범/표지/정보 ③ xvideos.com — 일반/정보."
- "일반 이미지 수집은 현재 열려있는 화면 렌더링이 되어있는 실제 DOM 요소들의 이미지를 전부 산출 후 다운로드해서 서버로 보내고, 서버는 기본 저장 경로에 각 도메인별로(일반은 normal) `/` 디렉토리 구분해서 저장."

### 확정된 상세 규격 (사용자 협의)
- 이미지 상한 `MAX_IMAGE_COLLECT_COUNT` 50 → **500**, 중복 URL Set 제거, lazy `data-src` 폴백 적용
- 사이트 버튼 **항상 3그룹 표시** + 비매칭 그룹 disabled·"다른 도메인" 배지
- 저장 폴더 도메인 `www.` 제거 → **루트 도메인 통일**(기존 `www.` 폴더는 이관 없이 유지)

### 완료된 작업 목록
- `plugins/basic-plugin/src/content.ts`: `MAX_IMAGE_COLLECT_COUNT` 50→500. 신규 `resolveImageSource()` — `currentSrc → src → data-src/data-original/data-lazy-src/data-url/data-lazy` 순 최종 URL 결정. `collectAndSendImages()` — 렌더링 DOM `img` 전부 취합 → 중복 URL `Set` 제거 + 상한 초과 중단, 대상 구조 `{ img, src }`로 변경해 루프에서 해석된 src 재사용.
- `plugins/basic-plugin/src/components/tabs/BasicTab.tsx`: 사이트 전용 그리드 `matchedSite` 조건부 → `Object.entries(SITE_IMAGE_BUTTONS)` 항상 렌더링. 그룹 헤더에 `현재 도메인`/`다른 도메인` 배지, 비매칭 그룹 버튼 `disabled` + title 안내("~ 페이지에서만 사용할 수 있습니다").
- `server/src/index.ts`: 신규 `normalizeRootDomain()` — `www.` 접두사만 제거(그 외 서브도메인 유지). `targetUrl`/`pageUrl` hostname 도메인 추출에 적용 → 저장 폴더 및 `crawl_logs.domain` 루트 도메인 통일.
- `plugins/opera-plugin/src/` 동일 2종(content.ts, BasicTab.tsx) 동기화(복사 + 헤더 교체).
- 문서: `docs/rule/R-00208 local-file-storage-system.md` §2.1(카테고리 하위 폴더·info JSON·루트 도메인 통일 규격), `docs/rule/R-00430 plugin-crawling.md` §5.3(500 상한/lazy/중복 제거/3그룹 배지/www 정규화)·§6 체크리스트 3건 추가.

### 변경된 파일
- `plugins/basic-plugin/src/content.ts`, `components/tabs/BasicTab.tsx`
- `plugins/opera-plugin/src/content.ts`, `components/tabs/BasicTab.tsx` (동기화)
- `server/src/index.ts`
- `docs/rule/R-00208 local-file-storage-system.md`, `docs/rule/R-00430 plugin-crawling.md`
- `docs/askLogs/ask-20260810031128.md`(신규)

### 검증 결과
- basic-plugin/opera-plugin `npm run build` 성공(각 48 모듈, content.js 7.65→7.95 kB, sidepanel.js 221.10 kB).
- server `npm run build`(tsc) 성공 → pm2 `WebCrawlServer` 재시작 후 online(9600).

### 잔여 사항
- 브라우저 수동 확인: 이미지 수집 섹션 3그룹 상시 표시/비매칭 그룹 비활성화 배지, lazy 포함·중복 제거·500 상한, `www.` 페이지 수집 시 `images/<루트도메인>/normal/` 저장.

---

## 2026-08-10 | 플러그인 DOM 액션 개편·이미지 수집 3버튼 + admin DB 정렬/필드검색/SQL 예제

### 요청
- "현재 페이지 전체 DOM 전송은 페이지 이전 소스가 아닌 버튼을 누를 때 현재 렌더링된 DOM을 다시 전체 읽어 전송. 전체 페이지 액션명 `CRAWL_DOCUMENT` → `fullPage`, DOM 요소 전송은 `DomCapture`로."
- "이미지 수집 버튼 3개: ① 일반 ② xchina.co — 일반/앨범/표지/정보 ③ xvideos.com — 일반/정보. 서버는 기본 저장 경로에 도메인별 디렉토리 구분 저장(일반은 `normal`)."
- "admin DB 관리 테이블 rows 컬럼 옆에 오름차순/내림차순 화살표 소팅."
- "행 검색(LIKE) 앞에 각 테이블 필드 선택 드롭다운 — 선택 필드에 대해서만 LIKE."
- "SQL 실행기에 예제 샘플 20가지 드롭다운 — 선택 시 에디터에 쿼리 삽입."

### 완료된 작업 목록
- **플러그인 액션 개편**: `content.ts` — 요소선택 전송 `CRAWL_PARTIAL`→`DomCapture`, iframe 전체문서 `CRAWL_DOCUMENT`→`fullPage`, `COLLECT_FULL_DOM`→`fullPage`(버튼 누를 때 현재 렌더링 DOM outerHTML 재캡처). 구형 `CRAWL_DOCUMENT`/`CRAWL_PARTIAL` 서버 수신 호환 유지. 크로스오리진 iframe src 참조는 기존 `CRAWL_PARTIAL` 유지.
- **이미지 수집 3버튼 + SITE_INFO**: `collectAndSendImages(category="normal")` — 페이로드에 `category` 추가(data:/fetch 성공 binary_base64/실패 json 모두 전달). 신규 `collectAndSendSiteInfo()` — 메타(description/keywords/og/canonical 등) JSON → `SITE_INFO`. 리스너 `COLLECT_IMAGES`가 payload.category 파싱 + 신규 `COLLECT_SITE_INFO`. `chromeService.ts` — `requestCollectImages(category)`/`requestCollectSiteInfo()`. `usePopupState.ts` — `handleCollectImages(category)`/`handleCollectSiteInfo()`. `BasicTab.tsx` — `matchSiteDomain()`(호스트 정확 일치/`.도메인` 접미사), `CATEGORY_LABELS`/`SITE_IMAGE_BUTTONS`(xchina.co → normal/album/cover/info, xvideos.com → normal/info), 일반 버튼 상시 + matchedSite 시 사이트 전용 그리드. `sidepanel.tsx`/`popup.tsx` props 체인.
- **서버 저장/액션**: `fileStorageService.ts` — `SaveCrawledImageOptions.category?` + `saveCrawledImage` `images/<도메인>/<카테고리>` 삽입, 신규 `saveSiteInfoToFile` → `images/<도메인>/info/<ts>-<seq>.json`. `index.ts` — 액션 허용 목록에 `fullPage`/`DomCapture`/`SITE_INFO` 추가, `CRAWL_IMAGE` category 전달, 신규 `SITE_INFO` 분기(JSON 물리 저장 + crawl_logs), 워커 파이프라인 조건 `CRAWL_DOCUMENT || fullPage`로 확장. `useAdminSocket.ts` — 실시간 액션 목록에 신규 액션 추가.
- **서버 fetchTableRows 확장**: `dbManagerService.ts` — 시그니처 `(dbRel, tableName, page=1, size=20, search="", searchField="", orderBy="", orderDir="asc")`. 검색 필드 컬럼 화이트리스트(`PRAGMA table_info` 기반), 필드 단일 LIKE/미지정 시 전체 컬럼 OR LIKE + `%`/`_` `ESCAPE '\'` 이스케이프, `ORDER BY <col> ASC|DESC`(유효 컬럼만, 페이지 캡 최대 200 유지). `index.ts` `/api/admin/db/rows` 라우트에 `searchField`/`orderBy`/`orderDir` 쿼리 파싱 추가.
- **admin 데이터 브라우저 정렬/필드검색**: `dbApiService.fetchTableRowsApi` 8파라미터 확장, `useDbManager.loadRows` 확장, `DbBrowserPanel` — 검색 필드 드롭다운(`전체 필드`+스키마 컬럼)·정렬 상태(`SortState`)·테이블 전환 시 검색어/필드/정렬/페이지 리셋, `DbDataGrid` — `sortColumn`/`sortDir`/`onSortChange` prop + 헤더 클릭 서버 정렬(▲`arrow_upward`/▼`arrow_downward`/미정렬`unfold_more`).
- **admin SQL 예제 + 클라이언트 정렬**: `SqlQueryPanel` — `EXAMPLE_QUERIES` 20개(sqlite_master/로그 분석/이미지 카테고리/스케줄/PRAGMA 등) 드롭다운(선택 시 에디터 삽입, 자동 실행 없음). `DbDataGrid` `clientSort` prop — 헤더 클릭 시 브라우저 내부 정렬(숫자 수치 비교/문자열 localeCompare, 토글).
- **opera-plugin 동기화**: 변경 6종(content.ts, chromeService.ts, usePopupState.ts, BasicTab.tsx, sidepanel.tsx, popup.tsx) 복사 + 헤더 경로만 `plugins/opera-plugin/src/` 교체. 양 플러그인 빌드 성공(각 48 모듈).
- **문서**: `docs/rule/R-00203 database.md`(rows API `searchField`/`orderBy`/`orderDir` + LIKE 이스케이프 규격), `docs/rule/R-00304 admin-worker-and-db-manager.md`(§3.1 기능 탭·§3.3 필드검색/헤더정렬/SQL 예제+클라이언트정렬 규정·검증 체크리스트 3건 추가).

### 변경된 파일
- `plugins/basic-plugin/src/content.ts`·`services/chromeService.ts`·`hooks/usePopupState.ts`·`components/tabs/BasicTab.tsx`·`sidepanel.tsx`·`popup.tsx`
- `plugins/opera-plugin/src/` 동일 6종 (동기화)
- `server/src/index.ts`, `server/src/services/fileStorageService.ts`, `server/src/services/dbManagerService.ts`
- `admin/src/hooks/useAdminSocket.ts`, `admin/src/hooks/useDbManager.ts`, `admin/src/services/dbApiService.ts`
- `admin/src/components/tables/DbDataGrid.tsx`, `admin/src/components/views/db/DbBrowserPanel.tsx`·`SqlQueryPanel.tsx`
- `docs/rule/R-00203 database.md`, `docs/rule/R-00304 admin-worker-and-db-manager.md`
- `docs/askLogs/ask-20260810024611.md`(신규)

### 검증 결과
- server `npm run build`(tsc) 성공 → pm2 `WebCrawlServer` 재시작 후 online(9600).
- admin `tsc --noEmit` 내 변경 파일 0건(선재 비차단 에러: FaviconGeneratorView/NetworkMonitorView/socketService env 동일), `vite build` 성공.
- basic-plugin/opera-plugin `npm run build` 성공(각 48 모듈, dist 갱신).
- API 수동: `crawl_logs` `orderBy=id&orderDir=desc` 첫행 175 / asc 첫행 27(총 144), `searchField=status&search=error` 112건, 전체 필드 LIKE 리터럴 `100%` 3건(`ESCAPE` 동작), 주입(`;DROP TABLE`) 0건 + configs 테이블 생존(화이트리스트 검증).

### 잔여 사항
- 브라우저 수동 확인: 사이트 전용 이미지 버튼(도메인 매칭/카테고리 저장), fullPage 재캡처, admin 헤더 정렬/필드 검색/예제 쿼리.

---

## 2026-08-09 | DB 관리 UX 개선 — 긴 셀 미리보기 + 페이지네이션 기본값 configs + file_path 탐색기

### 요청
- "DB관리에서 log_message 같이 html이 통으로 들어간 것은 너무 길다. 출력 문자열 제한하고 더보기로 전체 log_message를 레이어 창으로 볼 수 있게. 레이어 창은 현재 브라우저 창 높이에 맞게 하고 스크롤도."
- "테이블 선택하면 몇 행씩 보는 기능이 없다. 기본 20개씩 페이징 처리. 기본 값은 server/configs.json에 지정하고 기초 환경설정으로 편입."
- "file_path 부분도 옆에 작은 버튼으로 파일 브라우저가 열리게. 파일까지는 프로그램 연결이 필요하니 디렉토리까지만, 디렉토리는 윈도우 파일 브라우저가 실행되게. 브라우저 내부 파일 브라우저 레이어로 처리하지 말고."

### 완료된 작업 목록
- `server/configs.json`: `db_page_size`(20, "DB 관리 테이블 기본 출력 행 개수 (페이지당 행 수)")·`db_cell_preview_chars`(200, "DB 관리 그리드 셀 출력 문자열 제한 길이 (초과 시 더보기)") 시드 추가. `seedConfigDefaults()` 누락 키만 자동 INSERT → configs 테이블 + admin 환경설정(`/settings`) 자동 노출(기존 값 보존).
- `server/src/index.ts`: `POST /api/admin/fs/open-explorer` 신규 — `{path}` 실존 검증(미존재 404) → 파일이면 `dirname`(부모 디렉토리) / 디렉토리면 그대로 → win32 `explorer.exe`(비Win `xdg-open`/`open`) 실행, `windowsHide: true`, `FS_OPEN_EXPLORER` 관리자 활동 로그. `/api/admin/db/rows` size 미지정 기본값 50→20.
- `server/src/services/dbManagerService.ts`: `fetchTableRows` 기본 `size=20`, `pageSize = Math.min(200, Math.max(1, Number(size)||20))` 캡 유지.
- `admin/src/components/modals/ValuePreviewModal.tsx` 신규: 창 높이 기준 `maxHeight = window.innerHeight - 120px`(최소 320px), 본문 `overflow-y: auto`, 닫기 버튼·backdrop·ESC, 헤더에 전체 글자수·줄수 표시, material-symbols-outlined.
- `admin/src/components/tables/DbDataGrid.tsx` 개편: `CellValue` 하위 컴포넌트 — `cellPreviewLimit`(기본 200) 초과 시 `…` 잘림 + `더보기` 링크 → ValuePreviewModal, **`col === "file_path"` 정확 일치**·값 비어있지 않은 셀에만 `folder_open` 탐색기 버튼(진행 스피너·중복 실행 차단, 실패 시 그리드 하단 오류 배너). import 경로는 `../../services/apiService.js`·`../modals/ValuePreviewModal.js`.
- `admin/src/services/apiService.ts`: `openExplorerApi(path)` 추가(`POST /api/admin/fs/open-explorer`).
- `admin/src/hooks/useDbManager.ts`: `selectTable(table, size = 20)` — 하드코딩 50 제거, `loadRows(table, 1, size, "")`.
- `admin/src/components/views/db/DbBrowserPanel.tsx`: `dbPageSize=20`/`cellPreviewChars=200` props, `PAGE_SIZE_OPTIONS=[20,50,100,200]`, 페이지 크기 드롭다운(변경 시 1페이지부터 재조회), 검색/페이지 이동에 pageSize 전달, DbDataGrid에 `cellPreviewLimit` 전달.
- `admin/src/components/views/db/SqlQueryPanel.tsx`: `cellPreviewChars` prop → DbDataGrid `cellPreviewLimit` 전달.
- `admin/src/components/views/db/DbManagerView.tsx`: `dbPageSize`/`cellPreviewChars` props, `handleSelectTable` → `selectTable(table, dbPageSize)`, browser/sql 패널에 props 전달.
- `admin/src/App.tsx`: `dbPageSize = Number(configs…db_page_size)||20`, `cellPreviewChars = Number(…)||200` 파싱 → `<DbManagerView dbPageSize cellPreviewChars>`.
- 문서: `docs/rule/R-00203 database.md`(configs 키 2종 + open-explorer API + rows 기본 20), `docs/rule/R-00304 admin-worker-and-db-manager.md`(§3.1 데이터 브라우저 항목, §3.3 그리드 셀 규정, 검증 체크리스트 3건 추가).

### 변경된 파일
- `server/configs.json`, `server/src/index.ts`, `server/src/services/dbManagerService.ts`
- `admin/src/components/modals/ValuePreviewModal.tsx`(신규), `admin/src/components/tables/DbDataGrid.tsx`, `admin/src/services/apiService.ts`, `admin/src/hooks/useDbManager.ts`, `admin/src/components/views/db/DbBrowserPanel.tsx`·`SqlQueryPanel.tsx`·`DbManagerView.tsx`, `admin/src/App.tsx`
- `docs/rule/R-00203 database.md`, `docs/rule/R-00304 admin-worker-and-db-manager.md`
- `docs/askLogs/ask-20260809231120.md`(신규)

### 검증 결과
- server `tsc` 0건 + `npm run build` 성공, pm2 `WebCrawlServer` 재시작 후 online(9600).
- admin `tsc --noEmit` 내 변경 파일 0건(선재 비차단 에러 동일), `vite build` 성공.
- `GET /api/admin/configs` → `db_page_size=20`, `db_cell_preview_chars=200` 시드 확인.
- `GET /api/admin/db/rows`(crawl_logs, total=145) → size 미지정 시 `size=20, returned=20`(기본 20), page=2·size=50 정상.
- `POST /api/admin/fs/open-explorer` → 파일 지정 시 부모 `databases` 디렉토리로 Explorer 실행 성공, 미존재 경로 404.

### 잔여 사항
- 브라우저 수동 확인: 더보기 레이어(창 높이/스크롤), 행 수 드롭다운 20 기본, file_path 탐색기 버튼.

---

## 2026-08-09 | 기본 탭 개편 + 터미널 모든 탭 하단 공통화 + 현재 페이지 URL 자동 갱신

### 요청
- "터미널을 모든 페이지 하단 맨 아래에 배치 (스크롤·외곽 아웃라인 개선)"
- "기본 탭: DOM 전송(전체/요소선택/프레임), 이미지 수집, 액션 실행(미개발)"
- "페이지 URL 변화 시 [현재 페이지] 자동 갱신 (활성 탭 감시)"

### 완료된 작업 목록
- `TerminalConsole.tsx` 신설: 기존 DebugTab 터미널을 공통 컴포넌트로 분리, sidepanel/popup 모두 탭 내용(flex-1) 아래·푸터 위 공통 배치, 하늘색 아웃라인(`outline: 1px solid rgba(56,189,248,0.35)`) + 개선 스크롤바. DebugTab은 디버그 송출 카드만 유지.
- `BasicTab.tsx` 개편: 아코디언+카드 3섹션 — DOM 전송(라디오 전체/요소선택/프레임, 모드별 실행 버튼), 이미지 수집, 액션 실행(미개발 disabled). URL 카드 자동 갱신 표기.
- 요소 선택: content.ts에 파란 테두리(`outline: 3px solid #3b82f6`) 오버 → 클릭 시 요소 위치 "전송" 플로팅 버튼 → outerHTML 전체를 `CRAWL_PARTIAL`로 전송 → ESC/완료 시 `ELEMENT_PICKER_ENDED` 통지.
- 프레임: `GET_FRAME_INFO`로 iframe 개수 조회, 0개면 라디오/버튼 비활성. 같은 오리진은 outerHTML `CRAWL_DOCUMENT`, 크로스 오리진은 src URL 참조 `CRAWL_PARTIAL`.
- 이미지: `COLLECT_IMAGES` — 최대 50개, `fetch(src,{credentials:"include"})` 성공 시 Base64 `CRAWL_IMAGE`(binary_base64), 실패 시 URL만 `CRAWL_IMAGE`(json, error)로 스킵 없음 보관.
- `usePopupState.ts`: 신규 상태(isElementPicking/isFrameCollecting/hasFrame/frameCount/isImageCollecting) + `chrome.tabs.onActivated`/`onUpdated("complete")`로 활성 탭 URL·iframe 자동 감시. 기존 eslint 경고(`any` 2건, unused)도 정리.
- `chromeService.ts`: 공통 헬퍼 `sendCommandToActiveTab`(미주입 탭 content 주입 재시도) + 요소/프레임/이미지 요청 4함수. `types/index.ts`에 `CrawlImagePayload`/`CrawlElementPayload` 추가.
- 서버: `fileStorageService.saveCrawledImage()`(MIME→확장자 매핑, 실패 시 `.url` 참조 저장), `index.ts` CRAWL_IMAGE 분기(insertCrawlLog action=CRAWL_IMAGE + file_path/file_size 갱신, `payload.pageUrl` 도메인 기준 폴더 분류).
- opera-plugin 동기화: 변경 10개 파일 복사(헤더 경로 주석만 plugins/opera-plugin 교체), 기능 동일.

### 변경된 파일
- `plugins/basic-plugin/src/` types/index.ts, content.ts, services/chromeService.ts, components/TerminalConsole.tsx(신규), components/tabs/BasicTab.tsx, components/tabs/DebugTab.tsx, hooks/usePopupState.ts, sidepanel.tsx, popup.tsx, popup.css
- `plugins/opera-plugin/` 동일 10개 파일 동기화
- `server/src/services/fileStorageService.ts`, `server/src/index.ts`
- `docs/rule/R-00430 plugin-crawling.md`, `docs/rule/R-00440 plugin-ui-ux.md`, `docs/rule/R-00480 plugin-automation-crawling.md`, `docs/rule/R-00208 local-file-storage-system.md`
- `docs/askLogs/ask-20260809205823.md` (신규)

### 검증 결과
- basic-plugin·opera-plugin: `tsc --noEmit` 0건, `vite build` 성공, `eslint` 0건 (기존 경고 정리 포함).
- server: tsc 빌드 성공, pm2 `WebCrawlServer` 재시작 후 online 유지(포트 9600 응답).
- 요소 선택·이미지 저장·URL 자동 갱신은 브라우저 확장 재로드 후 사용자 최종 확인 필요.

---

## 2026-08-09 | 오페라 전용 플러그인(`plugins/opera-plugin`) 신설 (sidebar_action 사이드바 지원)

### 요청
- "오페라 브라우져에서는 sidebar_action 이라고 해야 한다고 하네 / Permission 'sidePanel' is unknown. 이라고 하고 사이드 패널이 안나와"
- "plugins\basic-plugin 일반 크롬 지원으로 기본 개발로 하고 / plugins\opera-plugin 오페라 브라우져 지원으로 하고 오페라 특수만 변경 하고 기능은 basic-plugin 기능 그대로하고"

### 원인 분석
- `plugins/basic-plugin/public/manifest.json`은 크롬 표준 `sidePanel` permission + `side_panel` 키 사용 → 오페라가 `sidePanel` permission을 인식하지 못해 `Permission 'sidePanel' is unknown` 오류로 로드/사이드바 실패.
- 오페라 사이드바는 별도 권한 없이 `sidebar_action` 매니페스트 키(`default_panel` 필수)로 동작하며 크롬 `side_panel` 키와 호환되지 않아 단일 manifest 동시 지원이 불가능.

### 완료된 작업 목록
- `plugins/opera-plugin` 신설: `plugins/basic-plugin` 전체 소스 사본(`public/`, `src/`, HTML 엔트리, `vite.config.ts`, `tsconfig.json`, `.npmrc`).
- 오페라 특수 변경: manifest.json(`sidePanel` permission·`side_panel` 키 제거 → `sidebar_action` 키 추가, name/description 오페라 명시), `background.ts`(`chrome.sidePanel?.setPanelBehavior` 옵셔널 가드), `package.json`(name=opera-plugin), 소스 헤더 경로 주석 20개 + vite.config.ts 일괄 교체.
- 루트 `package.json`: `workspaces`에 `plugins/opera-plugin` 추가, `plugin:opera:dev` 신설, `build:all`에 opera 빌드 포함.
- 문서: `R-00460`(§1.4 오페라 지원 규정, §6 오페라 전용 매니페스트 명세, §7 검증 절차), `R-00410`(§2.1 병행 구조), `ADR-006` 신규.

### 변경된 파일
- `plugins/opera-plugin/` (신규 워크스페이스, basic-plugin 사본)
- `package.json` (루트 workspaces/스크립트)
- `docs/rule/R-00460 plugin-manifest-permissions.md`, `docs/rule/R-00410 plugin-architecture.md`
- `docs/decision/ADR-006-opera-plugin-separation.md` (신규)
- `docs/askLogs/ask-20260809100542.md` (신규)

### 검증 결과
- `npm run build --workspace=opera-plugin` 성공 → `dist/`에 `sidepanel.js`/`offscreen.js`/`background.js`/`content.js` + 오페라용 manifest.json 생성.
- `npm run build --workspace=basic-plugin` 성공 → 크롬 빌드 정상 유지.
- opera `dist/manifest.json`: `sidebar_action` 존재, `sidePanel`/`side_panel` 부재 확인.
- 오페라 실제 로드·사이드바 표시는 오페라 환경에서 수동 검증 예정. `offscreen` 등 추가 미지원 권한/API 확인 시 별도 폴백 대응 예정.

---

## 2026-08-09 | 클라이언트 4컬럼 재구성 + 플러그인 메시지 원장/파일 저장 + CLIENT_CONFIG_UPDATE/ACK 실패 근본 수정

### 요청
- "클라이언트 4컬럼 재구성(client_id/client_type/alias/connected_at, assigned_worker_id/custom_storage_path 제거) + 플러그인 메시지 원장 저장 + 기본 저장 경로 하위 `<clientId>/<action>/` 평면 구조 물리 파일 저장 + 관리자 UI 개선"
- 확정: 수집 액션 `CRAWL_DOCUMENT`/`CRAWL_PARTIAL`/`CRAWL_METADATA`/`CRAWL_BINARY` 세분화(기존 `CRAWL_LOG` 제거), 모든 액션 원장 저장, 별칭은 플러그인 환경설정 저장 시 서버 전송(`CLIENT_CONFIG_UPDATE`→ACK), `GET /api/db/plugin_messages` API
- 연속 세션: CLIENT_CONFIG_UPDATE 별칭 미저장·ACK 미수신 문제 근본 원인 수정

### 원인 분석
- **ws 수신 데이터가 Buffer**: `ws` `message` 이벤트 `data`는 기본적으로 Buffer이며, `logPluginComm(..., rawData.substring(0, 200))`에서 `rawData.substring is not a function` 예외 발생. 이 예외가 별칭 저장·ACK보다 먼저 던져져 후속 처리가 중단됨.
- **빈 catch 은폐**: 메시지 핸들러의 `catch {}`가 예외를 조용히 삼켜 `plugins_comm.log` 기록·원인 추적 불가.
- **로그 함수 예외 전파**: `logPluginComm`/`logServerSystem`이 자체 try/catch 없이 `appendFileSync` 호출 → 파일 쓰기 실패가 상위 파이프라인 중단.
- **구버전 테이블 스키마 비호환**: `CREATE TABLE IF NOT EXISTS`가 기존 `crawl_logs` 스키마를 갱신하지 않아 `action`/`file_path` 등 부재 → `no such column` 예외 가능.

### 완료된 작업 내용
- `database.ts`: clients 4컬럼 + `ensureClientsTableSchema()`(6컬럼→4컬럼 이관 재생성, alias ADD COLUMN), `plugin_messages` 원장 테이블/함수, `insertCrawlLog` action 파라미터, `ensureCrawlLogsTableSchema()`(crawl_logs 부재 7컬럼 ADD COLUMN)
- `index.ts`: ws 수신 `typeof data === "string" ? data : data.toString()` 변환, 원장 훅, `CLIENT_CONFIG_UPDATE`/CRAWL_* 4액션/`CHAT_MESSAGE`/`PING_TEST`, `GET /api/db/plugin_messages`, `PUT /api/db/clients/:clientId/config`, 빈 catch → WARN 로그, `logPluginComm` 호출부 try/catch 가드
- `logger.ts`: `logPluginComm`/`logServerSystem` 내부 `appendFileSync` try/catch 예외 격리
- `fileStorageService.ts`: `savePluginMessageToFile()` 평면 구조 저장
- 플러그인: SettingsTab/별칭 저장/ACK, CRAWL_PARTIAL/DOCUMENT/METADATA 전송 분리, ACK 중계
- admin: Client 4컬럼 + `PluginMessageRecord`, `NodeConfigModal` 별칭만 유지, `PluginMessagesPanel` "메시지 원장" 탭, `fetchPluginMessagesApi`
- 문서: R-00203(crawl_logs 전체 스키마·마이그레이션·plugin_messages·plugin_messages API), R-00204(로그 예외 격리·빈 catch 금지), R-00420(서버 수신 가드 4.4 신설), ADR-005 신규

### 변경된 파일
- `server/src/database.ts`, `server/src/index.ts`, `server/src/logger.ts`, `server/src/services/fileStorageService.ts`
- `plugins/basic-plugin/src/*` (types/TabBar/content/offscreen/chromeService/usePopupState/SettingsTab/sidepanel)
- `admin/src/*` (types, apiService, useAdminDbApi, useAdminSocket, DbManagerView, PluginMessagesPanel 신규, NodeConfigModal, App.tsx)
- `docs/rule/R-00203`, `R-00204`, `R-00420`, `docs/decision/ADR-005-ws-buffer-and-log-isolation.md`(신규), `docs/askLogs/ask-20260809090945.md`(신규)

### 검증 결과
- server tsc 0건, 플러그인/관리자 빌드 성공.
- clients 4컬럼 기존 데이터 보존, crawl_logs 최종 컬럼 `["id","client_id","log_message","timestamp","action","domain","worker_name","url","title","file_path","file_size"]` 확인.
- `CLIENT_CONFIG_UPDATE` → ACK 수신 + `clients.alias` 저장 + `plugins_comm.log` 기록 정상, `server_system.log` `rawData.substring` WARN 소거.
- 원장(`plugin_messages`) + 평면 구조 파일(`E:\up\WebCrawlServer\clients\<clientId>\<action>\`) 저장 정상, `GET /api/db/plugin_messages` 정상 응답.

---

## 2026-08-09 | 노드/워커 저장 경로 파일 브라우저 + 기본 저장 경로(configs.data_path) 폴백 연동

### 요청
- "노드 환경설정의 '노드 전용 물리 저장 경로 (선택)'과 워커 관리의 '워커 전용 파일 저장소 루트 경로'에 파일 브라우저 기능. 두 경로를 따로 지정하지 않았다면 데이터 저장 기본 저장 경로가 되어야 함."
- 확정: 기본 경로 우선순위 `configs.data_path` 우선(없으면 STORAGE_ROOT_PATH → ./storage) / 워커 저장소 루트 빈 값 허용 + 폴백

### 조사 결론
- 물리 파일 저장 경로는 `index.ts:1683` `saveCrawledContentToFile` 호출 1곳이 결정, `globalDefaultPath` 미전달로 기본이 `./storage` 하드코딩 — `configs.data_path`와 무연동. `fileStorageService`의 우선순위·빈 값 skip 로직은 이미 구현돼 기본 경로만 교체하면 충족.

### 완료된 작업 목록
- `index.ts`: `getConfigDataPath()` 신규(수정 시 `runStartupValidation()`도 재사용), `saveCrawledContentToFile`에 `globalDefaultPath: getConfigDataPath() || undefined` 전달, `GET /api/admin/storage/status` `storageRootPath`를 `data_path > STORAGE_ROOT_PATH > ./storage`로 반영.
- admin: `NodeConfigModal`·`WorkerManagerView`에 `defaultStoragePath` props + 각 저장 경로 입력 옆 `folder_open` 파일 브라우저 버튼/`DirectoryBrowserModal` 재사용 + placeholder 기본 경로 안내. 워커 빌더 저장소 루트 기본값 `''`(빈 값)로 변경. `App.tsx`에서 `configs.data_path` 추출해 `GcpClientsView`(2곳)·`WorkerManagerView`로 전달.
- `R-00208`(우선순위/구조/코드 예시/체크리스트), `R-00203`(data_path 실제 연동 명시) 갱신.

### 변경 파일 목록
- `server/src/index.ts`
- `admin/src/App.tsx`, `admin/src/components/views/GcpClientsView.tsx`, `admin/src/components/views/WorkerManagerView.tsx`, `admin/src/components/modals/NodeConfigModal.tsx`
- `docs/rule/R-00208 local-file-storage-system.md`, `docs/rule/R-00203 database.md`, `docs/askLogs/ask-20260809054709.md`(신규)

### 검증 결과
- server tsc 0건, admin 빌드 성공. 재기동 후 `storage/status` → `E:\up\WebCrawlServer`(data_path). data_path 임시 변경 → 즉시 반영 → 원복. 워커 생성 `storageRootPath:""` → success + `storage_root_path=''` 저장 확인 후 임시 워커 레코드·DB 파일 정리. `/`,`/clients`,`/workers`,`/settings` 200, health 9600.

---

## 2026-08-09 | serverlogs DB 신설(systemlog) + 초기 값 검증 루틴 + 파일 브라우저 버튼

### 요청
- "serverlogs 디비에 각종 로그테이블이 들어갈 것. 첫 번째로 systemlog 테이블(idx/메세지 종류/메세지/int, int 기본값 1). 서버 구동 시 환경 설정의 데이터 저장 디렉토리 실존 검증 → 없으면 생성 + systemlog에 부재/생성 기록, 있으면 기록 안 함. 데이터 저장 경로 입력 필드 옆에 파일 브라우저 버튼."
- 확정: systemlog 컬럼명 영문 관례(`id`/`msg_type`/`message`/`code` DEFAULT 1) / 파일 브라우저 전체 파일시스템 탐색 허용 / 부재 시 "부재 발견+생성 완료" 2건 기록

### 조사 결론
- 기존 로깅은 파일 기반(`logs/*.log`, R-00204)뿐, DB 기반 시스템 로그 저장소 없음. `configs.data_path`는 시드+관리 UI만 연동돼 실존 검증 로직 부재. `dbManagerService`가 `databases/` 루트를 스캔하므로 serverlogs.db는 DB 매니저에 자동 노출됨.

### 완료된 작업 목록
- `database.ts`: `databases/serverlogs.db` 인스턴스(WAL) + `systemlog` 테이블(`id` PK AUTOINCREMENT/`msg_type`/`message`/`code` DEFAULT 1) + `insertSystemLog()`/`getSystemLogs()`.
- `index.ts`: `runStartupValidation()`(data_path 실존 검증, 부재 시 systemlog 2건 기록 후 `mkdirSync(recursive)` 생성, 존재 시 미기록), `getDriveRoots()`, `GET /api/admin/fs/browse`(드라이브 루트/하위 디렉토리+부모 경로, 404/400 처리).
- admin: `BrowseDirectoryEntry`/`BrowseDirectoryResult` 타입, `browseDirectoryApi()`, `DirectoryBrowserModal.tsx` 신규(드라이브 루트→폴더 진입/상위 이동/현재 폴더 선택), `ConfigSettingsView.tsx` data_path 입력 옆 파일 브라우저 버튼.
- `R-00204 logging.md`(systemlog DB 로그 규칙·초기 값 검증), `R-00203 database.md`(serverlogs.db 스키마 + fs/browse API) 갱신.

### 변경 파일 목록
- `server/src/database.ts`, `server/src/index.ts`
- `admin/src/types/index.ts`, `admin/src/services/apiService.ts`
- `admin/src/components/modals/DirectoryBrowserModal.tsx`(신규), `admin/src/components/views/ConfigSettingsView.tsx`
- `docs/rule/R-00204 logging.md`, `docs/rule/R-00203 database.md`, `docs/askLogs/ask-20260809041645.md`(신규)

### 검증 결과
- server tsc 0건, admin 빌드 성공. 재기동 후 serverlogs.db 생성·systemlog 스키마 확인. data_path 존재 시 행 0(기록 없음). 임시 부재 경로로 변경 후 재기동 → 디렉토리 자동 생성 + systemlog 2건(`부재 발견`/`생성 완료`, code=1) 확인 → 원복, 임시 디렉토리 삭제, 재기동 후 행 2 유지. `fs/browse`(드라이브 루트 C:/D:/E:, 하위 목록+부모) 정상. `/settings` SPA 200.

---

## 2026-08-09 | configs 테이블 신설 + admin 환경 설정 메뉴

### 요청
- "서버 구동 시 data.db에 configs 테이블 없으면 생성, 있으면 각 설정 값 검증·누락 시 server/configs.json 디폴트 적용 (구조: 변수명/값/코멘트). 파일 저장 위치(data_path)도 configs 테이블로 시드 검증. admin에 환경 설정 메뉴로 값 수정 가능하게."
- 확정: 시드 + 관리 UI만 (data_path 서버 기능 연동은 별도), 값(value) 수정만 (코멘트 읽기 전용, 키 추가/삭제 미지원)

### 조사 결론
- `server/configs.json`에 `data_path`(값·설명)만 있고 읽는 코드 없음. `configs` 테이블 미존재. 스키마 초기화는 `initializeDatabase()`(index.ts:210/797) 담당.

### 완료된 작업 목록
- `database.ts`: `configs` 테이블(`key` PK / `value` / `description`) 생성 + `seedConfigDefaults()`(configs.json 누락 키만 INSERT 시드, 기존 값 유지) + `getAllConfigs()`/`updateConfigValue()`.
- `index.ts`: `GET /api/admin/configs`, `PUT /api/admin/configs/:key`(400/404 처리, 관리자 활동 로그) 추가.
- admin: `ConfigEntry` 타입·`settings` 탭, `apiService.ts` configs 2함수, `useAdminDbApi.ts` configs 로더/저장, `ConfigSettingsView.tsx` 신규(인라인 값 수정+피드백), Sidebar/Breadcrumb/App 라우트 연동.
- `R-00203 database.md`: configs 스키마·시드 규칙·API 목록 추가.

### 변경 파일 목록
- `server/src/database.ts`, `server/src/index.ts`
- `admin/src/types/index.ts`, `admin/src/services/apiService.ts`, `admin/src/hooks/useAdminDbApi.ts`
- `admin/src/components/views/ConfigSettingsView.tsx`(신규), `admin/src/components/layout/Sidebar/Sidebar.tsx`, `admin/src/components/layout/Breadcrumb/BreadcrumbBar.tsx`, `admin/src/App.tsx`
- `docs/rule/R-00203 database.md`, `docs/askLogs/ask-20260809025330.md`(신규)

### 검증 결과
- server tsc 0건, admin 빌드 성공. 서버 재기동 후 `GET /api/admin/configs` → data_path 시드 확인, PUT 변경 → DB 직접 조회 반영 확인(원복), 404/400 정상, `/settings` SPA 200, health 200.

---

## 2026-08-08 | PM2 시작 스크립트 포트 고정 + WebCrawlAdmin 잔재·레거시 정리

### 요청
- "askLogs/ask-20260808202642.md와 docs/tips/2026-08-08-pm2-single-process-and-node_modules-root-only.md를 종합해 프로젝트 재검토 후 미비점 수정 개선"
- 확정: 포트 고정 9600 / WebCrawlAdmin 잔재 제거 / admin/start.js 제거

### 조사 결론 (미비점 5건)
- M1(핵심): `start-server.js` `getAvailablePort()`가 9600 점유 중이면 9601로 이동 후 기존 서버 kill → 재실행 시 9600 불통, "하나만 떠 있는데 접속 불통" 혼동의 실질 원인.
- M2: 루트 `package.json`에 `WebCrawlAdmin` 잔재 스크립트(`admin:status/logs/stop`), `clean:pm2`도 참조.
- M3: `clean:all` = `rimraf package-lock.json && npm ci` → lock 삭제 후 npm ci 항상 실패.
- M4: 미사용 레거시 `admin/start.js` (admin 패키지 `start`/`admin:start`만 참조).
- M5: docs/tips 문서에 포트 이동 결함 미기재.

### 완료된 작업 목록
- `server/scripts/start-server.js`: `getAvailablePort()`·`net` import 제거, `SERVER_PORT`(기본 9600) 고정, 근거 한글 주석, pm2 start env 주입 유지.
- 루트 `package.json`: WebCrawlAdmin 3개 스크립트 제거, `clean:pm2` 정리, `clean:all`의 `npm ci` → `npm install`.
- `admin/start.js` 삭제, `admin/package.json` `start`/`admin:start` 제거(`server:start` skip 유지).
- `docs/tips/...pm2-single-process-and-node_modules-root-only.md`: §2.3 포트 결함·개선, §2.5 잔재 정리, §4 예방 규칙 보완.

### 변경 파일 목록
- `server/scripts/start-server.js`, 루트 `package.json`, `admin/package.json`, `admin/start.js`(삭제)
- `docs/tips/2026-08-08-pm2-single-process-and-node_modules-root-only.md`
- `docs/askLogs/ask-20260808204652.md` (신규)

### 검증 결과
- JSON 유효성·`node --check` 통과. **9600 점유 상태에서 `server:start` 재실행 → `server-started on port 9600`**, health `port: 9600 / success: true`, 9600 LISTEN, 9601 미사용(이전 코드라면 9601 이동했음). npm 11 워크스페이스 전파 skip 출력은 무해.

---

## 2026-08-08 | PM2 프로세스 1개 정상 근거 정리 + node_modules 루트 고정 (vite cacheDir)

### 요청
- "admin:start 후 server:start를 하면 PM2에 WebCrawlServer 하나만 떠 있어. 문제가 뭐지"
- "admin/node_modules이 생기면 안 된다. node_modules은 프로젝트 루트에만 존재해야 한다. 원인과 해결을 docs/tips에 문서화"

### 조사 결론
- `admin:start` = admin build + `server:start`, `server:start` = `start-server.js` 실행 → 두 명령 모두 `pm2 delete WebCrawlServer` + 동일 이름 `--name WebCrawlServer` 기동. admin은 별도 프로세스가 아니라 `server/public` 정적 서빙 → **1개만 뜨는 게 정상 설계**.
- `admin/node_modules`의 실체는 Vite deps 캐시 `node_modules/.vite` (기본 cacheDir이 실행 디렉토리 기준). server/plugin의 node_modules는 빈 폴더(패키지는 루트에만 호이스팅).

### 완료된 작업 목록
- `admin/vite.config.ts`·`plugins/basic-plugin/vite.config.ts`에 `cacheDir: resolve(__dirname, "../node_modules/.vite")`(admin)/`"../../node_modules/.vite"`(plugin) 추가 → 워크스페이스 하위 node_modules 생성 차단.
- 기존 워크스페이스 node_modules 3곳 삭제 (.gitignore에 node_modules/·**/node_modules/·.vite/ 등록, 미트래킹 확인).
- `docs/tips/2026-08-08-pm2-single-process-and-node_modules-root-only.md` 신규 작성 (실행 체인, 단일 프로세스명 근거, admin 접속 경로, WebCrawlAdmin 잔재 안내, vite cacheDir 해결, 예방 규칙).

### 변경 파일 목록
- `admin/vite.config.ts`, `plugins/basic-plugin/vite.config.ts`
- `docs/tips/2026-08-08-pm2-single-process-and-node_modules-root-only.md` (신규)
- `docs/askLogs/ask-20260808202642.md` (신규)

### 검증 결과
- admin·plugin 빌드 성공, 두 워크스페이스 `node_modules` 재생성 없음 확인
- 서버 코드 변경 없음(재시작 불필요), PM2 `WebCrawlServer` 상태 유지

---

## 2026-08-08 | 플러그인↔서버↔admin 연결 불통 근본 개선 (마운트 자동 등록 + 실시간 노드 푸시 + 오프스크린 생존 보장)

### 요청
- "플러그인 → WebCrawlServer 전송 시 '페이지 스크립트 미연결', admin 온라인 노드 0개·수집노드관리 미표시 → 근본 원인 점검 및 개선책"
- 확정: 서버+플러그인+admin 전체 근본 개선, admin 실시간 반영은 웹소켓 푸시 방식

### 조사 결론 (근본 원인 5건)
- `clients`/`crawl_logs` 빈 상태 (DB 복원 이력 2건) → admin 목록 0개
- 노드 DB 등록이 `CRAWL_LOG` 수신에만 의존 → 연결만으로는 목록 미등록
- `ensureOffscreenDocument`가 `onInstalled`/`onStartup`에서만 호출 → 크롬이 오프스크린을 닫으면 소켓 복구 불가 (clientId 변동 ee68b226→8da6a1b8)
- content script 미주입 탭에서 `COLLECT_FULL_DOM` 실패 시 안내만 반환 (fallback 없음)
- admin `loadClients`가 최초/재연결 시에만 호출

### 완료된 작업 목록
- 서버: `upsertClient`(ON CONFLICT DO UPDATE) 신규 + 마운트/close/CLIENT_STATUS_UPDATE 3지점 `broadcastClientsChanged()`(`CLIENTS_UPDATED`) 푸시.
- 플러그인: `background.ts` onMessage 진입부 `ensureOffscreenDocument()` 선행 호출(오프스크린 생존 보장), `chromeService.ts` `scripting.executeScript` content 주입 fallback + 1회 자동 재시도.
- admin: `App.tsx` `handleAdminMessage`에서 `CLIENTS_UPDATED` → `loadClients()` 실시간 재조회.

### 변경 파일 목록
- `server/src/database.ts`, `server/src/index.ts`
- `plugins/basic-plugin/src/background.ts`, `services/chromeService.ts`
- `admin/src/App.tsx`
- `docs/rule/R-00206` (§2.3), `R-00420` (§4.3), `R-00470` (§5)
- `docs/askLogs/ask-20260808200937.md` (신규)

### 검증 결과
- server/plugin/admin tsc 0건(admin은 기존 비차단 6건 무시), 3개 워크스페이스 빌드 성공, 번들 마커 확인
- pm2 재시작 + 헬스 200, `GET /api/db/clients?onlineOnly=true` → 플러그인 노드 `is_online: true` 자동 등록 확인 (무중단 재연결 + 마운트 upsert 동작 증명)
- admin 실시간 노드 갱신·오프스크린 생존 보장은 플러그인 재로드 후 사용자 최종 확인 필요

---

## 2026-08-08 | 관리자 대시보드 노드별 고유 전송 + 연결 확인

### 요청
- "플러그인의 서버 http://localhost:9600/ 와 소통하는 소켓이 어떤거고 고유한 프로세서인지 확인 하는 방법있어? 연결 확인을 하고 브라우져 플러그인 마다 고유한 전송을 하려고하는거야"
- 확정: 관리자 대시보드에서 노드별 전송 + UUID 직접 입력

### 조사 결론
- 소켓은 플러그인 프로필당 1개 영구 고유 소켓(`ws://localhost:9600?clientId=<UUID>&clientType=plugin`), UUID 영속 → clientId = 고유 프로세서 1:1 (서버 중복 정화 4001)
- 특정 노드 1:1 타깃 전송 인프라(서버 targetId 릴레이 + admin dispatchCommand + 콘솔 UUID 입력)는 기존 구현 존재 → 온라인 노드 확인·응답 확인 UI만 보강

### 완료된 작업 목록
- `GcpControlConsoleView.tsx`: "온라인 노드 연결 확인" 섹션(별칭·UUID·사이드바 배지 + 적용/복사 버튼), "전송 결과 (실시간 수신 패킷)" 섹션(PONG_RESPONSE 성공 강조), 온라인 노드 수 배지, 연결 확인 방법 안내 캡션 추가.
- `App.tsx`: `/console` 라우트에 `clients`, `socketMessages` props 전달.
- `R-00206`: §6 노드별 고유 전송 절차(온라인 확인→UUID 지정→1:1 릴레이→응답 확인) 및 §7 체크리스트 반영.

### 변경 파일 목록
- `admin/src/components/views/GcpControlConsoleView.tsx`, `admin/src/App.tsx`
- `docs/rule/R-00206 server-node-session-management.md`
- `docs/askLogs/ask-20260808153900.md` (신규)

### 검증 결과
- admin tsc: 신규 파일 0건 (기존 비차단 에러 6건 무시), `npm run build --workspace=admin` 성공
- 서버 재시작 후 `/health`·`/console`·`/` 200, 새 번들(index-DL9C4Igz.js) 내 UI 마커 확인
- `/console` 동작(노드 목록·적용·전송·PONG 응답)은 사용자 최종 확인 필요

---

## 2026-08-08 | 플러그인 디버깅 탭 하단 터미널 콘솔 추가

### 완료된 작업 목록
- `DebugTab.tsx` 하단에 admin 네트워크 모니터링 스타일의 터미널 콘솔을 추가했습니다: 리사이즈 바(드래그로 높이 조절, 기본 200px) → 헤더(콘솔 소거/자동 스크롤 토글) → 로그 출력 영역(타입별 색상·타임스탬프·자동 스크롤) → `>` 명령 입력 줄.
- `usePopupState.ts`에 콘솔 상태·로직을 추가했습니다: `terminalLogs`/`autoScroll`/`commandInput`/`consoleHeight`, 수신 패킷(`SOCKET_PACKET_RECEIVED`)의 콘솔 로그 기록, 동작 로그(소켓 상태/DOM 수집/디버그 전송/탭 전환), 콘솔 명령어 `help`/`clear`/`status`/`ping`/`send <json>`.
- `chromeService.ts`에 범용 `sendSocketPacket()`을 신규 추가하고 `sendDebugMessage`를 `CRAWL_LOG` 봉투 래퍼로 리팩토링했습니다.
- `offscreen.ts`의 PONG 응답에 nullable 가드(`socket && readyState === OPEN`)를 추가해 플러그인 tsc 전체 0건을 달성했습니다.

### 변경 파일 목록
- `plugins/basic-plugin/src/types/index.ts`, `hooks/usePopupState.ts`, `services/chromeService.ts`, `components/tabs/DebugTab.tsx`, `sidepanel.tsx`, `popup.tsx`, `offscreen.ts`
- `docs/rule/R-00440 plugin-ui-ux.md` (디버깅 탭 터미널 콘솔 규격 §3.4 반영)
- `docs/askLogs/ask-20260808153115.md` (신규)

### 검증 결과
- plugin tsc EXIT 0, `npm run build --workspace=basic-plugin` 성공 (`sidepanel.js` 207.86 kB)
- 브라우저 확장 재로드 후 디버깅 탭 콘솔 동작은 사용자 최종 확인 필요

---

## 2026-08-08 | 네트워크 모니터링 패널 순번·설명 라벨 + 콘솔 명령 설명/실제 파라미터/구분선 표기

### 완료된 작업 목록
- `/network` 4개 패널 드롭다운 옵션을 레지스트리(`DiagCommandMeta { command, label, description }`) 기반으로 전환하고, 각 옵션 라벨을 `N. 명령명 — 기능 설명` 형태(순번 + 명령명 + 설명)로 표시했습니다. 예) `12. 시스템 Listen 포트 — 컴퓨터 전체에서 접속 대기 중(LISTEN)인 포트 및 PID 스캔`.
- 콘솔 출력을 `[실행] <명령명> — <설명>` → `[진행] ...` → `$ <실행된 전체 명령>` → `--------------` → 결과 → `--------------` → `[완료] ...` 순으로 개선해 명령이 정확히 어떻게 들어갔는지 구분되도록 했습니다.
- 서버 진단 케이스 15종의 `executedCommand`를 실제 수행 스크립트/전체 셸 명령으로 채웠습니다(Node.js 계열: `Node.js: os.cpus() + ...` 형태, `node_sockets`: `tasklist ...; netstat -ano` 2단계 전체 표기).

### 변경 파일 목록
- `admin/src/components/views/NetworkMonitorView.tsx`
- `server/src/index.ts`
- `docs/rule/R-00202 monitoring.md` (드롭다운 표기 규격 + 터미널 콘솔 출력 규격 반영)
- `docs/askLogs/ask-20260808151324.md` (신규)

### 검증 결과
- server tsc EXIT 0, admin tsc 신규 에러 0건, vite build 성공(`NetworkMonitorView-BWy8YCzg.js`)
- server dist 재컴파일 + pm2 재시작 → 헬스 200
- API 수동: 진단 명령 17종 전체에서 `executedCommand`가 빈 문자열 없이 전체 명령/스크립트로 반환됨
- `/network` 드롭다운 라벨·콘솔 구분선 표기는 브라우저 최종 확인 필요

---

## 2026-08-08 | 네트워크 모니터링 소켓 검증 명령 2종 추가 (Node 소켓 목록 + 시스템 Listen 포트)

### 완료된 작업 목록
- `/network` "패널 3 - 플러그인 소켓 검증" 드롭다운에 `Node 소켓 목록`(`node_sockets`)과 `시스템 Listen 포트`(`system_listen_ports`) 옵션을 추가했습니다.
- `node_sockets`: netstat엔 프로세스명이 없어 빈 결과였던 기존 `findstr node` 구현을, `tasklist`로 node.exe PID를 수집한 뒤 `netstat -ano`와 교차 매칭하는 방식으로 재구현했습니다. `{ nodePids, socketCount, sockets }` 구조 반환(비-Windows: `pgrep -x node` + `ss -tunap`).
- `system_listen_ports`: PID가 없던 `netstat -an` 구현을 `netstat -ano | findstr LISTENING`으로 변경해 포트와 PID를 함께 스캔하도록 수정했습니다.

### 변경 파일 목록
- `server/src/index.ts`
- `admin/src/components/views/NetworkMonitorView.tsx`
- `docs/rule/R-00202 monitoring.md` (진단 명령 스펙 반영)
- `docs/askLogs/ask-20260808145313.md` (신규)

### 검증 결과
- server tsc EXIT 0, admin tsc 신규 에러 0건, vite build 성공(`NetworkMonitorView-DTiqHnTi.js`)
- 재시작 + 헬스 200
- API 수동: `node_sockets` → 서버 PID 53036의 9600 포트 라인 4건 교차 매칭 확인, `system_listen_ports` → 71개 LISTENING 라인(포트+PID) 확인
- 패널 3 드롭다운 동작은 브라우저 최종 확인 필요

---

## 2026-08-08 | DB 관리 메뉴 신설 (워커 & DB 매니저 → 워커 관리 + DB 관리)

### 완료된 작업 목록
- 사이드바 "워커 & DB 매니저" 메뉴를 "워커 관리"로 변경하고, 신규 "DB 관리" 메뉴(`/db`, storage 아이콘)를 추가했습니다. Breadcrumb/라우팅/activeTab(`db`)을 일괄 반영했습니다.
- DB 관리는 "일반 SQLite 관리툴 수준"으로 설계해 6가지 기능을 구현했습니다: SQL 쿼리 실행기, DB·테이블 브라우저, 데이터 그리드 행 CRUD, 스키마 편집(테이블 생성/삭제/컬럼 추가), 백업/복원(생성·목록·다운로드·파일 복원·업로드 복원), 스토리지 모니터링(용량 카드+DB 크기 막대).
- 서버에 `dbManagerService.ts` 신규 구현 + `/api/admin/db/*` REST 라우트 17종을 `index.ts`에 추가했습니다. 쓰기/DDL 실행 시 관리자 활동 로그를 남기며, `dbRel`은 `databases/`·`databases/workers/` 화이트리스트 검증을 거칩니다.
- **경로 버그 수정**: dist/services 하위에서 `..` 2번으로 계산되어 `server/databases`를 가리키던 `dbManagerService.ts`·`workerEngineService.ts`를 `..` 3번으로 수정해 프로젝트 루트 `databases`를 정확히 참조하도록 했습니다.
- `listBackups`의 원본 DB 식별(`sourceDbRel`)을 실제 DB 파일명 매칭 기반으로 개선했습니다.
- admin은 `DbManagerView`(DB 선택+기능 탭)와 패널 5종, 재사용 `DbDataGrid`, `useDbManager` 훅, `dbApiService`를 신규 작성했습니다.

### 변경 파일 목록
- `server/src/services/dbManagerService.ts` (신규), `server/src/services/workerEngineService.ts`, `server/src/index.ts`
- `admin/src/types/index.ts`, `admin/src/services/dbApiService.ts`, `admin/src/hooks/useDbManager.ts`, `admin/src/utils/format.ts` (신규)
- `admin/src/components/tables/DbDataGrid.tsx`, `admin/src/components/views/db/*.tsx` 6종 (신규)
- `admin/src/components/layout/Sidebar/Sidebar.tsx`, `admin/src/components/layout/Breadcrumb/BreadcrumbBar.tsx`, `admin/src/App.tsx`
- `docs/askLogs/ask-20260808141852.md` (신규)

### 검증 결과
- server `tsc --noEmit` EXIT 0, admin `tsc --noEmit` 신규 에러 0건, `vite build` 성공(`DbManagerView-BB9fAA0S.js` 별도 chunk)
- `npm run admin:start` 재시작 + 헬스 200
- API 수동 검증: 파일/테이블/스키마/SELECT/행 CRUD/테이블 생성·삭제/컬럼 추가/백업 생성·목록·다운로드·복원(파일+업로드)/storage-info 모두 정상, Path Traversal은 화이트리스트로 거부
- `/db` UI 동작은 브라우저 최종 확인 필요

---

## 2026-08-08 | /network 빈 화면 복구 (TDZ 선언 전 참조 에러)

### 완료된 작업 목록
- `admin/src/components/views/NetworkMonitorView.tsx`에서 `handleClearSocketEvents`가 `addTerminalLog`보다 앞에 정의되어 발생한 TDZ(선언 전 참조) 에러로, NetworkMonitorView 마운트 시 React 전체 앱이 언마운트되어 빈 화면이 되는 문제를 수정했습니다.
- `handleClearSocketEvents`를 `addTerminalLog` 정의 직후로 이동해 해결했습니다.
- admin에 `tsc --noEmit` 타입 체크를 적용해 TS2448(선언 전 사용) 재발을 방지했습니다(기존 타입 표기 에러는 vite가 타입 체크를 안 해 동작 영향 없음, 범위 밖).

### 변경 파일 목록
- `admin/src/components/views/NetworkMonitorView.tsx`
- `docs/askLogs/ask-20260808045408.md` (신규)

### 검증 결과
- `tsc --noEmit` → TS2448 없음, `vite build` 성공
- `npm run admin:start` 재시작 + 헬스 200, 새 번들 `index-NTFIeQLj.js`·NetworkMonitorView chunk HTTP 200
- `/network` 빈 화면 해소는 브라우저 최종 확인 필요

---

## 2026-08-08 | 진단 패널 정리 + 웹소켓 이벤트 소거 + 콘솔 높이 드래그 조절

### 완료된 작업 목록
- 패널 2의 "물리 저장소 디스크"(`disk_status`) 항목을 UI(`NetworkMonitorView.tsx` 옵션·switch case)와 서버(`index.ts` case) 양쪽에서 제거해 wmic 실행 및 한글 깨짐 근원을 함께 제거했습니다.
- 최근 웹소켓 이벤트 헤더에 "이벤트 소거" 버튼을 추가했습니다. 뷰 내부 `hiddenEventKeys` Set으로 소거된 이벤트만 제외하고, 이후 도착하는 새 이벤트는 다시 표시됩니다(부모 상태 미변경).
- 터미널 콘솔을 `flex-1`(콘텐츠만큼 커지며 브라우저가 길어지던 원인)에서 고정 높이(기본 320px)로 변경하고, 상단 테두리 리사이즈 바를 포인터 드래그로 잡아 높이를 조절하도록 구현했습니다. 최소 160px, 상한은 화면 높이 기준 동적 값(`window.innerHeight - 100`)이며 드래그 중 텍스트 선택을 방지합니다.

### 변경 파일 목록
- `server/src/index.ts`
- `admin/src/components/views/NetworkMonitorView.tsx`
- `docs/askLogs/ask-20260808043938.md` (신규)

### 검증 결과
- server tsc build·admin vite build 성공, `npm run admin:start` 재시작 + 헬스 200
- `disk_status` 진단 → "지원되지 않는 진단 명령입니다" 응답(서버 제거 확인)
- 새 번들 `index-CiLUWm3c.js` 서빙, NetworkMonitorView chunk HTTP 200
- 이벤트 소거·콘솔 높이 드래그는 브라우저 최종 확인 필요

---

## 2026-08-08 | 진단 명령 실행 문자열 표시 + 출력 개행 정리 + 한글 인코딩 해결

### 완료된 작업 목록
- `server/src/index.ts`의 `runShellCommand`에 `euc-kr` 인코딩 옵션을 추가해 Windows netstat 등 로케일 의존 명령의 CP949 한글 출력("활성 연결" 헤더)이 깨지지 않도록 해결했습니다(`TextDecoder('euc-kr')` 디코딩, 영문 로케일과 호환).
- 진단 핸들러의 셸 실행 case를 실행 문자열을 `executedCommand` 변수로 저장·재사용하는 패턴으로 리팩터링하고, 응답을 `data: { command, executedCommand, output }`으로 확장했습니다.
- `admin/src/components/views/NetworkMonitorView.tsx` 콘솔 출력 영역에 `whitespace-pre-wrap`을 추가해 netstat 출력이 한 줄로 붙던 문제를 해결하고, `executeDiagnosticCommand`에서 `$ netstat -ano` 형태의 실행 명령어 표시를 추가했습니다(기존 응답 형식 호환).

### 변경 파일 목록
- `server/src/index.ts`
- `admin/src/components/views/NetworkMonitorView.tsx`
- `docs/askLogs/ask-20260808040925.md` (신규)

### 검증 결과
- server tsc build·admin vite build 성공, `npm run admin:start` 재시작 + 헬스 200
- `netstat_all` 진단 → `executedCommand: "netstat -ano"`, output 개행 포함, 첫 줄 "활성 연결" 정상 디코딩
- `disk_io_2s` 진단 → `{command, executedCommand:'', output:{...}}` 구조 호환 확인
- 새 번들 `index-BScokWZf.js` 서빙, NetworkMonitorView chunk HTTP 200

---

## 2026-08-08 | 네트워크 진단 명령 패널 드롭다운 전환

### 완료된 작업 목록
- `admin/src/components/views/NetworkMonitorView.tsx`의 네트워크 진단 명령 패널에서 28개 버튼으로 구성된 4개 카드 그리드를 제거하고, 패널 1~4 각각을 `<select>` 드롭다운 1개로 교체해 화면을 압축했습니다(사용자 확인: 그룹별 select 4개 + 선택 즉시 실행).
- 각 select는 플레이스홀더 옵션(`value=""`)을 기본으로, 명령 옵션 선택 시 `handleButtonClick(action)`으로 즉시 실행 후 플레이스홀더로 리셋되어 같은 명령 재실행이 가능합니다.
- 기존 `ControlConsoleView.tsx`의 select 스타일 패턴을 재사용하고 그룹명 라벨·`aria-label`을 부여했습니다. `runningCommand` 동안 select 영역을 비활성화해 중복 실행을 차단합니다(R-00302 준수).

### 변경 파일 목록
- `admin/src/components/views/NetworkMonitorView.tsx`
- `docs/askLogs/ask-20260808035108.md` (신규)

### 검증 결과
- `vite build` 성공, `npm run admin:start` → PM2 online + `server-started on port 9600`
- `GET /` 새 번들 `index-CmKN3rUJ.js` 참조, NetworkMonitorView chunk HTTP 200, 헬스체크 200

---

## 2026-08-08 | admin:start 콘솔 창 깜빡임 재발 해결 (셸 래퍼 제거 + --no-vizion)

### 완료된 작업 목록
- 1차 수정(windowsHide 추가)으로도 콘솔 창이 계속 나타나, 프로세스 시작 이벤트 추적(Win32_Process)으로 원인 3곳을 규명했습니다. ① `spawnSync(npx.cmd ...)`의 npx 배치 래퍼 내부 `cmd /c pm2 ...` 재실행 ② PM2 데몬의 vizion 기능(`git status`/`git tag`) ③ PM2 데몬의 `taskkill`.
- `server/scripts/start-server.js`에서 셸 래퍼 사용을 완전히 제거하고 `node.exe`로 tsc/pm2 CLI를 직접 실행(`windowsHide: true` 유지)하도록 재작성했습니다.
- PM2 시작 옵션에 `--no-vizion`을 추가해 데몬의 git 호출을 비활성화하고, 기존 프로세스의 vizion 환경을 없애기 위해 `pm2 delete` 후 `--no-vizion`으로 `pm2 start`하는 방식으로 변경했습니다.
- 재작성 중 발생한 `resolve is not defined`(import 누락) 에러를 `path.resolve`로 보정했습니다.
- `npm run admin:start`는 npm 워크스페이스 전파로 **admin 워크스페이스의 `admin:start`(`node start.js`)가 실행**되며, `admin/start.js`가 `start-server.js`를 spawn하는 흐름임을 확인했습니다(루트 `admin:start`가 아님).

### 변경 파일 목록
- `server/scripts/start-server.js` (셸 래퍼 제거·node 직접 실행·--no-vizion)
- `docs/askLogs/ask-20260808033727.md` (신규)

### 검증 결과
- `npm run admin:start` → admin/start.js → start-server.js → PM2 start 완료, `server-started on port 9600`
- PM2 `WebCrawlServer` online(새 PID), `pm2 describe`의 `version: N/A` → vizion 비활성화 확인
- `GET /api/admin/network/health` → `{"success":true,...,"port":9600}`
- 콘솔 창 깜빡임 해소는 사용자 터미널에서 `npm run admin:start` 재실행으로 최종 확인 필요

---

## 2026-08-08 | admin:start 실행 시 콘솔 창 깜빡임 제거 (start-server.js windowsHide)

### 완료된 작업 목록
- `npm run admin:start` 시 콘솔 창이 3회 깜빡이며 실행되고 사라지는 현상을 `server/scripts/start-server.js`의 `spawnSync` 3곳에 `windowsHide: true`를 추가해 해결했습니다. 원인은 `spawnSync`가 셸(`npm.cmd`/`npx.cmd`) 실행 시 콘솔 창을 새로 생성하기 때문입니다.

### 변경 파일 목록
- `server/scripts/start-server.js` (spawnSync 3곳 옵션 추가)
- `docs/askLogs/ask-20260808032708.md` (신규)

### 검증 결과
- `npm run admin:start` → 서버 빌드 정상, PM2 online(새 PID), `server-started on port 9600`, 헬스체크 200

---

## 2026-08-08 | netstat 진단 시 콘솔 창 깜빡임 제거 (windowsHide)

### 완료된 작업 목록
- admin 네트워크 모니터링 패널 1의 netstat 버튼 클릭 시 Windows 콘솔 창이 깜빡이고 사라지는 현상을 `runShellCommand()`에 `windowsHide: true`를 추가해 해결했습니다. 원인은 `child_process.exec`가 셸 사용 시 콘솔 창을 새로 생성하기 때문입니다.

### 변경 파일 목록
- `server/src/index.ts` (`runShellCommand` 옵션 1줄 추가)
- `docs/askLogs/ask-20260808032053.md` (신규)

### 검증 결과
- 헬스체크 200(port 9600), `netstat_9600`·`netstat_listening` 진단 응답 정상, PM2 online

---

## 2026-08-08 | docs/todo.md 완료 작업 정리 및 초기화

### 완료된 작업 목록
- `docs/todo.md`에 누적된 완료 작업 이력이 모두 `docs/askLogs/`에 기록되어 있음을 매핑으로 확인하고(빈 화면 복구→ask-20260808023936, 진단 확장·API→ask-20260807124500, 2026-08-08 예정 작업 4건→ask-20260808070000), `docs/todo.md`를 초기 상태로 비웠습니다.

### 변경 파일 목록
- `docs/todo.md`
- `docs/askLogs/ask-20260808031310.md` (신규)

### 검증 결과
- `docs/todo.md` 구조(`현재 작업`·`완료된 작업`·`예정 작업`) 유지, 내용 "(없음)"으로 초기화 확인

---

## 2026-08-08 | 플러그인 포트 통일(9700→9600) 및 네트워크 진단 보강

### 완료된 작업 목록
- `plugins/basic-plugin/vite.config.ts`의 `__SERVER_PORT__` 기본값과 `src/config/pluginConfig.ts` 폴백 포트를 9700→9600으로 통일하고 플러그인 dist를 재빌드했습니다.
- 9700 포트에 별도로 떠 있던 수동 실행 서버 프로세스(`node server/dist/index.js`, PID 25160)를 종료해 단일 서버 인스턴스(PM2, 9600)로 통일했습니다.
- `server/src/index.ts` 진단 명령 보강:
  - `disk_io_2s`의 netstat 실행 버그를 물리 디스크 쓰기 벤치마크(MB/s)로 교체했습니다.
  - `cleanup_dead_sockets` 서버 구현(비OPEN 데드 소켓 강제 종료·세션 제거)을 추가했습니다.
  - `avg_rtt` 구현(PING_TEST 발신 시각 기록 + PONG_RESPONSE 수신 시 RTT 링 버퍼 20개 누적, 평균/최소/최대/최근 RTT 집계)을 추가했습니다.
- `admin/src/components/views/NetworkMonitorView.tsx` 개선:
  - `runningCommand` 상태로 실행 중 배지 표시 및 명령 버튼 비활성(흐림) 처리, 중복 실행 차단을 추가했습니다.
  - 진단 응답을 4,000자로 제한해 요약 출력하고 소요 시간·출력 길이를 로그로 남기도록 개선했습니다.
  - '세션 1:1 핑' 버튼을 실제 1:1 세션 핑(대상 ID 입력) 동작으로 연결했습니다.

### 변경 파일 목록
- `plugins/basic-plugin/vite.config.ts`
- `plugins/basic-plugin/src/config/pluginConfig.ts`
- `plugins/basic-plugin/src/offscreen.ts` (주석)
- `plugins/basic-plugin/src/types/env.d.ts` (주석)
- `server/src/index.ts`
- `admin/src/components/views/NetworkMonitorView.tsx`
- `server/dist/*`, `server/public/*`, `plugins/basic-plugin/dist/*` (빌드 산출물, git 제외 대상)

### 검증 결과
- 플러그인 빌드 후 `dist/pluginConfig.js`에 `port:9600` 내장 확인
- `POST /api/admin/network/diagnostic` → `disk_io_2s`: `{"durationSeconds":2.01,"writtenBytes":489684992,"writeMbps":232.22}`
- `POST /api/admin/network/diagnostic` → `cleanup_dead_sockets`: `{"cleaned":0,"remaining":1}`
- `POST /api/admin/network/diagnostic` → `avg_rtt`: 연결 플러그인 노드 1대 감지(`sampleCount:0`, 샘플 미발생)
- `GET /api/admin/network/health` → 200, `{"success":true,"data":{"port":9600,...}}`
- admin·server `tsc/vite build` 에러 없음, PM2 `WebCrawlServer` online (새 PID)

---

## 2026-08-08 | 관리자 대시보드 빈 화면 복구 (admin:start 프로덕션 번들 강제 빌드)

### 완료된 작업 목록
- `server/public/index.html`이 Vite 개발 모드 진입점(`/@vite/client`, `/src/main.tsx`)으로 오염되어 관리자 UI가 빈 화면으로 표시되는 문제를 진단하고, admin 프로덕션 빌드 재수행으로 `/assets/index-*.js` 참조를 복원했습니다.
- 루트 `package.json`의 `admin:start` 스크립트를 수정하여 서버 기동 전에 admin 빌드가 선행되도록 보강했습니다.
- PM2 `WebCrawlServer` 프로세스를 재기동하고 9600 포트의 관리자 UI·SPA 라우트·REST API 응답을 검증했습니다.

### 변경 파일 목록
- `package.json` (루트, `admin:start` 스크립트)
- `server/public/*` (admin 빌드 산출물 재생성, git 제외 대상)

### 검증 결과
- `GET /` → 200, `/assets/index-fiF9j854.js` 참조 확인
- SPA 라우트 `/clients`, `/network`, `/workers` → 200 text/html
- `GET /api/admin/network/health` → `{"success":true,"data":{"port":9600,...}}`

---

## 2026-08-07 | 네트워크 모니터링 진단 패널 확장

### 완료된 작업 목록
- `admin/src/components/views/NetworkMonitorView.tsx`에서 네트워크 진단 명령 패널을 4개 그룹으로 확장했습니다.
- `server/src/index.ts`에 `/api/admin/network/diagnostic` 및 `/api/admin/network/token-push` REST API를 추가했습니다.

---

## 2026-08-06 | Phase 2~6 전면 구현 완료

### 완료된 작업 목록
