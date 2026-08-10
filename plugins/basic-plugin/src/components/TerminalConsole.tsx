// plugins/basic-plugin/src/components/TerminalConsole.tsx

import { useEffect, useRef } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { PluginLogEntry } from "../types";

/** 터미널 콘솔 컴포넌트 Props */
interface TerminalConsoleProps {
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
 * 공통 터미널 콘솔 컴포넌트입니다.
 * 모든 탭 페이지 하단 맨 아래에 동일하게 배치되며,
 * 리사이즈 바, 콘솔 소거, 자동 스크롤 토글, 명령어 입력을 제공합니다.
 * 외곽에 하늘색 아웃라인과 개선된 스크롤바 스타일을 적용합니다.
 */
export function TerminalConsole({
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
}: TerminalConsoleProps) {
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
    <div className="terminal-console" style={{ height: consoleHeight }}>
      {/* 콘솔 높이 조절 리사이즈 바 (상단 테두리를 드래그하면 높이가 조절됩니다) */}
      <div
        onPointerDown={onConsoleResizeStart}
        onPointerMove={onConsoleResizeMove}
        onPointerUp={onConsoleResizeEnd}
        onPointerCancel={onConsoleResizeEnd}
        className="h-2 shrink-0 cursor-row-resize bg-slate-700/50 hover:bg-sky-500/70 transition select-none touch-none"
        title="콘솔 높이 조절 (드래그)"
      />
      {/* 콘솔 헤더 */}
      <div className="px-3 py-2 bg-[#0d131f] border-b border-slate-700/80 flex justify-between items-center">
        <span className="text-[11px] font-semibold text-slate-400">
          터미널 콘솔
        </span>
        <div className="flex gap-2">
          <button
            onClick={onClearTerminal}
            className="btn-mini"
          >
            콘솔 소거
          </button>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`btn-mini ${autoScroll ? "on" : ""}`}
          >
            자동 스크롤 {autoScroll ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* 콘솔 출력 창 */}
      <div ref={consoleOutputRef} className="terminal-output">
        {terminalLogs.length === 0 ? (
          <div className="text-slate-500 text-center py-8">
            터미널 콘솔 준비 완료
          </div>
        ) : (
          terminalLogs.map((log) => (
            <div
              key={log.id}
              className={`terminal-log-line break-all whitespace-pre-wrap ${getLogTextColor(log.type)}`}
            >
              <span className="terminal-log-time">
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </span>
              <span className="flex-1 min-w-0">{log.text}</span>
            </div>
          ))
        )}
      </div>

      {/* 명령어 입력 줄 */}
      <div className="px-3 py-2 bg-[#0d131f] border-t border-slate-700/80">
        <div className="terminal-input">
          <span className="terminal-input-prompt">&gt;</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="명령어 입력 (help, status, ping, send, clear...)"
            className="terminal-input-field"
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
