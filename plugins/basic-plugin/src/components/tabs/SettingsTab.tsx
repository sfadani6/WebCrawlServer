// plugins/basic-plugin/src/components/tabs/SettingsTab.tsx

interface SettingsTabProps {
  /** 현재 설정된 노드 한글 별칭 */
  alias: string;
  /** 별칭 입력 값 변경 핸들러 */
  onAliasChange: (value: string) => void;
  /** 서버 저장 진행/결과 상태 메시지 */
  configSaveStatus: string;
  /** 별칭 저장 버튼 클릭 핸들러 */
  onSave: () => void;
}

/**
 * 플러그인 환경설정 탭 컴포넌트입니다.
 * 사용자가 자신의 노드 한글 별칭을 설정하고 저장 버튼을 누르면,
 * 서버로 CLIENT_CONFIG_UPDATE 패킷이 전송되어 clients 테이블 alias에 반영됩니다.
 * 별칭은 수시로 변경할 수 있으며, 로컬 스토리지에도 보관되어 재로드 시 유지됩니다.
 */
export function SettingsTab({
  alias,
  onAliasChange,
  configSaveStatus,
  onSave,
}: SettingsTabProps) {
  return (
    <div className="tab-content">
      <div className="info-section">
        <div className="info-section-title">
          <span className="material-symbols-outlined text-sm text-blue-400">settings</span>
          <span>노드 환경 설정</span>
        </div>

        <div className="flex flex-col gap-3">
          {/* 별칭 입력 필드 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-semibold">노드 한글 별칭 (Alias)</label>
            <input
              type="text"
              value={alias}
              onChange={(e) => onAliasChange(e.target.value)}
              placeholder="예: 오페라-개인-수집기-1"
              className="w-full p-2.5 bg-[#0F172A] border border-slate-700 rounded text-slate-100 outline-none focus:border-[#1A73E8] text-xs"
            />
            <p className="text-[10px] text-slate-500">
              별칭은 서버의 clients 테이블에 저장되며, 관리자 대시보드 노드 목록에 표시됩니다.
            </p>
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={onSave}
            className="px-4 py-2.5 bg-[#1A73E8] hover:bg-[#185abc] text-white rounded font-semibold text-xs transition w-full"
          >
            별칭 저장
          </button>

          {/* 저장 상태 메시지 */}
          {configSaveStatus && (
            <div className="text-[11px] text-emerald-400">{configSaveStatus}</div>
          )}
        </div>
      </div>
    </div>
  );
}
