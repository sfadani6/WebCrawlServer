// server/src/database.ts

import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

/** 클라이언트 DB 기록 구조체 (4컬럼 재구성 — 별칭은 플러그인 환경설정에서 서버 전송으로 저장) */
export interface ClientRecord {
  /** 클라이언트 고유 UUID */
  client_id: string;
  /** 클라이언트 구분 타입 (plugin | admin) */
  client_type: string;
  /** 노드 한글 별칭 (플러그인 환경설정 저장 시 서버로 전송되어 반영) */
  alias?: string;
  /** 최초 연결 시각 (ISO 문자열) */
  connected_at: string;
}

/** 크롤링 수집 로그 DB 기록 구조체 */
export interface CrawlLogRecord {
  /** 레코드 PK ID */
  id: number;
  /** 수집 노드 UUID */
  client_id: string;
  /** 수집 도메인 */
  domain?: string;
  /** 액션 구분 */
  action?: string;
  /** 담당 워커명 */
  worker_name?: string;
  /** 수집 URL */
  url?: string;
  /** 페이지 타이틀 */
  title?: string;
  /** 물리 파일 저장 경로 */
  file_path?: string;
  /** 파일 크기 (Bytes) */
  file_size?: number;
  /** 직렬화된 로그 메시지 바디 */
  log_message: string;
  /** 수집 시점 타임스탬프 */
  timestamp: number;
}

/** 시스템 환경 설정(configs) DB 기록 구조체 */
export interface ConfigRecord {
  /** 설정 변수명 (영문 식별자, PK) */
  key: string;
  /** 설정 값 (문자열) */
  value: string;
  /** 설정 항목 설명/코멘트 */
  description?: string;
}

/** 시스템 로그(systemlog) DB 기록 구조체 */
export interface SystemLogRecord {
  /** 레코드 PK ID (AUTOINCREMENT) */
  id: number;
  /** 로그 메세지 종류 (예: "INIT", "CONFIG", "ERROR") */
  msg_type: string;
  /** 로그 메세지 본문 */
  message: string;
  /** 숫자 구분 코드 (기본값 1) */
  code: number;
}

/** 플러그인 수신 메시지 원장(plugin_messages) DB 기록 구조체 */
export interface PluginMessageRecord {
  /** 레코드 PK ID (AUTOINCREMENT) */
  id: number;
  /** 수신 플러그인 노드 UUID */
  client_id: string;
  /** 메시지 행동 구분 액션명 (환경설정/수집/채팅/바이너리/지시 등) */
  action: string;
  /** 페이로드 물리 포맷 (json | binary_base64 | raw_text | chunk_stream) */
  payload_type: string;
  /** 직렬화된 페이로드 JSON 문자열 (바이너리는 원본 저장 파일 경로 참조) */
  payload_json: string | null;
  /** 직렬화된 메타데이터 JSON 문자열 */
  meta_json: string | null;
  /** 원본 메시지 물리 파일 저장 경로 (평면 구조 저장 시) */
  file_path: string | null;
  /** 저장 파일 크기 Bytes */
  file_size: number;
  /** 수신 시점 타임스탬프 */
  timestamp: number;
}

/** plugin_messages 조회 필터 파라미터 구조체 */
export interface PluginMessageQuery {
  /** 특정 클라이언트 필터 (선택) */
  clientId?: string;
  /** 특정 액션 필터 (선택) */
  action?: string;
  /** 조회 건수 제한 (기본값: 100) */
  limit?: number;
  /** 조회 시작 오프셋 (기본값: 0) */
  offset?: number;
}

/** 커스텀 스키마 필드 정의 구조체 */
export interface CustomFieldDef {
  /** 필드 영문 식별자 */
  name: string;
  /** SQLite 필드 데이터 타입 */
  type: "TEXT" | "INTEGER" | "REAL" | "BLOB";
  /** 필수 필드 여부 */
  required?: boolean;
}

