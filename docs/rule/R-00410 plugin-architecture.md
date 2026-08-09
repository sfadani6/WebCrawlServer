본 문서는 `WebCrawlServer` 브라우저 확장 플러그인의 모듈화 아키텍처 개정 지침입니다. 기존 팝업 중심의 파일 구조에서 **사이드바 단일 UI(`sidepanel.tsx`)** 및 **오프스크린 24시간 소켓 엔진(`offscreen.ts`)** 패러다임으로 이관됨에 따라 향상된 계층화 디렉터리 구조와 모듈 분리 규정을 재정의합니다.

---

## 1. 모듈화 아키텍처 개요 및 목적

1.1 **단일 책임 원칙 (SRP)**: 각 소스 파일, 함수, 컴포넌트는 오직 하나의 명확한 책임만 가집니다.  
1.2 **200라인 제한 규정**: 단일 소스 파일이 200라인을 초과할 경우 반드시 기능별 모듈 파일로 분할해야 합니다.  
1.3 **계층 분리 체계**: I/O 소켓 통신 계층(`offscreen.ts`), 이벤트 조율 계층(`background.ts`), 프레젠테이션 UI 계층(`sidepanel.tsx`), 외부 API 서비스 계층(`services/`)을 엄격히 분리합니다.  

---

## 2. 표준 계층 및 디렉터리 구조

`plugins/basic-plugin/src/` 내부 소스 코드는 아래의 표준 계층 구조를 준수해야 합니다.

```
plugins/basic-plugin/src/
├── config/                  # 빌드 타임 주입 상수 및 소켓 URL 모듈
│   └── pluginConfig.ts
├── types/                   # 전역 타입 및 확장 패킷 봉투 정의 계층
│   ├── env.d.ts             # Vite define 전역 상수 타입 선언
│   └── index.ts             # WebSocketPacket<T> 및 파일/메타 타입 명세
├── services/                # 순수 통신 및 크롬/외부 API I/O 계층
│   ├── chromeService.ts     # 크롬 API 및 오프스크린 상태 질의
│   ├── githubService.ts     # 깃허브 REST API 커밋/푸시 서비스 (보류: 백로그 항목)
│   └── backgroundScraper.ts # 백그라운드 fetch() + DOMParser 인출 모듈
├── hooks/                   # 비즈니스 로직 및 React 상태 관리 훅 계층
│   └── usePopupState.ts     # 사이드바 UI용 상태 및 비즈니스 콜백 캡슐화
├── components/              # UI 프레젠테이션 컴포넌트 계층
│   ├── Header.tsx           # 상단 타이틀 툴바
│   ├── TabBar.tsx           # 탭 네비게이션
│   ├── Footer.tsx           # 하단 노드 ID 및 소켓 포트 표출 UI
│   └── tabs/                # 탭별 프레젠테이션 뷰 컴포넌트
│       ├── BasicTab.tsx     # 기본 수집 탭
│       ├── InfoTab.tsx      # 브라우저/프로세서 정보 탭
│       └── DebugTab.tsx     # 디버깅 및 커스텀 패킷 테스트 탭
├── background.ts            # 오프스크린 생성 및 메시지 라우터
├── content.ts               # DOM 수집 및 선언형 페이징 순차 수집 엔진
├── sidepanel.tsx            # 단일 메인 사이드바 UI 엔트리 (30라인 이하)
└── offscreen.ts             # 24시간 무중단 단일 웹소켓 전담 엔진
```

### 2.1 오페라 전용 플러그인 병행 구조 (`plugins/opera-plugin/`)

오페라 브라우저 지원을 위해 `plugins/opera-plugin/`을 별도 워크스페이스로 분리 유지합니다. `plugins/basic-plugin`의 전체 소스 구조를 그대로 공유하며, **오페라 특수 부분만 변경**합니다.

```
plugins/opera-plugin/
├── public/manifest.json     # "sidePanel" permission 제거 + "sidebar_action" 키 사용 (R-00460 §6)
├── src/background.ts        # chrome.sidePanel?.setPanelBehavior(...) 옵셔널 가드 (오페라 예외 방지)
└── (그 외)                  # basic-plugin과 동일 구조/기능 유지
```

- 구조 원칙: `basic-plugin`을 기준 소스로 유지하고 `opera-plugin`은 오페라 전용 사본으로 관리합니다. 두 플러그인의 소스 헤더 경로 주석은 각자의 디렉터리 경로를 명시합니다.
- 배포 원칙: 크롬 웹스토어/크롬 확장은 `plugins/basic-plugin/dist/`를, 오페라 확장은 `plugins/opera-plugin/dist/`를 각각 개발자 모드로 로드합니다. 상세 결정 사항은 `ADR-006` 문서를 참조합니다.

---

## 3. 계층별 역할 및 표준 가이드

### 3.1 `offscreen.ts` (소켓 통신 계층)
- **역할**: 백엔드 포트(9600)와의 단일 웹소켓을 24시간 단독 소유하며, 패킷 수신 시 크롬 내부 메시징으로 전달.
- **규칙**: UI 렌더링 코드를 일절 포함하지 않으며 오직 통신 및 스토리지 최신화만 수행.

### 3.2 `background.ts` (이벤트 라우팅 계층)
- **역할**: 아이콘 클릭 시 사이드바 즉시 실행 지정 및 오프스크린 문서 자동 생성/유지 관리.
- **규칙**: 직접 웹소켓을 연결하지 않고 내부 메시지 중계 라우팅만 수행.

### 3.3 `services/` (외부 I/O 서비스 계층)
- **역할**: `chrome.*` API, GitHub REST API (`githubService.ts`), 백그라운드 HTML 인출(`backgroundScraper.ts`) 수행.
- **규칙**: React 라이브러리(`useState`, `useEffect`)와 완전히 독립된 순수 비동기 함수 형태로 작성.

### 3.4 `hooks/` (비즈니스 로직 계층)
- **역할**: 서비스 계층의 함수를 호출하고 React 상태 및 액션 콜백을 포장.
- **규칙**: JSX HTML 렌더링 코드를 포함하지 않고 UI 컴포넌트에 전달할 상태와 핸들러만 반환.

### 3.5 `sidepanel.tsx` 및 `components/` (UI 프레젠테이션 계층)
- **역할**: 유저 상호작용 및 단일 대시보드 UI/UX 렌더링.
- **규칙**: 최상위 `sidepanel.tsx` 엔트리는 `usePopupState` 훅을 호출하여 레이아웃을 마운트하는 **30라인 이하의 소형화 상태**를 유지해야 함.

---

## 4. 데이터 단방향 흐름 규칙 (Single-Direction Data Flow)

```
[ User Action ] ──► [ SidePanel Component ] (BasicTab, DebugTab 등)
                             │
                             ▼ (Trigger Callback)
                     [ Custom Hook ] (usePopupState)
                             │
                             ▼ (Call Service / Send Message)
                     [ Pure Service Module / Offscreen ]
                             │
                             ▼ (WebSocket)
                     [ WebCrawlServer (Port 9600) ]
```

---

## 5. 리팩토링 체크리스트

- [ ] 메인 UI 진입점인 `sidepanel.tsx` 파일이 30라인 이하로 소형화되었는가?
- [ ] 단일 소스 파일 중 200라인을 초과하는 거대 파일이 존재하지 않는가?
- [ ] `offscreen.ts`가 웹소켓 연결을 단독 소유하고 있는가?
- [ ] `services/` 모듈들이 React 라이브러리와 독립된 순수 함수로 작성되었는가?
