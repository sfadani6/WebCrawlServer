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

### 2.1 이미지 수집 전용 저장소 규격 (CRAWL_IMAGE)

기본 탭의 이미지 수집 기능으로 수신된 이미지는 HTML 도메인/DB_ID 구조와 **분리된 전용 폴더**에 보관하며, 사이트 전용 수집의 카테고리(일반/앨범/표지)별로 분리합니다.

```
<기본 저장 경로>/images/            # 이미지 수집 전용 루트 (R-00480 연동)
└── <safeDomain>/                  # 이미지가 포함된 페이지 루트 도메인 (예: xchina_co/)
    ├── normal/                    # 일반 이미지 수집 (기본 카테고리)
    │   ├── <timestamp>-<index>.png    # 성공 이미지 (MIME 기반 확장자)
    │   ├── <timestamp>-<index>.txt    # 크로스 오리진 인출 실패 시 URL 참조 텍스트 파일
    │   ├── <timestamp>-<index>_thumb/sfw.<ext>    # 미디어 번들: 메인/보조 썸네일
    │   ├── <timestamp>-<index>_thumb/sfw/preview.<ext>  # 미디어 번들: 프리뷰 mp4
    │   └── <timestamp>-<index>.txt    # 미디어 번들: 메타 txt (page_url/click_url/title 등)
    ├── album/                     # 사이트 전용 카테고리 (xchina.co 앨범 수집 등)
    ├── cover/                     # 사이트 전용 카테고리 (표지 수집)
    └── info/                      # SITE_INFO 액션 메타데이터 JSON 보관
        └── <timestamp>-<index>.json
```

- **파일명 규격**: `<timestamp(ms)>-<4자리 순차 인덱스>.<ext>` — 같은 서버 프로세스 내 시퀀스로 타임스탬프 충돌을 방지합니다.
- **성공 이미지**(payloadType `binary_base64`): MIME 타입→확장자 매핑(`image/png`→png, `image/jpeg`→jpg, `image/webp`→webp, `image/svg+xml`→svg, `video/mp4`→mp4, `video/webm`→webm 등). 미지원 MIME은 원본 파일명 확장자를 폴백으로 사용합니다.
- **실패 이미지**(payloadType `json`): 크로스 오리진 등 인출 실패 시 원본 URL만 담은 `.txt` 참조 텍스트 파일로 보관하며, 스킵하지 않습니다. 기존 `.url` 확장자는 `.txt`로 통일합니다. 아래 참조 파일 포맷을 따릅니다.
- **참조 파일(.txt) 포맷**:
  ```
  # WebCrawlServer 이미지 참조 파일
  # 인출 실패 사유: CORS_OR_FETCH_FAILED
  page_url: <수집 페이지 URL>
  image_url: <원본 이미지 URL>
  click_url: <연결된 상세 페이지 URL>   (사이트 전용 수집 시에만 추가)
  title: <상세 페이지 제목>             (사이트 전용 수집 시에만 추가)
  ```
- **도메인 분류**: 이미지가 속한 페이지(`pageUrl`)의 hostname을 기준으로 폴더를 구성하되, `normalizeRootDomain()`이 `www.` 서브도메인을 제거하여 루트 도메인 단위로 통일합니다(`www.xchina.co` → `xchina.co`). 기존 `www.` 폴더는 이관하지 않으며 신규 수집부터 적용됩니다.
- **카테고리 분류**: `CRAWL_IMAGE` 페이로드의 `category`(기본 `"normal"`)를 `sanitizeFolderName`으로 정화해 하위 디렉토리로 사용합니다. 사이트 전용 버튼(`xchina.co`: album/cover, `xvideos.com`: normal)이 전달하며, 플러그인 `matchSiteDomain()`의 서브도메인 허용 규칙과 정렬됩니다.
- **SITE_INFO**: 정보 수집 버튼이 전송한 페이지 메타데이터를 `<safeDomain>/info/<timestamp>-<index>.json`으로 물리 저장합니다.
- **DB 연동**: `crawl_logs`에 action=`CRAWL_IMAGE`/`SITE_INFO` 레코드가 적재되고, 저장된 파일 경로/크기가 `file_path`/`file_size`에 갱신됩니다.