/** 워커 DB 기록 구조체 */
export interface WorkerRecord {
  /** 워커 고유 ID */
  worker_id: string;
  /** 워커 한글 이름 */
  worker_name: string;
  /** 대상 DB 파일 상대 경로 */
  db_file_path: string;
  /** 대상 테이블 이름 */
  table_name: string;
  /** 워커 전용 파일 저장소 루트 경로 */
  storage_root_path: string;
  /** 직렬화된 커스텀 스키마 JSON 문자열 */
  schema_json: string;
  /** 기본 워커 여부 (1 또는 0) */
  is_default: number;
  /** 워커 생성 시각 */
  created_at: string;
}

/** 워커 생성 파라미터 구조체 */
export interface CreateWorkerParams {
  /** 워커 고유 ID (영문 식별자) */
  workerId: string;
  /** 워커 한글 이름 */
  workerName: string;
  /** 바인딩 DB 파일명 */
  dbFileName: string;
  /** 타깃 테이블명 */
  tableName: string;
  /** 파일 저장소 루트 경로 */
  storageRootPath: string;
  /** 커스텀 스키마 필드 정의 배열 */
  customFields: CustomFieldDef[];
  /** 기본 워커 지정 여부 */
  isDefault?: boolean;
}

// ESM 환경에서 __dirname 대체 경로 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 최상위 databases 및 databases/workers 경로 계산
const databasesDir = resolve(__dirname, "..", "..", "databases");
const workersDbDir = resolve(databasesDir, "workers");

// workers 서브 디렉터리 없을 경우 자동 생성
if (!existsSync(workersDbDir)) {
  mkdirSync(workersDbDir, { recursive: true });
}

// 메인 DB 경로 및 인스턴스 초기화
const mainDbPath = resolve(databasesDir, "data.db");
const db = new Database(mainDbPath);

// SQLite 고성능 및 무결성 PRAGMA 설정
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

// 서버 로그 전용 DB(serverlogs.db) 경로 및 인스턴스 초기화
// (각종 로그 테이블의 본체 저장소, 시스템 로그는 databases/serverlogs.db 하위 systemlog 테이블에 보관)
const serverLogsDbPath = resolve(databasesDir, "serverlogs.db");
const serverLogsDb = new Database(serverLogsDbPath);
serverLogsDb.pragma("journal_mode = WAL");

/**
 * clients 테이블을 4컬럼 구조(client_id/client_type/alias/connected_at)로 재구성합니다.
 * 기존 구버전(6컬럼: assigned_worker_id/custom_storage_path 포함) 테이블이 감지되면
 * 데이터(client_id/client_type/alias/connected_at)를 보존하며 테이블을 재생성합니다.
 */
