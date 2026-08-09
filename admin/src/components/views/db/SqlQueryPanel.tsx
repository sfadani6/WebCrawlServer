// admin/src/components/views/db/SqlQueryPanel.tsx

import { useState } from "react";
import { SqlQueryResult } from "../../../types/index.js";
import { DbDataGrid } from "../../tables/DbDataGrid.js";

/** SqlQueryPanel 컴포넌트 Props */
interface SqlQueryPanelProps {
  /** 현재 선택된 DB 상대 경로 (없으면 빈 문자열) */
  dbRel: string;
  /** 마지막 SQL 실행 결과 (훅 상태) */
  lastQueryResult: SqlQueryResult | null;
  /** 로딩 여부 */
  loading: boolean;
  /** 공통 오류 메시지 */
  error: string;
  /** SQL 실행 콜백 */
  onRunQuery: (sql: string) => Promise<SqlQueryResult | null>;
}

/** SQL 실행 히스토리 엔트리 구조체 */
interface QueryHistoryEntry {
  /** 실행 시각 (ISO 문자열) */
  timestamp: string;
  /** 실행된 SQL 구문 */
  sql: string;
}

/**
 * SQL 쿼리 실행기 패널 컴포넌트입니다.
 * SQL 에디터, 실행 버튼, 결과 그리드, 실행 시간/영향 행, 실행 히스토리를 제공합니다.
 * Ctrl+Enter 단축키로 즉시 실행할 수 있습니다.
 */
export function SqlQueryPanel({
  dbRel,
  lastQueryResult,
  loading,
  error,
  onRunQuery,
}: SqlQueryPanelProps) {
  /** SQL 에디터 입력 상태 */
  const [sql, setSql] = useState("");
  /** 실행 결과 로컬 상태 (패널 내 유지) */
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  /** 실행 히스토리 상태 (최대 20건) */
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);

  /** SQL 실행 핸들러 */
  const handleRun = async (sqlToRun?: string) => {
    const target = sqlToRun ?? sql;
    if (!target.trim()) return;
    const res = await onRunQuery(target);
    if (res) {
      setResult(res);
      setHistory((prev) =>
        [
          { timestamp: new Date().toISOString(), sql: target.trim() },
          ...prev,
        ].slice(0, 20)
      );
    }
  };

  /** 실행 중인 결과 우선 사용 (없으면 마지막 히스토리 결과) */
  const displayResult = result ?? lastQueryResult;

  return (
    <div className="flex flex-col gap-4">
      {/* SQL 에디터 카드 */}
      <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c] flex justify-between items-center">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            SQL 쿼리 실행기
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {dbRel ? dbRel : "DB를 먼저 선택해주세요"} · Ctrl+Enter 실행
          </span>
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleRun();
            }
          }}
          placeholder={"SELECT * FROM 테이블명 LIMIT 100;\n\n-- SELECT/WITH/PRAGMA 계열은 결과 그리드로, 그 외 구문은 영향 행 수로 표시됩니다."}
          className="w-full h-40 p-4 bg-[#111827] border-b border-slate-800 text-slate-100 font-mono text-xs outline-none resize-y placeholder:text-slate-600"
        />
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-mono">
            {result && (
              <>
                {result.isSelect
                  ? `${result.rows.length}행 반환`
                  : `영향 행 ${result.affected}건`}{" "}
                · {result.durationMs}ms
              </>
            )}
          </div>
          <button
            onClick={() => handleRun()}
            disabled={loading || !dbRel}
            className="px-4 py-2 bg-[#1A73E8] hover:bg-[#185abc] disabled:opacity-40 text-white text-xs font-semibold rounded transition"
          >
            {loading ? "실행 중..." : "▶ 실행"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 text-xs rounded px-4 py-3">
          {error}
        </div>
      )}

      {/* 결과 그리드 */}
      {displayResult && displayResult.isSelect && displayResult.rows.length > 0 && (
        <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c] flex justify-between items-center">
            <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
              Query Result
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {displayResult.message}
            </span>
          </div>
          <DbDataGrid
            columns={displayResult.columns}
            rows={displayResult.rows}
            emptyText="조회 결과가 없습니다."
          />
        </div>
      )}

      {/* 실행 히스토리 */}
      {history.length > 0 && (
        <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c]">
            <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
              실행 히스토리 ({history.length})
            </span>
          </div>
          <div className="divide-y divide-gray-800">
            {history.map((entry, index) => (
              <div
                key={index}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-[#2d2e31] transition"
              >
                <span className="text-[10px] text-slate-500 font-mono shrink-0 pt-1">
                  {new Date(entry.timestamp).toLocaleTimeString("ko-KR")}
                </span>
                <button
                  onClick={() => {
                    setSql(entry.sql);
                    handleRun(entry.sql);
                  }}
                  className="text-left text-slate-300 hover:text-[#1A73E8] font-mono text-xs break-all"
                >
                  {entry.sql}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
