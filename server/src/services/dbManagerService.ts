// server/src/services/dbManagerService.ts

import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename, extname, join } from "node:path";
import {
  existsSync,
  readdirSync,
  statSync,
  copyFileSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
} from "node:fs";

/** DB 파일 정보 구조체 */
export interface DbFileInfo {
  /** 상대 경로 (예: "databases/data.db", "databases/workers/foo.db") */
  dbRel: string;
  /** 파일명 (예: "data.db") */
  fileName: string;
  /** 소속 서브 디렉터리 (databases 루트 또는 databases/workers) */
  subDir: string;
  /** 파일 크기 (Bytes) */
  sizeBytes: number;
  /** 최종 수정 시각 (ISO 문자열) */
  modifiedAt: string;
  /** 내부 테이블 수 */
  tableCount: number;
}

/** 테이블 정보 구조체 */
export interface DbTableInfo {
  /** 테이블 이름 */
  name: string;
  /** 레코드 행 수 */
  rowCount: number;
}

/** 컬럼 스키마 정보 구조체 */
export interface DbColumnInfo {
  /** 컬럼명 */
  name: string;
  /** SQLite 데이터 타입 */
  type: string;
  /** NOT NULL 제약 여부 */
  notNull: boolean;
  /** PK 순번 (0이면 PK 아님) */
  pk: number;
  /** 기본값 표현식 (없으면 null) */
  defaultValue: unknown;
}

/** 인덱스 정보 구조체 */
export interface DbIndexInfo {
  /** 인덱스 이름 */
  name: string;
  /** UNIQUE 인덱스 여부 */
  unique: boolean;
  /** 인덱스 대상 컬럼명 배열 */
  columns: string[];
}

/** 테이블 스키마 조회 결과 구조체 */
export interface TableSchemaResult {
  /** 컬럼 목록 */
  columns: DbColumnInfo[];
  /** 인덱스 목록 */
  indexes: DbIndexInfo[];
  /** 총 행 수 */
  rowCount: number;
}

/** SQL 실행 결과 구조체 */
export interface SqlQueryResult {
  /** 결과 컬럼명 배열 (SELECT 계열) */
  columns: string[];
  /** 결과 행 배열 (SELECT 계열) */
  rows: Record<string, unknown>[];
  /** 영향받은 행 수 (INSERT/UPDATE/DELETE 계열) */
  affected: number;
  /** 실행 소요 시간 (ms) */
  durationMs: number;
  /** SELECT 계열 쿼리 여부 */
  isSelect: boolean;
  /** 실행 메시지 */
  message: string;
}

/** 테이블 행 조회 결과 구조체 */
export interface TableRowsResult {
  /** 조회된 행 배열 */
  rows: Record<string, unknown>[];
  /** 전체 행 수 (검색 조건 미적용 시) */
  total: number;
  /** 현재 페이지 번호 (1부터 시작) */
  page: number;
  /** 페이지당 행 수 */
  size: number;
}

/** 컬럼 정의 입력 구조체 (테이블 생성/컬럼 추가용) */
export interface ColumnDefInput {
  /** 컬럼명 */
  name: string;
  /** SQLite 데이터 타입 */
  type: string;
  /** NOT NULL 여부 */
  notNull?: boolean;
  /** PK 여부 (테이블 생성 시에만 유효) */
  primaryKey?: boolean;
}

/** 스토리지 모니터링 정보 구조체 */
export interface StorageInfo {
  /** 물리 저장소 루트 절대 경로 */
  storageRootPath: string;
  /** 저장소 존재 여부 */
  exists: boolean;
  /** 총 파일 수 */
  fileCount: number;
  /** 총 사용 용량 (Bytes) */
  totalBytes: number;
  /** DB 파일별 크기 목록 */
  dbFiles: DbFileInfo[];
  /** 백업 디렉터리 크기 (Bytes) */
  backupsBytes: number;
}

/** 백업 파일 정보 구조체 */
export interface BackupInfo {
  /** 백업 파일명 */
  fileName: string;
  /** 크기 (Bytes) */
  sizeBytes: number;
  /** 백업 생성 시각 (ISO 문자열) */
  createdAt: string;
  /** 원본 DB 상대 경로 (파일명 매칭 기반) */
  sourceDbRel: string;
}

