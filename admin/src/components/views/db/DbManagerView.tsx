// admin/src/components/views/db/DbManagerView.tsx

import { useEffect, useState } from "react";
import { useDbManager } from "../../../hooks/useDbManager.js";
import { formatBytes, formatDateTime } from "../../../utils/format.js";
import { Client } from "../../../types/index.js";
import { DbBrowserPanel } from "./DbBrowserPanel.js";
import { SqlQueryPanel } from "./SqlQueryPanel.js";
import { SchemaEditorPanel } from "./SchemaEditorPanel.js";
import { BackupRestorePanel } from "./BackupRestorePanel.js";
import { StorageMonitorPanel } from "./StorageMonitorPanel.js";
import { PluginMessagesPanel } from "./PluginMessagesPanel.js";

/** DB 관리 매니저 기능 탭 타입 */
type DbManagerTab = "browser" | "sql" | "schema" | "backup" | "storage" | "pluginMessages";

/** DB 관리 매니저 뷰 props 구조체 */
interface DbManagerViewProps {
  /** 등록된 클라이언트 목록 (메시지 원장 필터 드롭다운용) */
  clients: Client[];
}

/** 탭 정의 배열 (라벨/타입 쌍) */
const TABS: Array<{ key: DbManagerTab; label: string }> = [
  { key: "browser", label: "데이터 브라우저" },
  { key: "sql", label: "SQL 실행" },
  { key: "schema", label: "스키마 편집" },
  { key: "backup", label: "백업 / 복원" },
  { key: "storage", label: "스토리지 모니터링" },
  { key: "pluginMessages", label: "메시지 원장" },
];

/**
 * DB 관리 매니저 메인 뷰 컴포넌트입니다.
 * DB 파일 선택과 기능 탭(데이터 브라우저/SQL/스키마/백업/스토리지/메시지 원장)을 조율합니다.
 * 데이터 및 비즈니스 로직은 useDbManager 훅에 위임합니다.
 */
export function DbManagerView({ clients }: DbManagerViewProps) {
  const {
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
  } = useDbManager();

  /** 현재 활성화된 기능 탭 상태 */
  const [activeTab, setActiveTab] = useState<DbManagerTab>("browser");
  /** 현재 선택된 테이블명 상태 (브라우저/스키마 공유) */
  const [selectedTable, setSelectedTable] = useState("");

  // 최초 진입 시 DB 파일/백업/스토리지 정보를 로드하고 첫 DB를 선택합니다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const files = await loadDbFiles();
      if (!cancelled && files.length > 0) {
        await selectDb(files[0].dbRel);
      }
    })();
    loadBackups();
    loadStorageInfo();
    return () => {
      cancelled = true;
    };
  }, [loadDbFiles, selectDb, loadBackups, loadStorageInfo]);

  /** DB 선택 핸들러 */
  const handleSelectDb = async (dbRel: string) => {
    setSelectedTable("");
    setError("");
    await selectDb(dbRel);
  };

  /** 테이블 선택 핸들러 (스키마/행 데이터 로드) */
  const handleSelectTable = (table: string) => {
    setSelectedTable(table);
    setError("");
    selectTable(table);
  };

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* 상단 헤더: DB 선택 + 정보 */}
      <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c]">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            DB 관리 매니저
          </span>
        </div>
        <div className="p-4 flex flex-col md:flex-row md:items-center gap-3 text-xs">
          <div className="flex items-center gap-3 flex-1">
            <label className="text-slate-400 font-semibold shrink-0">
              대상 DB
            </label>
            <select
              value={selectedDbRel}
              onChange={(e) => handleSelectDb(e.target.value)}
              className="flex-1 p-2.5 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
            >
              <option value="" disabled>
                DB 파일을 선택하세요
              </option>
              {dbFiles.map((file) => (
                <option key={file.dbRel} value={file.dbRel}>
                  {file.dbRel} · {file.tableCount}개 테이블 · {formatBytes(file.sizeBytes)}
                </option>
              ))}
            </select>
          </div>
          {selectedDbRel && (
            <div className="text-[11px] text-slate-400 font-mono shrink-0">
              {dbFiles.find((f) => f.dbRel === selectedDbRel)?.modifiedAt
                ? `수정: ${formatDateTime(
                    dbFiles.find((f) => f.dbRel === selectedDbRel)?.modifiedAt || ""
                  )}`
                : ""}
            </div>
          )}
        </div>
      </div>

      {/* 기능 탭 네비게이션 */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition border ${
              activeTab === tab.key
                ? "bg-[#1A73E8] text-white border-[#1A73E8]"
                : "bg-[#202124] text-slate-300 hover:bg-slate-800 border-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 공통 오류 배너 */}
      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 text-xs rounded px-4 py-3">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-3 text-red-300 hover:text-red-100 underline"
          >
            닫기
          </button>
        </div>
      )}

      {/* 활성 탭에 따른 패널 렌더링 */}
      {activeTab === "browser" && (
        <DbBrowserPanel
          tables={tables}
          selectedTable={selectedTable}
          onSelectTable={handleSelectTable}
          schema={schema}
          rowsResult={rowsResult}
          onLoadRows={loadRows}
          onAddRow={addRow}
          onUpdateRow={updateRow}
          onDeleteRow={deleteRow}
        />
      )}

      {activeTab === "sql" && (
        <SqlQueryPanel
          dbRel={selectedDbRel}
          lastQueryResult={lastQueryResult}
          loading={loading}
          error={error}
          onRunQuery={runQuery}
        />
      )}

      {activeTab === "schema" && (
        <SchemaEditorPanel
          selectedTable={selectedTable}
          tables={tables}
          schema={schema}
          onSelectTable={handleSelectTable}
          onCreateTable={createTable}
          onDropTable={dropTable}
          onAddColumn={addColumn}
        />
      )}

      {activeTab === "backup" && (
        <BackupRestorePanel
          dbFiles={dbFiles}
          backups={backups}
          selectedDbRel={selectedDbRel}
          onCreateBackup={createBackup}
          onRestoreBackup={restoreBackup}
          onRestoreBackupFromFile={restoreBackupFromFile}
        />
      )}

      {activeTab === "storage" && (
        <StorageMonitorPanel
          storageInfo={storageInfo}
          onRefresh={loadStorageInfo}
        />
      )}

      {activeTab === "pluginMessages" && (
        <PluginMessagesPanel clients={clients} />
      )}
    </div>
  );
}
