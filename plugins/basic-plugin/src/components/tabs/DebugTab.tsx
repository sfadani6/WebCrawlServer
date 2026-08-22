// plugins/basic-plugin/src/components/tabs/DebugTab.tsx

import { useMemo } from "react";

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
}

/**
 * 디버그 탭 UI 컴포넌트.
 * 서버에 디버그 메시지(JSON)를 전송하는 송출 카드만 담당합니다.
 * 입력값의 JSON 유효성을 실시간으로 검사해 전송 전 오류를 즉시 안내하고,
 * 유효하지 않은 JSON은 전송 버튼을 비활성화합니다.
 * 터미널 콘솔은 모든 탭 하단 공통 컴포넌트(TerminalConsole)로 분리되었습니다.
 *
 * @param props - debugMessage/debugStatus/onChangeDebugMessage/onSendDebugMessage 참조
 * @returns 디버그 탭 JSX
 */
export function DebugTab({
  debugMessage,
  debugStatus,
  onChangeDebugMessage,
  onSendDebugMessage,
}: DebugTabProps) {
  /**
   * 입력된 디버그 메시지의 JSON 유효성 검증 결과.
   * 빈 입력 또는 유효한 JSON이면 null, 파싱 실패 시 오류 안내 문구를 반환합니다.
   */
  const jsonValidationError = useMemo(() => {
    const trimmed = debugMessage.trim();
    if (trimmed.length === 0) return null;
    try {
      JSON.parse(trimmed);
      return null;
    } catch {
      return "올바른 JSON 형식이 아닙니다. 따옴표·쉼표·중괄호 짝을 확인하세요.";
    }
  }, [debugMessage]);

  return (
    <div className="tab-content flex flex-col gap-3">
      {/* 기존 디버그 메시지 송출 카드 */}
      <div className="debug-card">
        <span className="debug-label">서버에 보낼 메시지 (JSON 포맷)</span>
        <textarea
          value={debugMessage}
          onChange={(e) => onChangeDebugMessage(e.target.value)}
          rows={6}
          aria-label="서버로 전송할 JSON 메시지 입력"
          aria-invalid={jsonValidationError !== null}
          className="debug-textarea font-mono"
          placeholder="서버로 전달할 JSON 객체를 입력하세요"
        />
        {/* JSON 유효성 실시간 피드백 — 파싱 실패 시 오류 박스 표시 + 전송 차단 */}
        {jsonValidationError && (
          <div
            role="alert"
            className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/30 break-all"
          >
            {jsonValidationError}
          </div>
        )}
        <button
          onClick={onSendDebugMessage}
          disabled={jsonValidationError !== null}
          aria-label="디버그 메시지 서버 전송"
          title={
            jsonValidationError
              ? "JSON 오류를 수정한 뒤 전송할 수 있습니다"
              : "입력한 JSON을 서버로 전송"
          }
          className="btn-primary mt-1"
        >
          <span>{jsonValidationError ? "JSON 오류 — 전송 불가" : "보내기"}</span>
        </button>
        {debugStatus && (
          <div className="text-[11px] text-sky-300 bg-[#0d131f] p-2 rounded border border-slate-700 break-all">
            {debugStatus}
          </div>
        )}
      </div>
    </div>
  );
}
