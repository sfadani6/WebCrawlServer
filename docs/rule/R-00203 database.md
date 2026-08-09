# R-00203 docs/rule/R-00203 database.md

`WebCrawlServer`는 SQLite 기반 로컬 데이터베이스를 사용합니다. 본 문서는 데이터베이스 설계, 마이그레이션, 백업 및 관리자 UI API 관점을 다룹니다.

## 스키마

- `clients` 테이블 (4컬럼 구조, R-00206 참조)
  - `client_id` TEXT PRIMARY KEY
  - `client_type` TEXT NOT NULL
  - `alias` TEXT (플러그인 환경설정에서 저장한 노드 별칭, 미설정 시 NULL)
  - `connected_at` TEXT NOT NULL
  - 연결 시 자동 `upsertClient()` 등록, 별칭은 `CLIENT_CONFIG_UPDATE` 액션으로만 갱신됩니다.
- `crawl_logs` 테이블 (수집 로그 + 물리 파일 분리 저장 메타, R-00208 참조)
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `client_id` TEXT NOT NULL
  - `domain` TEXT DEFAULT '' (수집 URL 호스트명)
  - `action` TEXT DEFAULT '' (액션 구분: `CRAWL_DOCUMENT`/`CRAWL_PARTIAL`/`CRAWL_METADATA`/`CRAWL_BINARY`)
  - `worker_name` TEXT DEFAULT '' (담당 워커)
  - `url` TEXT DEFAULT '' (수집 원본 URL)
  - `title` TEXT DEFAULT '' (수집 제목)
  - `file_path` TEXT DEFAULT '' (물리 분리 저장 파일 절대 경로)
  - `file_size` INTEGER DEFAULT 0 (파일 크기 Bytes)
  - `log_message` TEXT NOT NULL
  - `timestamp` INTEGER NOT NULL
  - FOREIGN KEY (`client_id`) REFERENCES `clients`(`client_id`) ON DELETE CASCADE
- `workers` 테이블 (동적 수집 워커 레지스트리, R-00207 참조)
  - `worker_id` TEXT PRIMARY KEY, `worker_name` TEXT NOT NULL
  - `db_file_path` TEXT NOT NULL, `table_name` TEXT NOT NULL
  - `storage_root_path` TEXT NOT NULL, `schema_json` TEXT NOT NULL
  - `is_default` INTEGER DEFAULT 0, `created_at` TEXT NOT NULL
  - 기동 시 `default_worker`(기본 수집 워커)를 자동 가등록합니다.
- `configs` 테이블 (시스템 환경 설정)
  - `key` TEXT PRIMARY KEY (설정 변수명)
  - `value` TEXT NOT NULL (설정 값)
  - `description` TEXT (설정 항목 설명/코멘트)
  - 서버 기동 시 `server/configs.json`(`{ "키": { "value", "description" } }`)을 디폴트 소스로 하여 **누락된 키만 INSERT** 시드하며, 이미 존재하는 키의 값은 유지(관리자 수정값 보존)합니다.
  - `data_path`(데이터 저장 기본 경로)는 노드/워커 전용 저장 경로 미지정 시 물리 파일 분리 저장소의 **글로벌 기본 저장 경로**로 사용됩니다(R-00208: `data_path` > `STORAGE_ROOT_PATH` > `./storage`). 서버 기동 시 `runStartupValidation()`이 실존 검증 후 없으면 자동 생성합니다.

`databases/serverlogs.db` (서버 로그 전용 DB)

- `systemlog` 테이블 (DB 기반 시스템 로그)
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT (PK ID)
  - `msg_type` TEXT NOT NULL (메세지 종류, 예: `INIT`, `CONFIG`, `ERROR`)
  - `message` TEXT NOT NULL (메세지 본문)
  - `code` INTEGER NOT NULL DEFAULT 1 (숫자 구분 코드)
  - `insertSystemLog()`로 기록하고 `getSystemLogs()`로 최신순 조회합니다.
- `plugin_messages` 테이블 (플러그인 수신 메시지 원장, 모든 액션 보존)
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `client_id` TEXT NOT NULL (발신 노드 ID)
  - `action` TEXT NOT NULL (수신 액션 구분)
  - `payload_type` TEXT NOT NULL DEFAULT 'json'
  - `payload_json` TEXT (원장 JSON)
  - `meta_json` TEXT (패킷 메타 정보)
  - `file_path` TEXT (평면 구조 물리 파일 절대 경로: `<기본경로>/clients/<clientId>/<action>/<timestamp>-<messageId>.<ext>`)
  - `file_size` INTEGER DEFAULT 0
  - `timestamp` INTEGER NOT NULL
  - 모든 액션(환경설정/수집/채팅/바이너리 등)이 수신 순서대로 원장에 기록됩니다.

## 마이그레이션

