// admin/src/components/views/db/StorageMonitorPanel.tsx

import { StorageInfo } from "../../../types/index.js";
import { formatBytes, formatDateTime } from "../../../utils/format.js";

/** StorageMonitorPanel 컴포넌트 Props */
interface StorageMonitorPanelProps {
  /** 스토리지 모니터링 정보 */
  storageInfo: StorageInfo | null;
  /** 정보 갱신 콜백 */
  onRefresh: () => void;
}

/**
 * 스토리지 모니터링 패널 컴포넌트입니다.
 * 물리 저장소 용량(파일 수/총 용량), DB 파일별 크기 막대, 백업 용량을 표시합니다.
 */
export function StorageMonitorPanel({ storageInfo, onRefresh }: StorageMonitorPanelProps) {
  /** DB 파일 중 가장 큰 크기 (막대 비율 기준) */
  const maxDbSize = Math.max(
    ...(storageInfo?.dbFiles || []).map((file) => file.sizeBytes),
    1
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 메트릭 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#202124] border border-gray-800 rounded p-4">
          <div className="text-[11px] font-medium text-gray-400">STORAGE ROOT</div>
          <div className="mt-2 text-sm font-bold text-slate-100 font-mono truncate">
            {storageInfo?.storageRootPath || "-"}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {storageInfo?.exists ? "존재" : "미존재"}
          </div>
        </div>
        <div className="bg-[#202124] border border-gray-800 rounded p-4">
          <div className="text-[11px] font-medium text-gray-400">TOTAL FILES</div>
          <div className="mt-2 text-2xl font-bold text-blue-400 font-mono">
            {storageInfo?.fileCount ?? 0}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">물리 저장 파일 수</div>
        </div>
        <div className="bg-[#202124] border border-gray-800 rounded p-4">
          <div className="text-[11px] font-medium text-gray-400">TOTAL SIZE</div>
          <div className="mt-2 text-2xl font-bold text-green-400 font-mono">
            {formatBytes(storageInfo?.totalBytes ?? 0)}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">저장소 총 용량</div>
        </div>
        <div className="bg-[#202124] border border-gray-800 rounded p-4">
          <div className="text-[11px] font-medium text-gray-400">BACKUPS SIZE</div>
          <div className="mt-2 text-2xl font-bold text-yellow-400 font-mono">
            {formatBytes(storageInfo?.backupsBytes ?? 0)}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">백업 디렉터리 용량</div>
        </div>
      </div>

      {/* DB 파일 크기 목록 */}
      <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c] flex justify-between items-center">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            Database Files ({storageInfo?.dbFiles.length ?? 0})
          </span>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded transition border border-slate-700"
          >
            새로고침
          </button>
        </div>
        <div className="p-4">
          {!storageInfo || storageInfo.dbFiles.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm font-sans">
              DB 파일이 없습니다.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#111827] text-slate-300 border-b border-slate-800 text-[11px] font-semibold">
                  <th className="p-3">DB 파일</th>
                  <th className="p-3">테이블 수</th>
                  <th className="p-3">수정일</th>
                  <th className="p-3">크기</th>
                  <th className="p-3 w-1/3">사용량</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-200">
                {storageInfo.dbFiles.map((file) => {
                  const ratio = Math.max(2, Math.round((file.sizeBytes / maxDbSize) * 100));
                  return (
                    <tr key={file.dbRel} className="hover:bg-[#2d2e31] transition">
                      <td className="p-3 font-mono text-blue-300 break-all">
                        {file.dbRel}
                      </td>
                      <td className="p-3 font-mono">{file.tableCount}</td>
                      <td className="p-3 text-slate-400 font-sans">
                        {formatDateTime(file.modifiedAt)}
                      </td>
                      <td className="p-3 font-mono">{formatBytes(file.sizeBytes)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-800 rounded overflow-hidden">
                            <div
                              className="h-full bg-[#1A73E8] rounded"
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono w-12 text-right">
                            {ratio}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
