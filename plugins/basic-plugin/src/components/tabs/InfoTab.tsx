// plugins/basic-plugin/src/components/tabs/InfoTab.tsx

import { BrowserInfo, ProcessorInfo } from '../../types';

interface InfoTabProps {
  browserInfo: BrowserInfo | null;
  processorInfo: ProcessorInfo | null;
}

export function InfoTab({ browserInfo, processorInfo }: InfoTabProps) {
  return (
    <div className="tab-content">
      <div className="info-section">
        <div className="info-section-title">
          <span className="material-symbols-outlined text-sm text-sky-400">browser_updated</span>
          <span>브라우저 정보</span>
        </div>
        {browserInfo ? (
          <div className="info-grid">
            <div className="info-row">
              <span className="info-key">플랫폼</span>
              <span className="info-value">{browserInfo.platform}</span>
            </div>
            <div className="info-row">
              <span className="info-key">언어</span>
              <span className="info-value">{browserInfo.language}</span>
            </div>
            <div className="info-row">
              <span className="info-key">벤더</span>
              <span className="info-value">{browserInfo.vendor}</span>
            </div>
            <div className="info-row">
              <span className="info-key">네트워크 상태</span>
              <span className="info-value">
                {browserInfo.onlineStatus ? '온라인 (Online)' : '오프라인 (Offline)'}
              </span>
            </div>
            <div className="info-row flex-col items-start gap-1">
              <span className="info-key">User-Agent</span>
              <span className="info-value-block font-mono text-[10px] break-all">
                {browserInfo.userAgent}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400">정보 인출 중...</div>
        )}
      </div>

      <div className="info-section">
        <div className="info-section-title">
          <span className="material-symbols-outlined text-sm text-emerald-400">memory</span>
          <span>브라우저 프로세서 정보</span>
        </div>
        {processorInfo ? (
          <div className="info-grid">
            <div className="info-row">
              <span className="info-key">논리 CPU 코어 수</span>
              <span className="info-value font-mono">{processorInfo.hardwareConcurrency} 코어</span>
            </div>
            {processorInfo.deviceMemory && (
              <div className="info-row">
                <span className="info-key">디바이스 메모리</span>
                <span className="info-value font-mono">약 {processorInfo.deviceMemory} GB</span>
              </div>
            )}
            <div className="info-row">
              <span className="info-key">최대 터치 포인트</span>
              <span className="info-value font-mono">{processorInfo.maxTouchPoints} 개</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400">정보 인출 중...</div>
        )}
      </div>
    </div>
  );
}