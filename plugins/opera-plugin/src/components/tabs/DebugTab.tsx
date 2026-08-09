// plugins/opera-plugin/src/components/tabs/DebugTab.tsx

import { useEffect, useRef } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { PluginLogEntry } from "../../types";

/** 디버그 탭 컴포넌트 Props */
interface DebugTabProps {
  /** 서버에 보낼 JSON 문자열 */
  debugMessage: string;
  /** 전송 결과 상태 메시지 */
  debugStatus: string;
  /** 입력 변경 콜백 */
  onChangeDebugMessage: (val: string) => void;
  /** 전송 실행 콜백 */
  onSendDebugMessage: () => void;
  /** 터미널 콘솔 로그 목록 */
  terminalLogs: PluginLogEntry[];
  /** 자동 스크롤 활성화 여부 */
  autoScroll: boolean;
  /** 자동 스크롤 토글 콜백 */
  setAutoScroll: (val: boolean) => void;
  /** 명령 입력 값 */
  commandInput: string;
  /** 명령 입력 값 변경 콜백 */
  setCommandInput: (val: string) => void;
  /** 콘솔 높이 (px) */
  consoleHeight: number;
  /** 콘솔 명령 실행 콜백 */
  onRunCommand: (command: string) => void;
  /** 콘솔 소거 콜백 */
  onClearTerminal: () => void;
  /** 콘솔 높이 리사이즈 바 드래그 시작 콜백 */
  onConsoleResizeStart: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** 콘솔 높이 리사이즈 바 드래그 이동 콜백 */
  onConsoleResizeMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** 콘솔 높이 리사이즈 바 드래그 종료 콜백 */
  onConsoleResizeEnd: () => void;
}

/**
 * 터미널 로그 타입별 텍스트 색상을 반환합니다.
 * (admin 네트워크 모니터링 콘솔과 동일 색상 규격)
 *
 * @param type - 로그 타입
 * @returns Tailwind 텍스트 색상 클래스
 */
function getLogTextColor(type: PluginLogEntry["type"]): string {
  switch (type) {
    case "success":
      return "text-emerald-400";
    case "error":
      return "text-rose-400";
    case "warning":
      return "text-amber-400";
    case "cmd":
      return "text-sky-400";
    default:
      return "text-slate-300";
  }
}

/**
 * 디버그 탭 UI 컴포넌트.
 * 서버에 디버그 메시지를 전송하고, 하단에는 admin 네트워크 모니터링 스타일의
 * 터미널 콘솔(패킷 수신/동작 로그 + 명령 입력)을 표시합니다.
 */
export function DebugTab({
  debugMessage,
  debugStatus,
  onChangeDebugMessage,
  onSendDebugMessage,
  terminalLogs,
  autoScroll,
  setAutoScroll,
  commandInput,
  setCommandInput,
  consoleHeight,
  onRunCommand,
  onClearTerminal,
  onConsoleResizeStart,
  onConsoleResizeMove,
  onConsoleResizeEnd,
}: DebugTabProps) {
  /** 콘솔 출력창 DOM 참조 */
  const consoleOutputRef = useRef<HTMLDivElement>(null);

  // 새 로그 도착 시 자동 스크롤을 바닥으로 이동합니다.
  useEffect(() => {
    if (autoScroll && consoleOutputRef.current) {
      const element = consoleOutputRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [terminalLogs, autoScroll]);

  /** 명령 입력 줄 Enter 키 핸들러 — 입력된 명령을 실행하고 입력란을 비웁니다. */
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onRunCommand(commandInput);
      setCommandInput("");
    }
  };

  return (
    <div className="tab-content flex flex-col gap-3">
      {/* 기존 디버그 메시지 송출 카드 */}
      <div className="debug-card">
        <span className="debug-label">서버에 보낼 메시지 (JSON 포맷)</span>
        <textarea
          value={debugMessage}
          onChange={(e) => onChangeDebugMessage(e.target.value)}
          rows={6}
          className="debug-textarea font-mono"
          placeholder="서버로 전달할 JSON 객체를 입력하세요"
        />
        <button onClick={onSendDebugMessage} className="send-button mt-1">
          <span className="material-symbols-outlined text-base">send</span>
          <span>보내기</span>
        </button>
        {debugStatus && (
          <div className="text-[11px] text-sky-300 bg-[#0d131f] p-2 rounded border border-slate-700 break-all">
            {debugStatus}
          </div>
        )}
      </div>

      {/* 하단 터미널 콘솔 (admin 네트워크 모니터링 스타일) */}
      <div
        className="flex flex-col bg-[#0D1117] rounded border border-slate-700 overflow-hidden"
        style={{ height: consoleHeight }}
      >
        {/* 콘솔 높이 조절 리사이즈 바 (상단 테두리를 드래그하면 높이가 조절됩니다) */}
        <div
          onPointerDown={onConsoleResizeStart}
          onPointerMove={onConsoleResizeMove}
          onPointerUp={onConsoleResizeEnd}
          onPointerCancel={onConsoleResizeEnd}
          className="h-2 shrink-0 cursor-row-resize bg-slate-700/50 hover:bg-slate-500/70 transition select-none touch-none"
          title="콘솔 높이 조절 (드래그)"
        />
        {/* 콘솔 헤더 */}
        <div className="px-3 py-2 bg-[#162032] border-b border-slate-700 flex justify-between items-center">
          <span className="text-[11px] text-slate-400">터미널 콘솔</span>
          <div className="flex gap-2">
            <button
              onClick={onClearTerminal}
              className="text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-0.5 rounded transition"
            >
              콘솔 소거
            </button>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`text-[11px] px-2 py-0.5 rounded transition ${
                autoScroll
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-700 hover:bg-slate-600 text-slate-300"
              }`}
            >
              자동 스크롤 {autoScroll ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* 콘솔 출력 창 */}
        <div
          ref={consoleOutputRef}
          className="flex-1 p-3 overflow-y-auto font-mono text-[11px] whitespace-pre-wrap"
        >
          {terminalLogs.length === 0 ? (
            <div className="text-slate-500 text-center py-8">
              터미널 콘솔 준비 완료
            </div>
          ) : (
            terminalLogs.map((log) => (
              <div
                key={log.id}
                className={`break-all whitespace-pre-wrap ${getLogTextColor(log.type)}`}
              >
                <span className="text-slate-600 mr-1.5">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                {log.text}
              </div>
            ))
          )}
        </div>

        {/* 명령어 입력 줄 */}
        <div className="px-3 py-2 bg-[#162032] border-t border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-sky-400 font-bold">&gt;</span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="명령어 입력 (help, status, ping, send, clear...)"
              className="flex-1 bg-transparent border-none outline-none text-slate-100 font-mono text-[11px]"
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
