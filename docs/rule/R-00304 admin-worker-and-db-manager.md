본 문서는 `WebCrawlServer` 관리자 대시보드(`admin/`)의 **수집 워커 빌더(Worker Builder)** 및 **멀티 DB / 스토리지 매니저 UI** 개발 지침서입니다. 관리자가 UI 상에서 코딩 없이 신규 워커를 생성하고, 커스텀 DB 스키마 및 저장 디렉터리를 동적 구성할 수 있도록 지원합니다.

---

## 1. 개요 및 화면 목적

1.1 **개요**: 서버에 가동될 수집 워커를 Admin UI에서 빌드하여, 커스텀 데이터 스키마와 전용 DB 파일(`databases/workers/worker_<name>.db`)을 동적 수립합니다.  
1.2 **화면 목적**:
   - **워커 빌더 UI (`WorkerManagerView.tsx`)**:
     - 신규 워커 생성 및 기본 파라미터 상속.
     - 대상 DB 지정 (기존 DB 선택 또는 신규 DB 동적 생성).
     - 커스텀 필드(스키마 JSON) 동적 추가/삭제.
     - 워커 전용 저장소 루트 경로 지정.
   - **DB / 스토리지 매니저 UI**:
     - `databases/` 및 `databases/workers/` 내의 모든 `.db` 파일 목록 조회 및 테이블 인스펙터.
     - 물리 파일 저장 디스크 용량 모니터링.

---

## 2. 수집 워커 빌더 UI 규정 (`WorkerManagerView.tsx`)

신규 워커를 빌드하고 커스텀 스키마 필드를 동적으로 추가하는 UI 컴포넌트 명세입니다.

```tsx
// admin/src/components/views/WorkerManagerView.tsx

import { useState } from 'react';
import { CustomFieldDef, WorkerRecord } from '../../types/index.js';

interface WorkerManagerViewProps {
  workers: WorkerRecord[];
  onCreateWorker: (params: {
    workerId: string;
    workerName: string;
    dbFileName: string;
    tableName: string;
    storageRootPath: string;
    customFields: CustomFieldDef[];
  }) => Promise<boolean>;
}

export function WorkerManagerView({ workers, onCreateWorker }: WorkerManagerViewProps) {
  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [dbFileName, setDbFileName] = useState('worker_custom.db');
  const [tableName, setTableName] = useState('custom_logs');
  const [storageRootPath, setStorageRootPath] = useState('E:\\data\\custom_worker');
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);

  // 커스텀 스키마 필드 동적 추가
  const handleAddField = () => {
    setCustomFields([
      ...customFields,
      { name: `field_${customFields.length + 1}`, type: 'TEXT', required: false }
    ]);
  };

  const handleFieldChange = (index: number, key: keyof CustomFieldDef, value: any) => {
    const updated = [...customFields];
    updated[index] = { ...updated[index], [key]: value };
    setCustomFields(updated);
  };

  const handleRemoveField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

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
      setWorkerId('');
      setWorkerName('');
      setCustomFields([]);
    }
  };

  return (
    <div className="flex flex-col gap-6 select-none font-sans">
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
        </div>
      </div>

      {/* 2. 신규 워커 빌더 폼 */}
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
            <input
              value={storageRootPath}
              onChange={(e) => setStorageRootPath(e.target.value)}
              placeholder="예: E:\data\facebook_worker"
              className="w-full p-3 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono outline-none focus:border-[#1A73E8]"
            />
          </div>
        </div>

        {/* 커스텀 스키마 필드 구성 */}
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

          {customFields.map((field, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-[#0F172A] p-2.5 rounded border border-slate-800 text-xs">
              <input
                value={field.name}
                onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                placeholder="필드명 (예: author_id)"
                className="flex-1 p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono"
              />
              <select
                value={field.type}
                onChange={(e) => handleFieldChange(idx, 'type', e.target.value as any)}
                className="p-2 bg-[#1E293B] border border-slate-700 rounded text-slate-100 font-mono"
              >
                <option value="TEXT">TEXT (문자열)</option>
                <option value="INTEGER">INTEGER (정수)</option>
                <option value="REAL">REAL (실수)</option>
                <option value="BLOB">BLOB (바이너리)</option>
              </select>
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
    </div>
  );
}
```

