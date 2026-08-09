// admin/src/components/views/ConfigSettingsView.tsx

import { useState } from 'react';
import { ConfigEntry } from '../../types/index.js';
import { DirectoryBrowserModal } from '../modals/DirectoryBrowserModal.js';

/** 환경 설정 뷰 컴포넌트 Props */
interface ConfigSettingsViewProps {
  /** 시스템 환경 설정 항목 배열 */
  configs: ConfigEntry[];
  /** 특정 설정 항목 값 수정 콜백 (성공 여부 반환) */
  onSaveConfig: (key: string, value: string) => Promise<boolean>;
}

/**
 * 관리자 대시보드 [환경 설정] 뷰 컴포넌트입니다.
 * configs 테이블(변수명/값/코멘트)에 시드된 설정 항목을 테이블로 나열하고,
 * 각 항목의 값(value)만 인라인 수정·저장할 수 있도록 제공합니다.
 * 코멘트(description)는 읽기 전용 표시이며, 키 추가/삭제는 지원하지 않습니다.
 */
export function ConfigSettingsView({
  configs,
  onSaveConfig,
}: ConfigSettingsViewProps) {
  /** 행별 편집 중인 값 상태 (key → 입력값) */
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  /** 행별 저장 상태 피드백 메시지 (key → message) */
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  /** 행별 저장 진행 중 여부 (key → boolean) */
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  /** 파일 브라우저 모달 열림 여부 */
  const [browserOpen, setBrowserOpen] = useState(false);
  /** 파일 브라우저로 값 선택 중인 설정 키 */
  const [browserTargetKey, setBrowserTargetKey] = useState('');

  /**
   * 파일 브라우저 버튼 클릭 시 대상 설정 키의 모달을 엽니다.
   *
   * @param key - 경로 선택 대상 설정 변수명
   */
  const openBrowser = (key: string) => {
    setBrowserTargetKey(key);
    setBrowserOpen(true);
  };

  /**
   * 파일 브라우저에서 선택된 경로를 해당 설정의 입력 값에 반영합니다.
   *
   * @param path - 선택된 디렉토리 절대 경로
   */
  const applyBrowserSelection = (path: string) => {
    if (browserTargetKey) {
      handleChange(browserTargetKey, path);
    }
    setBrowserOpen(false);
  };

  /**
   * 특정 행의 입력 값을 상태에 반영합니다.
   *
   * @param key - 설정 변수명
   * @param value - 새 입력값
   */
  const handleChange = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    setFeedback((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /**
   * 저장 버튼 클릭 시 해당 설정 값을 저장하고 결과 피드백을 표시합니다.
   *
   * @param entry - 대상 설정 항목
   */
  const handleSave = async (entry: ConfigEntry) => {
    const newValue = editValues[entry.key] ?? entry.value;
    setSavingKeys((prev) => ({ ...prev, [entry.key]: true }));
    const success = await onSaveConfig(entry.key, newValue);
    setSavingKeys((prev) => ({ ...prev, [entry.key]: false }));
    setFeedback((prev) => ({
      ...prev,
      [entry.key]: success ? '저장 완료' : '저장 실패',
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 환경 설정 개요 카드 */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-lg shadow-sm">
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1A73E8]">
              settings
            </span>
            <h2 className="text-base font-semibold text-slate-100">
              시스템 환경 설정
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            서버 기동 시 server/configs.json 디폴트 값으로 시드된 설정 항목입니다.
            항목의 값(value)만 수정할 수 있으며 코멘트는 읽기 전용입니다.
          </p>
        </div>

        {/* 설정 항목 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#111827] text-slate-400 border-b border-slate-800">
                <th className="p-3 font-medium w-48">변수명 (KEY)</th>
                <th className="p-3 font-medium">값 (VALUE)</th>
                <th className="p-3 font-medium w-72">코멘트</th>
                <th className="p-3 font-medium w-24 text-right">저장</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {configs.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-6 text-center text-sm text-slate-400"
                  >
                    등록된 환경 설정 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                configs.map((entry) => {
                  const editingValue = editValues[entry.key] ?? entry.value;
                  const isSaving = savingKeys[entry.key] ?? false;
                  const message = feedback[entry.key];
                  const isDirty = editingValue !== entry.value;

                  return (
                    <tr key={entry.key} className="hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <span className="font-mono text-xs font-semibold text-[#1A73E8]">
                          {entry.key}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            aria-label={`${entry.key} 값 입력`}
                            type="text"
                            value={editingValue}
                            onChange={(event) =>
                              handleChange(entry.key, event.target.value)
                            }
                            className="flex-1 bg-[#0F172A] border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#1A73E8]"
                          />
                          {entry.key === 'data_path' && (
                            <button
                              onClick={() => openBrowser(entry.key)}
                              aria-label="파일 브라우저 열기"
                              title="파일 브라우저로 디렉토리 선택"
                              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 rounded text-xs font-medium transition bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            >
                              <span className="material-symbols-outlined text-base">
                                folder_open
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-slate-400">
                        {entry.description || '-'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleSave(entry)}
                          disabled={isSaving || !isDirty}
                          aria-label={`${entry.key} 저장`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed bg-[#1A73E8] hover:bg-[#185ABC] text-white"
                        >
                          {isSaving ? '저장 중...' : '저장'}
                        </button>
                        {message && (
                          <span
                            className={`block text-[11px] mt-1 ${
                              message === '저장 완료'
                                ? 'text-[#34A853]'
                                : 'text-[#EA4335]'
                            }`}
                          >
                            {message}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 파일 브라우저 모달 */}
      <DirectoryBrowserModal
        isOpen={browserOpen}
        initialPath={
          browserTargetKey
            ? (editValues[browserTargetKey] ?? '')
            : ''
        }
        onSelect={applyBrowserSelection}
        onClose={() => setBrowserOpen(false)}
      />
    </div>
  );
}
