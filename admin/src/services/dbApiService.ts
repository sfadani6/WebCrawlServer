// admin/src/services/dbApiService.ts

import {
  BackupInfo,
  ColumnDefInput,
  DbFileInfo,
  DbTableInfo,
  SqlQueryResult,
  StorageInfo,
  TableRowsResult,
  TableSchemaResult,
} from "../types/index.js";

/**
 * DB 관리 REST API 응답 구조체
 * 서버의 통일 응답 규격 { success, data, message } 을 기준으로 타입을 명시합니다.
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * DB 관리 REST API 요청 공통 헬퍼입니다.
 * 서버 응답 규격을 해석하고 실패 시 예외를 던집니다.
 *
 * @param url - 요청 URL
 * @param options - fetch 옵션
 * @returns 성공 응답의 data 필드
 * @throws 서버가 오류 메시지를 반환한 경우 예외 발생
 */
async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new Error(`서버 응답을 해석할 수 없습니다. (HTTP ${res.status})`);
  }
  if (!json.success) {
    throw new Error(json.message || "요청에 실패했습니다.");
  }
  return json.data as T;
}

/**
 * 대상 DB 파일의 목록을 조회합니다.
 *
 * @returns DB 파일 정보 배열
 */
export async function fetchDbFilesApi(): Promise<DbFileInfo[]> {
  return requestJson<DbFileInfo[]>("/api/admin/db/files");
}

/**
 * 대상 DB의 테이블 목록을 조회합니다.
 *
 * @param dbRel - DB 상대 경로
 * @returns 테이블 정보 배열
 */
export async function fetchDbTablesApi(dbRel: string): Promise<DbTableInfo[]> {
  const url = `/api/admin/db/tables?dbRel=${encodeURIComponent(dbRel)}`;
  return requestJson<DbTableInfo[]>(url);
}

/**
 * 대상 DB 특정 테이블의 스키마를 조회합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param table - 테이블명
 * @returns 테이블 스키마 정보
 */
export async function fetchTableSchemaApi(
  dbRel: string,
  table: string
): Promise<TableSchemaResult> {
  const url = `/api/admin/db/schema?dbRel=${encodeURIComponent(dbRel)}&table=${encodeURIComponent(table)}`;
  return requestJson<TableSchemaResult>(url);
}

/**
 * 대상 DB에 대해 임의 SQL 구문을 실행합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param sql - 실행할 SQL 구문
 * @returns SQL 실행 결과
 */
export async function executeSqlApi(
  dbRel: string,
  sql: string
): Promise<SqlQueryResult> {
  return requestJson<SqlQueryResult>("/api/admin/db/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dbRel, sql }),
  });
}

/**
 * 데이터 그리드용 테이블 행 목록을 페이지네이션/검색 조건으로 조회합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param table - 테이블명
 * @param page - 페이지 번호 (1부터 시작)
 * @param size - 페이지당 행 수
 * @param search - 검색어
 * @returns 행 조회 결과
 */
export async function fetchTableRowsApi(
  dbRel: string,
  table: string,
  page: number = 1,
  size: number = 50,
  search: string = ""
): Promise<TableRowsResult> {
  const params = new URLSearchParams({
    dbRel,
    table,
    page: String(page),
    size: String(size),
    search,
  });
  return requestJson<TableRowsResult>(`/api/admin/db/rows?${params.toString()}`);
}

/**
 * 테이블에 새 행을 추가합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param table - 테이블명
 * @param data - 삽입할 컬럼명/값 매핑 객체
 * @returns 삽입된 레코드의 PK 값
 */
export async function insertRowApi(
  dbRel: string,
  table: string,
  data: Record<string, unknown>
): Promise<number> {
  const result = await requestJson<{ pk: number }>("/api/admin/db/rows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dbRel, table, data }),
  });
  return result.pk;
}

/**
 * 테이블의 PK에 해당하는 행을 수정합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param table - 테이블명
 * @param pkValue - PK 컬럼 값
 * @param data - 수정할 컬럼명/값 매핑 객체
 */
