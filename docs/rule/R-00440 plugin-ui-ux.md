본 문서는 `WebCrawlServer` 브라우저 확장 플러그인의 UI/UX 디자인 개정 지침입니다. 기존 팝업 UI 규격에서 **브라우저 세로 전체를 사용하는 상시 고정형 사이드바 대시보드(`sidepanel.tsx`)** 디자인 시스템으로 개정됨에 따라, 화면 레이아웃, 다중 포스팅 작성 폼, 깃허브 연동 폼 및 상태 피드백 표준을 정의합니다.

---

## 1. 디자인 기본 원칙 및 테마

1.1 **테마 규격**: 다크 투톤 스타일 적용 (기본 배경: `#0d131f`, 카드 배경: `#162032`, 주요 강조색: `#1d4ed8` / `#38bdf8`)  
1.2 **타이포그래피**: 기본 본문 `Noto Sans KR`, 폰트 및 노드 ID/로그 표현용 `JetBrains Mono` / `monospace`  
1.3 **아이콘 배제 원칙**: 폰트 아이콘(Google Material Symbols 등)은 사용하지 않으며, 텍스트 레이블 중심으로 UI를 구성한다. 예외적으로 아코디언 열림/닫힘 표시만 유니코드 `▼`/`▶` 문자를 허용한다.  
1.4 **버튼 색상 체계**: 파랑 그라데이션을 주 실행 색으로 단일화한다.
   - `btn-primary` (주 실행 버튼, 전체 폭): 파랑 그라데이션 `#1d4ed8→#3b82f6` + 흰 글씨. **비활성 상태는 `opacity` 대신 명시적 색상**(배경 `#1e293b` + 테두리 `#334155` + 글씨 `#94a3b8`)으로 표시해 가시성을 확보한다.
   - `btn-accent` (요소 선택 모드): 앰버 그라데이션 `#b45309→#f59e0b` — 기능 구분용 유일 예외.
   - `btn-secondary` (보조 그리드 — 이미지 수집 카테고리): 배경 `#1e293b` + 테두리 `#334155` + 글씨 `#e2e8f0`, 비활성 시 글씨 `#64748b`.
   - `btn-mini` (소형 다크 — 터미널 헤더 버튼): 배경 `#334155`, 활성 토글 시 에메랄드 `#059669` + 흰 글씨.
   - 파랑은 단일 스펙으로 통일하며, `#1A73E8` 등 이종 파랑은 사용하지 않는다.

---

## 2. 사이드바 대시보드 레이아웃 구조 (`sidepanel.tsx`)

사이드바 UI는 상단 헤더, 탭 네비게이션 바, 메인 콘텐츠 영역, **공통 터미널 콘솔(모든 탭 하단 맨 아래)**, 하단 푸터로 명확히 구조화되어야 합니다.

```
+------------------------------------------+
| ● WebCrawlServer 대시보드               | <- Header (아이콘 대신 도트 배지)
+------------------------------------------+
| [ 기본 ] | [ 정보 ] | [ 디버깅 ] | [ 설정 ] | <- TabBar
+------------------------------------------+
|                                          |
| ( 탭별 메인 뷰 컨테이너: flex: 1 )       | <- Main Content Area (overflow-y: auto)
|                                          |
+------------------------------------------+
| TERMINAL                     [⌃] [×]     | <- 공통 TerminalConsole (모든 탭 공유)
| 19:52:01 INFO   WebSocket connected      |
| > _                                      |
+------------------------------------------+
| 노드 ID: f47ac10b-58cc...                | <- Footer
+------------------------------------------+
```

