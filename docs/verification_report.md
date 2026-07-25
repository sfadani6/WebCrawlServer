# 전체 사이트 검증 리포트 및 개선 계획서

> 작성일시: 2026-07-26
> 대상: WebCrawlServer (http://localhost:9600/)

---

## 1. 현재 사이트 검증 결과 (현황 분석)

| URL 경로 | 현재 반환 상태 | UI / 디자인 형태 | 문제점 및 개선 필요사항 |
|---|---|---|---|
| `http://localhost:9600/` | HTTP 200 | 카드 형태 마케팅 스타일 (`public/index.html`) | 폰트가 지나치게 크고 데이터 밀도가 낮음. 구글 콘솔 스타일 통합 레이아웃 미적용. |
| `http://localhost:9600/database/` | HTTP 200 | React `admin-ui` (Google Sheets 그리드) | DB 생성 및 요약 정보 페이지가 없이 단일 DB의 테이블만 바로 표출됨. |
| `http://localhost:9600/modules` | HTTP 404 (JSON) | N/A | 공통 레이아웃 미적용, "미구현" 상태 표출 필요 |
| `http://localhost:9600/workflows` | HTTP 404 (JSON) | N/A | 공통 레이아웃 미적용, "미구현" 상태 표출 필요 |
| `http://localhost:9600/scheduler` | HTTP 404 (JSON) | N/A | 공통 레이아웃 미적용, "미구현" 상태 표출 필요 |
| `http://localhost:9600/logs` | HTTP 404 (JSON) | N/A | 공통 레이아웃 미적용, "미구현" 상태 표출 필요 |
| `http://localhost:9600/settings` | HTTP 404 (JSON) | N/A | 공통 레이아웃 미적용, "미구현" 상태 표출 필요 |

---

## 2. 주요 문제점 심층 파악

1. **디자인 일관성 부재 및 데이터 밀도 미흡**:
   - `/` 접속 시 구식 카드 뷰가 나오고, `/database/` 접속 시 다크모드 React UI가 나오는 등 UI/UX가 파편화되어 있음.
   - 개발자/관리자 콘솔에 어울리지 않는 큰 폰트와 넓은 여백 사용.

2. **데이터베이스 관리 계층 구조 미비**:
   - `docs/ask.md` 지침: `/database/` 에서는 전체 데이터베이스 목록, 신규 DB 생성 기능, DB별 요약 정보(테이블 수, 파일 크기, 상태 등)가 출력되어야 함.
   - 특정 데이터베이스를 클릭 시 내부 테이블 스프레드시트 관리 화면으로 진입해야 하나 현재는 단일 DB만 바로 표출됨.

3. **통합 관리자 콘솔 셸(Shell) 부재**:
   - 상단 헤더 및 좌측 사이드바가 모든 페이지에서 동일하게 유지되는 구글 콘솔 스타일의 일관된 셸(Shell) 구조 필요.
   - 미구현된 서비스 목록(`/modules`, `/workflows`, `/scheduler`, `/logs`, `/settings`)도 메뉴에 명확히 표기되고 "미구현" 뷰를 제공해야 함.

---

## 3. 개선 실행 계획 (구체적 목표)

### Phase 1: 백엔드 API & 라우팅 통합
- `server/routes/adminDb.js`에 DB 목록 조회 및 DB 생성 API 추가 (`GET /admin/api/databases`, `POST /admin/api/databases`).
- `server/app.js`에서 `/`, `/database/*`, `/modules`, `/workflows`, `/scheduler`, `/logs`, `/settings` 등의 모든 웹 라우트를 React 빌드 앱(`admin-ui`)으로 통합 서빙.

### Phase 2: 구글 콘솔 스타일 프론트엔드 UI/UX 재구축 (`server/admin-ui`)
- **공통 콘솔 셸 (Layout)**:
  - 상단 콤팩트 바: 서비스명 (`WebCrawlServer Console`), 검색창, 시스템 상태.
  - 좌측 네비게이션 메뉴: 콤팩트 폰트, 동일 아이콘/메뉴 트리.
- **페이지 구성**:
  1. **개요 / 서비스 목록 (`/`)**: 한눈에 파악 가능한 콤팩트 서비스 상태 테이블 & 빠른 링크.
  2. **데이터베이스 목록 & 관리 (`/database`)**:
     - SQLite DB 목록 및 요약 카드/테이블 (DB 이름, 파일 크기, 테이블 개수, WAL 모드 여부).
     - [ + 새 데이터베이스 생성 ] 모달.
     - DB 클릭 시 해당 DB의 테이블 및 스프레드시트 관리 화면(`/database/:dbName`)으로 전환.
  3. **데이터베이스 스프레드시트 뷰 (`/database/:dbName`)**:
     - 기존 `@glideapps/glide-data-grid` 캔버스 스프레드시트 유지 + 구글 콘솔 스타일에 맞춘 콤팩트 툴바.
  4. **미구현 페이지들 (`/modules`, `/workflows`, `/scheduler`, `/logs`, `/settings`)**:
     - 일관된 공통 레이아웃 내에서 깔끔한 "[미구현] 준비 중인 기능입니다" 안내 화면 표출.

---

## 4. 검증 및 수용 기준

1. `http://localhost:9600/` 접속 시 구글 콘솔 스타일의 깔끔한 서비스 목록이 표시되는가?
2. `http://localhost:9600/database/` 접속 시 DB 생성 및 DB별 요약 정보가 표시되는가?
3. DB 클릭 시 테이블 관리(Google Sheets 그리드) 화면으로 원활하게 연결되는가?
4. 모든 페이지에서 사이드바/상단 메뉴 UI가 일관되게 유지되는가?
5. 미구현 페이지 접속 시 404 JSON 에러 대신 공통 UI 내에서 "미구현"이 안내되는가?
