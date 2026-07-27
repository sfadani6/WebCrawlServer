# 변경 이력 (docs/CHANGELOG.md)

> 본 문서는 프로젝트의 버전별 변경 내역을 기록하는 메인 인덱스 파일입니다.
> AGENTS.md 2장에서 예외로 언급된 파일로, 컨텍스트 로딩 시 참조 대상이 됩니다.
> 상세 변경 이력은 `docs/CHANGELOG/` 폴더에 연도/버전별로 분리 저장합니다.

---

## 최신 버전

| 버전 | 날짜 | 제목 | 작성자 |
|------|------|------|--------|
| 0.1.7 | 2026-07-27 | 플러그인 연결 도우미 표시 보강 | Codex |
| 0.1.6 | 2026-07-27 | 플러그인 관리 연결 흐름 수정 | Codex |
| 0.1.5 | 2026-07-27 | 접속관리 시스템 및 플러그인 호환성 개선 | Mistral Vibe |
| 0.1.4 | 2026-07-26 | P0-P3 일괄 처리 (8/27건) | Cline |
| 0.1.3 | 2026-07-26 | 워크플로우 엔진 및 미구현 기능 6종 구현 | Cline |
| 0.1.2 | 2026-07-26 | 페이지 구조 개선 및 드롭다운 메뉴 구현 | Mistral Vibe |

---

## 버전 이력



### [0.1.7] - 2026-07-27

#### 추가 (Added)
- `server/admin-ui/src/components/PluginsPage.jsx`: `/plugins` 화면에 항상 보이는 연결 도우미 패널 추가
- `docs/CHANGELOG/플러그인-연결도우미-20260727200534.md`: 상세 변경 로그 추가

#### 변경 (Changed)
- 플러그인 관리 화면에 WebSocket URL 복사 버튼, 승인 대기/승인됨 카운트, 4단계 연결 절차 안내를 표시
- 승인 대기 요청이 없을 때 표시되는 문구에 연결 요청 생성 방법을 추가

### [0.1.6] - 2026-07-27

#### 변경 (Changed)
- `server/admin-ui/src/components/PluginsPage.jsx`: 플러그인 관리 화면의 미연결 채팅 UI 및 잔여 `</write_to_file>` 문자열 제거
- `plugin/background.js`: 저장된 승인 토큰 기반 직접 WebSocket 연결 및 승인 토큰 자동 저장 처리 추가
- `plugin/options/options.js`: 기본 토큰 입력값을 빈 값으로 변경
- `server/monitor/connectionManager.js`: 플러그인 요청 ID 기준 WebSocket 연결 종료 함수 추가
- `server/routes/plugin.js`, `server/routes/admin.js`: 연결 종료 API가 실제 WebSocket 세션 종료 개수를 반환하도록 수정
- `docs/CHANGELOG/플러그인-관리-연결흐름-20260727185813.md`: 상세 변경 로그 추가

#### 수정 (Fixed)
- `/plugins` 화면 하단에 채팅창처럼 보이는 미사용 UI가 표시되던 문제
- 승인 토큰을 입력해도 플러그인이 저장 토큰으로 바로 연결하지 않고 새 승인 요청 흐름으로 진입하던 문제
- 플러그인 연결 종료 API가 DB 상태만 바꾸고 활성 WebSocket 세션을 종료하지 않던 문제

### [0.1.5] - 2026-07-27

#### 추가 (Added)
- `server/monitor/connectionManager.js`: WebSocket 연결 추적 및 관리 시스템
- `server/routes/admin.js`: 접속 관리 API 라우터
- `server/admin-ui/src/components/ConnectionPage.jsx`: 실시간 접속 관리 페이지
- `docs/CHANGELOG/접속관리-시스템-20260727140000.md`: 상세 변경 로그

#### 변경 (Changed)
- `plugin/manifest.json`: web_accessible_resources 추가 (Opera 브라우저 호환성)
- `server/app.js`: verifyClient 개선 (Firefox 지원, async 처리 개선), connectionManager 통합
- `server/admin-ui/src/components/Layout.jsx`: 접속관리 메뉴 추가
- `server/admin-ui/src/App.jsx`: 접속관리 라우팅 추가
- `docs/ask.md`: 현재 요청 정보로 업데이트
- `docs/todo.md`: 작업 상태 반영
- `docs/todo.history.md`: 작업 이력 추가

#### 수정 (Fixed)
- Opera 브라우저에서 플러그인 아이콘 로딩 오류 (`Could not load icon`)
- WebSocket 인증 실패 (`HTTP Authentication failed`) - async callback 중복 호출 방지
- WebSocket origin 검증에서 Firefox 확장 프로그램 미지원 문제

#### 기능 (Features)
- 실시간 접속 관리 페이지: 현재 연결된 모든 장비 및 플러그인 모니터링
- 브라우저별 아이콘 표시 (Chrome, Opera, Firefox, Safari, Edge)
- 연결 상태, IP 주소, 브라우저 정보, 로그인 상태 등 상세 정보 제공
- 자동 새로고침 기능 (3~30초 간격 설정 가능)
- 개별 연결 강제 종료 기능
- 연결 통계 정보 제공

### [0.1.4] - 2026-07-26

