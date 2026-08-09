// admin/src/components/views/db/SchemaEditorPanel.tsx

import { useState } from "react";
import {
  ColumnDefInput,
  DbTableInfo,
  TableSchemaResult,
} from "../../../types/index.js";

/** SchemaEditorPanel 컴포넌트 Props */
interface SchemaEditorPanelProps {
  /** 현재 선택된 테이블명 */
  selectedTable: string;
  /** 선택된 DB의 테이블 목록 */
  tables: DbTableInfo[];
  /** 선택된 테이블의 스키마 정보 */
  schema: TableSchemaResult | null;
  /** 테이블 선택 콜백 */
  onSelectTable: (table: string) => void;
  /** 테이블 생성 콜백 */
  onCreateTable: (tableName: string, columns: ColumnDefInput[]) => Promise<boolean>;
  /** 테이블 삭제 콜백 */
  onDropTable: (table: string) => Promise<boolean>;
  /** 컬럼 추가 콜백 */
  onAddColumn: (table: string, column: ColumnDefInput) => Promise<boolean>;
}

/** 허용 가능한 SQLite 데이터 타입 목록 */
const SQLITE_TYPES = ["TEXT", "INTEGER", "REAL", "BLOB", "NUMERIC"] as const;

/** 새 테이블 생성용 빈 컬럼 정의 생성기 */
function createEmptyColumn(): ColumnDefInput {
  return { name: "", type: "TEXT", notNull: false, primaryKey: false };
}

/**
 * 스키마 편집기 패널 컴포넌트입니다.
 * 테이블 생성(동적 컬럼 정의), 테이블 삭제, 컬럼 추가, 현재 스키마 뷰어를 제공합니다.
 */
