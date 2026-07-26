# R-007 데이터베이스 개발 가이드라인 (database.md)

> Version: 2.0.0
> 작성자: 사용자
> 수정일: 2026-07-26
> 검토일: 2026-07-26
> 수정 이유:
>   - 실제 구현 내용 반영: admin_credentials, configattr, config 테이블 추가
>   - 관리자 UI API를 통한 DB 조작 방식(getDb 헬퍼, SQL 화이트리스트 등) 문서화
>   - 다중 DB 파일 운영 방식(database/ 디렉토리 내 복수 .db 파일) 추가
>   - bcryptjs 해시 저장 원칙 추가
> 관련 문서: docs/rule/instructions.md(R-000), docs/rule/auth.md(R-014), docs/rule/security.md(R-013), docs/rule/scheduler.md(R-005)
> 영향 범위: 기존 1.1.0 전면 개정. 코어 테이블 표 갱신, 운영 API 절 신설

---

## 1. 저장 위치 및 파일 구조

### 1.1 디렉토리 구조

```
database/
  main.db          # 시스템 핵심 베이스 (삭제 금지)
  {module}.db      # 모듈별 별도 DB (선택 운영)
  ...
```

- 모든 SQLite 파일은 프로젝트 루트 `database/` 디렉토리에 위치한다.
- `main.db`는 시스템 코어 테이블과 관리자 설정을 담는 핵심 파일이다. **절대 삭제하지 않는다.**
- 모듈별 데이터가 방대하거나 독립 운영이 필요한 경우 별도 `.db` 파일로 분리할 수 있다.
- `database/` 디렉토리는 서버 시작 시 자동 생성된다(`fs-extra.ensureDir`).

### 1.2 연결 설정 (필수)

서버 시작 시 반드시 아래 두 가지를 설정한다.

```js
// WAL 모드 활성화 - 동시 읽기 성능 향상
db.run('PRAGMA journal_mode=WAL;');

// 외래 키 제약 활성화 (SQLite 기본값은 OFF)
db.run('PRAGMA foreign_keys = ON;');
```

---

## 2. 코어 테이블 (system-defined, 삭제/구조 변경 금지)

`main.db`에 서버 시작 시 `CREATE TABLE IF NOT EXISTS`로 자동 생성된다.
코어 테이블의 구조를 변경할 때는 이 문서를 먼저 갱신한 뒤 적용한다.

| 테이블 | 용도 | 주요 컬럼 |
|---|---|---|
| `modules` | 모듈 등록 정보 | `id`, `name`, `type`, `config`, `tags`, `metadata` |
| `workflows` | YAML 워크플로우 정의 | `id`, `name`, `yaml_content`, `module_id`, `is_active` |
| `scheduled_jobs` | 스케줄러 등록 작업 | `id`, `name`, `workflow_id`, `cron_expression`, `status`, `overlap_policy` |
| `activity_logs` | 실행·종료·에러 활동 기록 | `id`, `source`, `action`, `status`, `message`, `cpu_usage`, `memory_usage` |
| `error_logs` | 예외 발생 시 상세 에러 | `id`, `error_type`, `error_message`, `stack_trace`, `context` |
| `schema_migrations` | 스키마 변경 이력 | `migration_id`, `target_type`, `module`, `description`, `applied_sql`, `applied_at` |
| `configattr` | 설정 속성 정의 목록 | `idx`, `name`, `description`, `created_at` |
| `config` | 설정 값 저장 (configattr 매핑) | `idx`, `attr_id`, `val1`, `val2`, `memo`, `created_at` |
| `admin_credentials` | 관리자 계정 (bcrypt 해시 저장) | `id(=1)`, `username`, `password(hash)`, `updated_at` |

### 2.1 configattr / config 테이블

설정 페이지(`/settings`)에서 조작하는 시스템 환경 설정 저장소다.

- `configattr`: 설정 속성 **정의** 테이블. 예: `{idx:1, name:'브라우저', description:'브라우저 실행 경로'}`
- `config`: 실제 설정 **값** 저장 테이블. `attr_id`로 `configattr.idx`를 참조한다.
- `config.attr_id`는 `FOREIGN KEY (attr_id) REFERENCES configattr(idx) ON DELETE CASCADE`를 설정한다.

초기 시딩값 (`configattr`):

| idx | name | description |
|---|---|---|
| 1 | 브라우저 | 브라우저 실행 경로 및 인자 설정 |
| 2 | 크롤러 | 크롤러 동시 실행 및 딜레이 설정 |
| 3 | 시스템 | 서버 시스템 전반 환경 설정 |

### 2.2 admin_credentials 테이블

관리자 인증 정보를 저장한다. 상세 규정은 `auth.md`(R-014) 참조.

- 행은 항상 `id = 1` 하나만 존재한다 (`CHECK(id = 1)` 제약).
- `password` 컬럼에는 평문이 아닌 **bcryptjs 해시** (cost factor 12)만 저장한다.
- 서버 시작 시 이 행을 읽어 인메모리 캐시에 로드한다.

---

## 3. 동적 테이블 (module-defined)

모듈 개발 시 필요한 테이블을 그때그때 생성하는 방식이다.

- 코어 테이블이 아닌 모든 데이터 테이블은 이 방식으로 생성한다.
- 관리자 UI(`/database` 페이지)에서 테이블 생성/삭제 가능.
- 별도 `.db` 파일에 생성하거나 `main.db`에 추가할 수 있다.
- 스키마 변경 시 `schema_migrations` 테이블에 이력을 남긴다.