function ensureClientsTableSchema(): void {
  // 1. 구버전 스키마 여부 감지 (PRAGMA table_info 기준)
  const existingColumns = db
    .prepare("PRAGMA table_info(clients)")
    .all() as Array<{ name: string }>;
  const legacySchemaDetected = existingColumns.some(
    (col) =>
      col.name === "assigned_worker_id" || col.name === "custom_storage_path"
  );
  const aliasMissing = existingColumns.some((col) => col.name === "alias") === false;

  if (legacySchemaDetected) {
    // 2. 구버전(6컬럼: assigned_worker_id/custom_storage_path 포함) 마이그레이션:
    //    기존 데이터 보존하며 4컬럼으로 재생성
    db.prepare("ALTER TABLE clients RENAME TO clients_legacy").run();
    db.prepare(
      `
      CREATE TABLE clients (
        client_id TEXT PRIMARY KEY,
        client_type TEXT NOT NULL,
        alias TEXT,
        connected_at TEXT NOT NULL
      )
    `
    ).run();
    db.prepare(
      `
      INSERT INTO clients (client_id, client_type, alias, connected_at)
      SELECT client_id, client_type, alias, connected_at FROM clients_legacy
    `
    ).run();
    db.prepare("DROP TABLE clients_legacy").run();
    return;
  }

  if (existingColumns.length > 0 && aliasMissing) {
    // 3. 기존 테이블이 있으나 alias 컬럼이 누락된 경우 (이전 3컬럼 스키마)
    //    기존 데이터(client_id/client_type/connected_at)를 보존하며 alias 컬럼만 추가
    db.prepare("ALTER TABLE clients ADD COLUMN alias TEXT").run();
    return;
  }

  // 4. 신규 4컬럼 스키마로 생성 (최초 생성 시)
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS clients (
      client_id TEXT PRIMARY KEY,
      client_type TEXT NOT NULL,
      alias TEXT,
      connected_at TEXT NOT NULL
    )
    `
  ).run();
}

/**
 * crawl_logs 테이블에 최신 스키마 컬럼(action/domain/file_path 등)이 반영되지 않은
 * 구버전 테이블을 감지하여 기존 데이터를 보존한 채 부재 컬럼만 추가합니다.
 * (CREATE TABLE IF NOT EXISTS는 기존 테이블의 스키마를 갱신하지 않으므로
 * 별도 마이그레이션이 필요합니다.)
 */
function ensureCrawlLogsTableSchema(): void {
  // 1. 기존 스키마 감지 (PRAGMA table_info 기준)
  const existingColumns = db
    .prepare("PRAGMA table_info(crawl_logs)")
    .all() as Array<{ name: string }>;

  if (existingColumns.length === 0) {
    // 테이블 자체가 없으면 CREATE TABLE IF NOT EXISTS로 생성되므로 여기서 종료
    return;
  }

  const columnNames = existingColumns.map((col) => col.name);

  // 2. 최신 스키마 기준 부재 컬럼 목록 (신규 프로젝트 CREATE TABLE과 동일한 정의)
  const columnsToAdd: Array<[string, string]> = [
    ["domain", "TEXT DEFAULT ''"],
    ["action", "TEXT DEFAULT ''"],
    ["worker_name", "TEXT DEFAULT ''"],
    ["url", "TEXT DEFAULT ''"],
    ["title", "TEXT DEFAULT ''"],
    ["file_path", "TEXT DEFAULT ''"],
    ["file_size", "INTEGER DEFAULT 0"],
  ];

  for (const [columnName, columnDdl] of columnsToAdd) {
    if (!columnNames.includes(columnName)) {
      // 3. 구버전 스키마 마이그레이션: 기존 데이터를 보존하며 부재 컬럼만 추가
      db.prepare(
        `ALTER TABLE crawl_logs ADD COLUMN ${columnName} ${columnDdl}`
      ).run();
    }
  }
}

/**
 * serverlogs DB(serverlogs.db)의 plugin_messages 원장 테이블을 생성합니다.
 * 플러그인에서 수신된 모든 액션 메시지를 보존하는 원장 저장소 역할을 합니다.
 */
function ensurePluginMessagesTable(): void {
  serverLogsDb.prepare(
    `
    CREATE TABLE IF NOT EXISTS plugin_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload_type TEXT NOT NULL DEFAULT 'json',
      payload_json TEXT,
      meta_json TEXT,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL
    )
  `
  ).run();
}

/**
 * 프로젝트 구동에 필수적인 메인 시스템 DB 스키마 및 디폴트 워커를 초기 구성합니다.
 * 백엔드 진입 시 즉시 1회 자동 호출됩니다.
 */
export function initializeDatabase(): void {
  // 1. clients 테이블 4컬럼 스키마 보장 (구버전 6컬럼 테이블 마이그레이션 포함)
  ensureClientsTableSchema();

  // 2. crawl_logs 기본 로그 테이블 생성 (도메인, URL, 물리 파일 경로 포함)
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS crawl_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      domain TEXT,
      action TEXT,
      worker_name TEXT,
      url TEXT,
      title TEXT,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      log_message TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients (client_id) ON DELETE CASCADE
    )
  `
  ).run();

  // 2-1. 구버전 crawl_logs 테이블에 action 컬럼이 없는 경우 마이그레이션
  ensureCrawlLogsTableSchema();

  // 3. workers 테이블 신설 (동적 수집 워커 레지스트리)
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS workers (
      worker_id TEXT PRIMARY KEY,
      worker_name TEXT NOT NULL,
      db_file_path TEXT NOT NULL,
      table_name TEXT NOT NULL,
      storage_root_path TEXT NOT NULL,
      schema_json TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `
  ).run();

  // 4. 디폴트 워커 자동 가등록 (없을 경우에만)
  const defaultWorkerExist = db
    .prepare("SELECT * FROM workers WHERE worker_id = 'default_worker'")
    .get();

  if (!defaultWorkerExist) {
    db.prepare(
      `
      INSERT INTO workers (worker_id, worker_name, db_file_path, table_name, storage_root_path, schema_json, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      "default_worker",
      "기본 수집 워커",
      "databases/data.db",
      "crawl_logs",
      "./storage",
      JSON.stringify([]),
      1,
      new Date().toISOString()
    );
  }

  // 5. 시스템 환경 설정(configs) 테이블 생성 및 디폴트 값 시드
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS configs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT
    )
  `
  ).run();

  seedConfigDefaults();

  // 6. 서버 로그 전용 DB(serverlogs.db)의 systemlog 테이블 생성
  serverLogsDb.prepare(
    `
    CREATE TABLE IF NOT EXISTS systemlog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      msg_type TEXT NOT NULL,
      message TEXT NOT NULL,
      code INTEGER NOT NULL DEFAULT 1
    )
  `
  ).run();

  // 7. serverlogs DB의 plugin_messages 원장 테이블 생성 (플러그인 수신 메시지 원장)
  ensurePluginMessagesTable();
}

/**
 * serverlogs DB의 systemlog 테이블에 시스템 로그 레코드를 삽입합니다.
 * 로그 파일(logs/*.log)과 별개로 DB 기반 로그 이력을 남기기 위한 용도입니다.
 *
 * @param msgType - 로그 메세지 종류 (예: "INIT", "CONFIG", "ERROR")
 * @param message - 로그 메세지 본문
 * @param code - 숫자 구분 코드 (기본값 1)
 * @returns 삽입된 레코드의 ID
 */
export function insertSystemLog(
  msgType: string,
  message: string,
  code: number = 1
): number {
  const info = serverLogsDb
    .prepare("INSERT INTO systemlog (msg_type, message, code) VALUES (?, ?, ?)")
    .run(msgType, message, code);
  return Number(info.lastInsertRowid);
}

/**
 * serverlogs DB의 systemlog 테이블에서 최근 시스템 로그를 최신순으로 조회합니다.
 *
 * @param limit - 조회 건수 제한 (기본값: 100)
 * @param offset - 조회 시작 오프셋 (기본값: 0)
 * @returns 시스템 로그 레코드 배열
 */
export function getSystemLogs(
  limit: number = 100,
  offset: number = 0
): SystemLogRecord[] {
  return serverLogsDb
    .prepare("SELECT * FROM systemlog ORDER BY id DESC LIMIT ? OFFSET ?")
    .all(limit, offset) as SystemLogRecord[];
}

/**
 * server/configs.json을 디폴트 소스로 하여 configs 테이블에 누락된 설정만 시드합니다.
 * configs.json 형식: { "키": { "value": "...", "description": "..." } }
 * 이미 존재하는 키의 기존 값은 유지(덮어쓰지 않음)하여 관리자 수정값이 보존되도록 합니다.
 * configs.json이 없거나 파싱에 실패하면 조용히 무시합니다.
 */
function seedConfigDefaults(): void {
  // 컴파일 산출물(dist/) 기준 server/configs.json 경로 계산
  const configsPath = resolve(__dirname, "..", "configs.json");

  if (!existsSync(configsPath)) {
    return;
  }

  try {
    const rawConfigs = JSON.parse(
      readFileSync(configsPath, "utf-8")
    ) as Record<string, { value?: unknown; description?: string }>;

    for (const [key, entry] of Object.entries(rawConfigs)) {
      if (!key || typeof entry !== "object" || entry === null) {
        continue;
      }

      // 키가 이미 존재하면 디폴트로 덮어쓰지 않음
      const existing = db
        .prepare("SELECT key FROM configs WHERE key = ?")
        .get(key);
      if (existing) {
        continue;
      }

      db.prepare(
        "INSERT INTO configs (key, value, description) VALUES (?, ?, ?)"
      ).run(
        key,
        entry.value === undefined ? "" : String(entry.value),
        entry.description || null
      );
    }
  } catch {
    // configs.json 파싱 실패 시 기본값 시드를 건너뜀
  }
}

/**
 * 데이터베이스에 기록된 모든 수집 클라이언트 목록을 조회합니다.
 *
 * @returns 클라이언트 레코드 배열
 */
export function getAllClients(): ClientRecord[] {
  return db
    .prepare("SELECT * FROM clients ORDER BY connected_at DESC")
    .all() as ClientRecord[];
}

/**
 * 시스템 환경 설정(configs) 전체 목록을 조회합니다.
 *
 * @returns 환경 설정 레코드 배열 (변수명, 값, 설명)
 */
export function getAllConfigs(): ConfigRecord[] {
  return db
    .prepare("SELECT key, value, description FROM configs ORDER BY key ASC")
    .all() as ConfigRecord[];
}

/**
 * 특정 환경 설정 키의 값을 갱신합니다.
 * 값 변경 시 코멘트(description)는 유지하며, 존재하지 않는 키는 갱신하지 않습니다.
 *
 * @param key - 변경할 설정 변수명
 * @param value - 새 설정 값 (문자열)
 * @returns 갱신된 행 수 (0이면 해당 키 미존재)
 */
export function updateConfigValue(key: string, value: string): number {
  const info = db
    .prepare("UPDATE configs SET value = ? WHERE key = ?")
    .run(value, key);
  return info.changes;
}

/**
 * 특정 클라이언트 노드의 환경설정(별칭)을 업데이트합니다.
 * 별칭은 플러그인이 환경설정에서 저장할 때 서버로 전송되어 이 함수로 기록됩니다.
 * 수시로 변경할 수 있으며, 기존 별칭이 없던 노드도 신규 등록됩니다.
 *
 * @param clientId - 대상 클라이언트 UUID
 * @param alias - 노드 한글 별칭 (빈 문자열/undefined 시 NULL 처리)
 */
export function updateClientConfig(
  clientId: string,
  alias?: string
): void {
  db.prepare(
    `
    UPDATE clients
    SET alias = ?
    WHERE client_id = ?
  `
  ).run(alias || null, clientId);
}

/**
 * 전체 수집 워커 목록을 조회합니다. 디폴트 워커가 상단에 정렬됩니다.
 *
 * @returns 워커 레코드 배열
 */
export function getAllWorkers(): WorkerRecord[] {
  return db
    .prepare("SELECT * FROM workers ORDER BY is_default DESC, created_at ASC")
    .all() as WorkerRecord[];
}

/**
 * 특정 워커 ID로 워커 정보를 조회합니다.
 *
 * @param workerId - 조회할 워커 ID
 * @returns 워커 레코드 또는 undefined
 */
export function getWorkerById(workerId: string): WorkerRecord | undefined {
  return db
    .prepare("SELECT * FROM workers WHERE worker_id = ?")
    .get(workerId) as WorkerRecord | undefined;
}

/**
 * 신규 수집 워커를 생성하고, 해당 워커 전용 DB 파일 및 스키마 테이블을 동적으로 빌드합니다.
 * DDL 예약어와 중복되는 커스텀 필드는 자동 필터링됩니다.
 *
 * @param params - 워커 생성 파라미터 객체
 */
export function createDynamicWorker(params: CreateWorkerParams): void {
  // 메인 DB와 신규 전용 DB 경로를 구분 처리
  const isMainDb = params.dbFileName === "data.db";
  const targetDbPath = isMainDb
    ? mainDbPath
    : resolve(workersDbDir, params.dbFileName);

  // 타깃 DB 인스턴스 열기 (신규 생성 포함)
  const targetDb = new Database(targetDbPath);
  targetDb.pragma("journal_mode = WAL");

  // DDL 기본 상속 예약어 컬럼 세트 (중복 방지용 가드 집합)
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

  // 기본 컬럼 DDL 구성
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

  // 예약어와 중복되지 않는 커스텀 필드만 DDL에 연결 (SQL 오류 방지)
  for (const field of params.customFields) {
    if (!reservedColumns.has(field.name.toLowerCase())) {
      ddl += `, ${field.name} ${field.type} ${field.required ? "NOT NULL" : ""}`;
    }
  }
  ddl += `);`;

  // 타깃 DB에 동적 테이블 생성
  targetDb.prepare(ddl).run();

  // 메인 DB workers 레지스트리에 워커 정보 등록
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

/**
 * 최근 수집 로그를 페이지네이션 방식으로 조회합니다.
 *
 * @param limit - 조회 건수 제한 (기본값: 100)
 * @param offset - 조회 시작 오프셋 (기본값: 0)
 * @returns 크롤링 로그 레코드 배열
 */
export function getCrawlLogs(
  limit: number = 100,
  offset: number = 0
): CrawlLogRecord[] {
  return db
    .prepare(
      "SELECT * FROM crawl_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    )
    .all(limit, offset) as CrawlLogRecord[];
}

/**
 * 특정 crawl_logs 레코드에 물리 파일 저장 경로 및 크기를 반영합니다.
 * 수집 로그를 먼저 적재한 뒤, 물리 파일 저장이 완료되면 해당 레코드의
 * file_path/file_size 컬럼을 갱신하는 데 사용됩니다.
 *
 * @param id - crawl_logs 레코드 PK ID
 * @param filePath - 저장된 HTML 물리 파일 절대 경로
 * @param fileSize - 저장 파일 크기 Bytes
 */
export function updateCrawlLogFile(
  id: number,
  filePath: string,
  fileSize: number
): void {
  db.prepare(
    "UPDATE crawl_logs SET file_path = ?, file_size = ? WHERE id = ?"
  ).run(filePath, fileSize, id);
}

/**
 * 데이터베이스의 모든 수집 로그를 일괄 소거합니다.
 */
export function clearAllCrawlLogs(): void {
  db.prepare("DELETE FROM crawl_logs").run();
}

/**
 * 특정 클라이언트를 데이터베이스에서 영구 삭제(정화 추방)합니다.
 * 연쇄 삭제(CASCADE)로 관련 로그도 함께 제거됩니다.
 *
 * @param clientId - 삭제할 클라이언트 UUID
 */
export function purgeClient(clientId: string): void {
  db.prepare("DELETE FROM clients WHERE client_id = ?").run(clientId);
}

/**
 * 수집 노드 웹소켓 세션 마운트 시 클라이언트를 자동 등록(upsert)합니다.
 * CRAWL_LOG 수신 여부와 무관하게 소켓 연결만으로도 노드가 admin 목록에 표시되도록 보장합니다.
 * 최초 접속이면 INSERT, 기존 노드이면 connected_at을 현재 시각으로 갱신합니다.
 *
 * @param clientId - 수집 노드 고유 UUID
 * @param clientType - 클라이언트 구분 타입 ("plugin" | "admin")
 */
export function upsertClient(clientId: string, clientType: string): void {
  db.prepare(
    `
    INSERT INTO clients (client_id, client_type, connected_at)
    VALUES (?, ?, ?)
    ON CONFLICT(client_id) DO UPDATE SET
      client_type = excluded.client_type,
      connected_at = excluded.connected_at
    `
  ).run(clientId, clientType, new Date().toISOString());
}

/**
 * 수집 노드로부터 수신된 로그를 데이터베이스에 삽입합니다.
 * 클라이언트 미등록 시 자동으로 INSERT OR IGNORE 처리합니다.
 *
 * @param clientId - 수집 노드 UUID
 * @param logMessage - 직렬화된 로그 메시지 바디
 * @param timestamp - 수집 시점 타임스탬프
 * @param domain - 수집 도메인 (기본값: "common")
 * @param filePath - 물리 파일 저장 경로 (기본값: "")
 * @param fileSize - 파일 크기 Bytes (기본값: 0)
 * @param action - 수집 액션 구분 (기본값: "CRAWL_DOCUMENT", 이전 "CRAWL_LOG" 하드코딩 대체)
 * @returns 삽입된 레코드의 ID
 */
export function insertCrawlLog(
  clientId: string,
  logMessage: string,
  timestamp: number,
  domain: string = "common",
  filePath: string = "",
  fileSize: number = 0,
  action: string = "CRAWL_DOCUMENT"
): number {
  // 미등록 클라이언트인 경우 자동 등록 (플러그인 최초 수신 처리)
  upsertClient(clientId, "plugin");

  // 수집 로그 레코드 적재
  const info = db
    .prepare(
      "INSERT INTO crawl_logs (client_id, domain, action, file_path, file_size, log_message, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(clientId, domain, action, filePath, fileSize, logMessage, timestamp);

  return Number(info.lastInsertRowid);
}

/**
 * 플러그인에서 수신된 메시지 패킷을 serverlogs DB의 plugin_messages 원장 테이블에 적재합니다.
 * 환경설정/수집/채팅/바이너리/지시 등 모든 액션을 수신 순서대로 보존합니다.
 *
 * @param clientId - 수신 플러그인 노드 UUID
 * @param action - 메시지 행동 구분 액션명
 * @param payloadType - 페이로드 물리 포맷 (기본값: "json")
 * @param payloadJson - 직렬화된 페이로드 JSON 문자열 (선택)
 * @param metaJson - 직렬화된 메타데이터 JSON 문자열 (선택)
 * @param filePath - 원본 메시지 물리 파일 저장 경로 (선택)
 * @param fileSize - 저장 파일 크기 Bytes (기본값: 0)
 * @returns 삽입된 레코드의 ID
 */
export function insertPluginMessage(
  clientId: string,
  action: string,
  payloadType: string = "json",
  payloadJson: string | null = null,
  metaJson: string | null = null,
  filePath: string | null = null,
  fileSize: number = 0
): number {
  const info = serverLogsDb
    .prepare(
      `
      INSERT INTO plugin_messages (client_id, action, payload_type, payload_json, meta_json, file_path, file_size, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      clientId,
      action,
      payloadType,
      payloadJson,
      metaJson,
      filePath,
      fileSize,
      Date.now()
    );
  return Number(info.lastInsertRowid);
}