### 2.2 미디어 번들 저장소 규격 (CRAWL_IMAGE assets 배열)

사이트 전용 미디어 다운로드 매니저(xvideos.com)가 오프스크린에서 직접 인출한 자산 묶음은 `CRAWL_IMAGE` 페이로드의 `assets` 배열로 수신되며, `saveCrawledMediaBundle()`이 하나의 번들 단위로 물리 저장합니다.

```
<기본 저장 경로>/images/<safeDomain>/<category>/
├── <timestamp>-<index>.txt                    # 번들 메타 txt (원문 그대로 저장)
├── <timestamp>-<index>_thumb/sfw.<ext>        # 메인 썸네일 (xv_24_t.jpg 계열)
├── <timestamp>-<index>_thumb/preview.<ext>    # 프리뷰 mp4 (preview.mp4)
└── <timestamp>-<index>_thumb/sfw/preview.<ext># (보조 썸네일 존재 시, 폴더/파일명은 자산명 파생)
```

- **요청 흐름**: 플러그인이 `GET_STORAGE_LOCATION`으로 저장 위치(절대/상대)를 조회한 뒤(→ `STORAGE_LOCATION_RESPONSE`), 오프스크린이 3종 자산(CORS 우회 + 오페라 VPN)을 fetch하여 base64 번들 + `txtContent`를 `CRAWL_IMAGE`(payloadType `json`)로 전송합니다.
- **계층 경로 확장(xvideos 페이징 연동)**: `CRAWL_IMAGE` 번들 payload에 `pathSegments?: string[]`가 포함되면 `saveCrawledMediaBundle()`이 카테고리 하위에 세그먼트 폴더를 추가 생성해 `<기본 저장 경로>/images/<safeDomain>/<category>/<pathSegments...>/<baseName>_<kind>.<ext>`로 저장합니다. (xvideos 페이징 액션: `pageUrl`의 실제 도메인 + URL 분석 세그먼트 → `images/<도메인>/<세그먼트>/<월>/<N>/page-<N>-<eid>_thumb.<ext>` 등)
- **저장 분기**: `payloadObj.assets`가 배열이면 기존 단일 이미지 저장 대신 번들 저장 경로를 탑니다. `txtContent`가 있으면 `<timestamp>-<index>.txt`로 원문 그대로 저장합니다. 각 자산은 `name`에서 파생한 하위 폴더/확장자(앱 대비)에 저장하며, `data`가 빈 문자열(인출 실패)인 자산은 건너뜁니다.
- **ACK**: 저장 완료 시 `CRAWL_MEDIA_SAVED` ACK(`bundleId`/`savedDir`/`savedFiles`)를 전송하고, 플러그인은 매칭 `bundleId` 항목의 상태를 완료/실패로 갱신합니다(60초 타임아웃).

### 2.3 페이지 단위 수집 분리 저장 규격 (CRAWL_PARTIAL `pathSegments`)

액션 실행기가 페이지 단위로 수집한 JSON 메타(xvideos 페이징 액션 등)는 payload의 `pathSegments`/`fileName`을 따라 **카테고리·월·페이지 폴더로 분리 저장**합니다. `pathSegments`가 없는 기존 `CRAWL_PARTIAL`은 기존 기본 저장 규격을 그대로 유지합니다.

```
<기본 저장 경로>/<safeDomain>/              # 페이지 단위 분리 저장 루트 (R-00480 연동, images/ 제외) — pageUrl의 실제 도메인
└── best/                                   # pathSegments[0] (URL 분석 세그먼트, 정화됨)
    └── 2026-06/                           # pathSegments[1] (월)
        └── 16/                            # pathSegments[2] (페이지 번호)
            └── page-16.json               # fileName (페이지 단위 메타 JSON)
```

