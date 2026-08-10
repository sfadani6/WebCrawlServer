// admin/src/components/modals/ValuePreviewModal.tsx

import { useEffect, useMemo, useState } from 'react';

/** 셀 값 전체 미리보기 모달 컴포넌트 Props */
interface ValuePreviewModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 모달 제목 (테이블명.컬럼명 등) */
  title: string;
  /** 표시할 전체 값 문자열 */
  content: string;
  /** 모달 닫기 콜백 */
  onClose: () => void;
}

/**
 * DB 관리 그리드(DbDataGrid)의 긴 셀 값 전체를 표시하는 레이어 모달 컴포넌트입니다.
 * 현재 브라우저 창 높이(window.innerHeight)를 기준으로 레이어 높이를 산정하고,
 * 본문은 overflow-y auto 스크롤로 긴 문자열(HTML 원문 등)을 자유롭게 볼 수 있습니다.
 * 닫기 버튼, 배경(backdrop) 클릭, ESC 키로 닫습니다.
 */
export function ValuePreviewModal({
  isOpen,
  title,
  content,
  onClose,
}: ValuePreviewModalProps) {
  /** 브라우저 창 높이 기준 레이어 최대 높이 (px) */
  const [maxHeight, setMaxHeight] = useState(600);

  // 모달이 열릴 때 현재 창 높이를 기준으로 레이어 최대 높이를 산정합니다.
  useEffect(() => {
    if (isOpen) {
      setMaxHeight(Math.max(320, window.innerHeight - 120));
    }
  }, [isOpen]);

  // ESC 키로 모달을 닫습니다.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 줄 수(대략적)와 문자열 길이 정보를 미리 계산해 헤더에 표시합니다.
  const contentInfo = useMemo(() => {
    const lines = content.split('\n').length;
    const chars = content.length;
    return `${chars.toLocaleString()}자 · ${lines.toLocaleString()}줄`;
  }, [content]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight }}
        className="bg-[#1E293B] border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
      >
        {/* 모달 헤더 */}
        <div className="px-6 py-4 bg-[#111827] border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-blue-400">
              visibility
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-100 truncate">
                값 미리보기 · {title}
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {contentInfo}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="미리보기 닫기"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition shrink-0"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* 모달 본문 (스크롤 영역) */}
        <div className="overflow-y-auto flex-1">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-200 leading-relaxed p-6">
            {content || '(빈 값)'}
          </pre>
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-3 bg-[#111827] border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="bg-[#1A73E8] hover:bg-[#185ABC] text-white text-xs px-4 py-2 rounded-lg transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
