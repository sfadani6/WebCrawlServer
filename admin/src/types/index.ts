// admin/src/types/index.ts

/** 수집 노드 클라이언트 데이터 구조체 (4컬럼 재구성 — 별칭은 플러그인 환경설정에서 서버 전송으로 저장) */
export interface Client {
  /** 노드 고유 UUID */
  client_id: string;
  /** 클라이언트 구분 타입 */
  client_type: string;
  /** 노드 한글 별칭 (Alias, 플러그인 환경설정에서 저장) */
  alias?: string;
  /** 최초 접속 타임스탬프 또는 ISO 문자열 */
  connected_at: string;
  /** 백엔드 실시간 소켓 가동 여부 */
  is_online?: boolean;
  /** 사이드바 UI 활성화 여부 */
  is_sidebar_open?: boolean;
}

/** 시스템 환경 설정(configs) 항목 구조체 */
export interface ConfigEntry {
  /** 설정 변수명 (영문 식별자) */
  key: string;
  /** 설정 값 (문자열) */
  value: string;
  /** 설정 항목 설명/코멘트 */
  description?: string;
}

/** 파일 브라우저 디렉토리 항목 구조체 */
export interface BrowseDirectoryEntry {
  /** 디렉토리 이름 */
  name: string;
  /** 디렉토리 절대 경로 */
  path: string;
}

/** 파일 브라우저 디렉토리 목록 조회 결과 구조체 */
export interface BrowseDirectoryResult {
  /** 현재 브라우징 중인 디렉토리 경로 (루트/드라이브 목록일 때 빈 문자열) */
  currentPath: string;
  /** 부모 디렉토리 경로 (더 이상 상위가 없으면 null) */
  parentPath: string | null;
  /** 현재 디렉토리의 하위 디렉토리 목록 */
  directories: BrowseDirectoryEntry[];
}

/** 커스텀 스키마 필드 정의 구조체 */
export interface CustomFieldDef {
  /** 필드 영문 식별자 */
  name: string;
  /** SQLite 필드 데이터 타입 */
  type: "TEXT" | "INTEGER" | "REAL" | "BLOB";
  /** 필수 필드 여부 */
  required?: boolean;
}

/** 워커 데이터베이스 기록 구조체 */
export interface WorkerRecord {
  /** 워커 고유 ID */
  worker_id: string;
  /** 워커 한글 이름 */
  worker_name: string;
  /** 대상 DB 파일 상대 경로 */
  db_file_path: string;
  /** 대상 테이블 이름 */
  table_name: string;
  /** 워커 전용 저장소 루트 경로 */
  storage_root_path: string;
  /** 직렬화된 커스텀 필드 JSON 문자열 */
  schema_json: string;
  /** 디폴트 워커 여부 (1 또는 0) */
  is_default: number;
  /** 생성 시각 */
  created_at: string;
}

/** 플러그인 수신 메시지 원장(plugin_messages) 데이터 구조체 */
export interface PluginMessageRecord {
  /** 레코드 PK ID */
  id: number;
  /** 수신 플러그인 노드 UUID */
  client_id: string;
  /** 메시지 행동 구분 액션명 */
  action: string;
  /** 페이로드 물리 포맷 (json | binary_base64 | raw_text | chunk_stream) */
  payload_type: string;
  /** 직렬화된 페이로드 JSON 문자열 */
  payload_json: string | null;
  /** 직렬화된 메타데이터 JSON 문자열 */
  meta_json: string | null;
  /** 원본 메시지 물리 파일 저장 경로 */
  file_path: string | null;
  /** 저장 파일 크기 (Bytes) */
  file_size: number;
  /** 수신 시점 타임스탬프 */
  timestamp: number;
}

/** 크롤링 수집 로그 데이터 구조체 */
export interface CrawlLog {
  /** DB 레코드 PK ID */
  id: number;
  /** 수집 노드 UUID */
  client_id: string;
  /** 도메인 */
  domain?: string;
  /** 수집 액션 */
  action?: string;
  /** 파일 물리 경로 */
  file_path?: string;
  /** 파일 크기 (Bytes) */
  file_size?: number;
  /** 직렬화된 로그 메시지 바디 */
  log_message: string;
  /** 수집 시점 타임스탬프 */
  timestamp: number;
}

/** 웹소켓 메시지 규격 구조체 */
export interface WebSocketMessage<T = unknown> {
  /** 송신 노드 식별자 */
  senderId: string;
  /** 수신 타깃 식별자 (ALL, SERVER, 또는 특정 UUID) */
  targetId?: string | "ALL" | "SERVER";
  /** 지시 액션 명령 문자열 */
  action: string;
  /** 페이로드 물리 포맷 */
  payloadType?: "json" | "binary_base64" | "raw_text" | "chunk_stream";
  /** 실질 페이로드 바디 */
  payload: T;
  /** 메타데이터 객체 */
  meta?: {
    timestamp: number;
    traceId?: string;
    extraParams?: Record<string, unknown>;
  };
}

/** 웹소켓 통신 가동 상태 타입 */
export type ConnectionStatus = "CONNECTED" | "DISCONNECTED";

/** 대시보드 활성 메인 탭 타입 */
export type ActiveTab = "clients" | "workers" | "db" | "console" | "network" | "logs" | "favicon" | "settings";

/** 노드 리스트 출력 필터 모드 타입 */
export type NodeStatusFilter = "ONLINE" | "ALL" | "OFFLINE";

