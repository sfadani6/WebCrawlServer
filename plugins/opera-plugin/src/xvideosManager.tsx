// plugins/opera-plugin/src/xvideosManager.tsx

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';

import { useXvideosDownloadManager } from './hooks/useXvideosDownloadManager';
import { XvideosManagerView } from './components/XvideosManagerView';

/**
 * xvideos 다운로드 매니저 전용 팝업 창 엔트리 컴포넌트입니다.
 * 사이드바가 전달한 ?tabId= 쿼리로 대상 xvideos 탭을 식별하고,
 * 목록 생성/순차 다운로드/초기화를 전용 창에서 독립 수행합니다.
 * (패널 폭이 좁은 사이드바 대신 새 팝업 창에서 넓은 목록 UI 제공)
 */
export default function XvideosManager() {
  /** 대상 xvideos 탭 ID (쿼리 파싱 + 폴백 조회 결과) */
  const [tabId, setTabId] = useState<number | null>(null);
  /** 탭 미발견 등 초기화 실패 안내 */
  const [initError, setInitError] = useState("");
  const manager = useXvideosDownloadManager();

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

      // 2) 폴백: 열려 있는 xvideos 탭 검색
      try {
        const tabs = await chrome.tabs.query({ url: "*://*.xvideos.com/*" });
        const found = tabs.find((t) => typeof t.id === "number");
        if (found && typeof found.id === "number") {
          setTabId(found.id);
          return;
        }
      } catch {
        // 폴백 조회 실패 — 아래 오류 안내로 처리
      }

      if (!cancelled) {
        setInitError(
          "xvideos.com 탭을 찾을 수 없습니다. xvideos.com 페이지를 연 상태에서 매니저를 다시 열어 주세요.",
        );
      }
    };
    void resolveTab();
    return () => {
      cancelled = true;
    };
  }, []);

  // 목록 생성 상태 (초기 로드 시 자동 1회 생성)
  const [builtOnce, setBuiltOnce] = useState(false);
  useEffect(() => {
    if (tabId !== null && !builtOnce && !initError) {
      setBuiltOnce(true);
      void manager.buildList(tabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, builtOnce, initError]);

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

  return <XvideosManagerView manager={manager} tabId={tabId} />;
}

// React 앱 루트 마운트
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <XvideosManager />
    </React.StrictMode>
  );
}