// ESM 환경에서 __dirname 대체 경로 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 프로젝트 루트의 databases 및 databases/workers 경로 계산
// 컴파일 결과가 dist/services/ 하위에 위치하므로 3단계 위로 이동하여 루트를 기준으로 해석합니다.
const databasesDir = resolve(__dirname, "..", "..", "..", "databases");
const workersDbDir = resolve(databasesDir, "workers");
const backupsDir = resolve(databasesDir, "backups");

// 물리 저장소 루트 (R-00208: STORAGE_ROOT_PATH 또는 기본 "./storage")
const storageRoot = process.env.STORAGE_ROOT_PATH || "./storage";

/**
 * SQLite 예약 시스템 테이블을 제외한 사용자 테이블 목록을 조회합니다.
 *
 * @param targetDb - 대상 DB 인스턴스
 * @returns 테이블명 배열
 */
function getNonSystemTables(targetDb: Database.Database): string[] {
  const rows = targetDb
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

/**
 * SQLite 식별자(테이블/컬럼명)를 큰따옴표 인용 구문으로 안전하게 감쌉니다.
 * SQL 인젝션 및 구문 오류를 차단합니다.
 *
 * @param identifier - 정화할 식별자
 * @returns 인용된 식별자
 */
function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * 클라이언트가 전달한 DB 상대 경로를 화이트리스트 검증 후 절대 경로로 변환합니다.
 * databases/ 및 databases/workers/ 내부의 .db 파일만 허용하며 경로 이탈(Path Traversal)을 차단합니다.
 *
 * @param dbRel - 클라이언트가 전달한 DB 상대 경로 (예: "databases/workers/foo.db")
 * @returns 검증된 절대 경로
 * @throws 허용 범위를 벗어난 경로 또는 잘못된 형식일 경우 오류 발생
 */
export function resolveDbRelPath(dbRel: string): string {
  // 1. 백슬래시를 슬래시로 정규화하고 접두사 정리
  const normalized = String(dbRel).replace(/\\/g, "/").replace(/^\/+/, "");

  // 2. 허용 경로 패턴 검증 (databases/ 또는 databases/workers/ 하위 .db 파일)
  const match = /^databases\/(?:workers\/)?([A-Za-z0-9_.-]+\.db)$/.exec(
    normalized
  );
  if (!match) {
    throw new Error(
      `허용되지 않는 DB 경로입니다: ${dbRel} (databases/ 또는 databases/workers/ 내부 .db 파일만 허용됩니다)`
    );
  }

  // 3. 대상 경로를 databases 루트 기준으로 해석
  const absolute = resolve(databasesDir, match[1]);

  // 4. 해석된 경로가 databases 루트 내부인지 이중 검증
  if (!absolute.startsWith(databasesDir)) {
    throw new Error(`DB 경로가 허용 범위를 벗어났습니다: ${dbRel}`);
  }

  // 5. 실제 파일 존재 여부 확인
  if (!existsSync(absolute)) {
    throw new Error(`존재하지 않는 DB 파일입니다: ${dbRel}`);
  }

  return absolute;
}

/**
 * DB 파일 목록을 조회합니다. databases/ 루트와 databases/workers/ 하위의
 * 모든 .db 파일을 수집하고 파일 크기, 수정 시각, 테이블 수를 함께 반환합니다.
 *
 * @returns DB 파일 정보 배열
 */
export function listDbFiles(): DbFileInfo[] {
  const results: DbFileInfo[] = [];

  const scanDir = (dir: string, subDir: string) => {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".db") {
        continue;
      }
      const absPath = join(dir, entry.name);
      const stat = statSync(absPath);
      const dbRel = `databases/${subDir ? `${subDir}/` : ""}${entry.name}`;
      const tableCount = (() => {
        try {
          const targetDb = new Database(absPath, { readonly: true });
          try {
            return getNonSystemTables(targetDb).length;
          } finally {
            targetDb.close();
          }
        } catch {
          return 0;
        }
      })();

      results.push({
        dbRel,
        fileName: entry.name,
        subDir: subDir || "databases",
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        tableCount,
      });
    }
  };

  scanDir(databasesDir, "");
  scanDir(workersDbDir, "workers");

  return results.sort((a, b) => a.dbRel.localeCompare(b.dbRel));
}

/**
 * 대상 DB의 사용자 테이블 목록과 행 수를 조회합니다.
 *
 * @param dbRel - DB 상대 경로
 * @returns 테이블 정보 배열
 */