- **전송 규격**: `CRAWL_PARTIAL` payload에 `pathSegments: string[]`, `fileName?: string`, **`requestId?: string`**을 포함합니다(xvideos 페이징 액션: `["<세그먼트>","<월>","<N>"]` + `page-<N>.json` + requestId). `fileName`이 없으면 `<timestamp>-<seq>.json` 기본명을 사용합니다.
- **저장 분기**: 서버 `index.ts`의 `CRAWL_PARTIAL` 분기에서 `Array.isArray(payload.pathSegments) && 길이 > 0`이면 `saveCrawlPartialToFile()`로 저장하고, 아니면 기존 흐름(기본 저장 규격)을 따릅니다.
- **저장 ACK**: 저장 완료 후 서버는 **`CRAWL_PARTIAL_SAVED`**(`requestId`/`savedFilePath`/`fileSize`/`entriesCount`) ACK를 플러그인에 응답합니다. 액션 실행기는 `requestId`를 담은 `CRAWL_PARTIAL` 전송 시 이 ACK(실제 파일 저장 확인)까지 대기한 뒤에만 다음 페이지로 이동합니다(오프스크린 `partialSaveWaiters` 30초 타임아웃).
- **정화 규칙**: `pathSegments`의 각 요소와 `fileName`은 `sanitizeFolderName()`으로 경로 금지 특수문자를 정화하며, 디렉터리 탐색(경로 탈출)은 세그먼트 단위 정화로 차단됩니다.
- **DB 연동**: `crawl_logs`에 action=`CRAWL_PARTIAL` 레코드의 `file_path`/`file_size`가 실제 저장 파일 경로·크기로 갱신됩니다.

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

### 3.1 미디어 번들 저장 (`saveCrawledMediaBundle`)

`CRAWL_IMAGE`의 `assets` 배열(미디어 번들)을 한 번에 물리 저장하고 저장 경로/파일 목록을 반환합니다. 실패 자산(`data` 빈 문자열)은 스킵하고, 메타 txt(`txtContent`)는 원문 그대로 `<timestamp>-<index>.txt`로 보관합니다.

```typescript
// server/src/services/fileStorageService.ts

export interface SaveCrawledMediaBundleOptions {
  customNodePath?: string;     // 노드 전용 지정 경로
  workerStoragePath?: string;  // 워커 전용 지정 경로
  globalDefaultPath?: string;  // 글로벌 기본 경로 (configs.data_path 우선, 없으면 "./storage")
  domain: string;              // 루트 도메인 (예: "xvideos.com")
  category: string;            // 카테고리 (기본 "normal")
  baseName: string;            // "<timestamp>-<index>" 파일명 기준
  clickUrl?: string;           // 연결된 상세 페이지 URL (참조 파일에 기록)
  title?: string;              // 상세 페이지 제목 (참조 파일에 기록)
  pageUrl?: string;            // 수집 페이지 URL
  txtContent?: string;         // 플러그인이 생성한 메타 txt 원문
  assets: CrawledMediaAssetOptions[];  // 자산 목록 (name/data)
}

export interface CrawledMediaAssetOptions {
  name: string;      // 자산명 (예: "sfw", "preview.mp4") — 하위 폴더/확장자 파생 기준
  data: string;      // base64 원문; 빈 문자열이면 인출 실패로 간주해 스킵
}

export interface SaveCrawledMediaBundleResult {
  savedDir: string;        // 번들 저장 디렉터리 절대 경로
  savedFiles: string[];    // 실제 저장된 파일 절대 경로 목록
}

export function saveCrawledMediaBundle(
  options: SaveCrawledMediaBundleOptions
): SaveCrawledMediaBundleResult;
```

