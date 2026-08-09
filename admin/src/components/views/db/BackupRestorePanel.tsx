// admin/src/components/views/db/BackupRestorePanel.tsx

import { useMemo, useRef, useState } from "react";
import { BackupInfo, DbFileInfo } from "../../../types/index.js";
import { getBackupDownloadUrl } from "../../../services/dbApiService.js";
import { formatBytes, formatDateTime } from "../../../utils/format.js";

/** BackupRestorePanel 컴포넌트 Props */
interface BackupRestorePanelProps {
  /** 전체 DB 파일 목록 */
  dbFiles: DbFileInfo[];
  /** 백업 파일 목록 */
  backups: BackupInfo[];
  /** 현재 선택된 DB 상대 경로 */
  selectedDbRel: string;
  /** 백업 생성 콜백 */
  onCreateBackup: (dbRel: string) => Promise<boolean>;
  /** 업로드 base64 복원 콜백 */
  onRestoreBackup: (dbRel: string, contentBase64: string) => Promise<boolean>;
  /** 기존 백업 파일 직접 복원 콜백 */
  onRestoreBackupFromFile: (dbRel: string, fileName: string) => Promise<boolean>;
}

/**
 * 파일을 base64 문자열로 읽는 헬퍼 함수입니다.
 *
 * @param file - 읽을 File 객체
 * @returns base64 데이터 문자열 (data URL 접두사 제거)
 */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

/**
 * 백업/복원 패널 컴포넌트입니다.
 * DB 백업 생성, 백업 목록(다운로드/직접 복원), 업로드 복원 기능을 제공합니다.
 */
export function BackupRestorePanel({
  dbFiles,
  backups,
  selectedDbRel,
  onCreateBackup,
  onRestoreBackup,
  onRestoreBackupFromFile,
}: BackupRestorePanelProps) {
  /** 백업 대상 DB 상대 경로 상태 (기본값: 현재 선택 DB 또는 첫 DB) */
  const [backupDbRel, setBackupDbRel] = useState(
    selectedDbRel || dbFiles[0]?.dbRel || ""
  );
  /** 복원 대상 DB 상대 경로 상태 (기본값: 현재 선택 DB 또는 첫 DB) */
  const [restoreDbRel, setRestoreDbRel] = useState(
    selectedDbRel || dbFiles[0]?.dbRel || ""
  );
  /** 업로드된 복원 파일 base64 상태 */
  const [restoreBase64, setRestoreBase64] = useState("");
  /** 업로드된 복원 파일명 상태 */
  const [restoreFileName, setRestoreFileName] = useState("");
  /** 파일 입력 ref (선택 초기화용) */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 백업 대상 DB 후보 목록 (파일 선택 드롭다운용) */
  const backupDbOptions = useMemo(() => dbFiles, [dbFiles]);

  /** 파일 선택 핸들러 (base64 변환) */
  const handleFileChange = async (file: File | undefined | null) => {
    if (!file) return;
    const base64 = await readFileAsBase64(file);
    setRestoreFileName(file.name);
    setRestoreBase64(base64);
  };

  /** 업로드 복원 실행 핸들러 */
  const handleRestoreUpload = async () => {
    if (!restoreDbRel || !restoreBase64) return;
    const success = await onRestoreBackup(restoreDbRel, restoreBase64);
    if (success) {
      setRestoreBase64("");
      setRestoreFileName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* [1] 백업 생성 */}
      <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c]">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            DB 백업 생성
          </span>
        </div>
        <div className="p-4 flex flex-wrap items-center gap-3 text-xs">
          <label className="text-slate-400 font-semibold">대상 DB</label>
          <select
            value={backupDbRel}
            onChange={(e) => setBackupDbRel(e.target.value)}
            className="flex-1 min-w-56 p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
          >
            {backupDbOptions.map((file) => (
              <option key={file.dbRel} value={file.dbRel}>
                {file.dbRel} ({formatBytes(file.sizeBytes)})
              </option>
            ))}
          </select>
          <button
            onClick={() => onCreateBackup(backupDbRel)}
            disabled={!backupDbRel}
            className="px-4 py-2 bg-[#1A73E8] hover:bg-[#185abc] disabled:opacity-40 text-white text-xs font-semibold rounded transition"
          >
            백업 생성
          </button>
        </div>
      </div>

      {/* [2] 백업 목록 */}
      <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c]">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            백업 목록 ({backups.length})
          </span>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-xs">
            <label className="text-slate-400 font-semibold shrink-0">
              복원 대상 DB
            </label>
            <select
              value={restoreDbRel}
              onChange={(e) => setRestoreDbRel(e.target.value)}
              className="flex-1 min-w-56 p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
            >
              {backupDbOptions.map((file) => (
                <option key={file.dbRel} value={file.dbRel}>
                  {file.dbRel}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#111827] text-slate-300 border-b border-slate-800 text-[11px] font-semibold">
                  <th className="p-3">파일명</th>
                  <th className="p-3">크기</th>
                  <th className="p-3">생성일</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-200 font-mono">
                {backups.map((backup) => (
                  <tr key={backup.fileName} className="hover:bg-[#2d2e31] transition">
                    <td className="p-3 text-slate-200 break-all">{backup.fileName}</td>
                    <td className="p-3">{formatBytes(backup.sizeBytes)}</td>
                    <td className="p-3 text-slate-400 font-sans">
                      {formatDateTime(backup.createdAt)}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <a
                          href={getBackupDownloadUrl(backup.fileName)}
                          download
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] rounded border border-slate-700"
                        >
                          다운로드
                        </a>
                        <button
                          onClick={() =>
                            onRestoreBackupFromFile(restoreDbRel, backup.fileName)
                          }
                          disabled={!restoreDbRel}
                          className="px-2 py-1 bg-[#1A73E8]/20 hover:bg-[#1A73E8]/40 text-[#1A73E8] text-[10px] rounded border border-[#1A73E8]/40 disabled:opacity-30"
                        >
                          복원
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {backups.length === 0 && (
              <div className="p-6 text-center text-gray-500 text-sm font-sans">
                생성된 백업이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* [3] 파일 업로드 복원 */}
      <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c]">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            파일 업로드 복원
          </span>
        </div>
        <div className="p-4 flex flex-wrap items-center gap-3 text-xs">
          <label className="text-slate-400 font-semibold">복원 대상</label>
          <select
            value={restoreDbRel}
            onChange={(e) => setRestoreDbRel(e.target.value)}
            className="flex-1 min-w-48 p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
          >
            {backupDbOptions.map((file) => (
              <option key={file.dbRel} value={file.dbRel}>
                {file.dbRel}
              </option>
            ))}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,.sqlite,.sqlite3"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
            className="flex-1 min-w-48 text-slate-300 text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 file:text-xs file:hover:bg-slate-700"
          />
          <button
            onClick={handleRestoreUpload}
            disabled={!restoreDbRel || !restoreBase64}
            className="px-4 py-2 bg-red-900/50 hover:bg-red-800 disabled:opacity-30 text-red-100 text-xs font-semibold rounded transition"
          >
            {restoreFileName ? `${restoreFileName} 복원` : "복원 실행"}
          </button>
        </div>
        <div className="px-4 pb-3 text-[10px] text-slate-500">
          복원 시 현재 DB 파일은 backups/ 폴더에 자동 보존 백업됩니다.
        </div>
      </div>
    </div>
  );
}
