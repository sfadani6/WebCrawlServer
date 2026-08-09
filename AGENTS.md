# WebCrawlServer - AI 에이전트 통합 지침 (AGENTS.md)

> 버전: 0.7.0
> 작성자: 사용자 & AI
> 수정일: 2026-08-05
> 검토일: 2026-08-05
> 수정 이유:
>   1) 사이드바 단일 UI 통합 및 24시간 오프스크린 무중단 소켓 아키텍처 반영 (크롬 포트 연결 기반 사이드바 열림/닫힘 상태 추적)
>   2) 동적 워커 빌더, `databases/workers/` 멀티 DB, 대용량 물리 파일 분리 저장소 및 노드 별칭/환경설정 매니저 반영
>   3) 크롬 메시징 예외 가드(`sendMessage().catch()`) 및 DDL 예약어 충돌 검증 규칙 반영
>   4) 신규 규칙 레지스트리(`R-00206`~`R-00208`, `R-00303`~`R-00304`, `R-00470`~`R-00490`) 전체 반영
> 관련 문서: docs/rule/R-00000 instructions.md(R-00000), docs/rule/ 하위 전체 문서
> 영향 범위: 프로젝트 루트, docs/rule/ 전체, 백엔드, 관리자 UI, 브라우저 플러그인
> Breaking Change 여부: 있음 (사이드바+오프스크린 통합, 워커/멀티 DB 확장 및 물리 파일 분리 저장소)
> 프로젝트: WebCrawlServer (브라우저 플러그인 + 로컬 WebSocket/REST 서버 + 관리자 대시보드 모노레포)

> **보류(Deferred)**: 문서 내 Git/GitHub 자동화 및 통합 관련 항목은 현재 우선순위에서 제외됩니다. 깃허브 연동은 백로그로 관리되며, 즉시 구현 권고나 자동화 제안에서 제외해 주십시오.

---

## 0. 문서 참조 구조

### 0.1 문서 계층 및 역할

각 문서는 아래와 같은 역할과 우선순위를 가진다. 위쪽이 상위 문서이며, 하위 문서는 상위 문서의 범위를 벗어나는 내용을 임의로 정의할 수 없다.

```
AGENTS.md                    Root Rule   — 최상위 절대 규칙 (언어, 문서 위치, 우선순위, 소스 헤더/주석 규칙 등)
        ↓
docs/rule/*.md               실무 규칙   — 개발/운영 세부 지침 (아키텍처, 워커 빌더, 멀티 DB, 관리자 UI, 사이드바 등)
        ↓
docs/ask.md                  요청사항    — 사용자가 남긴 작업 요청 원문
        ↓
docs/todo.md                 현재 작업   — 요청을 바탕으로 AI가 세운 실행 계획
        ↓
README.md                    프로젝트 설명 — 외부/신규 참여자를 위한 개요
```

- `AGENTS.md`는 다른 모든 문서보다 우선하는 최상위 지시서다.
- `docs/rule/` 하위 문서(`R-00000`, `R-00100`~`R-00490`)는 `AGENTS.md`가 위임한 실무 세부 규칙 문서다. `instructions.md`(R-00000)는 인덱스 역할을 수행한다.
- `docs/ask.md`/`docs/todo.md`는 특정 작업 단위의 요청·계획을 담는 문서이며, 규칙 문서의 내용을 무시하는 근거로 사용할 수 없다.
- `README.md`, `AGENTS.md`, `replit.md`는 규칙 문서가 아니며 프로젝트 루트에 위치해야 한다. `docs/rule/AGENTS.md` 같은 복제본은 금지한다.

### 0.2 Rule Registry

작업 주제에 맞는 문서만 골라 읽는다. 신규 지침 문서는 `AGENTS.md`와 `R-00000 instructions.md`에 동시에 등록한다.