/** 네트워크 진단 터미널 콘솔 로그 엔트리 구조체 */
export interface TerminalLogEntry {
  /** 로그 고유 ID */
  id: string;
  /** 로그 생성 타임스탬프 (ISO 문자열) */
  timestamp: string;
  /** 로그 타입 (정보, 성공, 경고, 오류, 명령어) */
  type: "info" | "success" | "warning" | "error" | "cmd";
  /** 로그 메시지 본문 */
  text: string;
}

/** 네트워크 헬스체크 응답 구조체 */
export interface NetworkHealthResponse {
  /** 서버 포트 바인딩 상태 */
  portBound: boolean;
  /** 포트 번호 */
  port: number;
  /** 서버 업타임 여부 */
  uptime: boolean;
  /** 서버 시작 시각 */
  startedAt: string;
  /** DB WAL 모드 상태 */
  walModeEnabled: boolean;
  /** 메모리 사용량 (MB) */
  memoryUsage: number;
  /** 응답 지연 시간 (ms) */
  responseTime: number;
}

/** Ping 테스트 결과 구조체 */
export interface PingTestResult {
  /** 테스트 대상 노드 ID */
  clientId: string;
  /** 왕복 지연 시간 (ms) */
  rtt: number;
  /** 테스트 성공 여부 */
  success: boolean;
  /** 테스트 타임스탬프 */
  timestamp: number;
}

/** API 응답 속도 진단 결과 구조체 */
export interface ApiSpeedTestResult {
  /** 엔드포인트 URL */
  endpoint: string;
  /** 응답 시간 (ms) */
  responseTime: number;
  /** 응답 성공 여부 */
  success: boolean;
  /** 테스트 타임스탬프 */
  timestamp: number;
}

/** DB 파일 정보 구조체 (DB 관리 매니저) */
export interface DbFileInfo {
  /** 상대 경로 (예: "databases/workers/foo.db") */
  dbRel: string;
  /** 파일명 (예: "foo.db") */
  fileName: string;
  /** 소속 서브 디렉터리 */
  subDir: string;
  /** 파일 크기 (Bytes) */
  sizeBytes: number;
  /** 최종 수정 시각 (ISO 문자열) */
  modifiedAt: string;
  /** 내부 테이블 수 */
  tableCount: number;
}

/** 테이블 정보 구조체 */
export interface DbTableInfo {
  /** 테이블 이름 */
  name: string;
  /** 레코드 행 수 */
  rowCount: number;
}

/** 컬럼 스키마 정보 구조체 */
export interface DbColumnInfo {
  /** 컬럼명 */
  name: string;
  /** SQLite 데이터 타입 */
  type: string;
  /** NOT NULL 제약 여부 */
  notNull: boolean;
  /** PK 순번 (0이면 PK 아님) */
  pk: number;
  /** 기본값 표현식 */
  defaultValue: unknown;
}

/** 인덱스 정보 구조체 */
export interface DbIndexInfo {
  /** 인덱스 이름 */
  name: string;
  /** UNIQUE 여부 */
  unique: boolean;
  /** 대상 컬럼명 배열 */
  columns: string[];
}

/** 테이블 스키마 조회 결과 구조체 */
export interface TableSchemaResult {
  /** 컬럼 목록 */
  columns: DbColumnInfo[];
  /** 인덱스 목록 */
  indexes: DbIndexInfo[];
  /** 총 행 수 */
  rowCount: number;
}

/** SQL 실행 결과 구조체 */
export interface SqlQueryResult {
  /** 결과 컬럼명 배열 (SELECT 계열) */
  columns: string[];
  /** 결과 행 배열 (SELECT 계열) */
  rows: Record<string, unknown>[];
  /** 영향받은 행 수 */
  affected: number;
  /** 실행 소요 시간 (ms) */
  durationMs: number;
  /** SELECT 계열 쿼리 여부 */
  isSelect: boolean;
  /** 실행 메시지 */
  message: string;
}

/** 테이블 행 조회 결과 구조체 */
export interface TableRowsResult {
  /** 조회된 행 배열 */
  rows: Record<string, unknown>[];
  /** 전체 행 수 */
  total: number;
  /** 현재 페이지 번호 */
  page: number;
  /** 페이지당 행 수 */
  size: number;
}

/** 컬럼 정의 입력 구조체 (테이블 생성/컬럼 추가용) */
export interface ColumnDefInput {
  /** 컬럼명 */
  name: string;
  /** SQLite 데이터 타입 */
  type: string;
  /** NOT NULL 여부 */
  notNull?: boolean;
  /** PK 여부 (테이블 생성 시에만 유효) */
  primaryKey?: boolean;
}

/** 스토리지 모니터링 정보 구조체 */
export interface StorageInfo {
  /** 물리 저장소 루트 절대 경로 */
  storageRootPath: string;
  /** 저장소 존재 여부 */
  exists: boolean;
  /** 총 파일 수 */
  fileCount: number;
  /** 총 사용 용량 (Bytes) */
  totalBytes: number;
  /** DB 파일별 크기 목록 */
  dbFiles: DbFileInfo[];
  /** 백업 디렉터리 크기 (Bytes) */
  backupsBytes: number;
}

/** 백업 파일 정보 구조체 */
export interface BackupInfo {
  /** 백업 파일명 */
  fileName: string;
  /** 크기 (Bytes) */
  sizeBytes: number;
  /** 생성 시각 (ISO 문자열) */
  createdAt: string;
  /** 원본 DB 상대 경로 */
  sourceDbRel: string;
}