export function listTables(dbRel: string): DbTableInfo[] {
  const targetDb = new Database(resolveDbRelPath(dbRel), { readonly: true });
  try {
    const tables = getNonSystemTables(targetDb);
    return tables.map((name) => {
      const row = targetDb
        .prepare(`SELECT COUNT(*) AS cnt FROM ${quoteIdentifier(name)}`)
        .get() as { cnt: number };
      return { name, rowCount: row.cnt };
    });
  } finally {
    targetDb.close();
  }
}

/**
 * 대상 DB의 특정 테이블 스키마(컬럼/인덱스/행 수)를 조회합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 테이블명
 * @returns 테이블 스키마 정보
 */
export function getTableSchema(dbRel: string, tableName: string): TableSchemaResult {
  const targetDb = new Database(resolveDbRelPath(dbRel), { readonly: true });
  try {
    // 1. 컬럼 정보 조회 (PRAGMA table_info)
    const columnRows = targetDb
      .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
      .all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }>;

    const columns: DbColumnInfo[] = columnRows.map((c) => ({
      name: c.name,
      type: c.type,
      notNull: c.notnull === 1,
      pk: c.pk,
      defaultValue: c.dflt_value,
    }));

    // 2. 인덱스 정보 조회 (index_list + index_info)
    const indexRows = targetDb
      .prepare(`PRAGMA index_list(${quoteIdentifier(tableName)})`)
      .all() as Array<{ name: string; unique: number }>;

    const indexes: DbIndexInfo[] = indexRows.map((idx) => {
      const infoRows = targetDb
        .prepare(`PRAGMA index_info(${quoteIdentifier(idx.name)})`)
        .all() as Array<{ name: string | null }>;
      return {
        name: idx.name,
        unique: idx.unique === 1,
        columns: infoRows
          .map((r) => r.name)
          .filter((n): n is string => typeof n === "string"),
      };
    });

    // 3. 총 행 수 조회
    const countRow = targetDb
      .prepare(`SELECT COUNT(*) AS cnt FROM ${quoteIdentifier(tableName)}`)
      .get() as { cnt: number };

    return { columns, indexes, rowCount: countRow.cnt };
  } finally {
    targetDb.close();
  }
}

/**
 * DB 내부 레코드 값을 JSON 직렬화 가능한 형태로 변환합니다.
 * Buffer(BLOB) 및 bigint 값이 JSON 직렬화 예외를 일으키지 않도록 정화합니다.
 *
 * @param value - 원본 값
 * @returns 직렬화 가능한 값
 */
function serializeValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return `[BLOB ${value.length} bytes]`;
  }
  if (value instanceof Uint8Array) {
    return `[BLOB ${value.length} bytes]`;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

/**
 * 임의 SQL 구문을 대상 DB에 대해 실행하고 결과를 반환합니다.
 * SELECT/PRAGMA/EXPLAIN/WITH 계열은 행 결과를, 그 외 쓰기 구문은 영향 행 수를 반환합니다.
 * 다중 문장은 순차 실행되며 실행 시간을 측정합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param sql - 실행할 SQL 구문
 * @returns SQL 실행 결과
 */
export function executeQuery(dbRel: string, sql: string): SqlQueryResult {
  const cleanSql = String(sql).trim();
  if (!cleanSql) {
    throw new Error("실행할 SQL 구문이 비어 있습니다.");
  }

  const targetDb = new Database(resolveDbRelPath(dbRel));
  try {
    const startedAt = Date.now();

    // 단일 SELECT 계열 쿼리 판별 (첫 키워드 기준)
    const isSelect = /^(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(cleanSql);

    if (isSelect) {
      // 결과 행을 안전하게 직렬화하여 반환
      const rawRows = targetDb.prepare(cleanSql).all() as Array<
        Record<string, unknown>
      >;
      const columns =
        rawRows.length > 0
          ? Object.keys(rawRows[0])
          : (() => {
              try {
                const info = targetDb.prepare(cleanSql).columns();
                return info.map((c) => c.name);
              } catch {
                return [];
              }
            })();

      const rows = rawRows.map((row) => {
        const serialized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          serialized[key] = serializeValue(value);
        }
        return serialized;
      });

      return {
        columns,
        rows,
        affected: rows.length,
        durationMs: Date.now() - startedAt,
        isSelect: true,
        message: `${rows.length}개 행이 반환되었습니다.`,
      };
    }

    // 쓰기/DDL 계열: 다중 문장까지 지원하는 exec 실행
    // better-sqlite3의 totalChanges(연결 수립 후 누적 변경 수) 차이로 영향 행 수를 산출합니다.
    const totalAware = targetDb as unknown as { totalChanges: number };
    const beforeChanges = totalAware.totalChanges;
    targetDb.exec(cleanSql);
    const affected = totalAware.totalChanges - beforeChanges;

    return {
      columns: [],
      rows: [],
      affected,
      durationMs: Date.now() - startedAt,
      isSelect: false,
      message: `영향받은 행 ${affected}건 처리되었습니다.`,
    };
  } finally {
    targetDb.close();
  }
}

/**
 * 데이터 그리드용 테이블 행을 페이지네이션 및 검색 조건으로 조회합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 테이블명
 * @param page - 페이지 번호 (1부터 시작)
 * @param size - 페이지당 행 수
 * @param search - 검색어 (TEXT 컬럼 LIKE 검색)
 * @returns 행 조회 결과
 */
export function fetchTableRows(
  dbRel: string,
  tableName: string,
  page: number = 1,
  size: number = 50,
  search: string = ""
): TableRowsResult {
  const targetDb = new Database(resolveDbRelPath(dbRel), { readonly: true });
  try {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(size) || 50));
    const offset = (pageNum - 1) * pageSize;

    // 컬럼 목록 조회 (검색 조건 생성 및 직렬화에 사용)
    const columnRows = targetDb
      .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
      .all() as Array<{ name: string }>;
    const columnNames = columnRows.map((c) => c.name);

    // 검색 조건 (LIKE) 구성
    const keyword = String(search || "").trim();
    let whereClause = "";
    const whereParams: unknown[] = [];
    if (keyword.length > 0) {
      const likeClauses = columnNames
        .map((col) => `${quoteIdentifier(col)} LIKE ?`)
        .join(" OR ");
      whereClause = ` WHERE (${likeClauses})`;
      whereParams.push(
        ...columnNames.map(() => `%${keyword.replace(/[%_]/g, "\\$&")}%`)
      );
    }

    // 전체 행 수 조회
    const countRow = targetDb
      .prepare(
        `SELECT COUNT(*) AS cnt FROM ${quoteIdentifier(tableName)}${whereClause}`
      )
      .get(...whereParams) as { cnt: number };

    // 페이지 단위 데이터 조회
    const rawRows = targetDb
      .prepare(
        `SELECT * FROM ${quoteIdentifier(tableName)}${whereClause} LIMIT ? OFFSET ?`
      )
      .all(...whereParams, pageSize, offset) as Array<Record<string, unknown>>;

    const rows = rawRows.map((row) => {
      const serialized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        serialized[key] = serializeValue(value);
      }
      return serialized;
    });

    return { rows, total: countRow.cnt, page: pageNum, size: pageSize };
  } finally {
    targetDb.close();
  }
}

/**
 * 테이블의 PK 컬럼명을 조회합니다.
 *
 * @param targetDb - 대상 DB 인스턴스
 * @param tableName - 테이블명
 * @returns PK 컬럼명 (없으면 null)
 */
function getPrimaryKeyColumn(
  targetDb: Database.Database,
  tableName: string
): string | null {
  const columnRows = targetDb
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all() as Array<{ name: string; pk: number }>;
  const pkColumn = columnRows.find((c) => c.pk > 0);
  return pkColumn ? pkColumn.name : null;
}

/**
 * 지정 테이블에 새 행을 삽입합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 테이블명
 * @param data - 삽입할 컬럼명/값 매핑 객체
 * @returns 삽입된 레코드의 PK 값
 */
export function insertTableRow(
  dbRel: string,
  tableName: string,
  data: Record<string, unknown>
): number {
  const targetDb = new Database(resolveDbRelPath(dbRel));
  try {
    const validColumns = new Set(
      (
        targetDb
          .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
          .all() as Array<{ name: string }>
      ).map((c) => c.name)
    );

    const entries = Object.entries(data).filter(
      ([key, value]) => validColumns.has(key) && value !== undefined
    );
    if (entries.length === 0) {
      throw new Error("삽입할 컬럼 값이 없습니다.");
    }

    const cols = entries.map(([key]) => quoteIdentifier(key)).join(", ");
    const placeholders = entries.map(() => "?").join(", ");
    const values = entries.map(([, value]) => value);

    const info = targetDb
      .prepare(
        `INSERT INTO ${quoteIdentifier(tableName)} (${cols}) VALUES (${placeholders})`
      )
      .run(...values);

    return Number(info.lastInsertRowid);
  } finally {
    targetDb.close();
  }
}

