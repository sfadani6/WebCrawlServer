// admin/src/components/modals/NodeConfigModal.tsx

import { useState, useEffect } from 'react';
import { Client } from '../../types/index.js';

/** 노드 환경설정 모달 컴포넌트 Props */
interface NodeConfigModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 선택된 타깃 클라이언트 객체 */
  client: Client | null;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /**
   * 환경설정 저장 콜백 함수
   * @param clientId - 대상 노드 UUID
   * @param alias - 노드 한글 별칭
   */
  onSave: (clientId: string, alias: string) => Promise<boolean>;
}

/**
 * 특정 수집 노드(클라이언트)의 한글 별칭(Alias)을 설정하는 모달 컴포넌트입니다.
 * 4컬럼 재구성에 따라 별칭만 관리하며, 별칭은 플러그인 환경설정에서도 저장할 수 있습니다.
 * Material Symbols 아이콘 및 GCP 다크 테마를 준수합니다.
 */
export function NodeConfigModal({
  isOpen,
  client,
  onClose,
  onSave
}: NodeConfigModalProps) {
  // 모달이 닫혀 있거나 타깃 클라이언트 미선택 시 렌더링 생략
  if (!isOpen || !client) return null;

  /** 노드 한글 별칭 입력 상태 */
  const [alias, setAlias] = useState(client.alias || '');
  /** 저장 진행 중 로딩 상태 */
  const [isSaving, setIsSaving] = useState(false);

  // 타깃 클라이언트 변경 시 입력 폼 초기값 동기화
  useEffect(() => {
    setAlias(client.alias || '');
  }, [client]);

  /** 설정 저장 핸들러: 저장 진행 중 상태 전환 및 콜백 호출 */
  const handleSave = async () => {
    setIsSaving(true);
    await onSave(client.client_id, alias);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1E293B] border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* 모달 헤더 */}
        <div className="px-6 py-4 bg-[#111827] border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">settings</span>
            노드 환경설정 [{client.client_id.slice(0, 8)}]
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* 모달 입력 폼 바디 */}
        <div className="p-6 flex flex-col gap-4 text-xs font-sans">

          {/* 노드 한글 별칭 입력 */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">노드 한글 별칭 (Alias)</label>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="예: 오페라-개인-수집기-1"
              className="w-full p-2.5 bg-[#0F172A] border border-slate-700 rounded text-slate-100 outline-none focus:border-[#1A73E8]"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              별칭은 플러그인 환경설정 탭에서도 동일하게 저장할 수 있으며, 수시로 변경 가능합니다.
            </p>
          </div>
        </div>

        {/* 모달 푸터: 취소 및 저장 버튼 */}
        <div className="px-6 py-3 bg-[#111827] border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 transition"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-[#1A73E8] hover:bg-[#185abc] text-white rounded font-semibold transition"
          >
            {isSaving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
