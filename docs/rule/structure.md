# R-003 프로젝트 구조 및 명명 규칙 (structure.md)

> Version: 1.1.0
> 작성자: 사용자
> 수정일: 2026-07-25
> 검토일: 2026-07-25
> 수정 이유: instructions.md 3장을 별도 문서로 분리. 디렉토리 트리를 docs/rule/ 다중 파일 구조 및 docs/decision/(ADR) 반영으로 갱신. 모듈 디렉토리에 tests/, docs/, assets/, sample/ 하위 폴더 추가(테스트/샘플 데이터 관리 목적)
> 관련 문서: docs/rule/instructions.md(R-000), docs/rule/mcp.md(R-004), docs/rule/workflow-management.md(R-008)
> 영향 범위: 신규 분리 문서, 기존 instructions.md 3장을 대체. 신규 모듈부터 확장된 하위 폴더 구조 적용(기존 모듈은 소급 적용하지 않음)
> Breaking Change 여부: 없음 (기존 모듈 구조와 하위 호환. 신규 폴더는 선택적 추가 항목)

---

## 1. 디렉토리 구조

```
WebCrawlServer/
├── server/
│   ├── app.js               # 서버 진입점
│   ├── db/                   # DB 헬퍼 및 초기화
│   ├── middleware/           # Express 미들웨어 (Basic Auth 등)
│   ├── routes/               # API 라우팅 정의
│   │   ├── api.js            # 플러그인 API
│   │   ├── adminDb.js        # 관리자 DB API
│   │   ├── adminUi.js        # 관리자 UI (SPA 라우팅)
│   │   └── nlp.js            # NLP API
│   └── admin-ui/             # 관리자 UI (React 빌드 산출물)
│
├── modules/                  # 모듈별 독립 디렉토리 (관리자 페이지에서 자동 생성)
│   └── <module_name>/
│       ├── schema.sql         # 모듈 전용 DB 스키마
│       ├── workflow.yaml      # 모듈 워크플로우 정의
│       ├── actions/           # 모듈 액션 스크립트
│       ├── config.json        # 모듈 환경 설정
│       ├── sample.json        # 샘플 입력/출력 데이터 (선택, 1.3 참조)
│       ├── tests/             # 모듈 단위 테스트 (선택, 1.3 참조)
│       ├── docs/              # 모듈 전용 설명 문서 (선택, 1.3 참조)
│       ├── assets/            # 모듈 전용 정적 리소스 (선택, 1.3 참조)
│       └── README.md          # 모듈 설명
│
├── database/
│   └── main.db                # 공용 SQLite DB (모듈별 테이블 포함)
│
├── public/                    # 관리자 페이지 정적 리소스
│   ├── index.html
│   ├── css/
│   └── js/
│
├── workflows/                 # 모듈 외부 공용 워크플로우
├── logs/                      # 날짜별 로그 파일
├── config/                    # 앱 설정 파일 (스케줄러 기본값 등 포함)
├── plugin/                    # 브라우저 플러그인 소스
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   └── popup/
│
├── docs/                       # 모든 마크다운 문서는 이 하위에 위치
│   ├── rule/                   # 세부 규칙 문서 (R-000 ~ R-013, AGENTS.md 0.2 레지스트리 참조)
│   │   ├── instructions.md      # 규칙 문서 인덱스 (R-000)
│   │   ├── architecture.md      # R-001
│   │   ├── tech-stack.md        # R-002
│   │   ├── structure.md         # R-003 (본 문서)
│   │   ├── mcp.md               # R-004
│   │   ├── scheduler.md         # R-005
│   │   ├── monitoring.md        # R-006
│   │   ├── database.md          # R-007
│   │   ├── workflow-management.md # R-008
│   │   ├── logging.md           # R-009
│   │   ├── versioning.md        # R-010
│   │   ├── coding.md            # R-011
│   │   ├── communication.md     # R-012
│   │   └── security.md          # R-013
│   ├── decision/                # ADR(Architecture Decision Record), 컨텍스트 로딩 제외(workflow-management.md 참조)
│   │   └── 0001-example.md
│   ├── ask.md                    # 작업 요청 파일
│   ├── todo.md                   # 작업 계획 파일
│   ├── CHANGELOG.md            # 버전 인덱스 (루트 파일, 컨텍스트 로딩 대상)
│   ├── CHANGELOG/               # 버전별 상세 기록 (컨텍스트 로딩 제외)
│   ├── askLogs/                 # 작업 요청/처리 상세 이력 (컨텍스트 로딩 제외)
│   ├── tips/                    # 개발 팁/트러블슈팅 (컨텍스트 로딩 제외)
│   └── todo.history.md          # 완료 작업 요약 이력
│
├── package.json
└── README.md
```

