// admin/src/hooks/useDbManager.ts

import { useCallback, useState } from "react";
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
import {
  addColumnApi,
  createBackupApi,
  createTableApi,
  deleteRowApi,
  dropTableApi,
  executeSqlApi,
  fetchBackupsApi,
  fetchDbFilesApi,
  fetchDbTablesApi,
  fetchStorageInfoApi,
  fetchTableRowsApi,
  fetchTableSchemaApi,
  insertRowApi,
  restoreBackupApi,
  restoreBackupFileApi,
  updateRowApi,
} from "../services/dbApiService.js";

/**
 * 관리자 대시보드 DB 관리 매니저의 상태 및 비즈니스 로직 훅입니다.
 * DB 파일 목록, 테이블/스키마 조회, SQL 실행, 행 CRUD, 백업/복원,
 * 스토리지 모니터링 전반의 상태를 통합 관리합니다.
 */
export function useDbManager() {
  /** 데이터베이스 파일 목록 상태 */
  const [dbFiles, setDbFiles] = useState<DbFileInfo[]>([]);
  /** 현재 선택된 DB 상대 경로 상태 */
  const [selectedDbRel, setSelectedDbRel] = useState<string>("");
  /** 선택된 DB의 테이블 목록 상태 */
  const [tables, setTables] = useState<DbTableInfo[]>([]);
  /** 선택된 테이블의 스키마 상태 */
  const [schema, setSchema] = useState<TableSchemaResult | null>(null);
  /** SQL 실행 결과 상태 */
  const [lastQueryResult, setLastQueryResult] = useState<SqlQueryResult | null>(
    null
  );
  /** 데이터 그리드 행 조회 결과 상태 */
  const [rowsResult, setRowsResult] = useState<TableRowsResult | null>(null);
  /** 스토리지 모니터링 정보 상태 */
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  /** 백업 파일 목록 상태 */
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  /** 공통 로딩 플래그 상태 */
  const [loading, setLoading] = useState(false);
  /** 공통 오류 메시지 상태 */
  const [error, setError] = useState("");

  /** DB 파일 목록을 조회합니다. */
  const loadDbFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchDbFilesApi();
      setDbFiles(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "DB 파일 목록 조회에 실패했습니다.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * DB를 선택하고 해당 DB의 테이블 목록을 로드합니다.
   *
   * @param dbRel - 선택할 DB 상대 경로
   */
  const selectDb = useCallback(async (dbRel: string) => {
    setSelectedDbRel(dbRel);
    setSchema(null);
    setRowsResult(null);
    setError("");
    if (!dbRel) {
      setTables([]);
      return;
    }
    try {
      const data = await fetchDbTablesApi(dbRel);
      setTables(data);
    } catch (err) {
      setTables([]);
      setError(err instanceof Error ? err.message : "테이블 목록 조회에 실패했습니다.");
    }
  }, []);

  /**
   * 테이블을 선택하고 스키마와 첫 페이지 데이터를 로드합니다.
   *
   * @param table - 선택할 테이블명
   */
  const selectTable = useCallback(
    async (table: string) => {
      if (!selectedDbRel || !table) return;
      setError("");
      try {
        const schemaData = await fetchTableSchemaApi(selectedDbRel, table);
        setSchema(schemaData);
        await loadRows(table, 1, 50, "");
      } catch (err) {
        setSchema(null);
        setError(err instanceof Error ? err.message : "스키마 조회에 실패했습니다.");
      }
    },
    [selectedDbRel]
  );

  /**
   * 테이블 행 목록을 페이지/검색 조건으로 로드합니다.
   *
   * @param table - 테이블명
   * @param page - 페이지 번호
   * @param size - 페이지당 행 수
   * @param search - 검색어
   */
  const loadRows = useCallback(
    async (table: string, page: number, size: number, search: string) => {
      if (!selectedDbRel) return;
      try {
        const data = await fetchTableRowsApi(selectedDbRel, table, page, size, search);
        setRowsResult(data);
      } catch (err) {
        setRowsResult(null);
        setError(err instanceof Error ? err.message : "행 조회에 실패했습니다.");
      }
    },
    [selectedDbRel]
  );

  /**
   * 임의 SQL 구문을 실행하고 결과를 상태에 반영합니다.
   *
   * @param sql - 실행할 SQL 구문
   */
  const runQuery = useCallback(
    async (sql: string): Promise<SqlQueryResult | null> => {
      if (!selectedDbRel) {
        setError("DB를 먼저 선택해주세요.");
        return null;
      }
      setError("");
      try {
        const result = await executeSqlApi(selectedDbRel, sql);
        setLastQueryResult(result);
        return result;
      } catch (err) {
        setLastQueryResult(null);
        setError(err instanceof Error ? err.message : "SQL 실행에 실패했습니다.");
        return null;
      }
    },
    [selectedDbRel]
  );

  /**
   * 테이블에 새 행을 추가하고 데이터 그리드를 갱신합니다.
   *
   * @param table - 테이블명
   * @param data - 삽입할 컬럼명/값 매핑 객체
   * @returns 성공 여부
   */
  const addRow = useCallback(
    async (table: string, data: Record<string, unknown>): Promise<boolean> => {
      if (!selectedDbRel) return false;
      try {
        await insertRowApi(selectedDbRel, table, data);
        await selectTable(table);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "행 추가에 실패했습니다.");
        return false;
      }
    },
    [selectedDbRel, selectTable]
  );

  /**
   * 테이블 행을 수정하고 데이터 그리드를 갱신합니다.
   *
   * @param table - 테이블명
   * @param pkValue - PK 컬럼 값
   * @param data - 수정할 컬럼명/값 매핑 객체
   * @returns 성공 여부
   */
  const updateRow = useCallback(
    async (
      table: string,
      pkValue: string | number,
      data: Record<string, unknown>
    ): Promise<boolean> => {
      if (!selectedDbRel) return false;
      try {
        await updateRowApi(selectedDbRel, table, pkValue, data);
        await selectTable(table);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "행 수정에 실패했습니다.");
        return false;
      }
    },
    [selectedDbRel, selectTable]
  );

  /**
   * 테이블 행을 삭제하고 데이터 그리드를 갱신합니다.
   *
   * @param table - 테이블명
   * @param pkValue - PK 컬럼 값
   * @returns 성공 여부
   */
  const deleteRow = useCallback(
    async (table: string, pkValue: string | number): Promise<boolean> => {
      if (!selectedDbRel) return false;
      if (!window.confirm(`행 [${pkValue}] 을(를) 삭제하시겠습니까?`)) return false;
      try {
        await deleteRowApi(selectedDbRel, table, pkValue);
        await selectTable(table);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "행 삭제에 실패했습니다.");
        return false;
      }
    },
    [selectedDbRel, selectTable]
  );

  /**
   * 신규 테이블을 생성하고 테이블 목록을 갱신합니다.
   *
   * @param tableName - 신규 테이블명
   * @param columns - 컬럼 정의 배열
   * @returns 성공 여부
   */
  const createTable = useCallback(
    async (tableName: string, columns: ColumnDefInput[]): Promise<boolean> => {
      if (!selectedDbRel) return false;
      if (!window.confirm(`테이블 [${tableName}] 을(를) 생성하시겠습니까?`)) return false;
      try {
        await createTableApi(selectedDbRel, tableName, columns);
        await selectDb(selectedDbRel);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "테이블 생성에 실패했습니다.");
        return false;
      }
    },
    [selectedDbRel, selectDb]
  );

  /**
   * 테이블을 삭제하고 테이블 목록을 갱신합니다.
   *
   * @param table - 삭제할 테이블명
   * @returns 성공 여부
   */
  const dropTable = useCallback(
    async (table: string): Promise<boolean> => {
      if (!selectedDbRel) return false;
      if (!window.confirm(`테이블 [${table}] 을(를) 영구 삭제하시겠습니까?`)) return false;
      try {
        await dropTableApi(selectedDbRel, table);
        setSchema(null);
        setRowsResult(null);
        await selectDb(selectedDbRel);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "테이블 삭제에 실패했습니다.");
        return false;
      }
    },
    [selectedDbRel, selectDb]
  );

  /**
   * 테이블에 새 컬럼을 추가하고 스키마를 갱신합니다.
   *
   * @param table - 대상 테이블명
   * @param column - 추가할 컬럼 정의
   * @returns 성공 여부
   */
  const addColumn = useCallback(
    async (table: string, column: ColumnDefInput): Promise<boolean> => {
      if (!selectedDbRel) return false;
      if (!window.confirm(`컬럼 [${column.name}] 을(를) 추가하시겠습니까?`)) return false;
      try {
        await addColumnApi(selectedDbRel, table, column);
        await selectTable(table);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "컬럼 추가에 실패했습니다.");
        return false;
      }
    },
    [selectedDbRel, selectTable]
  );

  /** 백업 파일 목록을 조회합니다. */
  const loadBackups = useCallback(async () => {
    try {
      const data = await fetchBackupsApi();
      setBackups(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "백업 목록 조회에 실패했습니다.");
      return [];
    }
  }, []);

  /**
   * 대상 DB의 백업을 생성하고 백업 목록을 갱신합니다.
   *
   * @param dbRel - 백업할 DB 상대 경로
   * @returns 성공 여부
   */
  const createBackup = useCallback(
    async (dbRel: string): Promise<boolean> => {
      if (!window.confirm(`DB [${dbRel}] 의 백업을 생성하시겠습니까?`)) return false;
      try {
        await createBackupApi(dbRel);
        await loadBackups();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "백업 생성에 실패했습니다.");
        return false;
      }
    },
    [loadBackups]
  );

  /**
   * 업로드된 base64 데이터를 대상 DB에 복원합니다.
   *
   * @param dbRel - 복원 대상 DB 상대 경로
   * @param contentBase64 - DB 파일 base64 문자열
   * @returns 성공 여부
   */
  const restoreBackup = useCallback(
    async (dbRel: string, contentBase64: string): Promise<boolean> => {
      if (!window.confirm(`DB [${dbRel}] 을(를) 복원하시겠습니까? (원본은 자동 보존 백업됩니다)`)) {
        return false;
      }
      try {
        await restoreBackupApi(dbRel, contentBase64);
        await loadDbFiles();
        await loadBackups();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "DB 복원에 실패했습니다.");
        return false;
      }
    },
    [loadDbFiles, loadBackups]
  );

  /**
   * 기존 백업 파일을 대상 DB에 직접 복원합니다.
   *
   * @param dbRel - 복원 대상 DB 상대 경로
   * @param fileName - 백업 파일명
   * @returns 성공 여부
   */
  const restoreBackupFromFile = useCallback(
    async (dbRel: string, fileName: string): Promise<boolean> => {
      if (!window.confirm(`백업 [${fileName}] 을(를) DB [${dbRel}] 에 복원하시겠습니까? (원본은 자동 보존 백업됩니다)`)) {
        return false;
      }
      try {
        await restoreBackupFileApi(dbRel, fileName);
        await loadDbFiles();
        await loadBackups();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "백업 복원에 실패했습니다.");
        return false;
      }
    },
    [loadDbFiles, loadBackups]
  );

  /** 스토리지 모니터링 정보를 조회합니다. */
  const loadStorageInfo = useCallback(async () => {
    try {
      const data = await fetchStorageInfoApi();
      setStorageInfo(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "스토리지 정보 조회에 실패했습니다.");
      return null;
    }
  }, []);

  return {
    dbFiles,
    selectedDbRel,
    tables,
    schema,
    lastQueryResult,
    rowsResult,
    storageInfo,
    backups,
    loading,
    error,
    setError,
    setSelectedDbRel,
    loadDbFiles,
    selectDb,
    selectTable,
    loadRows,
    runQuery,
    addRow,
    updateRow,
    deleteRow,
    createTable,
    dropTable,
    addColumn,
    loadBackups,
    createBackup,
    restoreBackup,
    restoreBackupFromFile,
    loadStorageInfo,
  };
}