---

## 4. 관리자 UI를 통한 DB 조작 API

`server/routes/adminDb.js`에서 관리자 UI와 통신하는 API를 제공한다.

### 4.1 getDb 헬퍼 함수

```js
function getDb(dbName) {
  // 경로 정규화: path.basename으로 디렉토리 탈출 방지
  const safeName = path.basename(dbName).endsWith('.db')
    ? path.basename(dbName) : `${path.basename(dbName)}.db`;
  const targetPath = path.join(__dirname, '../../database', safeName);
  return new sqlite3.Database(targetPath);
}
```

- 모든 DB 조작 API는 이 헬퍼를 통해 파일을 열어야 한다.
- 직접 경로를 조합하지 않는다 (경로 탈출 방지).

### 4.2 주요 API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/admin/api/databases` | database/ 내 `.db` 파일 목록 |
| DELETE | `/admin/api/databases/:name` | DB 파일 삭제 (`main.db` 보호됨) |
| GET | `/admin/api/tables?db=` | 특정 DB 내 테이블 목록 |
| POST | `/admin/api/tables?db=` | 새 테이블 생성 (DDL) |
| DELETE | `/admin/api/tables/:name?db=` | 테이블 삭제 (DROP TABLE) |
| GET | `/admin/api/tables/:name/schema?db=` | 테이블 컬럼 스키마 조회 |
| GET | `/admin/api/tables/:name/rows?db=` | 행 조회 (limit/offset 지원) |
| POST | `/admin/api/tables/:name/rows?db=` | 행 추가 |
| PUT | `/admin/api/tables/:name/rows/:id?db=` | 행 수정 |
| DELETE | `/admin/api/tables/:name/rows/:id?db=` | 행 삭제 |
| GET | `/admin/api/config` | config + configattr JOIN 조회 |
| POST | `/admin/api/config` | config 행 추가 |
| PUT | `/admin/api/config/:idx` | config 행 수정 |
| DELETE | `/admin/api/config/:idx` | config 행 삭제 |
| GET | `/admin/api/configattr` | configattr 목록 조회 |
| POST | `/admin/api/configattr` | configattr 항목 추가 |
| DELETE | `/admin/api/configattr/:idx` | configattr 항목 삭제 |

### 4.3 SQL 보안 원칙

- 테이블명은 `화이트리스트(sqlite_master 조회)` 또는 `path.basename` 정규화를 통해 검증한다.
- 테이블 생성 시 컬럼명/타입은 프론트엔드에서 전달받으며, 허용 타입은 `TEXT`, `INTEGER`, `REAL`, `BLOB`, `TIMESTAMP`로 제한한다.
- `DROP TABLE` 시 시스템 테이블(`modules`, `workflows`, `scheduled_jobs`, `activity_logs`, `error_logs`, `schema_migrations`, `configattr`, `config`, `admin_credentials`)은 보호 목록에서 거부한다.
- 매개변수화된 쿼리(`?` 플레이스홀더)를 사용한다. 값을 직접 SQL 문자열에 삽입하지 않는다.

---

## 5. 스키마 설계 원칙

- PK는 `INTEGER PRIMARY KEY AUTOINCREMENT`를 기본으로 한다.
- 시각 컬럼은 `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`를 사용한다.
- NOT NULL이 필요한 컬럼에는 명시적으로 `NOT NULL`을 선언한다.
- 외래 키 참조가 있는 경우 `ON DELETE CASCADE` 또는 `ON DELETE SET NULL`을 명시한다.

---

## 6. 마이그레이션 및 스키마 버전 관리

- 코어 테이블 구조 변경 → 이 문서(R-007) 갱신 후 적용.
- 모듈 테이블 구조 변경 → 적용 시점에 `schema_migrations` 테이블에 기록.
- `schema_migrations` 최소 컬럼: `migration_id`, `target_type`(core/module), `module`, `description`, `applied_sql`, `applied_at`.
- 되돌리기가 필요한 변경은 적용 전 역방향 SQL을 `docs/tips/`에 남긴다.

---

## 7. 인덱스, 외래 키, 트랜잭션

- **인덱스**: `WHERE`/`JOIN`/`ORDER BY`에 자주 사용되는 컬럼에 추가. 추가/삭제도 6장 마이그레이션 절차를 따른다.
- **외래 키**: `PRAGMA foreign_keys = ON` 명시 필수. 로그성 테이블은 외래 키를 강제하지 않아도 된다.
- **트랜잭션**: 다중 테이블 연속 쓰기는 트랜잭션으로 묶는다. 실패 시 전체 롤백 후 `error_logs`에 기록.

---

## 8. VACUUM (공간 회수)

- 로그성 테이블 대량 삭제 후 `VACUUM`을 수동으로 실행한다.
- 자동 스케줄링이 필요하면 `scheduler.md`(R-005) cron 방식으로 등록한다.
- 실행 중에는 DB 쓰기가 지연되므로 트래픽이 없는 시간대에 수행한다.

---

## 9. 백업 및 복구

- `database/main.db`와 WAL 파일(`main.db-wal`, `main.db-shm`)을 정기적으로 별도 위치에 복사 보관한다.
- 스키마 변경(6장) 직전에는 수동으로 백업 파일을 하나 남긴다.
- 복구 시 WAL 파일까지 함께 복원해야 데이터 정합성이 유지된다.
- `admin_credentials`가 포함된 백업 파일은 외부 노출에 유의한다 (비밀번호 해시 포함).
