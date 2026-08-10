// server/src/services/fileStorageService.ts

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";/** 파일 저장 옵션 구조체 */
export interface SaveContentOptions {
  /** 노드 전용 물리 저장 경로 (최우선 적용) */
  customNodePath?: string;
  /** 워커 전용 물리 저장 경로 (노드 미지정 시 적용) */
  workerStoragePath?: string;
  /** 글로벌 기본 저장 경로 (기본값: "./storage") */
  globalDefaultPath?: string;
  /** 수집 도메인 (예: "aaa.com") */
  domain: string;
  /** DB 레코드 인덱스 ID (예: 1042) */
  dbLogId: number | string;
  /** 저장할 HTML 원본 소스 문자열 */
  htmlContent: string;
}

/** 파일 저장 결과 구조체 */
export interface SaveContentResult {
  /** 최종 저장된 절대 파일 경로 */
  savedFilePath: string;
  /** 저장된 파일 크기 (Bytes) */
  fileSize: number;
}

/**
 * 윈도우 및 리눅스 디렉터리명에 허용되지 않는 특수문자를 언더스코어로 정화합니다.
 *
 * @param name - 정화할 원본 문자열
 * @returns 안전한 파일/폴더명 문자열
 */
function sanitizeFolderName(name: string): string {
  return (name || "common").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

/**
 * 우선순위(노드 전용 > 워커 전용 > 글로벌 기본)에 따라 물리 저장 경로를 결정하고,
 * 수집된 HTML 콘텐츠를 도메인/ID 구조의 디렉터리에 index.html 파일로 디스크에 보관합니다.
 *
 * @param options - 파일 저장 옵션 객체
 * @returns 저장된 파일 경로 및 크기 정보
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

  // 2. 도메인 특수문자 정화 후 세부 디렉터리 경로 구성 (예: ./storage/aaa_com/1042/)
  const safeDomain = sanitizeFolderName(options.domain);
  const targetDir = resolve(
    rootPath,
    safeDomain,
    String(options.dbLogId)
  );

  // 3. 대상 디렉터리 없을 경우 재귀적으로 자동 생성
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // 4. index.html 파일 쓰기 단행
  const targetFilePath = resolve(targetDir, "index.html");
  const buffer = Buffer.from(options.htmlContent, "utf-8");

  writeFileSync(targetFilePath, buffer);

  return {
    savedFilePath: targetFilePath,
    fileSize: buffer.length,
  };
}

/** 플러그인 수신 메시지 원본 파일 저장 옵션 구조체 */
export interface SavePluginMessageOptions {
  /** 글로벌 기본 저장 경로 (기본값: "./storage") */
  globalDefaultPath?: string;
  /** 수신 플러그인 노드 UUID */
  clientId: string;
  /** 메시지 행동 구분 액션명 (예: "CRAWL_DOCUMENT", "CHAT_MESSAGE") */
  action: string;
  /** 페이로드 물리 포맷 (json | binary_base64 | raw_text | chunk_stream) */
  payloadType: string;
  /** 실질 페이로드 데이터 (json 객체 / raw 문자열 / binary_base64 문자열) */
  payload: unknown;
  /** 원장 DB 레코드 ID (파일명 시퀀스로 활용) */
  messageId: number | string;
}

/**
 * 플러그인에서 수신된 원본 메시지를 기본 저장 디렉토리 하위의 클라이언트 고유
 * 디렉토리에 평면 구조로 저장합니다.
 *
 * 저장 경로 규격: <기본경로>/clients/<clientId>/<action>/<timestamp>-<messageId>.<ext>
 * - payloadType이 "json"이면 .json, "binary_base64"이면 .bin, 그 외 .txt 확장자로 저장합니다.
 * - binary_base64는 Base64 디코딩하여 이진 바이트로 보관합니다.
 *
 * @param options - 플러그인 메시지 저장 옵션 객체
 * @returns 저장된 파일 경로 및 크기 정보
 */
export function savePluginMessageToFile(
  options: SavePluginMessageOptions
): SaveContentResult {
  // 1. 기본 저장 루트 경로 결정 (configs.data_path 폴백 연동)
  const rootPath = options.globalDefaultPath || "./storage";

  // 2. 클라이언트 ID 및 액션명 특수문자 정화 후 평면 디렉토리 경로 구성
  const safeClientId = sanitizeFolderName(options.clientId);
  const safeAction = sanitizeFolderName(options.action);
  const targetDir = resolve(rootPath, "clients", safeClientId, safeAction);

  // 3. 대상 디렉토리 없을 경우 재귀적으로 자동 생성
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // 4. 확장자 결정 및 바이트 버퍼 변환
  const ext =
    options.payloadType === "json"
      ? "json"
      : options.payloadType === "binary_base64"
      ? "bin"
      : "txt";

  let buffer: Buffer;
  if (options.payloadType === "binary_base64" && typeof options.payload === "string") {
    // Base64 문자열을 이진 바이트로 디코딩
    buffer = Buffer.from(options.payload, "base64");
  } else if (typeof options.payload === "string") {
    buffer = Buffer.from(options.payload, "utf-8");
  } else {
    // 객체 등 JSON 직렬화 가능 데이터는 예쁜 출력 포맷으로 저장
    buffer = Buffer.from(JSON.stringify(options.payload ?? null, null, 2), "utf-8");
  }

  // 5. 평면 구조 파일명: <timestamp>-<messageId>.<ext>
  const targetFilePath = resolve(
    targetDir,
    `${Date.now()}-${String(options.messageId)}.${ext}`
  );
  writeFileSync(targetFilePath, buffer);

  return {
    savedFilePath: targetFilePath,
    fileSize: buffer.length,
  };
}

/** 이미지 수집 저장 옵션 구조체 (CRAWL_IMAGE 액션) */
export interface SaveCrawledImageOptions {
  /** 글로벌 기본 저장 경로 (기본값: "./storage") */
  globalDefaultPath?: string;
  /** 수집 도메인 (예: "aaa.com") */
  domain: string;
  /** 원본 파일명 (확장자 폴백 후보) */
  fileName?: string;
  /** 이미지 MIME 타입 (예: "image/png") */
  mimeType?: string;
  /** 페이로드 물리 포맷 (binary_base64 성공 / json 실패) */
  payloadType: string;
  /** Base64 인코딩 이미지 바이너리 데이터 (성공 시) */
  data?: string;
  /** 이미지 원본 소스 URL */
  url?: string;
  /** 이미지가 포함된 페이지 URL */
  pageUrl?: string;
  /** 수집 카테고리 (기본 "normal", 사이트별 album/cover 등 저장소 하위 폴더 구분) */
  category?: string;
  /** 인출 실패 사유 (성공 시 미설정, 실패 시 "CORS" 등) */
  error?: string;
  /** 비디오 블록 클릭 URL (xvideos 등 사이트 메타, 있을 때만 txt에 기록) */
  clickUrl?: string;
  /** 비디오 블록 제목 (있을 때만 txt에 기록) */
  title?: string;
}

/** 이미지 저장을 위한 서버 프로세스 내 순차 인덱스 (동일 타임스탬프 충돌 방지) */
let imageSaveSeq = 0;

/**
 * MIME 타입을 파일 확장자로 매핑합니다. 매핑 실패 시 빈 문자열을 반환합니다.
 *
 * @param mimeType - 이미지 MIME 타입
 * @returns 확장자 문자열 (점 제외, 미지원 시 "")
 */
function mimeToExtension(mimeType: string): string {
  switch ((mimeType || "").toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/bmp":
      return "bmp";
    case "image/svg+xml":
      return "svg";
    case "image/ico":
    case "image/x-icon":
      return "ico";
    case "video/mp4":
    case "video/webm":
      return "mp4";
    default:
      return "";
  }
}

/**
 * 수집된 이미지를 전용 폴더에 물리 파일로 보관합니다. (R-00208 이미지 저장소 규격)
 *
 * 저장 경로 규격: <기본경로>/images/<도메인>/<카테고리>/<timestamp>-<index>.<ext>
 * - binary_base64 성공 페이로드: Base64 디코딩 후 MIME 확장자로 바이너리 저장
 * - json 실패 페이로드(CORS 등): 원본 URL만 담은 .txt 참조 파일로 보관 (스킵하지 않음)
 *
 * @param options - 이미지 저장 옵션 객체
 * @returns 저장된 파일 경로 및 크기 정보
 */
export function saveCrawledImage(
  options: SaveCrawledImageOptions
): SaveContentResult {
  // 1. 저장소 최상위 루트 경로 결정
  const rootPath = options.globalDefaultPath || "./storage";

  // 2. 도메인/카테고리 특수문자 정화 후 이미지 전용 디렉터리 구성 (예: ./storage/images/aaa_com/normal/)
  const safeDomain = sanitizeFolderName(options.domain);
  const safeCategory = sanitizeFolderName(options.category || "normal");
  const targetDir = resolve(rootPath, "images", safeDomain, safeCategory);

  // 3. 대상 디렉터리 없을 경우 재귀적으로 자동 생성
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // 4. 파일명 시퀀스 증가 및 확장자 결정
  imageSaveSeq += 1;
  const seq = String(imageSaveSeq % 10000).padStart(4, "0");
  const baseName = `${Date.now()}-${seq}`;

  let buffer: Buffer;
  let ext: string;

  if (options.payloadType === "binary_base64" && options.data) {
    // 성공 페이로드: MIME 기반 확장자 → Base64 디코딩 바이너리 저장
    ext = mimeToExtension(options.mimeType || "");
    if (!ext) {
      // MIME 미지원 시 원본 파일명 확장자 폴백
      const fileExt = (options.fileName || "").split(".").pop();
      ext = fileExt && fileExt.length > 0 && fileExt.length <= 5 ? fileExt : "bin";
    }
    buffer = Buffer.from(options.data, "base64");
  } else {
    // 실패 페이로드(CORS 등): 원본 URL만 담은 참조 파일로 보관 (확장자: .txt)
    ext = "txt";
    const refText =
      `# WebCrawlServer 이미지 참조 파일\n` +
      `# 인출 실패 사유: ${options.error || "UNKNOWN"}\n` +
      `page_url: ${options.pageUrl || ""}\n` +
      `image_url: ${options.url || ""}\n` +
      (options.clickUrl ? `click_url: ${options.clickUrl}\n` : "") +
      (options.title ? `title: ${options.title}\n` : "");
    buffer = Buffer.from(refText, "utf-8");
  }

  // 5. 파일명: <timestamp>-<index>.<ext>
  const targetFilePath = resolve(targetDir, `${baseName}.${ext}`);
  writeFileSync(targetFilePath, buffer);

  return {
    savedFilePath: targetFilePath,
    fileSize: buffer.length,
  };
}

/** 사이트 정보 수집 저장 옵션 구조체 (SITE_INFO 액션) */
export interface SaveSiteInfoOptions {
  /** 글로벌 기본 저장 경로 (기본값: "./storage") */
  globalDefaultPath?: string;
  /** 수집 도메인 (예: "xchina.co") */
  domain: string;
  /** 페이지 메타데이터 정보 객체 */
  info: Record<string, unknown>;
}

/**
 * 정보 수집 버튼에서 전송된 페이지 메타데이터를 JSON 물리 파일로 보관합니다.
 *
 * 저장 경로 규격: <기본경로>/images/<도메인>/info/<timestamp>-<index>.json
 *
 * @param options - 사이트 정보 저장 옵션 객체
 * @returns 저장된 파일 경로 및 크기 정보
 */
export function saveSiteInfoToFile(
  options: SaveSiteInfoOptions
): SaveContentResult {
  const rootPath = options.globalDefaultPath || "./storage";
  const safeDomain = sanitizeFolderName(options.domain);
  const targetDir = resolve(rootPath, "images", safeDomain, "info");

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  imageSaveSeq += 1;
  const seq = String(imageSaveSeq % 10000).padStart(4, "0");
  const targetFilePath = resolve(targetDir, `${Date.now()}-${seq}.json`);
  const buffer = Buffer.from(JSON.stringify(options.info ?? null, null, 2), "utf-8");

  writeFileSync(targetFilePath, buffer);

  return {
    savedFilePath: targetFilePath,
    fileSize: buffer.length,
  };
}

/** 미디어 번들 자산 옵션 구조체 (xvideos 블록의 썸네일/프리뷰 mp4) */
export interface CrawledMediaAssetOptions {
  /** 자산 구분 키 (thumb | sfw | preview) — 파일명 접미사로 사용 */
  kind: string;
  /** 자산 원본 URL */
  url: string;
  /** 원본 파일명 (확장자 폴백 후보) */
  fileName?: string;
  /** MIME 타입 (예: "image/jpeg", "video/mp4") */
  mimeType?: string;
  /** Base64 인코딩 바이너리 데이터 (다운로드 실패 시 빈 문자열 → 파일 스킵) */
  data?: string;
}

/** 미디어 번들 저장 옵션 구조체 (CRAWL_IMAGE 번들 페이로드) */
export interface SaveCrawledMediaBundleOptions {
  /** 글로벌 기본 저장 경로 (기본값: "./storage") */
  globalDefaultPath?: string;
  /** 수집 도메인 (예: "xvideos.com") */
  domain: string;
  /** 이미지가 포함된 페이지 URL */
  pageUrl?: string;
  /** 수집 카테고리 (기본 "normal") */
  category?: string;
  /** 비디오 블록 클릭 URL */
  clickUrl?: string;
  /** 비디오 블록 제목 */
  title?: string;
  /** 파일명 시퀀스 (플러그인이 생성한 <timestamp>-<index> 문자열) */
  baseName: string;
  /** 플러그인이 생성한 txt 메타 원문 */
  txtContent: string;
  /** 자산 목록 (최대 3종: thumb/sfw/preview) */
  assets: CrawledMediaAssetOptions[];
}

/** 미디어 번들 저장 결과 구조체 */
export interface SaveCrawledMediaBundleResult extends SaveContentResult {
  /** 최종 저장된 절대 디렉토리 경로 */
  savedDir: string;
  /** 실제 저장된 자산/메타 파일 절대 경로 목록 */
  savedFiles: string[];
}

/**
 * xvideos 미디어 번들(썸네일/보조썸네일/프리뷰 mp4 + 플러그인 생성 txt 메타)을
 * 전용 폴더에 물리 파일로 보관합니다. (R-00208 이미지 저장소 규격 확장)
 *
 * 저장 경로 규격: <기본경로>/images/<도메인>/<카테고리>/<timestamp>-<index>.<ext>
 * - txt: 플러그인이 생성한 메타 원문(click_url/title/자산 URL/저장 파일 목록)을 그대로 저장
 * - 자산: Base64 디코딩 후 MIME 확장자로 <baseName>_<kind>.<ext> 바이너리 저장
 * - 다운로드 실패 자산(data 미존재)은 바이너리를 스킵하며, 실패 내역은 txt에 기록됩니다.
 *
 * @param options - 미디어 번들 저장 옵션 객체
 * @returns 저장된 디렉토리/파일 목록 및 크기 정보
 */
export function saveCrawledMediaBundle(
  options: SaveCrawledMediaBundleOptions
): SaveCrawledMediaBundleResult {
  // 1. 저장소 최상위 루트 경로 결정
  const rootPath = options.globalDefaultPath || "./storage";

  // 2. 도메인/카테고리 특수문자 정화 후 이미지 전용 디렉터리 구성
  const safeDomain = sanitizeFolderName(options.domain);
  const safeCategory = sanitizeFolderName(options.category || "normal");
  const targetDir = resolve(rootPath, "images", safeDomain, safeCategory);

  // 3. 대상 디렉터리 없을 경우 재귀적으로 자동 생성
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // 4. 파일명 베이스 (플러그인이 생성한 <timestamp>-<index> 사용, 서버 시퀀스 불필요)
  const baseName =
    options.baseName && options.baseName.trim().length > 0
      ? options.baseName.trim()
      : `${Date.now()}-${String(++imageSaveSeq % 10000).padStart(4, "0")}`;

  // 5. txt 메타 파일 저장 (플러그인 생성 원문 그대로)
  const txtPath = resolve(targetDir, `${baseName}.txt`);
  const txtBuffer = Buffer.from(options.txtContent || "", "utf-8");
  writeFileSync(txtPath, txtBuffer);

  // 6. 자산 바이너리 저장 (다운로드 실패 자산은 건너뜀)
  const savedFiles: string[] = [txtPath];
  let totalSize = txtBuffer.length;

  for (const asset of options.assets || []) {
    if (!asset.data) continue;
    let ext = mimeToExtension(asset.mimeType || "");
    if (!ext) {
      // MIME 미지원 시 원본 파일명 확장자 폴백
      const fileExt = (asset.fileName || "").split(".").pop();
      ext = fileExt && fileExt.length > 0 && fileExt.length <= 5 ? fileExt : "bin";
    }
    const safeKind = sanitizeFolderName(asset.kind || "asset");
    const assetPath = resolve(targetDir, `${baseName}_${safeKind}.${ext}`);
    const buffer = Buffer.from(asset.data, "base64");
    writeFileSync(assetPath, buffer);
    savedFiles.push(assetPath);
    totalSize += buffer.length;
  }

  return {
    savedFilePath: txtPath,
    fileSize: totalSize,
    savedDir: targetDir,
    savedFiles,
  };
}
