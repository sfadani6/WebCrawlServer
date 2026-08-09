// admin/src/services/apiService.ts

import {
  Client,
  ConfigEntry,
  CrawlLog,
  WorkerRecord,
  CustomFieldDef,
  BrowseDirectoryResult,
  PluginMessageRecord,
} from "../types/index.js";

/**
 * 등록된 수집 클라이언트 목록을 백엔드 REST API로부터 인출합니다.
 *
 * @param onlineOnly - true 지정 시 실시간 소켓 가동 노드만 인출
 * @returns 클라이언트 데이터 배열
 */
export async function fetchClientsApi(
  onlineOnly: boolean = false,
): Promise<Client[]> {
  const url = onlineOnly
    ? "/api/db/clients?onlineOnly=true"
    : "/api/db/clients";
  const res = await fetch(url);
  const json = await res.json();
  return json.success ? json.data : [];
}

/**
 * 지정 노드의 환경설정(별칭)을 업데이트합니다.
 * 4컬럼 재구성으로 별칭만 관리하며, 플러그인 환경설정에서도 동일 경로로 저장됩니다.
 *
 * @param clientId - 대상 노드 UUID
 * @param alias - 노드 한글 별칭
 * @returns 성공 여부
 */
export async function updateClientConfigApi(
  clientId: string,
  alias: string,
): Promise<boolean> {
  const res = await fetch(`/api/db/clients/${clientId}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alias }),
  });
  const json = await res.json();
  return json.success;
}

/**
 * 전체 수집 워커 목록을 인출합니다.
 *
 * @returns 워커 레코드 배열
 */
export async function fetchWorkersApi(): Promise<WorkerRecord[]> {
  const res = await fetch("/api/admin/workers");
  const json = await res.json();
  return json.success ? json.data : [];
}

/**
 * 신규 동적 수집 워커 및 타깃 DB 스키마 빌드를 요청합니다.
 *
 * @param params - 워커 생성 옵션 객체
 * @returns 성공 여부
 */
export async function createWorkerApi(params: {
  workerId: string;
  workerName: string;
  dbFileName: string;
  tableName: string;
  storageRootPath: string;
  customFields: CustomFieldDef[];
  isDefault?: boolean;
}): Promise<boolean> {
  const res = await fetch("/api/admin/workers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  return json.success;
}

/**
 * 최근 수집 로그 목록을 인출합니다.
 *
 * @returns 크롤링 로그 배열
 */
export async function fetchLogsApi(): Promise<CrawlLog[]> {
  const res = await fetch("/api/db/logs");
  const json = await res.json();
  return json.success ? json.data : [];
}

/**
 * 데이터베이스 수집 로그 일괄 소거를 요청합니다.
 *
 * @returns 성공 여부
 */
export async function clearLogsApi(): Promise<boolean> {
  const res = await fetch("/api/db/logs", { method: "DELETE" });
  const json = await res.json();
  return json.success;
}

/**
 * 특정 클라이언트 기기를 블랙리스트 차단 추방 요청합니다.
 *
 * @param clientId - 타깃 노드 UUID
 * @returns 성공 여부
 */
export async function purgeClientApi(clientId: string): Promise<boolean> {
  const res = await fetch(`/api/db/clients/${clientId}`, { method: "DELETE" });
  const json = await res.json();
  return json.success;
}

/**
 * 연결된 플러그인에 최신 인증 토큰을 실시간 푸시합니다.
 *
 * @param tokenType - 토큰 구분 키
 * @param token - 최신 토큰 값
 * @returns 성공 여부
 */
export async function pushAuthTokenApi(
  tokenType: string,
  token: string,
): Promise<boolean> {
  const res = await fetch("/api/admin/network/token-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenType, token }),
  });
  const json = await res.json();
  return json.success;
}

/**
 * 시스템 환경 설정(configs) 전체 목록을 백엔드 REST API로부터 인출합니다.
 *
 * @returns 환경 설정 항목 배열 (변수명, 값, 설명)
 */
export async function fetchConfigsApi(): Promise<ConfigEntry[]> {
  const res = await fetch("/api/admin/configs");
  const json = await res.json();
  return json.success ? json.data : [];
}

/**
 * 특정 환경 설정 항목의 값을 수정합니다.
 *
 * @param key - 변경할 설정 변수명
 * @param value - 새 설정 값
 * @returns 성공 여부
 */
export async function updateConfigValueApi(
  key: string,
  value: string,
): Promise<boolean> {
  const res = await fetch(`/api/admin/configs/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  const json = await res.json();
  return json.success;
}

/**
 * 플러그인 수신 메시지 원장(plugin_messages)을 필터 및 페이지네이션으로 인출합니다.
 *
 * @param params - 조회 필터 파라미터 (클라이언트 ID / 액션명 / 건수 제한 / 오프셋 선택)
 * @returns 플러그인 메시지 레코드 배열
 */
export async function fetchPluginMessagesApi(params: {
  clientId?: string;
  action?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<PluginMessageRecord[]> {
  const search = new URLSearchParams();
  if (params.clientId) search.set("clientId", params.clientId);
  if (params.action) search.set("action", params.action);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const query = search.toString();
  const res = await fetch(`/api/db/plugin_messages${query ? `?${query}` : ""}`);
  const json = await res.json();
  return json.success ? json.data : [];
}

/**
 * 파일 브라우저용 디렉토리 목록을 백엔드 REST API로부터 인출합니다.
 *
 * @param path - 조회할 디렉토리 절대 경로 (미지정 시 드라이브 루트 목록 반환)
 * @returns 현재 경로, 부모 경로, 하위 디렉토리 목록
 */
export async function browseDirectoryApi(
  path?: string,
): Promise<BrowseDirectoryResult> {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await fetch(`/api/admin/fs/browse${query}`);
  const json = await res.json();
  return json.success
    ? json.data
    : { currentPath: "", parentPath: null, directories: [] };
}
