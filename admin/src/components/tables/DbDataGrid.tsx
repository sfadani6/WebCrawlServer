// admin/src/components/tables/DbDataGrid.tsx

import { ReactNode, useMemo, useState } from "react";
import { openExplorerApi } from "../../services/apiService.js";
import { ValuePreviewModal } from "../modals/ValuePreviewModal.js";

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
  /** 셀 출력 문자열 제한 길이 (초과 시 더보기 링크 제공, 기본 200) */
  cellPreviewLimit?: number;
  /** 현재 정렬된 컬럼명 (서버 정렬 모드) */
  sortColumn?: string | null;
  /** 현재 정렬 방향 (서버 정렬 모드) */
  sortDir?: "asc" | "desc";
  /** 헤더 클릭 정렬 콜백 (서버 정렬 모드에서 호출) */
  onSortChange?: (col: string) => void;
  /** 클라이언트 내부 정렬 사용 여부 (SQL 결과 그리드용, 서버 정렬과 별개) */
  clientSort?: boolean;
}

/** 셀 값 전체 미리보기 모달 상태 구조체 */
interface PreviewState {
  /** 모달 제목 (테이블명.컬럼명 형태) */
  title: string;
  /** 표시할 전체 값 문자열 */
  content: string;
}

/** 미리보기/더보기 대상 기본 제한 길이 */
const DEFAULT_PREVIEW_LIMIT = 200;

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
 * 클라이언트 정렬용 값 비교 함수입니다.
 * 양쪽 모두 숫자면 수치 비교, 아니면 문자열 localeCompare로 비교합니다.
 *
 * @param a - 비교 값 A
 * @param b - 비교 값 B
 * @returns 비교 결과 정수
 */
function compareCellValues(a: unknown, b: unknown): number {
  const bothNumbers = typeof a === "number" && typeof b === "number";
  if (bothNumbers) return a - b;
  const sa = a === null || a === undefined ? "" : String(a);
  const sb = b === null || b === undefined ? "" : String(b);
  return sa.localeCompare(sb);
}

/** 클라이언트 정렬 상태 구조체 */
interface ClientSortState {
  /** 정렬 대상 컬럼명 */
  column: string;
  /** 정렬 방향 */
  dir: "asc" | "desc";
}

/** 셀 값 출력 및 file_path 탐색기 버튼을 렌더링하는 하위 컴포넌트 */
interface CellValueProps {
  /** 컬럼명 */
  col: string;
  /** 원본 셀 값 */
  value: unknown;
  /** 문자열 제한 길이 */
  previewLimit: number;
  /** 더보기 클릭 시 전체 값 미리보기 콜백 */
  onOpenPreview: (title: string, content: string) => void;
  /** file_path 탐색기 버튼 클릭 콜백 */
  onOpenExplorer: (path: string) => void;
  /** 탐색기 여는 중 여부 (해당 경로) */
  openingPath: string | null;
}

function CellValue({
  col,
  value,
  previewLimit,
  onOpenPreview,
  onOpenExplorer,
  openingPath,
}: CellValueProps) {
  const text = formatCell(value);
  const isLong = text.length > previewLimit;
  const shown = isLong ? `${text.slice(0, previewLimit)}…` : text;
  // file_path 컬럼에만 탐색기 버튼 표시 (경로 형태 값)
  const isFilePath = col === "file_path" && text.trim().length > 0;
  const isOpening = openingPath === text.trim();

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-1.5">
        <span className="whitespace-pre-wrap break-words max-w-md inline-block font-mono">
          {shown}
        </span>
        {isFilePath && (
          <button
            onClick={() => onOpenExplorer(text.trim())}
            disabled={isOpening}
            title="Windows 파일 탐색기로 폴더 열기"
            aria-label={`${col} 폴더 열기`}
            className="shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded text-[#1A73E8] hover:bg-[#1A73E8]/15 border border-transparent hover:border-[#1A73E8]/40 transition disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">
              {isOpening ? "progress_activity animate-spin" : "folder_open"}
            </span>
          </button>
        )}
      </div>
      {isLong && (
        <button
          onClick={() => onOpenPreview(col, text)}
          className="mt-0.5 text-[11px] text-[#1A73E8] hover:text-[#3B82F6] hover:underline font-sans"
        >
          더보기
        </button>
      )}
    </div>
  );
}

/**
 * SQL 결과 및 데이터 브라우저에 공용되는 재사용 가능한 데이터 그리드 컴포넌트입니다.
 * GCP 다크 테마 스타일을 준수하며, 컬럼명/행 데이터만 전달하면 렌더링합니다.
 * 긴 셀(log_message 등)은 설정된 글자 수만큼만 표시하고 "더보기"로 전체 값을
 * 브라우저 창 높이에 맞춘 레이어 모달에서 볼 수 있으며, file_path 컬럼은 옆의
 * 작은 버튼으로 OS 네이티브 파일 탐색기를 엽니다.
 * 컬럼 헤더 클릭 정렬을 지원합니다 — 데이터 브라우저는 서버 정렬(onSortChange),
 * SQL 결과 그리드는 클라이언트 정렬(clientSort)을 사용합니다.
 */