/**
 * 지정 테이블의 PK에 해당하는 행을 수정합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 테이블명
 * @param pkValue - PK 컬럼 값
 * @param data - 수정할 컬럼명/값 매핑 객체
 */
export function updateTableRow(
  dbRel: string,
  tableName: string,
  pkValue: string | number,
  data: Record<string, unknown>
): void {
  const targetDb = new Database(resolveDbRelPath(dbRel));
  try {
    const pkColumn = getPrimaryKeyColumn(targetDb, tableName);
    if (!pkColumn) {
      throw new Error(
        `테이블 ${tableName}에 PK 컬럼이 존재하지 않아 행 수정을 지원하지 않습니다.`
      );
    }

    const validColumns = new Set(
      (
        targetDb
          .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
          .all() as Array<{ name: string }>
      ).map((c) => c.name)
    );

    const entries = Object.entries(data).filter(
      ([key, value]) =>
        validColumns.has(key) && key !== pkColumn && value !== undefined
    );
    if (entries.length === 0) {
      throw new Error("수정할 컬럼 값이 없습니다.");
    }

    const setClause = entries
      .map(([key]) => `${quoteIdentifier(key)} = ?`)
      .join(", ");
    const values = entries.map(([, value]) => value);

    targetDb
      .prepare(
        `UPDATE ${quoteIdentifier(tableName)} SET ${setClause} WHERE ${quoteIdentifier(pkColumn)} = ?`
      )
      .run(...values, pkValue);
  } finally {
    targetDb.close();
  }
}

/**
 * 지정 테이블의 PK에 해당하는 행을 삭제합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 테이블명
 * @param pkValue - PK 컬럼 값
 */
export function deleteTableRow(
  dbRel: string,
  tableName: string,
  pkValue: string | number
): void {
  const targetDb = new Database(resolveDbRelPath(dbRel));
  try {
    const pkColumn = getPrimaryKeyColumn(targetDb, tableName);
    if (!pkColumn) {
      throw new Error(
        `테이블 ${tableName}에 PK 컬럼이 존재하지 않아 행 삭제를 지원하지 않습니다.`
      );
    }

    targetDb
      .prepare(
        `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(pkColumn)} = ?`
      )
      .run(pkValue);
  } finally {
    targetDb.close();
  }
}

/**
 * SQLite 타입 및 식별자 정화 검증을 수행합니다.
 *
 * @param type - 검증할 데이터 타입
 * @returns 정화된 타입
 */
function validateSqliteType(type: string): string {
  const upper = String(type || "TEXT").toUpperCase();
  if (/^(TEXT|INTEGER|REAL|BLOB|NUMERIC)$/.test(upper)) {
    return upper;
  }
  throw new Error(`허용되지 않는 SQLite 타입입니다: ${type}`);
}

/**
 * 테이블명/컬럼명 식별자를 검증합니다. 예약 문자 및 SQL 인젝션을 차단합니다.
 *
 * @param identifier - 검증할 식별자
 * @returns 검증 통과 시 동일 문자열
 */
function validateIdentifier(identifier: string): string {
  const value = String(identifier).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`허용되지 않는 식별자입니다: ${identifier}`);
  }
  return value;
}

/**
 * 신규 테이블을 동적 생성합니다. 기본 상속 컬럼과의 중복은 자동 필터링합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 신규 테이블명
 * @param columns - 컬럼 정의 배열
 */
export function createTable(
  dbRel: string,
  tableName: string,
  columns: ColumnDefInput[]
): void {
  const safeTable = validateIdentifier(tableName);
  const targetDb = new Database(resolveDbRelPath(dbRel));
  try {
    const ddlParts: string[] = [];
    for (const col of columns) {
      const colName = validateIdentifier(col.name);
      const type = validateSqliteType(col.type);
      let part = `${quoteIdentifier(colName)} ${type}`;
      if (col.notNull) part += " NOT NULL";
      if (col.primaryKey) part += " PRIMARY KEY AUTOINCREMENT";
      ddlParts.push(part);
    }

    const ddl = `CREATE TABLE ${quoteIdentifier(safeTable)} (${ddlParts.join(", ")})`;
    targetDb.exec(ddl);
  } finally {
    targetDb.close();
  }
}