export function SchemaEditorPanel({
  selectedTable,
  tables,
  schema,
  onSelectTable,
  onCreateTable,
  onDropTable,
  onAddColumn,
}: SchemaEditorPanelProps) {
  /** 신규 테이블명 상태 */
  const [newTableName, setNewTableName] = useState("");
  /** 신규 테이블 컬럼 정의 배열 상태 */
  const [newTableColumns, setNewTableColumns] = useState<ColumnDefInput[]>([
    createEmptyColumn(),
  ]);
  /** 추가할 컬럼 정의 상태 */
  const [newColumn, setNewColumn] = useState<ColumnDefInput>(createEmptyColumn());

  /** 신규 테이블 컬럼 속성 변경 핸들러 */
  const handleNewTableColumnChange = (
    index: number,
    key: keyof ColumnDefInput,
    value: unknown
  ) => {
    setNewTableColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, [key]: value } : col))
    );
  };

  /** 신규 테이블 컬럼 추가 핸들러 */
  const handleAddNewTableColumn = () => {
    setNewTableColumns((prev) => [...prev, createEmptyColumn()]);
  };

  /** 신규 테이블 컬럼 제거 핸들러 */
  const handleRemoveNewTableColumn = (index: number) => {
    setNewTableColumns((prev) => prev.filter((_, i) => i !== index));
  };

  /** 테이블 생성 제출 핸들러 */
  const handleCreateTable = async () => {
    if (!newTableName.trim()) {
      window.alert("테이블명을 입력해주세요.");
      return;
    }
    const validColumns = newTableColumns.filter(
      (col) => col.name.trim().length > 0
    );
    if (validColumns.length === 0) {
      window.alert("최소 1개 이상의 컬럼을 정의해주세요.");
      return;
    }
    const success = await onCreateTable(
      newTableName.trim(),
      validColumns.map((col) => ({ ...col, name: col.name.trim() }))
    );
    if (success) {
      setNewTableName("");
      setNewTableColumns([createEmptyColumn()]);
    }
  };

  /** 컬럼 추가 제출 핸들러 */
  const handleAddColumn = async () => {
    if (!selectedTable) {
      window.alert("컬럼을 추가할 테이블을 먼저 선택해주세요.");
      return;
    }
    if (!newColumn.name.trim()) {
      window.alert("컬럼명을 입력해주세요.");
      return;
    }
    const success = await onAddColumn(selectedTable, {
      ...newColumn,
      name: newColumn.name.trim(),
    });
    if (success) {
      setNewColumn(createEmptyColumn());
    }
  };

  /** 테이블 삭제 핸들러 */
  const handleDropTable = async () => {
    if (!selectedTable) return;
    const success = await onDropTable(selectedTable);
    if (success) {
      setNewColumn(createEmptyColumn());
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* [1] 테이블 생성 폼 */}
      <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c]">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            신규 테이블 생성
          </span>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 font-semibold shrink-0">
              테이블명
            </label>
            <input
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder="예: product_meta"
              className="flex-1 p-2 bg-[#1E293B] border border-slate-700 rounded text-xs text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
            />
          </div>

          {/* 동적 컬럼 정의 목록 */}
          <div className="flex flex-col gap-2">
            {newTableColumns.map((col, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <input
                  value={col.name}
                  onChange={(e) =>
                    handleNewTableColumnChange(index, "name", e.target.value)
                  }
                  placeholder="컬럼명"
                  className="flex-1 p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
                />
                <select
                  value={col.type}
                  onChange={(e) =>
                    handleNewTableColumnChange(index, "type", e.target.value)
                  }
                  className="p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono"
                >
                  {SQLITE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-slate-400 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={!!col.notNull}
                    onChange={(e) =>
                      handleNewTableColumnChange(
                        index,
                        "notNull",
                        e.target.checked
                      )
                    }
                    className="accent-[#1A73E8]"
                  />
                  NOT NULL
                </label>
                <label className="flex items-center gap-1 text-slate-400 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={!!col.primaryKey}
                    onChange={(e) =>
                      handleNewTableColumnChange(
                        index,
                        "primaryKey",
                        e.target.checked
                      )
                    }
                    className="accent-yellow-500"
                  />
                  PK
                </label>
                <button
                  onClick={() => handleRemoveNewTableColumn(index)}
                  disabled={newTableColumns.length <= 1}
                  className="p-1.5 bg-red-900/40 hover:bg-red-800 disabled:opacity-30 text-red-200 rounded transition"
                >
                  <span className="material-symbols-outlined text-xs">delete</span>
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={handleAddNewTableColumn}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-white transition"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              컬럼 추가
            </button>
            <button
              onClick={handleCreateTable}
              className="px-4 py-2 bg-[#1A73E8] hover:bg-[#185abc] text-white text-xs font-semibold rounded transition"
            >
              테이블 생성
            </button>
          </div>
        </div>
      </div>

      {/* [2] 현재 테이블 스키마 + 컬럼 추가 */}
      <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c]">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            테이블 스키마 · 컬럼 추가
          </span>
        </div>
        <div className="p-4 flex flex-col gap-4">
          {/* 테이블 선택 */}
          <div className="flex flex-wrap gap-2">
            {tables.map((table) => (
              <button
                key={table.name}
                onClick={() => onSelectTable(table.name)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition border ${
                  selectedTable === table.name
                    ? "bg-[#1A73E8]/20 text-[#1A73E8] border-[#1A73E8]/40"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700"
                }`}
              >
                {table.name}
              </button>
            ))}
            {tables.length === 0 && (
              <span className="text-xs text-slate-500">테이블이 없습니다.</span>
            )}
          </div>

          {/* 스키마 뷰어 */}
          {schema && (
            <div className="text-xs space-y-2">
              <div>
                <div className="text-slate-400 mb-1 font-semibold">
                  컬럼 ({schema.columns.length}) · 총 {schema.rowCount}행
                </div>
                <div className="bg-[#111827] rounded border border-slate-800 divide-y divide-slate-800">
                  {schema.columns.map((col) => (
                    <div
                      key={col.name}
                      className="flex justify-between items-center px-3 py-2 font-mono text-[11px]"
                    >
                      <span className="text-slate-200">
                        {col.pk > 0 && (
                          <span className="text-yellow-400 mr-1">PK</span>
                        )}
                        {col.name}
                      </span>
                      <span className="text-slate-500">
                        {col.type}
                        {col.notNull ? " NOT NULL" : ""}
                        {col.defaultValue !== null &&
                          col.defaultValue !== undefined &&
                          ` DEFAULT ${String(col.defaultValue)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {schema.indexes.length > 0 && (
                <div>
                  <div className="text-slate-400 mb-1 font-semibold">인덱스</div>
                  <div className="bg-[#111827] rounded border border-slate-800 divide-y divide-slate-800">
                    {schema.indexes.map((idx) => (
                      <div
                        key={idx.name}
                        className="px-3 py-2 font-mono text-[11px] text-slate-300"
                      >
                        {idx.unique ? "UNIQUE " : ""}
                        {idx.name}({idx.columns.join(", ")})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 컬럼 추가 폼 */}
          <div className="border-t border-slate-800 pt-4 flex flex-col gap-3">
            <span className="text-xs text-slate-400 font-semibold">
              새 컬럼 추가
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                value={newColumn.name}
                onChange={(e) =>
                  setNewColumn((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="컬럼명"
                className="flex-1 min-w-40 p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
              />
              <select
                value={newColumn.type}
                onChange={(e) =>
                  setNewColumn((prev) => ({ ...prev, type: e.target.value }))
                }
                className="p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono"
              >
                {SQLITE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-slate-400 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={!!newColumn.notNull}
                  onChange={(e) =>
                    setNewColumn((prev) => ({
                      ...prev,
                      notNull: e.target.checked,
                    }))
                  }
                  className="accent-[#1A73E8]"
                />
                NOT NULL
              </label>
              <button
                onClick={handleAddColumn}
                className="px-4 py-2 bg-[#1A73E8] hover:bg-[#185abc] text-white text-xs font-semibold rounded transition"
              >
                컬럼 추가
              </button>
            </div>
          </div>

          {/* 테이블 삭제 */}
          <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              테이블 {selectedTable ? `[${selectedTable}]` : ""} 을(를) 영구 삭제
            </span>
            <button
              onClick={handleDropTable}
              disabled={!selectedTable}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-800 disabled:opacity-30 text-red-100 text-xs font-semibold rounded transition"
            >
              테이블 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
