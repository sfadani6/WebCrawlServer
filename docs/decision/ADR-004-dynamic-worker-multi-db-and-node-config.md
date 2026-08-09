# ADR-004: 동적 수집 워커 빌더, 멀티 DB 및 노드 환경설정 매니저 채택

> **상태**: 승인됨 (Accepted)  
> **날짜**: 2026-08-05  
> **결정자**: 시스템 아키텍트 & 개발 팀  
> **관련 문서**: AGENTS.md, R-00206, R-00207, R-00208, R-00303, R-00304  

---

## 1. 배경 및 문제 정의 (Context & Problem Statement)

크롤링 분산 수집 노드가 늘어나고 수집 대상 도메인이 다양해짐에 따라 기존 시스템에 다음과 같은 아키텍처 한계가 발생했습니다.

1. **DB 폭증 및 성능 저하 (SQLite Bloat)**:
   - 무거운 HTML 소스 원본(`outerHTML`)이나 이미지/동영상 바이너리를 SQLite DB 칼럼에 직접 인서트할 경우 DB 파일 용량이 수십 GB로 폭증하고 WAL 잠금 및 쿼리 속도 저하 발생.
2. **수집 노드 식별성 부족 (Node Identification)**:
   - 난해한 UUID 형태의 노드 ID만 표시되어 어느 브라우저 프로필/기기에서 들어온 데이터인지 관리자가 식별하기 어려움.
3. **다양한 수집 스키마 및 저장소 분리 요구**:
   - 페이스북, 트위터, 쇼핑몰 등 도메인마다 수집하는 데이터 필드와 적재할 DB/디렉터리 경로가 다르나, 이를 동적으로 정의하고 분리 보관할 체계가 부재함.

---

## 2. 고려된 대안들 (Considered Options)

### 대안 1: 단일 DB 및 단일 데이터 저장 구조 (기존 방식)
- **장점**: 백엔드 구현이 단순함.
- **단점**: DB 용량 폭증, 쿼리 저하, 노드 식별 불가, 도메인별 저장소 분리 불가.

### 대안 2: 물리 파일 분리 저장 + 멀티 SQLite DB + 노드 환경설정 매니저 채택 (선택안)
- **장점**:
  - **대용량 파일 분리 저장**: 무거운 HTML/바이너리는 디스크 지정 경로(`STORAGE_ROOT_PATH\<domain>\<db_id>\index.html`)에 저장하고 DB에는 경로(`file_path`)만 기록하여 DB 경량화.
  - **노드 별칭 및 환경설정 매니저**: 노드 옆에 한글 별칭(예: `오페라-개인-수집기-1`)과 `[환경설정 ⚙️]` 모달을 추가하여 노드별 저장 경로 및 전담 워커 지정.
  - **동적 워커 빌더 & 멀티 DB (`databases/workers/`)**: Admin UI에서 워커 생성 시 대상 DB(`worker_<name>.db`), 스키마 필드, 워커 전용 저장소 루트를 자유롭게 구성.
- **단점**: 백엔드 워커 매핑 엔진 및 관리자 UI 모달 추가 구현 필요.

---

## 3. 아키텍처 결정 사항 (Decision)

**대안 2 (물리 파일 분리 저장 + 멀티 DB + 노드 환경설정 매니저)를 백엔드 및 관리자 UI 핵심 아키텍처로 채택합니다.**

### 상세 결정 규정:
1. **노드 환경설정 매니저 (`clients` 테이블 확장)**:
   - 노드 ID 표출 칸 옆에 `[환경설정 ⚙️]` 모달을 제공하여 노드 별칭(`alias`), 노드 전용 물리 저장 경로(`custom_storage_path`), 담당 워커(`assigned_worker_id`)를 지정합니다.
2. **동적 워커 빌더 & 멀티 DB (`workers` 테이블 신설)**:
   - Admin UI에서 워커를 동적 생성하며, 기본 통신 파라미터를 상속받고 커스텀 필드(스키마 JSON)를 추가할 수 있게 합니다.
   - 워커 생성 시 `databases/workers/worker_<name>.db` 파일이 자동 동적 생성되며, 지정한 테이블로 데이터가 적재됩니다.
3. **저장소 경로 적용 우선순위**:
   - 패킷 유입 시 저장 경로: **노드 전용 경로 (`custom_storage_path`) > 워커 전용 경로 (`storage_root_path`) > 시스템 기본 경로 (`STORAGE_ROOT_PATH`)** 순으로 적용됩니다.

---

## 4. 파급 효과 및 이점 (Consequences)

### 긍정적 이점:
- **DB 속도 및 용량 최적화**: 무거운 파일은 물리 디스크에 저장되고 DB에는 텍스트 경로만 보관되어 SQLite가 항상 초경량 상태 유지.
- **운영 편의성 극대화**: 노드 ID를 한글 별칭으로 즉시 식별하고, 특정 노드의 수집 파일만 별도 디렉터리(`E:\data\...`)로 격리 보관 가능.
- **유연한 수집 확장성**: 소스 코드 수정 없이 Admin UI에서 수집 워커와 DB 스키마를 무한히 생성 및 운영 가능.

### 적용 위치:
- `server/src/database.ts`, `server/src/services/fileStorageService.ts`, `server/src/index.ts`
- `admin/src/components/tables/GcpClientsTable.tsx`, `admin/src/components/modals/NodeConfigModal.tsx`
- `admin/src/components/views/WorkerManagerView.tsx`