- 서버 기동 시 `initializeDatabase()`에서 `CREATE TABLE IF NOT EXISTS` 및 PRAGMA 기반 자동 마이그레이션을 수행합니다.
- `ensureClientsTableSchema()`: 구버전(6컬럼 `assigned_worker_id`/`custom_storage_path` 포함) 테이블 감지 시 `clients_legacy`로 이관 후 4컬럼으로 재생성하며, 3컬럼에 `alias`가 누락된 경우 `ALTER TABLE ... ADD COLUMN alias TEXT`로 기존 데이터를 보존합니다.
- `ensureCrawlLogsTableSchema()`: 기존 `crawl_logs` 테이블에 최신 컬럼(`domain`/`action`/`worker_name`/`url`/`title`/`file_path`/`file_size`)이 없으면 부재 컬럼만 `ALTER TABLE ... ADD COLUMN`으로 추가합니다. (`CREATE TABLE IF NOT EXISTS`는 기존 테이블 스키마를 갱신하지 않으므로 구버전 테이블은 별도 마이그레이션이 필수입니다.)
- `ensurePluginMessagesTable()`: `plugin_messages` 원장 테이블 생성.
- SQLite는 `ALTER TABLE ADD COLUMN`으로 컬럼 순서를 기존 뒤쪽에 추가하므로, 애플리케이션 코드는 컬럼 순서가 아닌 **이름** 기준으로 쿼리해야 합니다.

## 백업

- 데이터 파일은 `databases/data.db`에 저장됩니다.
- 정기 백업은 파일 복사 수준에서 관리해야 합니다.
- `data.db-wal` 파일이 존재하면 정상적인 WAL 모드 트랜잭션 처리 중임을 의미합니다.

## 관리자 UI API

- `/api/db/clients`: 등록된 클라이언트 목록 조회
- `/api/db/logs`: 최근 수집 로그 조회
- `DELETE /api/db/logs`: 전체 수집 로그 삭제
- `DELETE /api/db/clients/:clientId`: 특정 클라이언트 및 관련 로그 삭제
- `GET /api/db/plugin_messages?clientId=&action=&limit=&offset=`: 플러그인 수신 메시지 원장 조회 (선택 필터, 최신순, 기본 limit 100)
- `GET /api/admin/configs`: 시스템 환경 설정 목록 조회 (변수명/값/코멘트)
- `PUT /api/admin/configs/:key` `{value}`: 환경 설정 값 수정 (미존재 키 404, 빈 값 400)
- `GET /api/admin/fs/browse?path=...`: 파일 브라우저 디렉토리 목록 조회 (path 미지정 시 드라이브 루트, 지정 시 하위 디렉토리 목록/부모 경로, 로컬 전체 파일시스템 탐색 허용)

## DB 관리 매니저 API (R-00304 DB 관리 UI 규격)

대상 DB는 `databases/` 및 `databases/workers/` 내부의 `.db` 파일로 제한되며, 모든 `dbRel` 파라미터는 서버측 화이트리스트 검증(`resolveDbRelPath`)을 거쳐 Path Traversal을 차단합니다.

- `GET /api/admin/db/files`: 전체 DB 파일 목록 조회 (파일 크기/수정 시각/테이블 수 포함)
- `GET /api/admin/db/tables?dbRel=...`: 대상 DB의 테이블 목록 (행 수 포함)
- `GET /api/admin/db/schema?dbRel=...&table=...`: 특정 테이블의 컬럼/인덱스/행 수 스키마
- `POST /api/admin/db/query` `{dbRel, sql}`: 임의 SQL 실행 (쓰기/DDL 시 관리자 활동 로그 기록)
- `GET /api/admin/db/rows?dbRel=...&table=...&page=&size=&search=`: 행 페이지네이션 조회 (TEXT LIKE 검색)
- `POST /api/admin/db/rows` `{dbRel, table, data}`: 행 추가
- `PUT /api/admin/db/rows/:pkValue`: PK 기반 행 수정 (PK 없는 테이블은 거부)
- `DELETE /api/admin/db/rows/:pkValue`: PK 기반 행 삭제
- `POST /api/admin/db/tables` `{dbRel, tableName, columns}`: 신규 테이블 생성
- `DELETE /api/admin/db/tables/:tableName`: 테이블 삭제
- `POST /api/admin/db/tables/:tableName/columns` `{dbRel, column}`: 컬럼 추가
- `POST /api/admin/db/backups` `{dbRel}`: 백업 생성 (`databases/backups/<원본명>_<타임스탬프>.db`)
- `GET /api/admin/db/backups`: 백업 목록 조회 (실제 DB 파일명 매칭으로 원본 식별)
- `GET /api/admin/db/backups/download?fileName=...`: 백업 파일 다운로드
- `POST /api/admin/db/backups/restore` `{dbRel, fileName}`: 기존 백업 파일 복원
- `POST /api/admin/db/restore` `{dbRel, contentBase64}`: base64 업로드 DB 복원 (`express.json({ limit: "200mb" })`)
- `GET /api/admin/db/storage-info`: 물리 저장소 용량/DB 파일별 크기/백업 용량 모니터링

복원 시 원본을 보호하기 위해 복원 전 현재 파일을 `databases/backups/<원본명>_pre-restore_<타임스탬프>.db`로 자동 보존합니다. 테이블/컬럼 식별자와 SQLite 타입은 서버측 정규식 검증을 거칩니다.

## 설계 지침

- 외래 키 무결성을 위해 `foreign_keys = ON`을 사용합니다.
- WAL 모드(`journal_mode = WAL`)를 통해 동시 읽기/쓰기 성능을 개선합니다.
- DB 파일 경로는 `import.meta.url` 기반 절대 경로로 계산합니다. 컴파일 결과가 `dist/services/` 하위에 위치하므로 루트 `databases`는 3단계 위(`resolve(__dirname, "..", "..", "..", "databases")`)로 해석합니다.