---

## 3. DB 관리 매니저 UI 규정 (`DbManagerView.tsx`)

1.1의 **DB / 스토리지 매니저 UI**를 일반 SQLite 관리툴(DB Browser for SQLite/SQLiteStudio) 수준으로 확장한 화면 명세입니다. 사이드바의 "DB 관리" 메뉴(`/db`)에서 접근합니다.

### 3.1 화면 구성

- **대상 DB 선택 드롭다운**: `GET /api/admin/db/files` 결과(`dbRel`·테이블 수·크기)를 표시하고 선택한 DB를 모든 탭에 공유합니다.
- **기능 탭 5종**:
  1. **데이터 브라우저** (`DbBrowserPanel`): 테이블 목록(행 수) + 테이블 선택 시 스키마(컬럼/PK/인덱스)와 데이터 그리드. 그리드는 페이지네이션·**페이지당 행 수 선택(기본 20, `configs.db_page_size`)**·**필드별 LIKE 검색 드롭다운(전체 필드/개별 컬럼)**·**컬럼 헤더 정렬(▲▼ 서버 정렬)**·행 추가/수정/삭제 폼을 제공합니다.
  2. **SQL 실행** (`SqlQueryPanel`): SQL 에디터(Ctrl+Enter 실행), **예제 쿼리 20개 드롭다운**(선택 시 에디터 삽입), 결과 그리드(**클라이언트 정렬**), 실행 히스토리 표시. 쓰기/DDL은 서버에서 관리자 활동 로그를 남깁니다.
  3. **스키마 편집** (`SchemaEditorPanel`): 동적 컬럼 정의(이름/타입/NOT NULL/PK)로 테이블 생성, 테이블 삭제, 컬럼 추가.
  4. **백업 / 복원** (`BackupRestorePanel`): 백업 생성, 백업 목록(원본 DB 식별 표시)의 다운로드·직접 복원, DB 파일 업로드(base64) 복원.
  5. **스토리지 모니터링** (`StorageMonitorPanel`): 저장소 루트/파일 수/총 용량/백업 용량 카드와 DB 파일별 크기 비율 막대.

### 3.2 아키텍처 규정

- 모든 DB 데이터·비즈니스 로직은 `useDbManager` 훅(`admin/src/hooks/useDbManager.ts`)에 집중하고, 뷰는 상태 표시와 사용자 인터랙션만 담당합니다.
- REST 통신은 `admin/src/services/dbApiService.ts`의 `requestJson` 헬퍼를 일괄 사용합니다 (성공/실패 표준 응답 처리).
- 데이터 그리드는 `admin/src/components/tables/DbDataGrid.tsx` 재사용 컴포넌트로 분리합니다.
- DB 식별자(테이블/컬럼명)는 서버측 검증을 거치므로 클라이언트에서 별도 인젝션 대응 없이 인라인 렌더링합니다.

### 3.3 데이터 그리드 셀 규정 (`DbDataGrid.tsx`)

