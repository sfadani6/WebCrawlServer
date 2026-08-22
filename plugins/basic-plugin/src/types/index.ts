// plugins/basic-plugin/src/types/index.ts

/** 패킷 페이로드 물리 데이터 포맷 구별자 */
export type PayloadType = "json" | "binary_base64" | "raw_text" | "chunk_stream";

/** 파일 및 바이너리 자원 송수신 메타데이터 인터페이스 */
export interface FileMetadata {
  /** 원본 파일명 */
  fileName?: string;
  /** 파일 MIME 타입 */
  mimeType?: string;
  /** 파일 크기 (Bytes) */
  fileSize?: number;
  /** 대용량 파일 분할 조각 인덱스 */
  chunkIndex?: number;
  /** 전체 분할 조각 수 */
  totalChunks?: number;
}

/** 패킷 확장 메타데이터 인터페이스 */
export interface PacketMetadata {
  /** 패킷 생성 시점 타임스탬프 */
  timestamp: number;
  /** 요청 추적 고유 ID */
  traceId?: string;
  /** 첨부 파일 메타데이터 */
  fileMeta?: FileMetadata;
  /** 동적 확장 파라미터 맵 */
  extraParams?: Record<string, unknown>;
}

/**
 * 표준 확장형 웹소켓 통신 패킷 봉투 규격 (ADR-002)
 * senderId, targetId, action, payloadType, payload, meta 구조를 준수합니다.
 */
export interface WebSocketPacket<T = unknown> {
  /** 송신 수집 노드 고유 UUID (clientId) */
  senderId: string;
  /** 수신 타깃 식별자 (ALL, SERVER, 또는 특정 UUID) */
  targetId?: string | "ALL" | "SERVER";
  /** 지시 액션 명령 문자열 */
  action: string;
  /** 페이로드 물리 포맷 */
  payloadType: PayloadType;
  /** 실질 데이터 바디 */
  payload: T;
  /** 확장 메타데이터 객체 */
  meta: PacketMetadata;
}

/** 사이드바 대시보드 탭 구분 타입 */
export type TabType = "basic" | "info" | "debug" | "settings";

/** 플러그인 환경설정 저장 페이로드 구조체 (CLIENT_CONFIG_UPDATE 액션) */
export interface ClientConfigPayload {
  /** 노드 한글 별칭 (환경설정에서 설정·저장 시 서버로 전송) */
  alias?: string;
  /** 플러그인 식별 정보 */
  clientType?: string;
  /** 확장 가능 추가 설정 필드 */
  [key: string]: unknown;
}

/** 플러그인 환경설정 저장 ACK 응답 구조체 (CLIENT_CONFIG_UPDATE_ACK 액션) */
export interface ClientConfigAckPayload {
  /** 저장 성공 여부 */
  success: boolean;
  /** 서버에 반영된 별칭 */
  alias?: string;
  /** 실패 사유 메시지 */
  message?: string;
}

/** 전체 페이지 문서 수집 페이로드 구조체 (CRAWL_DOCUMENT 액션) */
export interface CrawlDocumentPayload {
  /** 수집 페이지 URL */
  url?: string;
  /** 페이지 타이틀 */
  title?: string;
  /** 전체 DOM HTML 원본 (물리 파일 분리 저장 대상) */
  fullDom?: string;
  /** 수집 시점 타임스탬프 */
  timestamp?: number;
  /** 확장 가능 추가 필드 */
  [key: string]: unknown;
}

/** 페이지 일부 데이터 수집 페이로드 구조체 (CRAWL_PARTIAL 액션) */
export interface CrawlPartialPayload {
  /** 수집 페이지 URL */
  url?: string;
  /** 페이지 타이틀 */
  title?: string;
  /** 부분 수집 결과 (링크, 항목, 텍스트 등) */
  data?: unknown;
  /** 수집 시점 타임스탬프 */
  timestamp?: number;
  /** 확장 가능 추가 필드 */
  [key: string]: unknown;
}

/** 바이너리/이미지 파일 전송 페이로드 구조체 (CRAWL_BINARY 액션, payloadType: binary_base64) */
export interface CrawlBinaryPayload {
  /** 원본 파일명 */
  fileName?: string;
  /** 파일 MIME 타입 */
  mimeType?: string;
  /** 수집 페이지 URL */
  url?: string;
  /** Base64 인코딩 바이너리 데이터 */
  data?: string;
  /** 수집 시점 타임스탬프 */
  timestamp?: number;
  /** 확장 가능 추가 필드 */
  [key: string]: unknown;
}