### 2.1 주요 탭별 구성 요소
- **`기본` 탭**:
  - 오프스크린 웹소켓 실시간 연결 상태 배지 (`● 온라인` / `○ 오프라인`)
  - 현재 페이지 URL 카드 (활성 탭 감시로 자동 갱신)
  - **DOM 전송** 아코디언: 라디오 `전체`/`요소선택`/`프레임` 선택 → 모드별 실행 버튼 (전체=fullDom 전송, 요소선택=파란 테두리 선택 모드, 프레임=iframe DOM 전송, iframe 미존재 시 비활성화)
  - **이미지 수집** 아코디언: 현재 페이지 이미지를 추출해 서버 전송
  - **액션 실행** 아코디언: 사이트별 액션 모듈을 표시합니다. 현재 `xvideos.com` 모듈이 구현되어 있으며, 기본 탭의 각 사이트 그룹 이미지 수집 버튼 블록 하단에 해당 모듈의 실행 버튼이 함께 표시됩니다(아래 2.4 § 참조)
- **`정보` 탭**:
  - 브라우저 환경 정보 (플랫폼, 언어, User-Agent) 및 프로세서 정보 (CPU 코어 수, 디바이스 메모리)
- **`디버깅` 탭**:
  - 서버에 보낼 JSON 메시지 입력(`debug-textarea`) + [보내기] 버튼 + 전송 상태 표시
  - (터미널 콘솔은 하단 공통 컴포넌트로 이동)
- **`설정` 탭**:
  - 노드 한글 별칭(Alias) 입력 및 서버 저장

### 2.3 xvideos 다운로드 매니저 전용 팝업 창 (`xvideosManager.tsx`)

패널 폭 협소 문제를 해소하기 위해 xvideos 다운로드 매니저는 사이드바 내부가 아닌 **전용 팝업 창(`chrome.windows.create({ type: "popup" })`, 900×760)**으로 분리 표시합니다. 사이드바/팝업의 xvideos 그룹은 "다운로드 매니저 열기" 버튼을 제공하며, 매니저 창은 대상 xvideos 탭(`?tabId=`)을 쿼리로 전달받아 독립 동작합니다.

- **창 생성 흐름**: 사이드바 `handleOpenXvideosManager` → `chrome.tabs.query({ url: "*://*.xvideos.com/*" })`로 대상 xvideos 탭 탐색(활성 탭 우선, 없으면 첫 탭) → `chrome.windows.create({ url: chrome.runtime.getURL("xvideos-manager.html?tabId=…"), type: "popup", width: 900, height: 760, focused: true })`. `windows` 권한이 manifest permissions에 필요합니다.
- **진입 검증**: 매니저 페이지가 `chrome.tabs.get(tabId)`로 탭 유효성을 확인하고, 실패 시 `chrome.tabs.query`로 폴백하며, xvideos 탭이 없으면 초기 오류 안내("xvideos.com 탭을 찾을 수 없습니다...")를 표시합니다.
- **레이아웃**:
  - 헤더: 제목(`xvideos.com 다운로드 매니저`) + 대상 페이지 URL(축약) + [닫기] 버튼(`window.close()`)
  - 상태 영역: 저장 위치 절대경로(`absDir`) + 진행 상태 메시지
  - **페이지 전체 스크롤**: 매니저 HTML `<html class="manager-scrollable">`이 전역 `html/body { overflow: hidden }`을 해제하고(`popup.css`의 `html.manager-scrollable { overflow-y: auto }` + 가시 스크롤바 thumb `#475569`), 목록·버튼·로그를 포함한 **창 전체가 통째로 스크롤**되어 아래 데이터까지 항상 확인 가능합니다. 루트는 `h-screen`이 아닌 `min-h-screen`으로 자연 높이로 펼쳐집니다.
  - 항목 목록: 항목 카드(상태 배지: 대기/다운로드/완료/실패 + 제목 + clickUrl)
  - 항목별 **다운로드 대상 이미지 URL 주소**: `image_url`/`sfw_image_url`/`preview_video_url` 3줄을 `break-all`+선택 복사 가능하게 표시(썸네일 미리보기가 아니라 실제 다운로드할 주소)
  - 항목별 **프로그레스 바**: 다운로드 시작 직후(0%) 스카이 쉬머 애니메이션(`progress-bar-indeterminate`) → 오프스크린 단계 이벤트로 실제 % 갱신 → 완료 100%(에메랄드)/실패 100%(레드), 우측 % 숫자 표기
  - 버튼 3종: [목록 생성] / [진행] / [초기화] — `btn-primary`/`btn-secondary`/`btn-mini` 토큰 재사용
  - 하단 로그 터미널: 작업 진행 로그(레벨별 색상)
