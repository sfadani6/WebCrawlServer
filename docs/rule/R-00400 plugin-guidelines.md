본 문서는 `WebCrawlServer` 프로젝트의 브라우저 확장 플러그인 개발 및 운영을 위한 최상위 통합 지침 문서입니다. **사이드바 통합 UI(`sidepanel.tsx`)** 및 **24시간 무중단 백그라운드 소켓 엔진(`offscreen.ts`)** 패러다임을 반영한 전체 시스템 아키텍처 개요, 운영 원칙 및 하위 세부 규칙 문서(`R-00410` ~ `R-00490`)로 연결되는 통합 목차(Index) 역할을 담당합니다.

---

## 1. 개요 및 적용 범위

1.1 **적용 대상**: `plugins/basic-plugin/` 패키지 및 본 프로젝트에 포함된 브라우저 확장 프로그램  
1.2 **표준 규격**: Chrome Extension Manifest V3 (MV3) 표준 규격 준수  
1.3 **기술 스택**: Node.js, TypeScript, ESM(`import`/`export`), React 19, Vite, Tailwind CSS  
1.4 **운영 목적**:
   - 오프스크린(`offscreen.ts`)을 통한 24시간 무중단 백그라운드 웹소켓 통신 유지 및 수집 패킷 적재.
        - 상시 고정형 사이드바(`sidepanel.tsx`) 대시보드를 통한 실시간 수집 감시, 멀티 SNS 자동 포스팅.
        - (참고) `깃허브(GitHub)` 연동/자동 커밋은 현재 보류 항목입니다. 즉시 구현 대상이 아님을 명시합니다.

---

## 2. 플러그인 전체 시스템 아키텍처 (System Context)

```
[ WebCrawlServer (Express/SQLite - 포트 9600) ]
       ▲
       │ (1) 24시간 무중단 단일 웹소켓 통신 (Single WebSocket Owner: clientId: UUID)
       ▼
┌──────────────────────────────────────────────────────────┐
│ offscreen.ts (Offscreen Document - 백그라운드 수집 엔진)   │
│ - 화면에 보이지 않는 24시간 헤드리스 DOM 환경             │
│ - 웹소켓 통신 소유 및 패킷 릴레이 / 백그라운드 fetch() 인출 │
└────────────────────────────▲─────────────────────────────┘
                             │ (2) chrome.runtime 내부 메시징 파이프라인
                             ▼
┌──────────────────────────────────────────────────────────┐
│ background.ts (Service Worker - 이벤트 조율자)          │
│ - 아이콘 클릭 시 사이드바 실행 (openPanelOnActionClick)  │
│ - 오프스크린 문서 자동 생성/유지 (ensureOffscreenDocument)│
└───────▲────────────────────▲─────────────────────▲───────┘
        │                    │                     │
        ▼                    ▼                     ▼
[ sidepanel.tsx ]     [ githubService.ts ]   [ content.ts ]
(사이드바 통합 UI)     (깃허브 커밋/푸시)     (선언형 페이징 수집 엔진)
```

### 2.1 주요 실행 주체 및 역할
- **`offscreen.ts` (오프스크린 엔진)**: 24시간 무중단 웹소켓 단독 소유, 백그라운드 `fetch()` + `DOMParser` 경량 인출, 패킷 인코딩/디코딩.
- **`background.ts` (서비스 워커)**: 오프스크린 생성/유지 관리, 아이콘 클릭 시 사이드바 즉시 열림 지정, 크롬 내부 메시지 라우팅.
- **`sidepanel.tsx` (사이드바 단일 메인 UI)**: 기존 팝업을 완전히 대체하는 상시 대시보드 UI. 노드 상태, 실시간 로그, 다중 포스팅 작성, 깃허브 설정 일괄 처리 (깃허브 기능은 보류).
- **`content.ts` (콘텐츠 스크립트)**: 타깃 웹페이지에 주입되어 선언형 페이징 순차 이동 수집 및 다중 SNS 자동 포스팅 DOM 입력 수행.
-- **깃허브 통합 주석**: `githubService.ts` 연동은 백로그로 이동되었으며, 현재 문서의 우선 구현 항목에는 포함되지 않습니다.