/** 이미지 수집 전송 페이로드 구조체 (CRAWL_IMAGE 액션) */
export interface CrawlImagePayload {
  /** 원본 파일명 */
  fileName?: string;
  /** 이미지 MIME 타입 */
  mimeType?: string;
  /** 이미지 원본 소스 URL */
  url?: string;
  /** 이미지가 포함된 페이지 URL */
  pageUrl?: string;
  /** Base64 인코딩 바이너리 데이터 (성공 시, payloadType: binary_base64) */
  data?: string;
  /** 크로스 오리진 등으로 인한 인출 실패 사유 (실패 시, payloadType: json) */
  error?: string;
  /** 수집 시점 타임스탬프 */
  timestamp?: number;
  /** 확장 가능 추가 필드 */
  [key: string]: unknown;
}

/** xvideos 비디오 블록 수집 항목 구조체 (다운로드 매니저 목록 구성용) */
export interface XvideosMediaEntry {
  /** 비디오 블록 고유 EID (예: "kavfihb169e") */
  eid: string;
  /** 비디오 클릭 URL (절대 경로, .videopv 앵커 또는 썸네일 링크에서 추출) */
  clickUrl: string;
  /** 비디오 제목 (title 속성에서 추출) */
  title: string;
  /** 메인 썸네일 URL (xv_24_t.jpg 등, 단일 영상 페이지에서는 포스터 이미지 1종) */
  mainUrl: string;
  /** 보조(무해) 썸네일 URL (xv_3_t.jpg, data-sfwthumb) — 단일 영상 페이지에서는 빈 문자열 */
  sfwUrl: string;
  /** 프리뷰 mp4 URL (data-pvv) — 단일 영상 페이지에서는 빈 문자열 */
  previewUrl: string;
}

/** 미디어 번들 자산 구조체 (CRAWL_IMAGE 번들 페이로드 assets 항목) */
export interface MediaAssetPayload {
  /** 자산 구분 키 (thumb | sfw | preview) */
  kind: string;
  /** 자산 원본 URL */
  url: string;
  /** 원본 파일명 (확장자 폴백 후보) */
  fileName?: string;
  /** MIME 타입 (예: "image/jpeg", "video/mp4") */
  mimeType?: string;
  /** Base64 인코딩 바이너리 데이터 (다운로드 실패 시 빈 문자열) */
  data?: string;
}

/** 미디어 번들 전송 페이로드 구조체 (CRAWL_IMAGE 번들, payloadType: binary_base64) */
export interface CrawlMediaBundlePayload {
  /** 다운로드 매니저 내 항목 추적 ID (서버 ACK가 동일 ID로 응답) */
  bundleId?: string;
  /** 파일명 시퀀스 (플러그인이 생성한 <timestamp>-<index> 문자열) */
  baseName?: string;
  /** 이미지가 포함된 페이지 URL */
  pageUrl?: string;
  /** 수집 카테고리 (기본 "normal") */
  category?: string;
  /** 비디오 블록 클릭 URL */
  clickUrl?: string;
  /** 비디오 블록 제목 */
  title?: string;
  /** 플러그인이 생성한 txt 메타 원문 (서버가 그대로 저장) */
  txtContent?: string;
  /** 계층 저장 경로 세그먼트 (예: xvideos 페이징 액션: ["best","2026-03","1"]) — 지정 시 해당 폴더에 저장 */
  pathSegments?: string[];
  /** 자산 목록 (최대 3종: thumb/sfw/preview) */
  assets?: MediaAssetPayload[];
  /** 수집 시점 타임스탬프 */
  timestamp?: number;
}

/** 저장 위치 조회 요청 페이로드 구조체 (GET_STORAGE_LOCATION 액션) */
export interface StorageLocationRequestPayload {
  /** 대상 페이지 URL (도메인 산출 기준) */
  pageUrl?: string;
  /** 수집 카테고리 (기본 "normal") */
  category?: string;
}

/** 저장 위치 조회 응답 페이로드 구조체 (STORAGE_LOCATION_RESPONSE 액션) */
export interface StorageLocationResponsePayload {
  /** 조회 성공 여부 */
  success: boolean;
  /** 산출된 루트 도메인 */
  domain?: string;
  /** 수집 카테고리 */
  category?: string;
  /** 저장소 최상위 절대 경로 (configs.data_path) */
  absRoot?: string;
  /** 저장소 루트 기준 상대 경로 (images/<도메인>/<카테고리>) */
  relDir?: string;
  /** 대상 저장 절대 경로 */
  absDir?: string;
  /** 오류 메시지 */
  message?: string;
}