- **상태 관리**: `useXvideosDownloadManager` 훅(`src/hooks/useXvideosDownloadManager.ts`)이 목록/순차 진행/초기화/로그(200건 상한)를 전담하며, 오프스크린의 `FETCH_MEDIA_BUNDLE_PROGRESS` 브로드캐스트를 `chrome.runtime.onMessage`로 수신해 항목 `progress`를 실시간 갱신합니다. 기존 `mediaAckWaiters`(60초)/`storageLocationWaiter`(15초) 파이프라인과 동일 컨텍스트에서 동작합니다.
- **자동 목록 생성**: 최초 진입 시 대상 탭으로 `COLLECT_XVIDEOS_MEDIA`를 1회 요청해 목록을 자동 구성합니다.

### 2.4 액션 실행 모듈 및 액션 실행기 팝업 창 (`actionRunner.tsx` / `ActionRunnerView.tsx`)

자동 이동·연속 수집 같은 **오래 걸리는 액션**은 사이드바가 아닌 **액션 실행기 전용 팝업 창(`chrome.windows.create({ type: "popup" })`, 900×760)**으로 분리 실행합니다. 진행 상태를 팝업이 보유하므로 **팝업 창을 닫으면 실행이 중단**되며, 서버·탭 상태에 부담을 주지 않습니다.

- **실행 버튼 위치**: 기본 탭 하단의 **"액션 실행"** 섹션(§2.2 레이아웃) 하위에 사이트별 액션 모듈 카드를 배치합니다. 현재 구현된 `xvideos.com · xvideos.red` 모듈은 **"xvideos 페이징 액션"** 버튼을 제공하며, `(matchedSite === "xvideos.com" || matchedSite === "xvideos.red") && isServerOnline`일 때만 활성화됩니다. (버튼 활성화는 페이징 페이지 여부와 무관하며, 액션 실행기 팝업이 xvideos 탭을 직접 탐색합니다)
- **창 생성 흐름**: `handleOpenXvBestOfRedAction()` → `chrome.tabs.query({ url: ["*://*.xvideos.com/*", "*://*.xvideos.red/*"] })`로 대상 탭 탐색(페이징 경로 `/<세그먼트>/YYYY-MM` 탭 우선 → 활성 탭 → 첫 탭) → `chrome.windows.create({ url: chrome.runtime.getURL("action-runner.html?module=best-of-red&tabId=…"), type: "popup", width: 900, height: 760, focused: true })`. xvideos(xvideos.com/xvideos.red) 탭이 없으면 팝업이 초기 오류 안내를 표시합니다.
- **액션 실행기 레이아웃** (`ActionRunnerView.tsx`, `xvideos-manager.html`과 동일한 `manager-scrollable` 전역 스크롤 규격):
  - 헤더: 액션명(`xvideos 페이징 액션`) + 대상 탭 URL(축약) + 실행 상태 배지(`idle`/`init`/`running`/`completed`/`stopped`/`error` 구분 색상) + [닫기] 버튼(`window.close()`)
  - 초기 정보 카드: 감지된 베이스 경로(URL 분석 결과, 예: `/best/2026-03`)/총 페이지 수(시작 0 ~ 마지막 maxPage)/현재 페이지/마지막 페이지
  - **진행률 바**: 현재 페이지 ÷ 총 페이지(`%` 표기) + [시작] / [중지] 버튼(`btn-primary`/`btn-secondary`)
  - **행동 로그 콘솔(페이지별 트리)**: 로그를 **페이지 키(`page` 번호)별 펼침/접기 트리 그룹**으로 표시합니다. 페이지 그룹은 등장 순서대로 배치되고, 그룹 헤더에 ▾/▸ 토글 + 상단 배지(오류 > 경고 > 완료 우선순위) + 로그 수를 표시합니다. **현재 작업 중인 페이지 그룹은 자동 펼침 + `scrollIntoView` 자동 스크롤**되며, 전역 그룹(`__global__`: 실행 시작/완료 등 페이지 무관 로그)은 항상 펼침입니다. "전체 펼치기/접기" 버튼으로 일괄 토글합니다. 로그는 이동·로드 검증(네트워크 상태 포함)·수집(시도 n/3)·미디어 저장·서버 저장 단계로 구분되며 레벨별 색상과 최대 300건 유지 규칙을 적용합니다.
  - 완료 배너: 성공/실패 페이지 수(실패 페이지 목록), JSON 저장 수, 미디어 저장 성공/실패 집계, 저장 루트(`images/<도메인>/<세그먼트>/<월>/<N>/`) 요약 표시