## 2. 모듈 생성 운영 방식
- 관리자 페이지에서 "모듈 생성" 실행 시 `modules/<module_name>/` 디렉토리와 `schema.sql`, `workflow.yaml`, `actions/`, `config.json`, `README.md`가 자동 생성된다.
- `sample.json`, `tests/`, `docs/`, `assets/`는 필요한 모듈에 한해 선택적으로 생성한다. 자동 생성 대상에 포함할지 여부는 실제 운영 중 판단하여 이 문서에 반영한다.
- 모듈이 사용할 DB 테이블/컬럼은 사전에 정의하지 않는다. 관리자 페이지의 **스키마 관리 기능**(database.md 참조)에서 그때그때 생성·편집하고, 결과를 해당 모듈의 `schema.sql`에 반영한 뒤 `database/main.db`에 적용한다.
- 모듈 생성/편집 화면에서 이 모듈이 사용할 테이블을 지정(연결)할 수 있어야 한다. 하나의 모듈이 여러 테이블을 쓰거나, 여러 모듈이 같은 테이블을 공유하는 경우 모두 허용한다.
- 신규 모듈 추가 시 기존 MCP 명령어 집합과 충돌하지 않도록 액션명을 사전에 확인한다(mcp.md 참조).
- 1인 개인용 도구이므로 스키마 적용 전 별도 승인/검증 절차는 두지 않는다. 적용한 SQL은 `activity_logs`에 남겨 사후에 확인 가능하도록 한다.
- 모듈 단위 테스트(`tests/`)를 작성한 경우, 모듈 변경 시 관련 테스트를 함께 갱신한다. 테스트 실행 방법은 모듈 `README.md`에 기록한다.

## 3. 명명 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| 파일/디렉토리 | kebab-case 또는 snake_case (모듈 디렉토리는 snake_case) | `video_splitter`, `image-editor.js` |
| 클래스 | PascalCase | `ModuleManager`, `WorkflowRunner` |
| 함수/변수 | camelCase | `loadModuleConfig`, `currentTheme` |
| MCP 액션명 | snake_case 동사형 | `crawl_page`, `run_process` |
| 모듈 디렉토리명 | 기능을 나타내는 영문 소문자 | `crawler`, `note_manager` |
| DB 테이블 | snake_case 복수형 | `modules`, `activity_logs` |

## 4. 확장 모듈 후보 (참고용)
아래는 향후 추가 검토 대상 모듈 후보 목록이며, 실제 생성 여부·시점은 `workflow-management.md`(R-008) 운영 절차(`docs/ask.md`/`docs/todo.md`)에 따라 그때그때 결정한다. 이 목록 자체가 개발 계획을 확정하는 것은 아니다.

- `crawler`: 페이지 크롤링, 데이터 수집
- `image_editor`: 이미지 수집/편집
- `note_manager`: 메모장
- `video_editor`: 영상 편집(ffmpeg 연동, tech-stack.md 참조)
- `db_monitor`: 외부 DB 모니터링
- `slack_notify`: Slack Webhook 연동(tech-stack.md 알림 정책과 연결)

이메일 발송을 담당하는 모듈은 후보에서 제외한다. `tech-stack.md`에서 이메일 알림을 사용하지 않기로 확정했기 때문이며, 필요해지면 해당 결정을 먼저 변경한다.
