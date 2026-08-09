본 문서는 `WebCrawlServer` 백엔드 서버에서 크롤링 수집된 무거운 HTML 원본 소스(`outerHTML`), 이미지, PDF 등의 대용량 데이터를 SQLite DB에 직접 적재하지 않고, **물리 디렉터리 분리 저장소(Local File Storage System)**로 격리 보관하기 위한 기술 지침서입니다.

---

## 1. 개요 및 저장소 분리 원칙

1.1 **개요**: DB 용량 폭증과 쿼리 성능 저하를 방지하기 위해 무거운 파일 자원은 물리 디스크에 보관하고, SQLite DB에는 해당 파일의 물리적 경로(`file_path`) 및 메타데이터만 경량 적재합니다.  
1.2 **3대 물리 저장소 원칙**:
   - **경로 결정 우선순위**: 노드 전용 경로(`custom_storage_path`) > 워커 전용 경로(`storage_root_path`) > 글로벌 기본 경로 (`configs.data_path` → `STORAGE_ROOT_PATH` → `./storage`). 노드/워커 경로를 미지정(빈 값)하면 기본 저장 경로(`configs.data_path`)가 적용됩니다.
   - **도메인/DB_ID 하위 분류 & 특수문자 정화**: `<기본 저장 경로>\<safeDomain>\<db_id>\index.html` 체계로 자동 폴더를 생성하며, 윈도우/리눅스 디렉터리 금지 특수문자(`:`, `?`, `*`, `<`, `>`, `|`)는 안전하게 치환 정화함.
   - **디스크 용량 모니터링**: 물리 저장소 디스크의 남은 용량 및 총 저장 용량을 REST API로 모니터링.

---

## 2. 물리 파일 저장소 디렉터리 구조 명세

```
<기본 저장 경로>/ (예: E:\up\WebCrawlServer\  — configs.data_path)
└── <safeDomain>/                  # 특수문자 정화된 도메인 폴더 (예: aaa_com/, facebook_com/)
    └── <db_log_id>/               # DB 인덱스 번호별 독립 폴더 (예: 1042/)
        ├── index.html             # 수집된 HTML 원본 소스
        ├── metadata.json          # 수집 헤더, 쿠키, 타임스탬프 정보
        ├── images/                # 파싱되어 다운로드된 이미지 폴더 (추후 확장)
        └── videos/                # 파싱되어 다운로드된 동영상 폴더 (추후 확장)
```

---

## 3. 파일 저장소 서비스 모듈 규정 (`server/src/services/fileStorageService.ts`)

수집된 HTML 또는 바이너리 데이터를 결정된 물리 경로에 안전하게 저장하고 경로 정보를 반환합니다.

```typescript
// server/src/services/fileStorageService.ts

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface SaveContentOptions {
  customNodePath?: string;     // 노드 전용 지정 경로
  workerStoragePath?: string;  // 워커 전용 지정 경로
  globalDefaultPath?: string;  // 글로벌 기본 경로 (configs.data_path 우선, 없으면 "./storage")
  domain: string;              // 도메인 (예: "aaa.com")
  dbLogId: number | string;    // DB 인덱스 ID (예: 1042)
  htmlContent: string;         // HTML 원본 소스
}

export interface SaveContentResult {
  savedFilePath: string;
  fileSize: number;
}

/** 윈도우/리눅스 디렉터리 경로 금지 특수문자를 이스케이프 정화합니다. */
function sanitizeFolderName(name: string): string {
  return (name || "common").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

/**
 * 우선순위에 따라 물리 저장 경로를 결정하고, HTML 파일 및 메타데이터를 디스크에 보관합니다.
 */
export function saveCrawledContentToFile(
  options: SaveContentOptions
): SaveContentResult {
  // 1. 저장소 최상위 루트 경로 결정 (우선순위: 노드 지정 > 워커 지정 > 글로벌 기본)
  const rootPath =
    options.customNodePath && options.customNodePath.trim().length > 0
      ? options.customNodePath
      : options.workerStoragePath && options.workerStoragePath.trim().length > 0
      ? options.workerStoragePath
      : options.globalDefaultPath || "./storage";

  // 2. 도메인 특수문자 정화 및 디렉터리 세부 경로 생성 (예: E:\data\aaa_com\1042\)
  const safeDomain = sanitizeFolderName(options.domain);
  const targetDir = resolve(
    rootPath,
    safeDomain,
    String(options.dbLogId)
  );

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // 3. index.html 파일 쓰기 단행
  const targetFilePath = resolve(targetDir, "index.html");
  const buffer = Buffer.from(options.htmlContent, "utf-8");

  writeFileSync(targetFilePath, buffer);

  return {
    savedFilePath: targetFilePath,
    fileSize: buffer.length,
  };
}
```

---

## 4. 디스크 용량 모니터링 REST API 규정 (`GET /api/admin/storage/status`)

관리자 대시보드에서 스토리지 디스크의 용량을 실시간 모니터링할 수 있도록 정보를 제공합니다.

```typescript
// server/src/index.ts

app.get("/api/admin/storage/status", (_req, res) => {
  try {
    const rootPath =
      getConfigDataPath() ||            // configs.data_path 우선
      process.env.STORAGE_ROOT_PATH ||  // 그 다음 환경변수
      "./storage";                      // 최종 폴백
    res.json({
      success: true,
      data: {
        storageRootPath: resolve(rootPath),
        status: "NORMAL",
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: "디스크 상태 조회 실패" });
  }
});
```

---

## 5. 검증 체크리스트

- [ ] 무거운 HTML 소스가 SQLite DB 칼럼 대신 디스크 파일(`index.html`)로 분리 저장되는가?
- [ ] 파일 저장 경로 우선순위(노드 전용 > 워커 전용 > 기본 저장 경로)가 정상 적용되는가?
- [ ] 노드/워커 저장 경로 미지정 시 `configs.data_path`가 기본 저장 경로로 적용되는가?
- [ ] 도메인 특수문자가 정화되어 `<기본 저장 경로>\<safeDomain>\<db_id>\` 디렉터리가 에러 없이 자동 생성되는가?
- [ ] SQLite DB에는 경량 텍스트 경로(`file_path`) 및 파일 크기(`file_size`)만 정확히 기입되는가?