- **상태 관리**: `useBestOfRedRunner` 훅(`src/hooks/useBestOfRedRunner.ts`)이 상태 머신(`idle/init/running/completed/stopped/error`), 로그(`key: action_log_<seq>`, 300건 상한, 각 로그에 **`page: number | null` 그룹 키** 포함), 진행도, 완료 요약(`summary`), 시작/중지(`stopRequested` ref)를 전담합니다. `ActionRunnerView.tsx`는 로그를 `page` 키로 그룹화한 트리를 렌더링합니다. `actionRunner.tsx`는 쿼리 파라미터(`module`/`tabId`)를 파싱하고 탭 유효성 검증·폴백 탐색을 담당합니다.

---

## 3.4 공통 터미널 콘솔 규격 (`TerminalConsole.tsx`)

터미널 콘솔은 **모든 탭 페이지 하단 맨 아래**에 공통으로 배치되는 공용 컴포넌트(`components/TerminalConsole.tsx`)이며, admin 네트워크 모니터링(`/network`) 콘솔과 동일한 시각 규격을 따릅니다. `sidepanel.tsx`/`popup.tsx` 레이아웃에서 탭 내용 영역(`flex-1`) 아래, 푸터 위에 위치합니다.

- **로그 데이터 소스**:
  - 오프스크린에서 수신된 웹소켓 패킷(`SOCKET_PACKET_RECEIVED`) — `usePopupState`의 `receivedLogs` 파이프라인을 터미널 로그로 함께 기록 (`[패킷 수신] <action> | sender: <UUID 앞 8자> | <payload 요약>`, `PONG_RESPONSE`는 success 색상)
  - 플러그인 동작 로그: 소켓 상태 조회, DOM/요소/프레임/이미지 수집, 디버그 전송, 탭 전환
- **로그 타입별 색상**: `success`(emerald), `error`(rose), `warning`(amber), `cmd`(sky), 기본(슬레이트) — admin과 동일
- **구조**: 리사이즈 바(상단 테두리 드래그로 높이 조절, 기본 200px) → 헤더(터미널 콘솔 + 콘솔 소거/자동 스크롤 토글 버튼) → 로그 출력 영역(자동 스크롤, 타임스탬프 표시) → `>` 명령 입력 줄
- **외곽 디자인**: 하늘색 계열 아웃라인(`outline: 1px solid rgba(56,189,248,0.35)` + `outline-offset: 2px`)과 개선된 스크롤바(6px 웹킷 스크롤바, hover 강조)를 적용합니다.
- **콘솔 명령어**: `help`(도움말) / `clear`(비우기) / `status`(`GET_SOCKET_STATUS`로 소켓 상태 조회) / `ping`(`PING_TEST` 패킷 전송) / `send <json>`(JSON 파싱 후 `CRAWL_METADATA` 봉투로 서버 전송) / 알 수 없는 명령은 error 로그
- **상태 관리**: `PluginLogEntry { id, timestamp, type, text }` 타입(`types/index.ts`)과 `terminalLogs`/`autoScroll`/`commandInput`/`consoleHeight` 상태는 `usePopupState`가 소유, UI는 `TerminalConsole.tsx`가 렌더링
- **범용 패킷 전송**: `chromeService.sendSocketPacket()`은 임의 액션/타깃/페이로드 패킷을 `SEND_SOCKET_PACKET`으로 전송하며, `sendDebugMessage()`는 이를 `CRAWL_METADATA` 봉투로 감싸는 얇은 래퍼

