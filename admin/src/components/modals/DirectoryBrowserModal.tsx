// admin/src/components/modals/DirectoryBrowserModal.tsx

import { useEffect, useState } from 'react';
import {
  BrowseDirectoryEntry,
  BrowseDirectoryResult,
} from '../../types/index.js';
import { browseDirectoryApi } from '../../services/apiService.js';

/** 파일 브라우저 모달 컴포넌트 Props */
interface DirectoryBrowserModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 최초 브라우징 시작 경로 (빈 문자열이면 드라이브 루트) */
  initialPath: string;
  /** 디렉토리 선택 콜백 (선택된 절대 경로 전달) */
  onSelect: (path: string) => void;
  /** 모달 닫기 콜백 */
  onClose: () => void;
}

/**
 * 관리자 대시보드 [환경 설정] 뷰에서 사용하는 파일 브라우저 모달 컴포넌트입니다.
 * 백엔드 GET /api/admin/fs/browse API를 호출해 드라이브 루트부터 전체 파일 시스템의
 * 디렉토리를 탐색하며, 현재 폴더를 선택하면 해당 절대 경로를 콜백으로 반환합니다.
 * 하위 항목은 디렉토리만 표시합니다.
 */
export function DirectoryBrowserModal({
  isOpen,
  initialPath,
  onSelect,
  onClose,
}: DirectoryBrowserModalProps) {
  /** 현재 브라우징 중인 경로/부모/하위 목록 상태 */
  const [result, setResult] = useState<BrowseDirectoryResult>({
    currentPath: '',
    parentPath: null,
    directories: [],
  });
  /** 디렉토리 목록 로딩 중 여부 */
  const [loading, setLoading] = useState(false);
  /** 조회 실패 메시지 (없으면 null) */
  const [error, setError] = useState<string | null>(null);

  /**
   * 지정 경로의 디렉토리 목록을 백엔드로부터 인출해 상태에 반영합니다.
   * 경로가 빈 문자열이면 드라이브 루트 목록이 반환됩니다.
   *
   * @param path - 조회할 디렉토리 절대 경로 (빈 문자열 허용)
   */
  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await browseDirectoryApi(path);
      setResult(data);
    } catch {
      setError('디렉토리 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 모달이 열릴 때 또는 시작 경로가 변경될 때 목록을 재조회합니다.
  useEffect(() => {
    if (isOpen) {
      loadDirectory(initialPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPath]);

  // 모달이 닫혀 있으면 아무것도 렌더링하지 않습니다.
  if (!isOpen) return null;

  /** 현재 폴더 진입 처리 (클릭한 하위 디렉토리 경로) */
  const enterDirectory = (entry: BrowseDirectoryEntry) => {
    loadDirectory(entry.path);
  };

  /** 상위 폴더로 이동 처리 */
  const goParent = () => {
    if (result.parentPath) {
      loadDirectory(result.parentPath);
    }
  };

  /** 현재 폴더를 선택 값으로 확정하고 모달을 닫습니다. */
  const confirmSelection = () => {
    onSelect(result.currentPath);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1E293B] border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 bg-[#111827] border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">
              folder_open
            </span>
            <h3 className="font-bold text-sm text-slate-100">파일 브라우저</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="파일 브라우저 닫기"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-5 flex flex-col gap-3 overflow-hidden flex-1">
          {/* 현재 경로 표시 + 상위 이동 */}
          <div className="flex items-center gap-2 bg-[#111827] border border-slate-800 rounded-lg px-3 py-2">
            <button
              onClick={goParent}
              disabled={!result.parentPath || loading}
              aria-label="상위 폴더로 이동"
              title="상위 폴더"
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
            <span className="flex-1 truncate font-mono text-xs text-slate-300">
              {result.currentPath || '(드라이브 루트 선택)'}
            </span>
          </div>

          {/* 로딩/에러/목록 영역 */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 py-8">
              불러오는 중...
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-sm text-[#EA4335]">
              <span>{error}</span>
            </div>
          ) : result.directories.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 py-8">
              하위 디렉토리가 없습니다.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg bg-[#0F172A]">
              <ul className="divide-y divide-slate-800">
                {result.directories.map((entry) => (
                  <li key={entry.path}>
                    <button
                      onClick={() => enterDirectory(entry)}
                      aria-label={`${entry.name} 폴더 열기`}
                      title={entry.path}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 transition"
                    >
                      <span className="material-symbols-outlined text-slate-400 text-base">
                        folder
                      </span>
                      <span className="truncate">{entry.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-3 bg-[#111827] border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-4 py-2 rounded-lg transition"
          >
            취소
          </button>
          <button
            onClick={confirmSelection}
            disabled={!result.currentPath || loading}
            className="bg-[#1A73E8] hover:bg-[#185ABC] text-white text-xs px-4 py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            현재 폴더 선택
          </button>
        </div>
      </div>
    </div>
  );
}
