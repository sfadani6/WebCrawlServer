// plugins/basic-plugin/src/components/tabs/SettingsTab.tsx

import type { ConfigSaveState } from "../../types";

/** 저장 결과 배지 색상·라벨 매핑 (configSaveState별 표시 정보) */
const SAVE_STATE_BADGE: Record<ConfigSaveState, { label: string; className: string }> = {
  idle: { label: "대기", className: "save-status-idle" },
  pending: { label: "저장 중", className: "save-status-pending" },
  success: { label: "성공", className: "save-status-success" },
  error: { label: "실패", className: "save-status-error" },
  warning: { label: "경고", className: "save-status-warning" },
};

interface SettingsTabProps {
  /** 현재 설정된 노드 한글 별칭 */
  alias: string;
  /** 별칭 입력 값 변경 핸들러 */
  onAliasChange: (value: string) => void;
  /** 서버 저장 진행/결과 상태 메시지 */
  configSaveStatus: string;
  /** 저장 진행 상태 구분자 (배지 색상 결정) */
  configSaveState: ConfigSaveState;
  /** 별칭 저장 버튼 클릭 핸들러 */
  onSave: () => void;
}

/**
 * 플러그인 환경설정 탭 컴포넌트입니다.
 * 사용자가 자신의 노드 한글 별칭을 설정하고 저장 버튼을 누르면,
 * 서버로 CLIENT_CONFIG_UPDATE 패킷이 전송되어 clients 테이블 alias에 반영됩니다.
 * 별칭은 수시로 변경할 수 있으며, 로컬 스토리지에도 보관되어 재로드 시 유지됩니다.
 * 저장 결과는 상태 배지(성공/실패/저장 중/경고)로 즉시 구별됩니다.
 *
 * @param props - alias/onAliasChange/configSaveStatus/configSaveState/onSave 참조
 * @returns 환경설정 탭 JSX
 */
export function SettingsTab({
  alias,
  onAliasChange,
  configSaveStatus,
  configSaveState,
  onSave,
}: SettingsTabProps) {
  /** 현재 저장 상태에 대응하는 배지 표시 정보 (미지원 상태는 idle로 폴백) */
  const badge = SAVE_STATE_BADGE[configSaveState] ?? SAVE_STATE_BADGE.idle;

  return (
    <div className="tab-content">
      <div className="info-section">
        <div className="info-section-title">
          <span>노드 환경 설정</span>
        </div>

        <div className="flex flex-col gap-3">
          {/* 별칭 입력 필드 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="node-alias-input" className="text-xs text-slate-400 font-semibold">
              노드 한글 별칭 (Alias)
            </label>
            <input
              id="node-alias-input"
              type="text"
              value={alias}
              onChange={(e) => onAliasChange(e.target.value)}
              placeholder="예: 오페라-개인-수집기-1"
              className="w-full p-2.5 bg-[#0F172A] border border-slate-700 rounded text-slate-100 outline-none focus:border-[#38bdf8] text-xs"
            />
            <p className="text-[10px] text-slate-500">
              별칭은 서버의 clients 테이블에 저장되며, 관리자 대시보드 노드 목록에 표시됩니다.
            </p>
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={onSave}
            aria-label="노드 별칭 저장"
            className="btn-primary"
          >
            별칭 저장
          </button>

          {/* 저장 상태 배지 — 성공/실패/저장 중/경고를 색상으로 즉시 구별 */}
          {configSaveStatus && (
            <div
              role="status"
              className={`save-status-badge ${badge.className}`}
              data-state={configSaveState}
            >
              <span className="save-status-chip">{badge.label}</span>
              <span className="min-w-0 break-all">{configSaveStatus}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