#### 추가 (Added)
- server/logs/logRotator.js: 로그 파일 로테이션 모듈 신규 생성
- server/scheduler/cronParser.js: cron 로직 완전 재구현 (parseField, parseCron, getNextTime)
- docs/CHANGELOG/P0-P3-batch-20260726202400.md: 상세 변경 로그
- docs/CHANGELOG/P0-allowedOrigins-WSTOKEN-20260726202200.md: P0 버그 수정 로그

#### 변경 (Changed)
- server/app.js: allowedOrigins/WS_TOKEN 선언 위치 수정, ENV_VARS 환경변수 검증 추가
- server/routes/adminDb.js: isValidTableName() 함수 추가 (SQL Injection 방지)
- docs/rule/workflow-management.md: v1.1.0 → v1.2.0 (작업 흐름 강제 규정 반영)
- docs/todo.md: 완료된 8개 항목 제거, 19개 미처리 항목만 유지

#### 수정 (Fixed)
- P0: WebSocket verifyClient에서 allowedOrigins 참조 시점 오류 수정
- P0: WS_TOKEN 기본값 하드코딩 제거, 환경변수 필수화
- P0: server/logs/logRotator.js 누락으로 인한 서버 크래시 해결

#### 보안 (Security)
- WS_TOKEN 환경변수 미설정 시 WebSocket 연결 전면 차단
- adminDb.js 테이블명 화이트리스트 검증 추가 (SQL Injection 방지)
- 서버 시작 시 7개 환경변수 누락 여부 검증 및 경고 로그 출력

---

### [0.1.3] - 2026-07-26

#### 추가 (Added)
- server/scripts/scriptEngine.js: MCP 스크립트 엔진 (steps 배열 파싱/실행)
- server/scheduler/jobRunner.js: 예약 작업 실행 엔진
- server/scheduler/cronParser.js: cron 표현식 파서 (초기 버전)
- server/monitor/monitorWs.js: CPU/메모리 모니터링 WebSocket broadcast
- server/middleware/retry.js: 최대 3회 재시도 로직
- server/workflows/workflowEngine.js: YAML 워크플로우 실행 엔진

#### 변경 (Changed)
- server/app.js: 스케줄러/모니터/로그 모듈 연동

---

### [0.1.2] - 2026-07-26

#### 추가 (Added)
- 서버 프로세스 목록 페이지 (public/admin/process/index.html)
- 서버 프로세스 세부 정보 페이지 (public/admin/process/detail.html)
- 로그 기록 목록 페이지 (public/admin/process/logs/index.html)
- 데이터베이스 관리 페이지 (public/admin/database/index.html)
- 관리자 페이지 라우팅 추가 (app.js)
- **페이지 구조 가이드라인** (docs/rule/page/structure.md)

#### 변경 (Changed)
- 관리자 대시보드에 서버 프로세스/DB 퀵 액션 추가
- todo.md 우선순위 재조정 (서버 페이지 개발 우선)
- **모든 페이지에 드롭다운 메뉴 구현** (서버/DB/모듈/워크플로우/스케줄러/로그)
- **모든 페이지에 브레드크럼 추가** (현재 위치 표시)
- **일관된 헤더 구조**로 모든 페이지 통일
- admin.css에 드롭다운/브레드크럼 스타일 추가
- main.js에 네비게이션 초기화 함수 추가

#### 수정 (Fixed)
- AWS CLI Commons Compress 오류 해결을 위한 Java 버전 확인 추가

#### 개선 (Improved)
- **네비게이션 UX 개선**: 드롭다운 메뉴로 메뉴 그룹화, 현재 페이지 강조
- **모바일 대응**: 768px 이하에서 햄버거 메뉴로 네비게이션 표시
- **페이지 구조 표준화**: 모든 페이지가 동일한 헤더/네비게이션/브레드크럼 사용
- **접근성 개선**: 키보드 네비게이션 지원, ARIA 속성 적용

---

### [0.1.0] - 2026-07-25

#### 추가 (Added)
- 프로젝트 초기 구조 설정
- AGENTS.md 최상위 규칙 문서 생성
- Rule Registry (R-000~R-013) 모든 규칙 문서 생성
- docs 폴더 구조 초기화

#### 변경 (Changed)
- `docs/rule/instructions.md`를 주제별 13개 문서로 분리

---

## 버전 형식

- **메이저 버전 (X.0.0)**: 호환성Break가 있는 주요 변경
- **마이너 버전 (0.Y.0)**: 하위 호환성을 유지한 새로운 기능 추가
- **패치 버전 (0.0.Z)**: 버그 수정 및 사소한 개선

---

## changerlog 관리 규칙

1. 모든 커밋은 해당 버전 섹션에 기록
2. 변경 사항은 사실적 기술 (마케팅 용어 사용 금지)
3. 상세 내용은 `docs/CHANGELOG/` 폴더의 하위 문서에 기록
4. 릴리스 시 새로운 버전 섹션 생성 및 Unreleased 내용 이관

---

## 관련 폴더

- `docs/CHANGELOG/` - 상세 변경 이력 저장소
- `docs/askLogs/` - 작업 요청/처리 이력
- `docs/decision/` - 설계 결정 기록 (ADR)