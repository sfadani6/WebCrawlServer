// plugins/basic-plugin/src/components/ActionHelpModal.tsx

import { useEffect } from "react";

/** 액션 도움말 팝업의 개별 섹션 정의 */
export interface ActionHelpSection {
  /** 섹션 소제목 (본문 앞 굵은 라벨로 표시) */
  heading: string;
  /** 섹션 본문 문단 목록 (순서대로 줄바꿈 렌더링) */
  paragraphs: string[];
}

/** 액션 도움말 레이어 팝업 컴포넌트 Props */
interface ActionHelpModalProps {
  /** 팝업 표시 여부 (false일 때 아무것도 렌더링하지 않음) */
  open: boolean;
  /** 팝업 최상단 제목 */
  title: string;
  /** 도움말 본문 섹션 목록 (정의 순서대로 표시) */
  sections: ActionHelpSection[];
  /** 팝업 닫기 콜백 (✕ 버튼·배경 클릭·ESC 공통) */
  onClose: () => void;
}

/**
 * 액션 실행 카드의 도움말 레이어 팝업 컴포넌트입니다.
 * 버튼 옆 "?" 아이콘 클릭 시 화면 전체 오버레이 위에 상세 도움말을 표시하며,
 * 닫기 버튼(✕)·배경 클릭·ESC 키 세 가지 경로로 닫을 수 있습니다.
 *
 * @param props - open/title/sections/onClose 참조
 * @returns 열려 있을 때 도움말 오버레이 JSX, 닫혀 있으면 null
 */
export function ActionHelpModal({ open, title, sections, onClose }: ActionHelpModalProps) {
  // ESC 키 입력으로 팝업을 닫는 전역 키보드 리스너 (열려 있는 동안에만 등록)
  useEffect(() => {
    if (!open) return undefined;

    /**
     * ESC 키 입력을 감지해 팝업을 닫는 핸들러
     *
     * @param event - 키보드 이벤트 객체
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // 배경 오버레이 — 영역 밖 클릭 시에도 팝업을 닫는다
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={onClose}
    >
      {/* 도움말 다이얼로그 본체 — 내부 클릭이 배경으로 전파되지 않도록 차단 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[340px] max-h-[70vh] flex flex-col rounded-xl border border-[#26334d] bg-[#162032] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* 헤더 — 제목과 닫기(✕) 버튼 */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#1e293b]">
          <h2 className="text-[12px] font-bold text-slate-200 truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="도움말 닫기"
            title="닫기 (ESC)"
            className="btn-mini shrink-0 leading-none"
          >
            ✕
          </button>
        </div>

        {/* 본문 — 정의된 도움말 섹션을 순서대로 렌더링 (길면 세로 스크롤) */}
        <div className="overflow-y-auto px-3 py-3 space-y-3">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-1">
              <h3 className="text-[11px] font-bold text-sky-400">{section.heading}</h3>
              {section.paragraphs.map((paragraph, index) => (
                <p
                  key={`${section.heading}-${index}`}
                  className="text-[11px] text-slate-400 leading-relaxed"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
