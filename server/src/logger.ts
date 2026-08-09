import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ESM 빌드 환경에서도 정확히 루트 폴더 하위 logs 디렉토리를 식별하게 경로 연산 수행
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 실행 물리 위치에 무관하게 항상 최상위 루트 디렉토리 내부 logs 폴더 탐색 및 정합
const logsDir = resolve(__dirname, "..", "..", "logs");

// 기동 시점에 해당 로그 전용 물리 폴더 부재 시 자동 감지하여 일괄 동적 생성 처리 (크래시 중단 방지)
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

/**
 * 로그 라인 선두에 기입할 표준 ISO 8601 형식의 현재 시각 문자열을 취득합니다.
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 1. 브라우저 플러그인과 백엔드 소켓 간 수신 데이터 및 세션 소멸 정보를 로그 파일로 기록합니다.
 * 타깃 경로: logs\plugins_comm.log
 *
 * @param clientId - 수집 장비 UUID 고유 키값
 * @param action - 수행 명령 유형 (예: "CRAWL_START")
 * @param message - 전달 유실 탐지 정보 및 패킷 원시 문자열
 */
export function logPluginComm(
  clientId: string,
  action: string,
  message: string,
): void {
  try {
    const filePath = resolve(logsDir, "plugins_comm.log");
    const logLine = `[${getTimestamp()}] [CLIENT: ${clientId}] [ACTION: ${action}] - ${message}\n`;
    appendFileSync(filePath, logLine, "utf-8");
  } catch {
    // 로그 파일 기록 실패가 소켓 통신·DB 처리 흐름을 중단하지 않도록 예외를 격리합니다.
    // (appendFileSync 실패 시 상위 패킷 처리 전체가 죽는 취약점 차단)
  }
}

/**
 * 2. Express 및 웹소켓 네트워크 구동, DB 연결상태 및 무중단 예외 로그를 기록합니다.
 * 타깃 경로: logs\server_system.log
 *
 * @param level - 로그 위험 단계 수준 지정 ('INFO' | 'WARN' | 'ERROR')
 * @param message - 상세 예외 출력 문구
 */
export function logServerSystem(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
): void {
  try {
    const filePath = resolve(logsDir, "server_system.log");
    const logLine = `[${getTimestamp()}] [${level}] - ${message}\n`;
    appendFileSync(filePath, logLine, "utf-8");
  } catch {
    // 시스템 로그 기록 실패가 서버 운영 흐름을 중단하지 않도록 예외를 격리합니다.
  }
}

/**
 * 3. 관리자 제어 대시보드가 단행한 통제 동작 및 전체 릴레이 요청 내역을 기록합니다.
 * 타깃 경로: logs\admin_activity.log
 *
 * @param adminId - 관리자 세션 UUID 키값
 * @param actionType - 명령 식별 유형
 * @param detail - 수신 타깃 정보 및 세부 실행 정보
 */
export function logAdminActivity(
  adminId: string,
  actionType: string,
  detail: string,
): void {
  const filePath = resolve(logsDir, "admin_activity.log");
  const logLine = `[${getTimestamp()}] [ADMIN: ${adminId}] [ACTION: ${actionType}] - ${detail}\n`;
  appendFileSync(filePath, logLine, "utf-8");
}
