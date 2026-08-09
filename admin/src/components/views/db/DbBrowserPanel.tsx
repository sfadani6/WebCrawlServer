// admin/src/components/views/db/DbBrowserPanel.tsx

import { useMemo, useState } from "react";
import {
  DbColumnInfo,
  DbTableInfo,
  TableRowsResult,
  TableSchemaResult,
} from "../../../types/index.js";
import { DbDataGrid } from "../../tables/DbDataGrid.js";

/** DbBrowserPanel 컴포넌트 Props */
interface DbBrowserPanelProps {
  /** 선택된 DB의 테이블 목록 */
  tables: DbTableInfo[];
  /** 현재 선택된 테이블명 */
  selectedTable: string;
  /** 테이블 선택 콜백 */
  onSelectTable: (table: string) => void;
  /** 선택된 테이블의 스키마 정보 */
  schema: TableSchemaResult | null;
  /** 데이터 그리드 행 조회 결과 */
  rowsResult: TableRowsResult | null;
  /** 페이지/검색 조건으로 행 조회 콜백 */
  onLoadRows: (table: string, page: number, size: number, search: string) => Promise<void>;
  /** 행 추가 콜백 */
  onAddRow: (table: string, data: Record<string, unknown>) => Promise<boolean>;
  /** 행 수정 콜백 */
  onUpdateRow: (table: string, pk: string | number, data: Record<string, unknown>) => Promise<boolean>;
  /** 행 삭제 콜백 */
  onDeleteRow: (table: string, pk: string | number) => Promise<boolean>;
}

/**
 * 컬럼 값을 컬럼 타입에 맞춰 파싱합니다.
 * 빈 문자열은 null로, 숫자 타입은 Number로 변환합니다.
 *
 * @param value - 입력 문자열
 * @param type - SQLite 컬럼 타입
 * @returns 파싱된 값
 */
function parseColumnValue(value: string, type: string): unknown {
  if (value === "") return null;
  const upper = type.toUpperCase();
  if (upper.includes("INT") || upper.includes("REAL") || upper === "NUMERIC") {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }
  return value;
}

/**
 * 데이터 브라우저 패널 컴포넌트입니다.
 * 좌측 테이블 목록과 스키마, 우측 데이터 그리드(페이지네이션/검색/행 CRUD)를 제공합니다.
 */