- **경로 규칙**: `<globalDefaultPath|...>\images\<safeDomain>\<category>[<pathSegments...>]\<baseName>` 기반. `pathSegments?: string[]`가 지정되면 카테고리 하위에 세그먼트 폴더를 추가 생성합니다(xvideos 페이징 액션: `images/<도메인>/<세그먼트>/<월>/<N>/`, 도메인·세그먼트는 `pageUrl`·URL 분석 결과). 자산은 `<baseName>_thumb/sfw.<ext>` 등 `name`에서 파생한 하위 폴더에 저장하고, `mimeToExtension`(`video/mp4`→mp4, `video/webm`→webm 등) 매핑 또는 자산명 확장자로 확장자를 결정합니다.
- **메타 txt**: `txtContent`가 있으면 `<baseName>.txt`로 저장하고 `savedFiles`에 포함합니다.
- **ACK 연계**: `server/src/index.ts`의 `CRAWL_IMAGE` 분기에서 `Array.isArray(payloadObj.assets)` 감지 시 번들 저장을 수행하고 `CRAWL_MEDIA_SAVED`(`bundleId`/`savedDir`/`savedFiles`) ACK를 전송합니다.

### 3.2 페이지 단위 JSON 분리 저장 (`saveCrawlPartialToFile`)

`CRAWL_PARTIAL`의 `pathSegments`를 따라 페이지 단위 JSON 메타를 물리 저장하고 경로/크기를 반환합니다.

```typescript
// server/src/services/fileStorageService.ts

export interface SaveCrawlPartialOptions {
  customNodePath?: string;     // 노드 전용 지정 경로
  workerStoragePath?: string;  // 워커 전용 지정 경로
  globalDefaultPath?: string;  // 글로벌 기본 경로 (configs.data_path 우선, 없으면 "./storage")
  domain: string;              // 루트 도메인 (예: "xvideos.com")
  pathSegments: string[];      // 하위 폴더 세그먼트 (예: ["best","2026-06","16"])
  fileName?: string;           // 저장 파일명 (예: "page-16.json", 기본 "<timestamp>-<seq>.json")
  payload: unknown;            // 저장할 페이로드 원문 (JSON prettify 직렬화)
}

export function saveCrawlPartialToFile(
  options: SaveCrawlPartialOptions
): SaveContentResult;
```

- **경로 규칙**: `<globalDefaultPath|...>\<safeDomain>\<pathSegments를 정화한 폴더들>\<정화된 fileName>`(`images/` 없이 도메인 직하). 각 세그먼트를 `sanitizeFolderName()`으로 정화해 중첩 폴더로 생성하고, 마지막에 JSON(`JSON.stringify(payload, null, 2)`)을 저장합니다.
- **연계 분기**: `server/src/index.ts`의 `CRAWL_PARTIAL` 분기에서 `Array.isArray(payloadObj.pathSegments) && payloadObj.pathSegments.length > 0`이면 호출하고, `updateCrawlLogFile(logId, savedPath, savedSize)`로 `crawl_logs.file_path`/`file_size`를 갱신한 뒤, **`requestId`가 있으면 `CRAWL_PARTIAL_SAVED` ACK(실제 파일 경로/크기/엔트리 수)를 클라이언트에 응답**합니다.

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
- [ ] 이미지가 `<기본 경로>\images\<safeDomain>\<timestamp>-<index>.<ext>` 규격으로 저장되는가?
- [ ] 크로스 오리진 이미지가 스킵되지 않고 `.txt` 참조 파일(page_url/image_url/click_url/title)로 보관되는가?
- [ ] `GET_STORAGE_LOCATION`→`STORAGE_LOCATION_RESPONSE`로 플러그인이 저장 위치(절대/상대)를 조회하는가?
- [ ] 미디어 번들(`assets` 배열)이 `saveCrawledMediaBundle()`로 txt+썸네일+preview.mp4 일괄 저장되고 `CRAWL_MEDIA_SAVED` ACK가 반환되는가?
- [ ] `CRAWL_PARTIAL`의 `pathSegments`가 있으면 `<도메인>/<세그먼트>/<월>/<N>/page-N.json`(`images/` 없음)으로 분리 저장되고 `file_path`/`file_size`가 갱신되며, `requestId`가 있으면 `CRAWL_PARTIAL_SAVED` ACK가 응답되는가?
- [ ] 미디어 번들(`assets` 배열)에 `pathSegments`가 있으면 `images/<도메인>/<category>/<pathSegments...>/` 계층 폴더에 저장되는가?
