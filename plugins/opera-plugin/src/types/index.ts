// plugins/opera-plugin/src/types/index.ts

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
