// admin/src/components/views/WorkerManagerView.tsx

import { useState } from 'react';
import { WorkerRecord, CustomFieldDef } from '../../types/index.js';
import { DirectoryBrowserModal } from '../modals/DirectoryBrowserModal.js';

/** 워커 매니저 뷰 Props */
interface WorkerManagerViewProps {
  /** 현재 가동 중인 워커 목록 배열 */
  workers: WorkerRecord[];
  /** 데이터 저장 기본 경로 (configs.data_path, 미지정 시 저장 안내용) */
  defaultStoragePath: string;
  /**
   * 신규 동적 워커 생성 콜백 함수
   * @param params - 워커 생성 파라미터 객체
   */
  onCreateWorker: (params: {
    workerId: string;
    workerName: string;
    dbFileName: string;
    tableName: string;
    storageRootPath: string;
    customFields: CustomFieldDef[];
  }) => Promise<boolean>;
}

/**
 * 수집 워커를 코딩 없이 UI 상에서 동적으로 생성하고,
 * 전용 DB 스키마 테이블과 물리 저장 경로를 구성하는 관리자 뷰 컴포넌트입니다.
 * 기존 워커 현황 테이블과 신규 워커 빌더 입력 폼을 통합 제공합니다.
 */
export function WorkerManagerView({ workers, defaultStoragePath, onCreateWorker }: WorkerManagerViewProps) {
  /** 워커 ID 입력 상태 */
  const [workerId, setWorkerId] = useState('');
  /** 워커 한글 이름 입력 상태 */
  const [workerName, setWorkerName] = useState('');
  /** 바인딩 DB 파일명 입력 상태 */
  const [dbFileName, setDbFileName] = useState('worker_custom.db');
  /** 타깃 테이블명 입력 상태 */
  const [tableName, setTableName] = useState('custom_logs');
  /** 파일 저장소 루트 경로 입력 상태 (미입력 시 기본 저장 경로 사용) */
  const [storageRootPath, setStorageRootPath] = useState('');
  /** 커스텀 필드 스키마 정의 배열 상태 */
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  /** 파일 브라우저 모달 열림 여부 */
  const [browserOpen, setBrowserOpen] = useState(false);

  /** 커스텀 스키마 필드 동적 추가 */
  const handleAddField = () => {
    setCustomFields([
      ...customFields,
      { name: `field_${customFields.length + 1}`, type: 'TEXT', required: false }
    ]);
  };

  /**
   * 커스텀 스키마 필드 속성 변경
   *
   * @param index - 변경할 필드 인덱스
   * @param key - 변경할 속성 키
   * @param value - 새 속성 값
   */
  const handleFieldChange = (index: number, key: keyof CustomFieldDef, value: unknown) => {
    const updated = [...customFields];
    updated[index] = { ...updated[index], [key]: value };
    setCustomFields(updated);
  };

  /**
   * 커스텀 스키마 필드 제거
   *
   * @param index - 제거할 필드 인덱스
   */
  const handleRemoveField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  /** 워커 빌드 실행 제출 핸들러 */
  const handleSubmit = async () => {
    if (!workerId || !workerName) {
      alert('워커 ID와 이름을 입력해주세요.');
      return;
    }

    const success = await onCreateWorker({
      workerId,
      workerName,
      dbFileName,
      tableName,
      storageRootPath,
      customFields
    });

    if (success) {
      // 빌드 성공 시 입력 폼 초기화
      setWorkerId('');
      setWorkerName('');
      setCustomFields([]);
    }
  };

  /** 파일 브라우저에서 선택한 경로를 저장소 루트 입력 값에 반영 */
  const applyBrowserSelection = (path: string) => {
    setStorageRootPath(path);
    setBrowserOpen(false);
  };

  return (
    <div className="flex flex-col gap-6 font-sans">

      {/* 1. 가동 중인 워커 현황 테이블 */}
      <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c] flex justify-between items-center">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            Active Worker Instances ({workers.length})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111827] text-slate-300 border-b border-slate-800 text-[11px] font-semibold">
                <th className="p-3">워커 ID</th>
                <th className="p-3">워커 이름</th>
                <th className="p-3">바인딩 DB 파일</th>
                <th className="p-3">테이블명</th>
                <th className="p-3">저장소 루트</th>
                <th className="p-3">기본 워커 여부</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-200 font-mono">
              {workers.map((w) => (
                <tr key={w.worker_id} className="hover:bg-[#2d2e31] transition">
                  <td className="p-3 font-semibold text-blue-300">{w.worker_id}</td>
                  <td className="p-3 font-sans font-medium text-slate-100">{w.worker_name}</td>
                  <td className="p-3 text-slate-300">{w.db_file_path}</td>
                  <td className="p-3 text-yellow-300">{w.table_name}</td>
                  <td className="p-3 text-slate-400 text-[11px] break-all">{w.storage_root_path}</td>
                  <td className="p-3 font-sans">
                    {w.is_default ? (
                      <span className="bg-blue-900/40 text-blue-300 text-[10px] px-2 py-0.5 rounded border border-blue-700/40 font-semibold">
                        Default Worker
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded">
                        Custom Worker
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {workers.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm font-sans">
              등록된 수집 워커가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 2. 신규 워커 동적 빌더 입력 폼 */}
      <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800 flex flex-col gap-6 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">신규 수집 워커 동적 빌더</h2>
            <p className="text-xs text-slate-400">새로운 워커와 전용 DB 스키마 테이블을 동적으로 생성합니다.</p>
          </div>
          <button
            onClick={handleSubmit}
            className="bg-[#1A73E8] hover:bg-[#185abc] text-white text-xs font-semibold px-4 py-2 rounded transition shadow-sm"
          >
            워커 및 DB 빌드 단행
          </button>
        </div>

        {/* 기본 설정 입력 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">워커 ID (영어 식별자)</label>
            <input
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              placeholder="예: worker_facebook"
              className="w-full p-3 bg-[#1E293B] border border-slate-700 rounded text-slate-100 outline-none focus:border-[#1A73E8] font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">워커 한글 이름</label>
            <input
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="예: 페이스북 전담 수집 워커"
              className="w-full p-3 bg-[#1E293B] border border-slate-700 rounded text-slate-100 outline-none focus:border-[#1A73E8]"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">대상 DB 파일명 (databases/workers/)</label>
            <input
              value={dbFileName}
              onChange={(e) => setDbFileName(e.target.value)}
              placeholder="예: worker_facebook.db"
              className="w-full p-3 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">대상 테이블 이름</label>
            <input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="예: facebook_posts"
              className="w-full p-3 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-slate-400 mb-1 font-semibold">워커 전용 파일 저장소 루트 경로</label>
            <div className="flex items-center gap-2">
              <input
                value={storageRootPath}
                onChange={(e) => setStorageRootPath(e.target.value)}
                placeholder={
                  defaultStoragePath
                    ? `미입력 시 기본 저장 경로 적용: ${defaultStoragePath}`
                    : '미입력 시 기본 저장 경로 적용'
                }
                className="flex-1 p-3 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
              />
              <button
                onClick={() => setBrowserOpen(true)}
                aria-label="파일 브라우저 열기"
                title="파일 브라우저로 디렉토리 선택"
                className="shrink-0 flex items-center justify-center w-11 h-[46px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
              >
                <span className="material-symbols-outlined text-base">folder_open</span>
              </button>
            </div>
          </div>
        </div>

        {/* 커스텀 스키마 필드 동적 구성 영역 */}
        <div className="bg-[#1E293B] p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs text-slate-200">
              커스텀 스키마 필드 정의 (기본 파라미터는 자동 상속)
            </span>
            <button
              onClick={handleAddField}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded transition border border-slate-700"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              <span>필드 추가</span>
            </button>
          </div>

          {/* 커스텀 필드 행 목록 */}
          {customFields.map((field, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 bg-[#0F172A] p-2.5 rounded border border-slate-800 text-xs"
            >
              {/* 필드명 입력 */}
              <input
                value={field.name}
                onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                placeholder="필드명 (예: author_id)"
                className="flex-1 p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono"
              />
              {/* 타입 선택 드롭다운 */}
              <select
                value={field.type}
                onChange={(e) =>
                  handleFieldChange(idx, 'type', e.target.value as "TEXT" | "INTEGER" | "REAL" | "BLOB")
                }
                className="p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono"
              >
                <option value="TEXT">TEXT (문자열)</option>
                <option value="INTEGER">INTEGER (정수)</option>
                <option value="REAL">REAL (실수)</option>
                <option value="BLOB">BLOB (바이너리)</option>
              </select>
              {/* 필드 제거 버튼 */}
              <button
                onClick={() => handleRemoveField(idx)}
                className="p-1.5 bg-red-900/40 hover:bg-red-800 text-red-200 rounded transition"
              >
                <span className="material-symbols-outlined text-xs">delete</span>
              </button>
            </div>
          ))}

          {customFields.length === 0 && (
            <div className="text-center text-slate-500 text-xs py-4">
              추가 커스텀 필드가 없습니다. [필드 추가] 버튼으로 스키마를 확장할 수 있습니다.
            </div>
          )}
        </div>
      </div>

      {/* 파일 브라우저 모달 */}
      <DirectoryBrowserModal
        isOpen={browserOpen}
        initialPath={storageRootPath}
        onSelect={applyBrowserSelection}
        onClose={() => setBrowserOpen(false)}
      />
    </div>
  );
}