/** 미디어 번들 저장 완료 ACK 페이로드 구조체 (CRAWL_MEDIA_SAVED 액션) */
export interface CrawlMediaSavedAckPayload {
  /** 저장 성공 여부 */
  success: boolean;
  /** 요청한 번들의 추적 ID */
  bundleId?: string;
  /** 실제 저장된 절대 디렉토리 경로 */
  savedDir?: string;
  /** 실제 저장된 파일 절대 경로 목록 */
  savedFiles?: string[];
  /** 총 저장 크기 (Bytes) */
  fileSize?: number;
}

/** 다운로드 매니저 진행률 브로드캐스트 페이로드 구조체 (FETCH_MEDIA_BUNDLE_PROGRESS) */
export interface FetchMediaBundleProgressPayload {
  /** 진행률을 갱신할 항목 추적 ID */
  bundleId: string;
  /** 진행률 퍼센트 (0~100, 오프스크린 단계별 갱신) */
  progress: number;
}

/** xvideos 다운로드 매니저 항목 상태 구분자 */
export type XvideosDownloadStatus = "pending" | "downloading" | "done" | "failed";

/** xvideos 다운로드 매니저 큐 항목 구조체 (DownloadThemAll식 목록 UI 구성용) */
export interface XvideosDownloadItem {
  /** 항목 추적 ID (서버 ACK 매핑용) */
  bundleId: string;
  /** 파일명 시퀀스 (txt/자산 파일명 공통 베이스) */
  baseName: string;
  /** 비디오 블록 메타 항목 */
  entry: XvideosMediaEntry;
  /** 항목 다운로드 상태 */
  status: XvideosDownloadStatus;
  /** 다운로드 진행률 (0~100, 오프스크린 FETCH_MEDIA_BUNDLE_PROGRESS로 갱신) */
  progress: number;
  /** 저장 완료된 절대 디렉토리 경로 (완료 시) */
  savedDir?: string;
  /** 저장 완료된 파일 절대 경로 목록 (완료 시) */
  savedFiles?: string[];
  /** 실패 사유 (실패 시) */
  error?: string;
}

/** 요소 선택 결과 전송 페이로드 구조체 (요소 선택 모드 → CRAWL_PARTIAL) */
export interface CrawlElementPayload {  /** 수집 페이지 URL */
  url?: string;
  /** 페이지 타이틀 */
  title?: string;
  /** 선택된 요소의 outerHTML 전체 */
  data?: {
    /** 요소 태그명 (예: div, section) */
    tag: string;
    /** 요소 id 속성 */
    id?: string;
    /** 요소 class 목록 */
    className?: string;
    /** 선택된 요소의 outerHTML 원문 */
    outerHTML: string;
  };
  /** 수집 시점 타임스탬프 */
  timestamp?: number;
  /** 확장 가능 추가 필드 */
  [key: string]: unknown;
}

/** 일반 채팅 메시지 페이로드 구조체 (CHAT_MESSAGE 액션) */
export interface ChatMessagePayload {
  /** 채팅 본문 */
  message?: string;
  /** 발신자 표시명 */
  author?: string;
  /** 수집 시점 타임스탬프 */
  timestamp?: number;
  /** 확장 가능 추가 필드 */
  [key: string]: unknown;
}

/** 터미널 콘솔 로그 타입 구분자 (admin 네트워크 모니터링 콘솔과 동일 규격) */
export type PluginLogType = "info" | "success" | "error" | "warning" | "cmd";

/** 터미널 콘솔 로그 항목 구조체 */
export interface PluginLogEntry {
  /** 로그 고유 ID */
  id: string;
  /** 로그 기록 시각 (ISO 8601) */
  timestamp: string;
  /** 로그 타입 (색상 분류) */
  type: PluginLogType;
  /** 로그 본문 */
  text: string;
}

/** 웹소켓 연결 상태 응답 객체 */
export interface SocketStatusResponse {
  /** 소켓 연결 여부 */
  connected: boolean;
  /** 클라이언트 고유 UUID */
  clientId?: string;
  /** 서버 포트 번호 */
  port?: number;
}

/** 브라우저 스펙 정보 객체 */
export interface BrowserInfo {
  /** 유저 에이전트 문자열 */
  userAgent: string;
  /** 브라우저 언어 설정 */
  language: string;
  /** 운영체제 플랫폼 */
  platform: string;
  /** 브라우저 벤더 */
  vendor: string;
  /** 쿠키 활성화 여부 */
  cookieEnabled: boolean;
  /** 네트워크 연결 상태 */
  onlineStatus: boolean;
}

