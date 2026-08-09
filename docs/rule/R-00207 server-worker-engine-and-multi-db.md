본 문서는 `WebCrawlServer` 백엔드 서버의 **동적 수집 워커(Worker) 엔진**, **멀티 SQLite DB 동적 생성(`databases/workers/`)**, 및 **동적 테이블 스키마 매핑 규격**을 정의하는 기술 지침서입니다.

---

## 1. 개요 및 워커 아키텍처 원칙

1.1 **개요**: 서버 포트(9600)로 유입되는 소켓 수집 패킷을 수신하여, 지정된 수집 워커(Server Worker)가 패킷을 해석하고 전담 DB 및 커스텀 테이블 스키마에 동적 적재합니다.  
1.2 **3대 워커 아키텍처 원칙**:
   - **디폴트 워커 기동**: 서버 초기 구동 시 `default_worker`가 자동으로 할당되며, 기본 소켓 통신 파라미터를 기본 수용함.
   - **멀티 DB 동적 분리 생성**: 신규 워커 생성 시 `databases/workers/worker_<name>.db` 독립 DB 파일이 자동 동적 생성됨.
   - **스키마 상속 및 충돌 검증**: 신규 워커는 기본 파라미터(`client_id`, `domain`, `url`, `title`, `file_path`, `file_size`, `timestamp`)를 자동 상속받으며, DDL 조합 시 기본 칼럼과 동일한 커스텀 필드명은 자동 정화 검증을 단행함.

---

## 2. `workers` 테이블 명세 (`databases/data.db`)

워커 정의 및 DB/스키마 매핑 정보를 보관하는 메인 시스템 DB의 `workers` 테이블 스키마입니다.

```sql
CREATE TABLE IF NOT EXISTS workers (
  worker_id TEXT PRIMARY KEY,           -- 워커 고유 ID (예: "worker_facebook")
  worker_name TEXT NOT NULL,            -- 워커 한글 이름 (예: "페이스북 전담 수집 워커")
  db_file_path TEXT NOT NULL,           -- 대상 DB 경로 (예: "databases/workers/worker_facebook.db")
  table_name TEXT NOT NULL,             -- 대상 테이블명 (예: "facebook_posts")
  storage_root_path TEXT NOT NULL,      -- 워커 디폴트 저장소 루트 (예: "E:\data\facebook_worker")
  schema_json TEXT NOT NULL,            -- 커스텀 필드 정의 JSON 배열
  is_default INTEGER DEFAULT 0,         -- 디폴트 워커 여부 (1 또는 0)
  created_at TEXT NOT NULL
);
```

### 2.1 `schema_json` 구조 예시:
```json
[
  { "name": "post_count", "type": "INTEGER", "required": false },
  { "name": "author_id", "type": "TEXT", "required": true },
  { "name": "likes_count", "type": "INTEGER", "required": false }
]
```

---

## 3. 동적 워커 및 멀티 DB 생성 REST API 규정 (`POST /api/admin/workers`)

Admin UI에서 신규 워커 생성 시 호출되는 API로, 타깃 DB 파일 생성 및 SQLite `CREATE TABLE IF NOT EXISTS` 구문을 동적 실행합니다. 기본 상속 필드와의 칼럼 중복 충돌을 방지하는 검증 로직이 포함됩니다.

```typescript
// server/src/database.ts

export interface CustomFieldDef {
  name: string;
  type: "TEXT" | "INTEGER" | "REAL" | "BLOB";
  required?: boolean;
}

export interface CreateWorkerParams {
  workerId: string;
  workerName: string;
  dbFileName: string;       // 예: "worker_facebook.db" 또는 "data.db"
  tableName: string;        // 예: "facebook_posts"
  storageRootPath: string;  // 예: "E:\\data\\facebook_worker"
  customFields: CustomFieldDef[];
  isDefault?: boolean;
}

/**
 * 신규 수집 워커를 생성하고, 해당 워커 전용 DB 파일 및 스키마 테이블을 동적 빌드합니다.
 */
export function createDynamicWorker(params: CreateWorkerParams): void {
  const isMainDb = params.dbFileName === "data.db";
  const targetDbPath = isMainDb
    ? mainDbPath
    : resolve(workersDbDir, params.dbFileName);

  const targetDb = new Database(targetDbPath);
  targetDb.pragma("journal_mode = WAL");

  // DDL 기본 상속 칼럼 예약어 세트
  const reservedColumns = new Set([
    "id",
    "client_id",
    "domain",
    "url",
    "title",
    "file_path",
    "file_size",
    "timestamp",
  ]);

  let ddl = `
    CREATE TABLE IF NOT EXISTS ${params.tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      domain TEXT,
      url TEXT,
      title TEXT,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL
  `;

  // 예약어와 중복되지 않는 커스텀 필드만 DDL에 연결 (SQL 중복 칼럼 에러 차단)
  for (const field of params.customFields) {
    if (!reservedColumns.has(field.name.toLowerCase())) {
      ddl += `, ${field.name} ${field.type} ${field.required ? "NOT NULL" : ""}`;
    }
  }
  ddl += `);`;

  targetDb.prepare(ddl).run();

  const dbRelPath = isMainDb
    ? "databases/data.db"
    : `databases/workers/${params.dbFileName}`;

  db.prepare(
    `
    INSERT INTO workers (worker_id, worker_name, db_file_path, table_name, storage_root_path, schema_json, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    params.workerId,
    params.workerName,
    dbRelPath,
    params.tableName,
    params.storageRootPath,
    JSON.stringify(params.customFields),
    params.isDefault ? 1 : 0,
    new Date().toISOString()
  );
}
```

---

## 4. 파이프라인 워커 실행 엔진 규정 (`executeWorkerPipeline`)

수집 패킷 유입 시 지정된 워커가 동적으로 실행되어 해당 DB 및 파일 저장소에 데이터를 파싱·적재합니다.

```typescript
// server/src/services/workerEngineService.ts

/**
 * 유입 패킷을 담당 워커 스키마에 맞춰 인서트합니다.
 */
export function executeWorkerPipeline(
  workerConfig: WorkerRecord,
  clientId: string,
  domain: string,
  filePath: string,
  fileSize: number,
  packetPayload: Record<string, unknown>
): void {
  const targetDbPath = resolve(__dirname, "..", "..", workerConfig.db_file_path);
  const targetDb = new Database(targetDbPath);

  const customFields: CustomFieldDef[] = JSON.parse(workerConfig.schema_json || "[]");

  let cols = "client_id, domain, url, title, file_path, file_size, timestamp";
  let vals = "?, ?, ?, ?, ?, ?, ?";
  const paramValues: unknown[] = [
    clientId,
    domain,
    packetPayload.url || "",
    packetPayload.title || "",
    filePath,
    fileSize,
    Date.now(),
  ];

  for (const field of customFields) {
    cols += `, ${field.name}`;
    vals += `, ?`;
    paramValues.push(packetPayload[field.name] ?? null);
  }

  const query = `INSERT INTO ${workerConfig.table_name} (${cols}) VALUES (${vals})`;
  targetDb.prepare(query).run(...paramValues);
}
```

---

## 5. 검증 체크리스트

- [ ] Admin UI에서 신규 워커 생성 시 `databases/workers/`에 지정한 `.db` 파일 및 테이블이 자동 동적 생성되는가?
- [ ] 신규 워커에 정의한 커스텀 필드 중 기본 상속 칼럼과 중복되는 필드명이 에러 없이 안전하게 정화되는가?
- [ ] 패킷 유입 시 워커에 지정된 독립 DB 파일 및 테이블로 데이터가 정상 INSERT되는가?