/**
 * 지정 테이블을 삭제합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 삭제할 테이블명
 */
export function dropTable(dbRel: string, tableName: string): void {
  const safeTable = validateIdentifier(tableName);
  const targetDb = new Database(resolveDbRelPath(dbRel));
  try {
    targetDb.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(safeTable)}`);
  } finally {
    targetDb.close();
  }
}

/**
 * 지정 테이블에 새 컬럼을 추가합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 대상 테이블명
 * @param column - 추가할 컬럼 정의
 */
export function addColumn(
  dbRel: string,
  tableName: string,
  column: ColumnDefInput
): void {
  const safeTable = validateIdentifier(tableName);
  const colName = validateIdentifier(column.name);
  const type = validateSqliteType(column.type);
  const targetDb = new Database(resolveDbRelPath(dbRel));
  try {
    let ddl = `ALTER TABLE ${quoteIdentifier(safeTable)} ADD COLUMN ${quoteIdentifier(colName)} ${type}`;
    if (column.notNull) ddl += " NOT NULL";
    targetDb.exec(ddl);
  } finally {
    targetDb.close();
  }
}

/**
 * 대상 DB의 백업 파일을 backups/ 디렉터리에 타임스탬프 이름으로 생성합니다.
 *
 * @param dbRel - DB 상대 경로
 * @returns 생성된 백업 파일명
 */
export function createBackup(dbRel: string): string {
  const sourcePath = resolveDbRelPath(dbRel);
  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }

  const baseName = basename(sourcePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `${baseName.replace(/\.db$/, "")}_${stamp}.db`;
  const backupPath = join(backupsDir, backupFileName);

  copyFileSync(sourcePath, backupPath);
  return backupFileName;
}

/**
 * backups/ 디렉터리의 백업 파일 목록을 조회합니다.
 *
 * @returns 백업 파일 정보 배열
 */
export function listBackups(): BackupInfo[] {
  if (!existsSync(backupsDir)) return [];
  const entries = readdirSync(backupsDir, { withFileTypes: true });
  const backups: BackupInfo[] = [];

  // 실제 DB 파일명 → dbRel 매핑 (백업 원본 식별에 사용)
  const dbFilesByName = new Map<string, string>(
    listDbFiles().map((file) => [file.fileName, file.dbRel])
  );

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".db") {
      continue;
    }
    const absPath = join(backupsDir, entry.name);
    const stat = statSync(absPath);
    // 백업 파일명 규격: "<원본명>_<타임스탬프>.db" → 원본 DB 상대 경로 역산
    // 실제 databases/ 및 databases/workers/ 내 파일명과 매칭하여 정확한 원본을 식별합니다.
    const stampMatch = /^(.*)_\d{4}-\d{2}-\d{2}T[\d-]+Z\.db$/.exec(entry.name);
    let sourceDbRel = "databases/알수없음";
    if (stampMatch) {
      const matched = dbFilesByName.get(`${stampMatch[1]}.db`);
      if (matched) {
        sourceDbRel = matched;
      }
    }

    backups.push({
      fileName: entry.name,
      sizeBytes: stat.size,
      createdAt: stat.mtime.toISOString(),
      sourceDbRel,
    });
  }

  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * 업로드된 base64 바이트를 대상 DB 파일로 복원합니다.
 * 복원 전 현재 파일을 backups/에 자동 보존 백업한 뒤 덮어씁니다.
 *
 * @param dbRel - 복원 대상 DB 상대 경로
 * @param contentBase64 - 업로드된 DB 파일 base64 문자열
 * @returns 복원 완료 메시지
 */
export function restoreBackup(
  dbRel: string,
  contentBase64: string
): string {
  if (!contentBase64 || typeof contentBase64 !== "string") {
    throw new Error("복원할 DB 파일 데이터가 없습니다.");
  }

  const targetPath = resolveDbRelPath(dbRel);
  const buffer = Buffer.from(contentBase64, "base64");
  if (buffer.length === 0) {
    throw new Error("복원 파일 데이터가 비어 있습니다.");
  }

  // 복원 대상 파일을 버퍼로 직접 교체 (공통 내부 헬퍼)
  return overwriteDbFile(targetPath, buffer);
}

/**
 * 이미 생성된 백업 파일을 대상 DB에 복원합니다.
 * 복원 전 현재 파일을 backups/에 자동 보존 백업한 뒤 덮어씁니다.
 *
 * @param dbRel - 복원 대상 DB 상대 경로
 * @param fileName - backups/ 내부의 백업 파일명
 * @returns 복원 완료 메시지
 */
export function restoreBackupFromFile(
  dbRel: string,
  fileName: string
): string {
  const safeName = basename(String(fileName));
  const backupPath = join(backupsDir, safeName);
  if (!existsSync(backupPath)) {
    throw new Error(`존재하지 않는 백업 파일입니다: ${safeName}`);
  }

  const targetPath = resolveDbRelPath(dbRel);
  const buffer = readFileSync(backupPath);
  return overwriteDbFile(targetPath, buffer);
}

/**
 * 대상 DB 파일을 버퍼로 안전하게 교체하는 공통 헬퍼입니다.
 * 교체 전 현재 파일을 backups/에 자동 보존 백업합니다.
 *
 * @param targetPath - 교체 대상 DB 절대 경로
 * @param buffer - 새 DB 파일 바이트
 * @returns 복원 완료 메시지
 */
function overwriteDbFile(targetPath: string, buffer: Buffer): string {
  if (buffer.length === 0) {
    throw new Error("복원 파일 데이터가 비어 있습니다.");
  }

  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }

  // 복원 전 자동 보존 백업 (오류 시 원본 보호)
  const baseName = basename(targetPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const preRestorePath = join(
    backupsDir,
    `${baseName.replace(/\.db$/, "")}_pre-restore_${stamp}.db`
  );
  copyFileSync(targetPath, preRestorePath);

  // 대상 DB 파일 덮어쓰기
  writeFileSync(targetPath, buffer);
  return `${buffer.length} bytes가 복원되었습니다. (자동 보존 백업: ${basename(preRestorePath)})`;
}

/**
 * 백업 파일을 다운로드 가능한 바이트 버퍼로 반환합니다.
 *
 * @param fileName - 백업 파일명
 * @returns 파일명과 버퍼
 */
export function getBackupBuffer(fileName: string): {
  fileName: string;
  buffer: Buffer;
} {
  const safeName = basename(String(fileName));
  const absPath = join(backupsDir, safeName);
  if (!existsSync(absPath)) {
    throw new Error(`존재하지 않는 백업 파일입니다: ${safeName}`);
  }
  return { fileName: safeName, buffer: readFileSyncAsBuffer(absPath) };
}

/** 파일 전체를 Buffer로 읽는 내부 헬퍼 */
function readFileSyncAsBuffer(absPath: string): Buffer {
  return readFileSync(absPath);
}

/**
 * 물리 저장소 및 DB 파일/백업 디스크 사용량 모니터링 정보를 산출합니다.
 * R-00208 디스크 용량 모니터링 규격과 연계됩니다.
 *
 * @returns 스토리지 모니터링 정보
 */
export function getStorageInfo(): StorageInfo {
  // 1. 물리 저장소 루트 스캔 (파일 수 및 총 용량)
  let fileCount = 0;
  let totalBytes = 0;
  const rootPath = resolve(storageRoot);
  const exists = existsSync(rootPath);

  if (exists) {
    const walk = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walk(join(dir, entry.name));
        } else if (entry.isFile()) {
          const stat = statSync(join(dir, entry.name));
          fileCount += 1;
          totalBytes += stat.size;
        }
      }
    };
    try {
      walk(rootPath);
    } catch {
      // 순회 중 접근 불가 디렉터리 등은 무시
    }
  }

  // 2. DB 파일 목록 (dbFiles 크기 정보 재사용)
  const dbFiles = listDbFiles();

  // 3. 백업 디렉터리 용량
  let backupsBytes = 0;
  if (existsSync(backupsDir)) {
    for (const entry of readdirSync(backupsDir, { withFileTypes: true })) {
      if (entry.isFile()) {
        backupsBytes += statSync(join(backupsDir, entry.name)).size;
      }
    }
  }

  return {
    storageRootPath: rootPath,
    exists,
    fileCount,
    totalBytes,
    dbFiles,
    backupsBytes,
  };
}

/** 백업 디렉터리 절대 경로 내보내기 (다운로드 라우트용) */
export function getBackupsDir(): string {
  return backupsDir;
}