export function DbBrowserPanel({
  tables,
  selectedTable,
  onSelectTable,
  schema,
  rowsResult,
  onLoadRows,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
}: DbBrowserPanelProps) {
  /** 현재 페이지 번호 상태 */
  const [page, setPage] = useState(1);
  /** 검색어 상태 */
  const [search, setSearch] = useState("");
  /** 행 추가/수정 폼 표시 여부 상태 */
  const [formVisible, setFormVisible] = useState(false);
  /** 편집 중인 PK 값 상태 (null이면 신규 추가 모드) */
  const [editingPk, setEditingPk] = useState<string | null>(null);
  /** 행 입력 폼 값 상태 (컬럼명 → 문자열) */
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  /** 스키마의 컬럼명 → 타입 매핑 객체 */
  const columnTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    (schema?.columns || []).forEach((col) => {
      map[col.name] = col.type;
    });
    return map;
  }, [schema]);

  /** PK 컬럼명 (없으면 null) */
  const pkColumn = useMemo(() => {
    const pkCol = (schema?.columns || []).find((col) => col.pk > 0);
    return pkCol ? pkCol.name : null;
  }, [schema]);

  /** 폼 입력에 노출할 컬럼 목록 (PK 자동 증가 컬럼 제외) */
  const editableColumns = useMemo(() => {
    const pkNames = new Set(
      (schema?.columns || []).filter((col) => col.pk > 0).map((col) => col.name)
    );
    return (schema?.columns || []).filter((col) => !pkNames.has(col.name));
  }, [schema]);

  /** 전체 페이지 수 계산 */
  const totalPages = rowsResult
    ? Math.max(1, Math.ceil(rowsResult.total / rowsResult.size))
    : 1;

  /** 검색 실행 핸들러 (1페이지부터) */
  const handleSearch = () => {
    setPage(1);
    onLoadRows(selectedTable, 1, 50, search);
  };

  /** 페이지 이동 핸들러 */
  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
    onLoadRows(selectedTable, nextPage, 50, search);
  };

  /** 신규 행 추가 폼 열기 */
  const handleOpenAddForm = () => {
    const empty: Record<string, string> = {};
    editableColumns.forEach((col) => {
      empty[col.name] = "";
    });
    setFormValues(empty);
    setEditingPk(null);
    setFormVisible(true);
  };

  /** 기존 행 수정 폼 열기 */
  const handleOpenEditForm = (row: Record<string, unknown>) => {
    const values: Record<string, string> = {};
    editableColumns.forEach((col) => {
      const raw = row[col.name];
      values[col.name] = raw === null || raw === undefined ? "" : String(raw);
    });
    setFormValues(values);
    setEditingPk(pkColumn && row[pkColumn] !== undefined ? String(row[pkColumn]) : null);
    setFormVisible(true);
  };

  /** 폼 입력 변경 핸들러 */
  const handleFormValueChange = (name: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  /** 폼 제출 (추가 또는 수정) 핸들러 */
  const handleSubmitForm = async () => {
    const data: Record<string, unknown> = {};
    editableColumns.forEach((col) => {
      data[col.name] = parseColumnValue(formValues[col.name] || "", col.type);
    });

    const success = editingPk !== null
      ? await onUpdateRow(selectedTable, editingPk, data)
      : await onAddRow(selectedTable, data);

    if (success) {
      setFormVisible(false);
      setEditingPk(null);
      setPage(1);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* [좌측] 테이블 목록 + 스키마 정보 */}
      <div className="w-full md:w-64 flex flex-col gap-4 shrink-0">
        {/* 테이블 목록 */}
        <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c]">
            <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
              Tables ({tables.length})
            </span>
          </div>
          <div className="p-2 max-h-72 overflow-y-auto">
            {tables.length === 0 && (
              <div className="text-center text-gray-500 text-xs py-4 font-sans">
                테이블이 없습니다.
              </div>
            )}
            {tables.map((table) => (
              <button
                key={table.name}
                onClick={() => onSelectTable(table.name)}
                className={`w-full flex justify-between items-center px-3 py-2 rounded text-xs transition mb-0.5 font-mono ${
                  selectedTable === table.name
                    ? "bg-[#1A73E8]/20 text-[#1A73E8] border border-[#1A73E8]/40"
                    : "text-slate-300 hover:bg-slate-800 border border-transparent"
                }`}
              >
                <span className="truncate">{table.name}</span>
                <span className="text-[10px] text-slate-500">{table.rowCount}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 스키마 정보 */}
        {schema && selectedTable && (
          <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c]">
              <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
                Schema · {selectedTable}
              </span>
            </div>
            <div className="p-3 text-xs space-y-2">
              <div>
                <div className="text-slate-400 mb-1 font-semibold">컬럼</div>
                <div className="space-y-1">
                  {schema.columns.map((col) => (
                    <div
                      key={col.name}
                      className="flex justify-between items-center font-mono text-[11px]"
                    >
                      <span className="text-slate-200">
                        {col.pk > 0 && <span className="text-yellow-400 mr-1">PK</span>}
                        {col.name}
                      </span>
                      <span className="text-slate-500">
                        {col.type}
                        {col.notNull ? " NOT NULL" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {schema.indexes.length > 0 && (
                <div>
                  <div className="text-slate-400 mb-1 font-semibold">인덱스</div>
                  <div className="space-y-1">
                    {schema.indexes.map((idx) => (
                      <div
                        key={idx.name}
                        className="text-[11px] font-mono text-slate-300"
                      >
                        {idx.unique ? "UNIQUE " : ""}
                        {idx.name}({idx.columns.join(", ")})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* [우측] 데이터 그리드 + CRUD */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {!selectedTable ? (
          <div className="bg-[#202124] border border-gray-800 rounded p-8 text-center text-gray-500 text-sm font-sans">
            좌측에서 테이블을 선택해 데이터를 조회하세요.
          </div>
        ) : (
          <>
            {/* 검색 + 추가 버튼 */}
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="행 검색 (LIKE)"
                className="flex-1 p-2 bg-[#1E293B] border border-slate-700 rounded text-xs text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
              />
              <button
                onClick={handleSearch}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded transition border border-slate-700"
              >
                검색
              </button>
              <button
                onClick={handleOpenAddForm}
                className="px-3 py-2 bg-[#1A73E8] hover:bg-[#185abc] text-white text-xs font-semibold rounded transition"
              >
                + 행 추가
              </button>
            </div>

            {/* 데이터 그리드 */}
            <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c] flex justify-between items-center">
                <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
                  {selectedTable} · 총 {rowsResult?.total ?? 0}행
                </span>
              </div>
              {rowsResult && (
                <DbDataGrid
                  columns={Object.keys(rowsResult.rows[0] || {})}
                  rows={rowsResult.rows}
                  emptyText="조회된 행이 없습니다."
                  rowActions={(row) => (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditForm(row)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] rounded border border-slate-700"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => {
                          if (pkColumn && row[pkColumn] !== undefined) {
                            onDeleteRow(selectedTable, String(row[pkColumn]));
                          }
                        }}
                        className="px-2 py-1 bg-red-900/40 hover:bg-red-800 text-red-200 text-[10px] rounded"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                />
              )}
            </div>

            {/* 페이지네이션 */}
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>
                {rowsResult
                  ? `${(rowsResult.page - 1) * rowsResult.size + 1}–${Math.min(
                      rowsResult.page * rowsResult.size,
                      rowsResult.total
                    )} / ${rowsResult.total}`
                  : "0"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700"
                >
                  이전
                </button>
                <span className="font-mono">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700"
                >
                  다음
                </button>
              </div>
            </div>

            {/* 행 추가/수정 폼 */}
            {formVisible && (
              <div className="bg-[#111827] p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-slate-200">
                    {editingPk !== null
                      ? `행 수정 (PK: ${editingPk})`
                      : "신규 행 추가"}
                  </span>
                  <button
                    onClick={() => setFormVisible(false)}
                    className="text-slate-400 hover:text-slate-200 text-xs"
                  >
                    닫기
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {editableColumns.map((col: DbColumnInfo) => (
                    <div key={col.name}>
                      <label className="block text-slate-400 mb-1 font-semibold font-mono">
                        {col.name}{" "}
                        <span className="text-slate-600">({col.type})</span>
                      </label>
                      <input
                        value={formValues[col.name] || ""}
                        onChange={(e) =>
                          handleFormValueChange(col.name, e.target.value)
                        }
                        placeholder={col.notNull ? "필수값" : "비어 있음"}
                        className="w-full p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setFormVisible(false)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSubmitForm}
                    className="px-3 py-2 bg-[#1A73E8] hover:bg-[#185abc] text-white text-xs font-semibold rounded"
                  >
                    {editingPk !== null ? "수정 저장" : "행 추가"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
