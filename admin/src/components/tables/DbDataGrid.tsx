// admin/src/components/tables/DbDataGrid.tsx

import { ReactNode } from "react";

/** DbDataGrid 컴포넌트 Props */
interface DbDataGridProps {
  /** 표시할 컬럼명 배열 */
  columns: string[];
  /** 표시할 행 배열 */
  rows: Record<string, unknown>[];
  /** 데이터가 없을 때 표시할 메시지 */
  emptyText?: string;
  /** 행별 커스텀 액션 렌더러 (행 객체를 인자로 받음) */
  rowActions?: (row: Record<string, unknown>) => ReactNode;
}

/**
 * 셀 값을 문자열로 정화 변환합니다.
 * 객체(BLOB 요약 등)는 JSON 직렬화를 시도하고, 빈 값은 빈 문자열로 처리합니다.
 *
 * @param value - 원본 셀 값
 * @returns 표시용 문자열
 */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * SQL 결과 및 데이터 브라우저에 공용되는 재사용 가능한 데이터 그리드 컴포넌트입니다.
 * GCP 다크 테마 스타일을 준수하며, 컬럼명/행 데이터만 전달하면 렌더링합니다.
 */
export function DbDataGrid({ columns, rows, emptyText, rowActions }: DbDataGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-[#111827] text-slate-300 border-b border-slate-800 text-[11px] font-semibold">
            {columns.map((col) => (
              <th key={col} className="p-3 whitespace-nowrap">
                {col}
              </th>
            ))}
            {rowActions && <th className="p-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 text-gray-200 font-mono">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-[#2d2e31] transition">
              {columns.map((col) => (
                <td key={col} className="p-3 align-top">
                  <span className="whitespace-pre-wrap break-words max-w-md inline-block">
                    {formatCell(row[col])}
                  </span>
                </td>
              ))}
              {rowActions && (
                <td className="p-3 text-right whitespace-nowrap">
                  {rowActions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="p-8 text-center text-gray-500 text-sm font-sans">
          {emptyText || "표시할 데이터가 없습니다."}
        </div>
      )}
    </div>
  );
}
