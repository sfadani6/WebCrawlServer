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
  /** 셀 출력 문자열 제한 길이 (configs.db_cell_preview_chars, 기본 200) */
  cellPreviewChars?: number;
}

/** SQL 실행 히스토리 엔트리 구조체 */
interface QueryHistoryEntry {
  /** 실행 시각 (ISO 문자열) */
  timestamp: string;
  /** 실행된 SQL 구문 */
  sql: string;
}

/** 예제 쿼리 드롭다운 목록 (일반/이미지 크롤러 운영용 SQLite 대상) */
const EXAMPLE_QUERIES: { label: string; sql: string }[] = [
  {
    label: "모든 테이블 목록",
    sql: "SELECT name AS 테이블명, type AS 유형 FROM sqlite_master WHERE type IN ('table','view') ORDER BY name;",
  },
  {
    label: "테이블 행 수 요약",
    sql: "SELECT 'crawl_log' AS 테이블, COUNT(*) AS 행수 FROM crawl_log UNION ALL SELECT 'crawl_data', COUNT(*) FROM crawl_data UNION ALL SELECT 'images', COUNT(*) FROM images UNION ALL SELECT 'schedules', COUNT(*) FROM schedules;",
  },
  {
    label: "crawl_log 최근 50건",
    sql: "SELECT id, url, action, status, created_at FROM crawl_log ORDER BY id DESC LIMIT 50;",
  },
  {
    label: "수집 성공 로그만",
    sql: "SELECT id, url, action, created_at FROM crawl_log WHERE status = 'success' ORDER BY id DESC LIMIT 100;",
  },
  {
    label: "실패/오류 로그 검색",
    sql: "SELECT id, url, status, error, created_at FROM crawl_log WHERE status IN ('error','failed') ORDER BY id DESC LIMIT 100;",
  },
  {
    label: "최근 7일 일별 수집 건수",
    sql: "SELECT date(created_at) AS 일자, COUNT(*) AS 건수 FROM crawl_log WHERE created_at >= datetime('now','-7 days') GROUP BY date(created_at) ORDER BY 일자 DESC;",
  },
  {
    label: "URL 도메인별 수집 분포",
    sql: "SELECT substr(url, instr(url, '//')+2, instr(substr(url, instr(url, '//')+2), '/')-1) AS 도메인, COUNT(*) AS 건수 FROM crawl_log GROUP BY 도메인 ORDER BY 건수 DESC LIMIT 20;",
  },
  {
    label: "crawl_data 최근 50건",
    sql: "SELECT id, url, title, domain, file_path, created_at FROM crawl_data ORDER BY id DESC LIMIT 50;",
  },
  {
    label: "중복 URL 조회 (같은 URL 재수집)",
    sql: "SELECT url, COUNT(*) AS 횟수 FROM crawl_log GROUP BY url HAVING COUNT(*) > 1 ORDER BY 횟수 DESC LIMIT 20;",
  },
  {
    label: "images 카테고리별 건수",
    sql: "SELECT COALESCE(category, 'normal') AS 카테고리, COUNT(*) AS 건수, SUM(size_bytes) AS 총용량 FROM images GROUP BY COALESCE(category, 'normal') ORDER BY 건수 DESC;",
  },
  {
    label: "images 최근 50건",
    sql: "SELECT id, domain, category, file_name, size_bytes, created_at FROM images ORDER BY id DESC LIMIT 50;",
  },
  {
    label: "대용량 이미지 상위 20건",
    sql: "SELECT id, domain, category, file_name, size_bytes FROM images ORDER BY size_bytes DESC LIMIT 20;",
  },
  {
    label: "활성 스케줄 목록",
    sql: "SELECT id, name, cron, status, enabled, last_run_at, next_run_at FROM schedules WHERE enabled = 1 ORDER BY next_run_at;",
  },
  {
    label: "오늘 이후 실행 예정 스케줄",
    sql: "SELECT id, name, cron, next_run_at FROM schedules WHERE enabled = 1 AND next_run_at >= datetime('now') ORDER BY next_run_at ASC;",
  },
  {
    label: "schedules 상태별 요약",
    sql: "SELECT status, COUNT(*) AS 건수 FROM schedules GROUP BY status;",
  },
  {
    label: "노드별 최근 수집 이력",
    sql: "SELECT node_name, COUNT(*) AS 건수, MAX(created_at) AS 최근수집 FROM crawl_log GROUP BY node_name ORDER BY 건수 DESC;",
  },
  {
    label: "같은 도메인 재방문 간격",
    sql: "SELECT domain, COUNT(*) AS 건수, MIN(created_at) AS 최초, MAX(created_at) AS 최신 FROM crawl_data GROUP BY domain ORDER BY 건수 DESC LIMIT 20;",
  },
  {
    label: "스키마 정보 (현재 DB)",
    sql: "PRAGMA table_info(crawl_log);",
  },
  {
    label: "인덱스 목록",
    sql: "SELECT name AS 인덱스명, tbl_name AS 테이블, sql AS 정의 FROM sqlite_master WHERE type = 'index' ORDER BY tbl_name;",
  },
  {
    label: "DB 설정값 조회",
    sql: "SELECT * FROM configs ORDER BY key;",
  },
];

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
  cellPreviewChars = 200,
}: SqlQueryPanelProps) {
  /** SQL 에디터 입력 상태 */
  const [sql, setSql] = useState("");
  /** 실행 결과 로컬 상태 (패널 내 유지) */
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  /** 실행 히스토리 상태 (최대 20건) */
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);

  /** 예제 쿼리 드롭다운 선택 핸들러 (선택한 SQL을 에디터에 삽입) */
  const handleSelectExample = (sqlText: string) => {
    if (!sqlText) return;
    setSql(sqlText);
  };

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
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => handleSelectExample(e.target.value)}
              defaultValue=""
              aria-label="예제 쿼리 선택"
              title="예제 쿼리를 에디터에 불러옵니다"
              className="p-2 bg-[#1E293B] border border-slate-700 rounded text-xs text-slate-100 font-mono outline-none focus:border-[#1A73E8] max-w-[14rem]"
            >
              <option value="" disabled>
                예제 쿼리 선택 (20개)
              </option>
              {EXAMPLE_QUERIES.map((example) => (
                <option key={example.label} value={example.sql}>
                  {example.label}
                </option>
              ))}
            </select>
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
            cellPreviewLimit={cellPreviewChars}
            clientSort
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
