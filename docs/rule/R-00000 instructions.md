본 문서는 `WebCrawlServer` 프로젝트의 규칙 문서 인덱스입니다. 각 규칙 문서의 역할과 적용 범위를 안내하며, 신규 규칙 문서 추가 시 반드시 함께 갱신해야 합니다.

---

## 1. 사용 방법

1. `AGENTS.md`를 먼저 확인합니다.
2. 본 인덱스에서 해당 작업 주제에 맞는 `R-00N` 문서를 찾습니다.
3. 해당 `R-00N` 문서에서 구체 규칙을 확인합니다.
4. 필요 시 `docs/ask.md`와 `docs/todo.md`를 참고합니다.

---

## 2. 규칙 문서 목록 (Rule Registry Index)

| Rule ID | 문서 경로 | 범위 및 담당 내용 |
|---|---|---|
| **R-00000** | `docs/rule/R-00000 instructions.md` | 규칙 문서 인덱스 (본 표의 원본, 상세 안내) |
| **R-00100** | `docs/rule/R-00100 architecture.md` | 프로젝트 개요, 시스템 구성, 개발 범위 |
| **R-00101** | `docs/rule/R-00101 tech-stack.md` | 기술 스택 및 버전 호환성 규격 |
| **R-00102** | `docs/rule/R-00102 structure.md` | 폴더 구조, 명명 규칙, 모듈 생성/구조 |
| **R-00103** | `docs/rule/R-00103 workflow-management.md` | ask/todo 운영 절차, 이력 관리, ADR |
| **R-00104** | `docs/rule/R-00104 versioning.md` | Git, 버전 관리, 문서 버전 형식 |
| **R-00105** | `docs/rule/R-00105 communication.md` | 커뮤니케이션 가이드, 응답 구조 |
| **R-00106** | `docs/rule/R-00106 coding.md` | 코드 작성 규칙, 소스 헤더 및 주석 표준 |
| **R-00107** | `docs/rule/R-00107 security.md` | 예외 처리 및 일반 보안 정책 |
| **R-00108** | `docs/rule/R-00108 testing.md` | 단위/통합 테스트 도구, 환경, 작성 규칙 및 가이드 |
| **R-00200** | `docs/rule/R-00200 mcp.md` | MCP 프로토콜, 워크플로우 스텝 타입 |
| **R-00201** | `docs/rule/R-00201 scheduler.md` | 스케줄러, 작업 상태, 동시 실행 정책 |
| **R-00202** | `docs/rule/R-00202 monitoring.md` | 모니터링, 리소스 사용량 수집 |
| **R-00203** | `docs/rule/R-00203 database.md` | DB 스키마, 마이그레이션, 백업, 관리자 UI API |
| **R-00204** | `docs/rule/R-00204 logging.md` | 로그 기록 정책, 로그 분류 |
| **R-00205** | `docs/rule/R-00205 auth.md` | 페이지 인증, Basic Auth, bcryptjs, 자격증명 변경 API |
| **R-00206** | `docs/rule/R-00206 server-node-session-management.md` | 백엔드 세션 상태 메타, 별칭(Alias) 및 통신 라우팅 규격 |
| **R-00207** | `docs/rule/R-00207 server-worker-engine-and-multi-db.md` | 동적 서버 워커 엔진, 멀티 DB 동적 생성 및 매핑 규격 |
| **R-00208** | `docs/rule/R-00208 local-file-storage-system.md` | 대용량 HTML/바이너리 물리 파일 분리 저장소 지침 |
| **R-00300** | `docs/rule/R-00300 admin-guidelines.md` | 관리자 제어 기능 및 운영 UI 지침 |
| **R-00301** | `docs/rule/R-00301 admin-development-guidelines.md` | 관리자 UI 개발 및 모듈화 아키텍처 지침 |
| **R-00302** | `docs/rule/R-00302 admin-ui-ux-guidelines.md` | 관리자 UI/UX 디자인 및 시각적 일관성 가이드 |
| **R-00303** | `docs/rule/R-00303 admin-node-monitoring.md` | 관리자 대시보드 노드 배지 및 노드 환경설정 모달 지침 |
| **R-00304** | `docs/rule/R-00304 admin-worker-and-db-manager.md` | 관리자 대시보드 워커 빌더 & DB 매니저 UI 개발 지침 |
| **R-00400** | `docs/rule/R-00400 plugin-guidelines.md` | 플러그인 통합 지침, 전체 맥락 및 하위 문서 인덱스 |
| **R-00410** | `docs/rule/R-00410 plugin-architecture.md` | 플러그인 모듈화 아키텍처, 계층 구조 및 파일 분리 지침 |
| **R-00420** | `docs/rule/R-00420 plugin-communication.md` | WebSocket 연동, 무중단 재연결 및 크롬 메시징 가드 지침 |
| **R-00430** | `docs/rule/R-00430 plugin-crawling.md` | DOM 크롤링, 콘텐츠 스크립트(`content.ts`) 및 메타 수집 지침 |
| **R-00440** | `docs/rule/R-00440 plugin-ui-ux.md` | 사이드바 대시보드 UI/UX 디자인 및 레이아웃 지침 |
| **R-00450** | `docs/rule/R-00450 plugin-build-env.md` | Vite define 기반 빌드 타임 상수 주입 및 다중 엔트리 지침 |
| **R-00460** | `docs/rule/R-00460 plugin-manifest-permissions.md` | Manifest V3, 권한 관리 및 JSON 주석 금지 지침 |
| **R-00470** | `docs/rule/R-00470 plugin-sidepanel-offscreen.md` | 사이드바 통합 UI & 오프스크린 무중단 아키텍처 지침 |
| **R-00480** | `docs/rule/R-00480 plugin-automation-crawling.md` | 백그라운드 경량 수집 및 다중 포스팅 지침 |
| **R-00490** | `docs/rule/R-00490 plugin-github-integration.md` | 깃허브 REST API 연동 및 토큰 동기화 지침 (보류) |

---

## 3. 번호 분류 및 생성 원칙

- `R-001xx`: 통합 지침 / 개발 방향
- `R-002xx`: 시스템 / 서버
- `R-003xx`: 관리자 UI
- `R-004xx`: 플러그인 (10단위 확장형)
- `R-005xx`: 기록·운영·보관

### 신규 규칙 문서 추가 지침
- 새로운 규칙 문서를 추가할 때는 반드시 본 문서와 `AGENTS.md`의 Rule Registry 표를 동시에 갱신합니다.
- 두 표가 불일치할 경우 `AGENTS.md`가 최상위 기준으로 우선 적용됩니다.
- 신규 규칙 문서는 제목과 파일명 모두에 `R-00N` 번호를 반드시 포함해야 합니다. (예: `# R-00207 docs/rule/R-00207 server-worker-engine-and-multi-db.md`)

---

## 4. 문서 관리 및 우선순위

- 본 문서에서는 규칙 문서의 위치와 역할만 정의합니다.
- 세부 규칙은 각 `docs/rule/*.md` 문서를 따릅니다.
- 프로젝트 전체 문서 우선순위는 `AGENTS.md` > `docs/rule/*.md` > `docs/ask.md` > `docs/todo.md` > `README.md`입니다.