| Rule ID | 문서 경로 | 범위 및 담당 내용 |
|---|---|---|
| R-00000 | docs/rule/R-00000 instructions.md | 규칙 문서 인덱스 (본 표의 원본, 상세 안내) |
| R-00100 | docs/rule/R-00100 architecture.md | 프로젝트 개요, 시스템 구성, 개발 범위 |
| R-00101 | docs/rule/R-00101 tech-stack.md | 기술 스택 및 버전 호환성 규격 |
| R-00102 | docs/rule/R-00102 structure.md | 폴더 구조, 명명 규칙, 모듈 생성/구조 |
| R-00103 | docs/rule/R-00103 workflow-management.md | ask/todo 운영 절차, 이력 관리, ADR |
| R-00104 | docs/rule/R-00104 versioning.md | Git, 버전 관리, 문서 버전 형식 |
| R-00105 | docs/rule/R-00105 communication.md | 커뮤니케이션 가이드, 응답 구조 |
| R-00106 | docs/rule/R-00106 coding.md | 코드 작성 규칙, 소스 헤더 및 주석 표준 |
| R-00107 | docs/rule/R-00107 security.md | 예외 처리 및 일반 보안 정책 |
| R-00108 | docs/rule/R-00108 testing.md | 단위/통합 테스트 도구, 환경, 작성 규칙 및 가이드 |
| R-00200 | docs/rule/R-00200 mcp.md | MCP 프로토콜, 워크플로우 스텝 타입 |
| R-00201 | docs/rule/R-00201 scheduler.md | 스케줄러, 작업 상태, 동시 실행 정책 |
| R-00202 | docs/rule/R-00202 monitoring.md | 모니터링, 리소스 사용량 수집 |
| R-00203 | docs/rule/R-00203 database.md | DB 스키마, 마이그레이션, 백업, 관리자 UI API |
| R-00204 | docs/rule/R-00204 logging.md | 로그 기록 정책, 로그 분류 |
| R-00205 | docs/rule/R-00205 auth.md | 페이지 인증, Basic Auth, bcryptjs, 자격증명 변경 API |
| R-00206 | docs/rule/R-00206 server-node-session-management.md | 백엔드 세션 상태 메타, 별칭(Alias) 및 통신 라우팅 규격 |
| R-00207 | docs/rule/R-00207 server-worker-engine-and-multi-db.md | 동적 서버 워커 엔진, 멀티 DB 동적 생성 및 매핑 규격 |
| R-00208 | docs/rule/R-00208 local-file-storage-system.md | 대용량 HTML/바이너리 물리 파일 분리 저장소 지침 |
| R-00300 | docs/rule/R-00300 admin-guidelines.md | 관리자 제어 기능 및 운영 UI 지침 |
| R-00301 | docs/rule/R-00301 admin-development-guidelines.md | 관리자 UI 개발 및 모듈화 아키텍처 지침 |
| R-00302 | docs/rule/R-00302 admin-ui-ux-guidelines.md | 관리자 UI/UX 디자인 및 시각적 일관성 가이드 |
| R-00303 | docs/rule/R-00303 admin-node-monitoring.md | 관리자 대시보드 노드 배지 및 노드 환경설정 모달 지침 |
| R-00304 | docs/rule/R-00304 admin-worker-and-db-manager.md | 관리자 대시보드 워커 빌더 & DB 매니저 UI 개발 지침 |
| R-00400 | docs/rule/R-00400 plugin-guidelines.md | 플러그인 통합 지침, 전체 맥락 및 하위 문서 인덱스 |
| R-00410 | docs/rule/R-00410 plugin-architecture.md | 플러그인 모듈화 아키텍처, 계층 구조 및 파일 분리 지침 |
| R-00420 | docs/rule/R-00420 plugin-communication.md | WebSocket 연동, 무중단 재연결 및 크롬 메시징 가드 지침 |
| R-00430 | docs/rule/R-00430 plugin-crawling.md | DOM 크롤링, 콘텐츠 스크립트(`content.ts`) 및 메타 수집 지침 |
| R-00440 | docs/rule/R-00440 plugin-ui-ux.md | 사이드바 대시보드 UI/UX 디자인 및 레이아웃 지침 |
| R-00450 | docs/rule/R-00450 plugin-build-env.md | Vite define 기반 빌드 타임 상수 주입 및 다중 엔트리 지침 |
| R-00460 | docs/rule/R-00460 plugin-manifest-permissions.md | Manifest V3, 권한 관리 및 JSON 주석 금지 지침 |
| R-00470 | docs/rule/R-00470 plugin-sidepanel-offscreen.md | 사이드바 통합 UI & 오프스크린 무중단 아키텍처 지침 |
| R-00480 | docs/rule/R-00480 plugin-automation-crawling.md | 백그라운드 경량 수집 및 다중 포스팅 지침 |
| R-00490 | docs/rule/R-00490 plugin-github-integration.md | 깃허브 REST API 연동 및 토큰 동기화 지침 |

---

## 1. 에이전트 핵심 우선순위 지침 (최상위 규칙)

아래 항목은 다른 모든 규칙보다 우선 적용되며, 예외 없이 준수한다.

### 1.1 언어 및 소스 코드 작성 규칙 (예외 없음)
- **한글 사용 규칙**: 모든 답변, 코드 주석, 커밋 메시지, 문서 설명은 **한글로만 작성**한다. 변수명·함수명·클래스명 등 코드 식별자는 영문을 사용하되 주석과 서술문은 한글이어야 한다.
- **소스 코드 헤더 명시**: 모든 소스 코드(.ts, .tsx, .js, .css 등) 및 문서 출력물 최상단 1열에는 **상대 파일 경로와 파일 이름**을 반드시 주석으로 표기한다. (예: `// plugins/basic-plugin/src/sidepanel.tsx`)
- **코드 문서화 주석 표준**: 소스 코드 내의 주요 기능, 함수(JSDoc 매개변수/반환값), 클래스, 메서드, 주요 변수 및 상수에 대해 상세한 한글 주석을 필수 작성한다.
- **ESM 모듈 규격**: 모든 코드는 ESM(ECMAScript Modules) 규격(`import`/`export`)을 기준으로 개발한다. CommonJS(`require`/`module.exports`) 방식은 사용하지 않는다.

### 1.2 소통 및 문서화 위치 규칙
- 모든 마크다운(.md) 문서는 프로젝트 루트가 아닌 **`docs/` 디렉토리 하위의 관련 폴더**에 생성한다. (`AGENTS.md`, `README.md`는 프로젝트 루트에 위치)
- 마케팅성/주관적 수식어 사용을 금지하며 기술적 사실과 수치, 파일 경로 기반으로 작성한다.

### 1.3 문서 간 우선순위 규칙
```
1순위  System (실행 환경 지침)
2순위  AGENTS.md
3순위  docs/rule/*.md
4순위  docs/ask.md
5순위  docs/todo.md
6순위  README.md
```

---

## 2. 작업 종료 시 최소 확인 사항

- 코드가 정상적으로 실행/컴파일되는지 확인했는가
- 소스 코드 최상단에 파일 경로 및 파일 이름 주석이 명시되었는가
- 주요 기능, 함수, 클래스, 변수/상수에 상세한 한글 주석이 작성되었는가
- `AGENTS.md` 및 관련 `docs/rule/*.md` 문서의 규칙을 위반하지 않았는가
- `docs/todo.md`의 완료 항목 정리 및 `docs/todo.history.md`에 이력을 기록했는가

---

> **주의:** 본 지침을 위반하는 코드/문서는 작성하지 않는다. 실무 세부 규칙은 0.2 Rule Registry의 각 `docs/rule/*.md` 문서를 따른다.