/** 브라우저 프로세서 성능 정보 객체 */
export interface ProcessorInfo {
  /** CPU 논리 코어 수 */
  hardwareConcurrency: number;
  /** 디바이스 메모리 (GB, 선택) */
  deviceMemory?: number;
  /** 최대 터치 포인트 수 */
  maxTouchPoints: number;
}

/** xvideos 페이징 초기 정보 응답 구조체 (COLLECT_BEST_OF_RED_INIT) */
export interface XvBestOfRedInitData {
  /** 페이징 베이스 경로 (예: "/best/2026-03", 후행 슬래시 없음 — 현재 URL 분석 결과) */
  basePath: string;
  /** 현재 페이지 인덱스 (0 = 베이스 URL) */
  currentPage: number;
  /** 마지막 페이지 인덱스 (페이지네이션 최대 data-page 신뢰) */
  maxPage: number;
  /** 처리 대상 총 페이지 수 (항상 0부터 전체 순회하므로 maxPage + 1) */
  totalPages: number;
  /** 현재 페이지 전체 URL */
  url: string;
}

/** xvideos 페이징 페이지 수집 응답 구조체 (COLLECT_BEST_OF_RED_PAGE) */
export interface XvBestOfRedPageData {
  /** 로드 완료 검증 여부 (네트워크 안정 + DOM 안정 + 기대 URL 일치) */
  ready: boolean;
  /** 수집 시점 페이지 인덱스 */
  page: number;
  /** 수집 시점 페이지 전체 URL */
  url: string;
  /** 수집 시점 페이지 타이틀 */
  title: string;
  /** 수집된 비디오 블록 메타 목록 (로드 검증 실패 시 빈 배열) */
  data: XvideosMediaEntry[];
  /** 결과 메시지 */
  message: string;
  /** 브라우저 네트워크 상태 모니터링 결과 (로드 검증 시점) */
  network?: {
    /** 페이지 내 인-플라이트 네트워크 요청 수 */
    inflight: number;
    /** 성능 리소스 엔트리 수 */
    resources: number;
    /** 네트워크 안정 판정 여부 */
    stable: boolean;
  };
  /** 로드 검증에 소요된 대기 시간 (ms) */
  waitedMs?: number;
  /** 로드 검증 시점 탭 가시성 (visible/hidden — 백그라운드 판정용) */
  visibilityState?: string;
}

/** xvideos 페이징 페이지 미디어 번들 저장 결과 구조체 (FETCH_PAGE_MEDIA_BUNDLES 응답) */
export interface XvBestOfRedMediaResult {
  /** 전체 성공 여부 (실패 엔트리가 0개일 때만 true) */
  success: boolean;
  /** 성공 처리 엔트리 수 */
  savedCount: number;
  /** 실패 처리 엔트리 수 */
  failedCount: number;
  /** 서버가 저장한 파일 절대 경로 목록 (전 엔트리 합계) */
  savedFiles: string[];
  /** 엔트리별 저장 파일 매핑 (page-N.json 메타 기록용) */
  entryFiles: XvBestOfRedSavedFileInfo[];
  /** 실패 엔트리 정보 목록 (EID/사유) */
  failedEntries: Array<{ eid: string; reason: string }>;
}

/** xvideos 페이징 페이지 저장 결과 구조체 (엔트리별 로컬 저장 파일 경로) */
export interface XvBestOfRedSavedFileInfo {
  /** 엔트리 EID */
  eid: string;
  /** 메인 썸네일 저장 파일 절대 경로 (미저장 시 빈 문자열) */
  thumb?: string;
  /** 보조 썸네일 저장 파일 절대 경로 (미저장 시 빈 문자열) */
  sfw?: string;
  /** 프리뷰 mp4 저장 파일 절대 경로 (미저장 시 빈 문자열) */
  preview?: string;
}

/**
 * 노드 환경설정(별칭) 저장 진행 상태 구분자.
 * 설정 탭 저장 결과 배지의 색상을 결정하는 데 사용됩니다.
 * - pending : 서버 전송 대기 중
 * - success : 저장 완료 (서버 ACK 수신)
 * - error   : 저장 실패 (서버 오류·응답 실패)
 * - warning : 입력 검증 경고 (예: 빈 별칭)
 */
export type ConfigSaveState = "idle" | "pending" | "success" | "error" | "warning";