---

## 3. 사이드바 반응형 레이아웃 및 텍스트 선택 규정

3.1 **수직 유연성 (Flexbox)**: 사이드바 높이가 조절될 때 헤더, 탭바, 터미널 콘솔, 푸터는 고정(`flex-shrink: 0`)되고, 중앙 탭 콘텐츠 영역만 수직 확장(`flex: 1`, `overflow-y: auto`)되어 스크롤바를 제공합니다. 터미널 콘솔은 자체 높이(리사이즈 바)만큼 고정되어 모든 탭에서 하단 맨 아래에 동일하게 표시됩니다.  
3.2 **텍스트 드래그 선택 복사 지원 (`user-select: text`)**: 노드 ID, URL, 수집된 로그 텍스트, 깃허브 SHA 값 등은 마우스 드래그 선택 및 복사(`user-select: text`)가 보장되어야 합니다.  

---

## 4. 시각적 상태 피드백 및 모달 표출

4.1 **소켓 가동 배지**:
   - `● 온라인 (사이드바 활성 🖥️)`: 파란색 애니메이션 펄스 배지
   - `● 온라인 (백그라운드 가동 🌙)`: 초록색 애니메이션 펄스 배지
4.2 **버튼 처리 상태**:
   - 전송 중일 때 버튼 비활성화(`disabled`)하고 라벨을 "전송 중..."/“이미지 수집 중...” 등 텍스트로 전환한다. (아이콘 스피너 대신 텍스트 기반 진행 표시)
4.3 **원격 긴급 모달**:
   - 서버에서 `SHOW_ALERT_MODAL` 패킷 수신 시 사이드바 중앙에 경고 모달 창 즉시 팝업.

---

## 5. 검증 체크리스트

- [ ] 사이드바 UI가 브라우저 우측에 세로 전체로 깔끔하게 렌더링되는가?
- [ ] 탭 스위칭(`기본`, `정보`, `디버깅`, `설정`) 시 화면 전환이 부드럽게 이루어지는가?
- [ ] 터미널 콘솔이 모든 탭 하단 맨 아래에 동일하게 고정 표시되는가?
- [ ] 활성 탭 전환/페이지 이동 시 `[현재 페이지]` URL이 자동으로 갱신되는가?
- [ ] 기본 탭의 DOM 전송 라디오(전체/요소선택/프레임) 및 이미지 수집/액션 실행(xvideos.com · xvideos.red 모듈) 섹션이 정상 표시되는가?
- [ ] xvideos.com 또는 xvideos.red 페이지에서 액션 실행의 "xvideos 페이징 액션" 버튼이 활성화되고, 액션 실행기 팝업 창(900×760)이 열리며 **페이지별 트리 로그**(현재 페이지 자동 펼침·자동 스크롤, 전체 펼치기/접기) · 진행률 바 · 완료 배너(실패 페이지/미디어 집계)가 갱신되는가?
- [ ] 주요 노드 ID, 로그, URL 문자가 마우스 드래그로 복사되는가?
- [ ] 서버 패킷 수신 시 상태 배지 및 모달 창이 실시간으로 반응하는가?