---

## 3. R-004xx 플러그인 세부 지침 인덱스 (Rule Registry)

| Rule ID | 문서 경로 | 대분류 및 담당 범위 | 비고 |
|---|---|---|---|
| **R-00400** | `docs/rule/R-00400 plugin-guidelines.md` | **통합 기본 지침**: 본 문서. 전체 맥락 및 하위 지침 통합 인덱스 | 개정 |
| **R-00410** | `docs/rule/R-00410 plugin-architecture.md` | **모듈화 아키텍처**: 계층화 구조, `sidepanel.tsx` 엔트리 소형화 규칙 | 개정 |
| **R-00420** | `docs/rule/R-00420 plugin-communication.md` | **통신 및 메시징**: `offscreen.ts` 단일 소켓 연동, 메시지 라우팅 가드 | 개정 |
| **R-00430** | `docs/rule/R-00430 plugin-crawling.md` | **DOM 크롤링**: 백그라운드 `fetch()` 인출, 선언형 페이징 수집 엔진 | 개정 |
| **R-00440** | `docs/rule/R-00440 plugin-ui-ux.md` | **UI/UX 디자인**: 상시 사이드바 대시보드 UI/UX 레이아웃 규격 | 개정 |
| **R-00450** | `docs/rule/R-00450 plugin-build-env.md` | **빌드 및 환경변수**: Vite define 주입 및 다중 번들링 엔트리 규정 | 개정 |
| **R-00460** | `docs/rule/R-00460 plugin-manifest-permissions.md` | **매니페스트 및 권한**: MV3 `"sidePanel"`, `"offscreen"` 권한 및 `default_popup` 제거 | 개정 |
| **R-00470** | `docs/rule/R-00470 plugin-sidepanel-offscreen.md` | **사이드바/오프스크린 지침**: 오프스크린 24시간 소켓 & 사이드바 통합 지침 | **신규** |
| **R-00480** | `docs/rule/R-00480 plugin-automation-crawling.md` | **백그라운드 수집/포스팅 지침**: 경량 수집, 다중 SNS 자동 포스팅 지침 | **신규** |
| **R-00490** | `docs/rule/R-00490 plugin-github-integration.md` | **깃허브 연동 지침**: 깃허브 REST API 커밋/푸시 및 토큰 동기화 지침 | **보류(백로그)** |

---

## 4. 플러그인 개발 핵심 운영 원칙 요약

4.1 **단일 소켓 독점**: 프로필당 단 1개의 웹소켓 소켓만 생성하며, 오프스크린(`offscreen.ts`)이 24시간 단독 소유합니다.  
4.2 **사이드바 단일 UI 통합**: 기존 팝업 UI(`popup.tsx`)는 완전히 제거하며, 아이콘 클릭 시 사이드바(`sidepanel.tsx`)가 대시보드로 즉시 실행됩니다.  
4.3 **경량 백그라운드 인출**: 웹페이지 수집 시 유저의 활성 탭을 이동시키지 않고 백그라운드 `fetch()` + `DOMParser`로 순수 HTML만 고속 수집합니다.  
4.4 **선언형 포스팅 & 수집**: 서버에서 전달받은 JSON 행동 양식에 따라 페이징 자동 이동 및 다중 SNS 자동 포스팅을 단행합니다.  
4.5 **깃허브 실시간 동기화 (보류)**: 깃허브 기반 자동 커밋/푸시 및 파이프라인 트리거 기능은 현재 우선순위에서 제외됩니다. 토큰 동기화 설계는 유지하되, 깃허브 API를 통한 자동 커밋/푸시 구현은 백로그로 관리합니다.  