export function DbDataGrid({
  columns,
  rows,
  emptyText,
  rowActions,
  cellPreviewLimit = DEFAULT_PREVIEW_LIMIT,
  sortColumn = null,
  sortDir = "asc",
  onSortChange,
  clientSort = false,
}: DbDataGridProps) {
  /** 전체 값 미리보기 모달 상태 */
  const [preview, setPreview] = useState<PreviewState | null>(null);
  /** 탐색기로 여는 중인 경로 (중복 실행 차단) */
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  /** 탐색기 실행 실패 메시지 (없으면 null) */
  const [openError, setOpenError] = useState<string | null>(null);
  /** 클라이언트 정렬 상태 (clientSort 모드 전용) */
  const [localSort, setLocalSort] = useState<ClientSortState | null>(null);

  /** 클라이언트 정렬 모드에서 정렬된 행 목록 (미정렬 시 원본 유지) */
  const sortedRows = useMemo(() => {
    if (!clientSort || !localSort) return rows;
    const sorted = [...rows].sort((a, b) =>
      compareCellValues(a[localSort.column], b[localSort.column])
    );
    if (localSort.dir === "desc") sorted.reverse();
    return sorted;
  }, [rows, localSort, clientSort]);

  /**
   * 컬럼 헤더 클릭 정렬 핸들러입니다.
   * clientSort 모드에서는 내부 정렬 상태를 토글하고, 아니면 서버 정렬 콜백을 호출합니다.
   *
   * @param col - 정렬할 컬럼명
   */
  const handleHeaderClick = (col: string) => {
    if (clientSort) {
      setLocalSort((prev) =>
        prev && prev.column === col
          ? { column: col, dir: prev.dir === "asc" ? "desc" : "asc" }
          : { column: col, dir: "asc" }
      );
    } else if (onSortChange) {
      onSortChange(col);
    }
  };

  /** 표시용 정렬 상태 (클라이언트 정렬 우선, 없으면 서버 정렬 상태 사용) */
  const displaySort: ClientSortState | null = clientSort
    ? localSort
    : sortColumn
    ? { column: sortColumn, dir: sortDir }
    : null;

  /**
   * file_path 셀 값으로 Windows 파일 탐색기를 엽니다.
   * 실패 시 그리드 하단에 일시적 오류 메시지를 표시합니다.
   *
   * @param path - 열 대상 경로 (파일이면 부모 디렉토리까지만)
   */
  const handleOpenExplorer = async (path: string) => {
    if (openingPath) return;
    setOpeningPath(path);
    setOpenError(null);
    try {
      await openExplorerApi(path);
    } catch (err) {
      setOpenError(
        err instanceof Error ? err.message : "파일 탐색기를 여는 데 실패했습니다."
      );
    } finally {
      setOpeningPath(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-[#111827] text-slate-300 border-b border-slate-800 text-[11px] font-semibold">
            {columns.map((col) => {
              const active = displaySort?.column === col;
              return (
                <th key={col} className="p-3 whitespace-nowrap">
                  <button
                    onClick={() => handleHeaderClick(col)}
                    title="컬럼 정렬 (오름차순/내림차순 토글)"
                    className={`inline-flex items-center gap-1 transition ${
                      active ? "text-[#1A73E8]" : "hover:text-slate-100"
                    }`}
                  >
                    {col}
                    <span className="material-symbols-outlined text-sm leading-none">
                      {active
                        ? displaySort?.dir === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
              );
            })}
            {rowActions && <th className="p-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 text-gray-200">
          {sortedRows.map((row, index) => (
            <tr key={index} className="hover:bg-[#2d2e31] transition">
              {columns.map((col) => (
                <td key={col} className="p-3 align-top">
                  <CellValue
                    col={col}
                    value={row[col]}
                    previewLimit={cellPreviewLimit}
                    onOpenPreview={(title, content) =>
                      setPreview({ title: `${title}`, content })
                    }
                    onOpenExplorer={handleOpenExplorer}
                    openingPath={openingPath}
                  />
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

      {/* 탐색기 실행 실패 안내 */}
      {openError && (
        <div className="px-4 py-2 text-[11px] text-[#EA4335] bg-red-950/40 border-t border-red-900/50 font-sans">
          {openError}
        </div>
      )}

      {/* 긴 셀 전체 값 미리보기 레이어 모달 */}
      <ValuePreviewModal
        isOpen={preview !== null}
        title={preview?.title || ""}
        content={preview?.content || ""}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
