// plugins/basic-plugin/src/actionRunner.tsx

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./popup.css";

import { useBestOfRedRunner } from "./hooks/useBestOfRedRunner";
import { ActionRunnerView } from "./components/ActionRunnerView";

/**
 * 액션 실행기 전용 팝업 창 엔트리 컴포넌트입니다.
 * 베이스 탭 "액션 실행" 섹션의 액션 모듈이 전달한 ?module=&tabId= 쿼리로
 * 대상 탭을 식별하고, 해당 액션(현재 xvideos 페이징 액션)을 전용 창에서 독립 수행합니다.
 * 진행 로그(이동 중/브라우저 로딩 완료/데이터 수집/서버 저장)를 콘솔 형태로 출력합니다.
 *
 * 지원 모듈: module=best-of-red
 */
export default function ActionRunner() {
  /** 대상 탭 ID (쿼리 파싱 + 폴백 조회 결과) */
  const [tabId, setTabId] = useState<number | null>(null);
  /** 탭 미발견 등 초기화 실패 안내 */
  const [initError, setInitError] = useState("");
  /** 실행기 훅 (상태·로그·시작/중지) */
  const runner = useBestOfRedRunner();

  useEffect(() => {
    let cancelled = false;
    const resolveTab = async () => {
      // 1) 쿼리 파라미터의 tabId 우선 사용
      try {
        const queryId = Number(
          new URL(location.href).searchParams.get("tabId") || ""
        );
        if (Number.isInteger(queryId) && queryId > 0) {
          const tab = await chrome.tabs.get(queryId);
          if (tab && typeof tab.id === "number") {
            setTabId(tab.id);
            return;
          }
        }
      } catch {
        // 탭이 닫혔거나 접근 불가 — URL 기반 폴백 진행
      }

      // 2) 폴백: 열려 있는 xvideos.com/xvideos.red 페이징 탭 검색
      try {
        const tabs = await chrome.tabs.query({
          url: ["*://*.xvideos.com/*", "*://*.xvideos.red/*"],
        });
        const found =
          tabs.find((t) =>
            t.url ? /\/(?:[^/]+)\/\d{4}-\d{2}/.test(t.url) : false,
          ) || tabs.find((t) => typeof t.id === "number");
        if (found && typeof found.id === "number") {
          setTabId(found.id);
          return;
        }
      } catch {
        // 폴백 조회 실패 — 아래 오류 안내로 처리
      }

      if (!cancelled) {
        setInitError(
          "xvideos 페이징 페이지 탭을 찾을 수 없습니다. xvideos.com 또는 xvideos.red 페이징 페이지(예: /best/2026-03)를 연 상태에서 액션을 다시 실행해 주세요.",
        );
      }
    };
    void resolveTab();
    return () => {
      cancelled = true;
    };
  }, []);

  if (initError) {
    return (
      <div className="w-full min-h-screen bg-[#0d131f] text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="text-center max-w-sm">
          <p className="text-[12px] text-red-400 leading-relaxed">{initError}</p>
          <button onClick={() => window.close()} className="btn-primary mt-4">
            <span>창 닫기</span>
          </button>
        </div>
      </div>
    );
  }

  if (tabId === null) {
    return (
      <div className="w-full min-h-screen bg-[#0d131f] text-slate-100 flex items-center justify-center p-4 font-sans">
        <p className="text-[12px] text-slate-400">대상 탭 확인 중...</p>
      </div>
    );
  }

  return <ActionRunnerView runner={runner} tabId={tabId} />;
}

// React 앱 루트 마운트
const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ActionRunner />
    </React.StrictMode>
  );
}