- **긴 셀 미리보기**: 셀 텍스트가 `cellPreviewLimit`(`configs.db_cell_preview_chars`, 기본 200자)를 초과하면 `…` 잘림 표시와 **더보기** 링크를 노출합니다. `log_message`처럼 HTML이 통으로 들어간 컬럼은 반드시 이 규칙을 따릅니다.
- **값 미리보기 레이어**(`ValuePreviewModal.tsx`): 더보기 클릭 시 브라우저 **현재 창 높이**를 기준으로 레이어 최대 높이(`window.innerHeight - 120px`)를 산정하고 본문은 `overflow-y: auto` 스크롤로 전체 값을 표시합니다. 닫기 버튼·배경 클릭·ESC로 닫으며, 헤더에 전체 글자 수/줄 수를 표시합니다.
- **파일 경로 탐색기 버튼**: **`file_path` 컬럼명과 정확히 일치**하고 값이 비어 있지 않은 셀에 작은 `folder_open` 버튼을 표시합니다. 클릭 시 `POST /api/admin/fs/open-explorer`로 **OS 네이티브 Windows 탐색기**를 열며(파일이면 부모 디렉토리까지만), 브라우저 내부 레이어(`DirectoryBrowserModal`)는 사용하지 않습니다. 실행 실패 시 그리드 하단에 일시적 오류 메시지를 표시합니다.
- **페이지당 행 수**: 데이터 브라우저 하단 페이지네이션에 행 수 선택 드롭다운(20/50/100/200)을 제공하고, 기본값은 `configs.db_page_size`(기본 20)입니다. 변경 시 1페이지부터 재조회하며, 테이블 재선택 시에도 해당 크기가 적용됩니다(`selectTable(table, size)`).
- **필드별 LIKE 검색**: 검색 입력 앞에 검색 대상 컬럼 드롭다운(`전체 필드` + 스키마 컬럼)을 배치합니다. `전체 필드`는 기존 전체 컬럼 OR LIKE, 개별 컬럼 선택 시 해당 컬럼만 LIKE로 검색합니다. 서버 `fetchTableRows`의 `searchField`로 전달되며, 컬럼명은 서버 화이트리스트로 검증됩니다.
- **컬럼 헤더 정렬**: 데이터 브라우저의 `DbDataGrid`는 헤더 클릭 시 서버 정렬(`onSortChange` → `orderBy`/`orderDir`)을 요청합니다. 같은 컬럼 클릭 시 오름차순↔내림차순 토글, 새 컬럼은 오름차순 시작, 정렬 시 1페이지부터 재조회하며 아이콘은 ▲(`arrow_upward`)/▼(`arrow_downward`)/미정렬(`unfold_more`)로 구분합니다. 테이블 전환 시 검색어·검색 필드·정렬·페이지가 초기화됩니다.
- **SQL 예제 쿼리 + 클라이언트 정렬**: `SqlQueryPanel`은 예제 쿼리 20개(`EXAMPLE_QUERIES`, sqlite_master/로그 분석/이미지 카테고리/스케줄 등) 드롭다운을 에디터 하단에 제공하며, 선택 시 에디터에 삽입합니다(자동 실행 안 함). SQL 결과 그리드는 `clientSort` 모드로 헤더 클릭 시 **브라우저 내부 클라이언트 정렬**을 수행합니다(서버 재조회 없음, 숫자는 수치 비교·문자열은 localeCompare).

---

## 4. 검증 체크리스트

- [ ] [워커 빌더] 화면에서 신규 워커 생성 시 서버의 `databases/workers/`에 독립 DB가 동적 생성되는가?
- [ ] 커스텀 스키마 필드 추가 및 삭제가 UI 상에서 정상 동작하는가?
- [ ] 생성된 워커 목록 및 매핑 정보가 관리자 대시보드에 시각화되는가?
- [ ] [DB 관리] DB 선택 시 데이터 브라우저/스키마가 즉시 갱신되는가?
- [ ] [DB 관리] SQL 실행, 행 CRUD, 테이블/컬럼 편집이 백엔드에 반영되는가?
- [ ] [DB 관리] 긴 셀(log_message)이 제한 길이만큼만 표시되고 더보기 레이어가 창 높이에 맞게 스크롤되는가?
- [ ] [DB 관리] 테이블 선택 시 기본 20행(`configs.db_page_size`)으로 조회되고 행 수 드롭다운이 정상 동작하는가?
- [ ] [DB 관리] `file_path` 셀의 탐색기 버튼이 OS 네이티브 탐색기로 부모 디렉토리를 여는가? (미존재 경로는 404 안내)
- [ ] [DB 관리] 헤더 클릭 정렬이 ▲▼로 표시되고 같은 컬럼 토글/새 컬럼 오름차순/1페이지 재조회가 동작하는가?
- [ ] [DB 관리] 검색 필드 드롭다운 선택 시 해당 컬럼만 LIKE로 검색되고 `%`/`_` 리터럴 검색이 정상인가?
- [ ] [DB 관리] SQL 예제 20개 드롭다운 선택이 에디터에 삽입되고 결과 그리드 클라이언트 정렬이 동작하는가?
- [ ] [DB 관리] 백업 생성→다운로드→복원(파일/업로드) 사이클이 정상 동작하고 복원 전 자동 보존 백업이 생성되는가?
- [ ] [DB 관리] `dbRel` 경로 이탈 요청(`../`, 절대경로, 비 `.db`)이 화이트리스트로 거부되는가?