export async function updateRowApi(
  dbRel: string,
  table: string,
  pkValue: string | number,
  data: Record<string, unknown>
): Promise<void> {
  await requestJson(`/api/admin/db/rows/${encodeURIComponent(String(pkValue))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dbRel, table, data }),
  });
}

/**
 * 테이블의 PK에 해당하는 행을 삭제합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param table - 테이블명
 * @param pkValue - PK 컬럼 값
 */
export async function deleteRowApi(
  dbRel: string,
  table: string,
  pkValue: string | number
): Promise<void> {
  const url = `/api/admin/db/rows/${encodeURIComponent(String(pkValue))}?dbRel=${encodeURIComponent(dbRel)}&table=${encodeURIComponent(table)}`;
  await requestJson(url, { method: "DELETE" });
}

/**
 * 신규 테이블을 동적 생성합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 신규 테이블명
 * @param columns - 컬럼 정의 배열
 */
export async function createTableApi(
  dbRel: string,
  tableName: string,
  columns: ColumnDefInput[]
): Promise<void> {
  await requestJson("/api/admin/db/tables", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dbRel, tableName, columns }),
  });
}

/**
 * 지정 테이블을 삭제합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 삭제할 테이블명
 */
export async function dropTableApi(
  dbRel: string,
  tableName: string
): Promise<void> {
  const url = `/api/admin/db/tables/${encodeURIComponent(tableName)}?dbRel=${encodeURIComponent(dbRel)}`;
  await requestJson(url, { method: "DELETE" });
}

/**
 * 지정 테이블에 새 컬럼을 추가합니다.
 *
 * @param dbRel - DB 상대 경로
 * @param tableName - 대상 테이블명
 * @param column - 추가할 컬럼 정의
 */
export async function addColumnApi(
  dbRel: string,
  tableName: string,
  column: ColumnDefInput
): Promise<void> {
  await requestJson(
    `/api/admin/db/tables/${encodeURIComponent(tableName)}/columns`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dbRel, column }),
    }
  );
}

/**
 * 대상 DB의 백업 파일을 생성합니다.
 *
 * @param dbRel - DB 상대 경로
 * @returns 생성된 백업 파일명
 */
export async function createBackupApi(dbRel: string): Promise<string> {
  const result = await requestJson<{ fileName: string }>("/api/admin/db/backups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dbRel }),
  });
  return result.fileName;
}

/**
 * 백업 파일 목록을 조회합니다.
 *
 * @returns 백업 파일 정보 배열
 */
export async function fetchBackupsApi(): Promise<BackupInfo[]> {
  return requestJson<BackupInfo[]>("/api/admin/db/backups");
}

/**
 * 백업 파일 다운로드 URL을 생성합니다. (브라우저 다운로드 링크용)
 *
 * @param fileName - 백업 파일명
 * @returns 다운로드 URL
 */
export function getBackupDownloadUrl(fileName: string): string {
  return `/api/admin/db/backups/download?fileName=${encodeURIComponent(fileName)}`;
}

/**
 * 업로드된 DB 파일(base64)을 대상 DB에 복원합니다.
 *
 * @param dbRel - 복원 대상 DB 상대 경로
 * @param contentBase64 - DB 파일 base64 문자열
 * @returns 복원 완료 메시지
 */
export async function restoreBackupApi(
  dbRel: string,
  contentBase64: string
): Promise<string> {
  return requestJson<string>("/api/admin/db/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dbRel, contentBase64 }),
  });
}

/**
 * 이미 생성된 백업 파일을 대상 DB에 복원합니다.
 *
 * @param dbRel - 복원 대상 DB 상대 경로
 * @param fileName - backups/ 내부의 백업 파일명
 * @returns 복원 완료 메시지
 */
export async function restoreBackupFileApi(
  dbRel: string,
  fileName: string
): Promise<string> {
  return requestJson<string>("/api/admin/db/backups/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dbRel, fileName }),
  });
}

/**
 * 스토리지 모니터링 정보를 조회합니다.
 *
 * @returns 스토리지 정보
 */
export async function fetchStorageInfoApi(): Promise<StorageInfo> {
  return requestJson<StorageInfo>("/api/admin/db/storage-info");
}