/**
 * plugin_messages 원장 레코드에 물리 파일 저장 경로 및 크기를 반영합니다.
 * 메시지 원본 파일을 먼저 저장한 뒤 해당 레코드의 file_path/file_size 컬럼을 갱신합니다.
 *
 * @param id - plugin_messages 레코드 PK ID
 * @param filePath - 저장된 원본 파일 절대 경로
 * @param fileSize - 저장 파일 크기 Bytes
 */
export function updatePluginMessageFile(
  id: number,
  filePath: string,
  fileSize: number
): void {
  serverLogsDb
    .prepare("UPDATE plugin_messages SET file_path = ?, file_size = ? WHERE id = ?")
    .run(filePath, fileSize, id);
}

/**
 * 플러그인 수신 메시지 원장(plugin_messages)을 필터 및 페이지네이션으로 조회합니다.
 *
 * @param query - 조회 필터 파라미터 객체
 * @returns 플러그인 메시지 레코드 배열
 */
export function getPluginMessages(
  query: PluginMessageQuery = {}
): PluginMessageRecord[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.clientId) {
    conditions.push("client_id = ?");
    params.push(query.clientId);
  }
  if (query.action) {
    conditions.push("action = ?");
    params.push(query.action);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;
  params.push(limit, offset);

  return serverLogsDb
    .prepare(
      `SELECT * FROM plugin_messages ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(...params) as PluginMessageRecord[];
}

/** 메인 DB 인스턴스 기본 내보내기 */
export default db;
