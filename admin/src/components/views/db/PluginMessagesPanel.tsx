// admin/src/components/views/db/PluginMessagesPanel.tsx

import { useEffect, useState } from "react";
import {
  Client,
  PluginMessageRecord,
} from "../../../types/index.js";
import { fetchPluginMessagesApi } from "../../../services/apiService.js";
import { formatBytes, formatDateTime } from "../../../utils/format.js";

/** 플러그인 메시지 원장 조회 패널 props 구조체 */
interface PluginMessagesPanelProps {
  /** 등록된 클라이언트 목록 (필터 드롭다운용) */
  clients: Client[];
}

/**
 * 플러그인 수신 메시지 원장(plugin_messages) 조회 패널 컴포넌트입니다.
 * 클라이언트/액션 필터와 함께 원장 레코드를 최신순으로 목록 표시하며,
 * 페이로드/메타 JSON은 행 단위 토글로 펼쳐 확인할 수 있습니다.
 */
export function PluginMessagesPanel({ clients }: PluginMessagesPanelProps) {
  /** 원장 레코드 목록 상태 */
  const [messages, setMessages] = useState<PluginMessageRecord[]>([]);
  /** 선택된 클라이언트 필터 ("" 이면 전체) */
  const [filterClient, setFilterClient] = useState("");
  /** 선택된 액션 필터 ("" 이면 전체) */
  const [filterAction, setFilterAction] = useState("");
  /** 조회 로딩 상태 */
  const [loading, setLoading] = useState(false);
  /** 조회 오류 메시지 상태 */
  const [error, setError] = useState("");
  /** 펼쳐보기 토글용 선택 레코드 ID 상태 */
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /** 원장 목록을 현재 필터로 재조회하는 핸들러 */
  const loadMessages = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchPluginMessagesApi({
        clientId: filterClient || undefined,
        action: filterAction || undefined,
        limit: 100,
      });
      setMessages(rows);
    } catch {
      setError("플러그인 메시지 원장 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 최초 1회 조회
  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 행 펼침 토글 핸들러 */
  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c] flex items-center justify-between">
        <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
          플러그인 메시지 원장
        </span>
        <span className="text-[11px] text-slate-400">{messages.length}건</span>
      </div>

      {/* 필터 영역 */}
      <div className="p-4 flex flex-wrap items-center gap-3 text-xs border-b border-gray-800">
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 outline-none focus:border-[#1A73E8]"
        >
          <option value="">전체 클라이언트</option>
          {clients.map((c) => (
            <option key={c.client_id} value={c.client_id}>
              {c.alias || c.client_id}
            </option>
          ))}
        </select>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 outline-none focus:border-[#1A73E8]"
        >
          <option value="">전체 액션</option>
          {Array.from(new Set(messages.map((m) => m.action))).map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
        <button
          onClick={loadMessages}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-xs font-semibold transition bg-[#1A73E8] text-white hover:bg-[#1765CC] disabled:opacity-50"
        >
          {loading ? "조회 중..." : "조회"}
        </button>
        {error && <span className="text-red-400">{error}</span>}
      </div>

      {/* 원장 목록 */}
      <div className="divide-y divide-gray-800">
        {messages.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-slate-500 text-xs">
            수신된 플러그인 메시지가 없습니다.
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="px-4 py-3 hover:bg-slate-900/40">
            {/* 요약 행 */}
            <button
              onClick={() => toggleExpand(msg.id)}
              className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1"
            >
              <span className="font-mono text-xs text-slate-300 w-12 shrink-0">
                #{msg.id}
              </span>
              <span className="text-xs text-slate-200 w-52 truncate shrink-0">
                {msg.client_id}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-[#4FC3F7] font-mono text-[10px]">
                {msg.action}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {msg.payload_type}
              </span>
              <span className="text-[11px] text-slate-400 ml-auto shrink-0">
                {formatDateTime(msg.timestamp)}
              </span>
            </button>

            {/* 펼침 상세 영역 */}
            {expandedId === msg.id && (
              <div className="mt-3 space-y-2 text-[11px]">
                {msg.file_path && (
                  <div className="text-slate-400 font-mono break-all">
                    <span className="text-slate-500">파일: </span>
                    {msg.file_path}{" "}
                    <span className="text-slate-500">({formatBytes(msg.file_size)})</span>
                  </div>
                )}
                {msg.payload_json && (
                  <pre className="bg-[#0B0E14] border border-gray-800 rounded p-3 text-emerald-300 font-mono overflow-x-auto max-h-64">
                    {msg.payload_json}
                  </pre>
                )}
                {msg.meta_json && (
                  <pre className="bg-[#0B0E14] border border-gray-800 rounded p-3 text-amber-300 font-mono overflow-x-auto max-h-40">
                    {msg.meta_json}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
