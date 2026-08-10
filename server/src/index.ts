// server/src/index.ts

import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { exec } from "node:child_process";
import dns from "node:dns";
import os from "node:os";
import { promisify } from "node:util";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  openSync,
  writeSync,
  closeSync,
  statSync,
  readdirSync,
} from "node:fs";
import {
  initializeDatabase,
  getAllClients,
  getCrawlLogs,
  clearAllCrawlLogs,
  purgeClient,
  insertCrawlLog,
  upsertClient,
  updateClientConfig,
  insertPluginMessage,
  updatePluginMessageFile,
  getPluginMessages,
  updateCrawlLogFile,
  getAllWorkers,
  getWorkerById,
  createDynamicWorker,
  CreateWorkerParams,
  getAllConfigs,
  updateConfigValue,
  insertSystemLog,
} from "./database.js";
import {
  saveCrawledContentToFile,
  savePluginMessageToFile,
  saveCrawledImage,
  saveSiteInfoToFile,
  saveCrawledMediaBundle,
  SaveCrawledMediaBundleOptions,
} from "./services/fileStorageService.js";
import { executeWorkerPipeline } from "./services/workerEngineService.js";
import {
  listDbFiles,
  listTables,
  getTableSchema,
  executeQuery,
  fetchTableRows,
  insertTableRow,
  updateTableRow,
  deleteTableRow,
  createTable,
  dropTable,
  addColumn,
  createBackup,
  listBackups,
  getBackupBuffer,
  restoreBackup,
  restoreBackupFromFile,
  getStorageInfo,
} from "./services/dbManagerService.js";
import { logServerSystem, logAdminActivity, logPluginComm } from "./logger.js";

/** 클라이언트 세션 식별 유형 */
export type ClientType = "plugin" | "admin";

/** 백엔드 실시간 클라이언트 세션 구조체 */
export interface ClientSession {
  /** 웹소켓 인스턴스 */
  socket: WebSocket;
  /** 클라이언트 고유 UUID */
  clientId: string;
  /** 클라이언트 구분 타입 */
  clientType: ClientType;
  /** 연결 수립 시각 */
  connectedAt: Date;
  /** 노드 한글 별칭 */
  alias?: string;
  /** 사이드바 UI 열림 활성화 여부 */
  isSidebarOpen?: boolean;
  /** 마지막 통신 수신 타임스탬프 */
  lastSeen?: number;
  /** 최근 RTT(ms) 샘플 링 버퍼 — 최대 RTT_SAMPLE_LIMIT개 유지 (네트워크 지연 진단용) */
  rttSamples?: number[];
  /** 서버→플러그인 PING_TEST 발신 시각 추적 맵 — key: PING payload.timestamp, value: 발신 시각 */
  pendingPings?: Record<string, number>;
}

/** 패킷 메타데이터 구조체 */
export interface PacketMetadata {
  /** 생성 시점 타임스탬프 */
  timestamp: number;
  /** 요청 추적 고유 ID */
  traceId?: string;
  /** 동적 확장 파라미터 맵 */
  extraParams?: Record<string, unknown>;
}

/**
 * 확장형 표준 웹소켓 메시지 봉투 구조체
 * ADR-002: 확장 가능 패킷 봉투 프로토콜 규격
 */
export interface WebSocketMessage<T = unknown> {
  /** 송신 노드 식별자 */
  senderId: string;
  /** 수신 타깃 식별자 (ALL, SERVER, 또는 특정 UUID) */
  targetId?: string | "ALL" | "SERVER";
  /** 지시 액션 명령 문자열 */
  action: string;
  /** 데이터 포맷 유형 */
  payloadType?: "json" | "binary_base64" | "raw_text" | "chunk_stream";
  /** 실질 페이로드 바디 */
  payload: T;
  /** 메타데이터 객체 */
  meta?: PacketMetadata;
}

// ESM 환경에서 __dirname 대체 경로 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 정적 파일 제공 경로 (admin 빌드 산출물 또는 public/)
const publicPath = resolve(__dirname, "..", "public");

const app = express();
const server = createServer(app);

/**
 * 예외 객체로부터 한글 오류 메시지를 안전하게 추출합니다.
 *
 * @param error - 발생한 예외 객체
 * @returns 문자열 오류 메시지
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "알 수 없는 오류가 발생했습니다.";
}

/**
 * 호스트명에서 www. 서브도메인을 제거한 루트 도메인으로 정규화합니다.
 * (예: "www.xchina.co" → "xchina.co", "xchina.co" → "xchina.co")
 * 플러그인의 matchSiteDomain()이 서브도메인을 허용하므로, 저장 폴더를
 * 사이트 도메인 단위로 통일하기 위해 사용합니다. 그 외 서브도메인(m. 등)은 유지합니다.
 *
 * @param hostname - 원본 호스트명
 * @returns 정규화된 루트 도메인 문자열
 */
function normalizeRootDomain(hostname: string): string {
  const lower = (hostname || "").toLowerCase();
  if (lower.startsWith("www.")) return lower.slice(4);
  return lower;
}

/**
 * configs 테이블의 data_path(데이터 저장 디렉토리) 값을 조회합니다.
 * 설정값이 없거나 비어 있으면 빈 문자열을 반환합니다.
 *
 * @returns 데이터 저장 기본 경로 문자열 (없으면 "")
 */
function getConfigDataPath(): string {
  return getAllConfigs().find((c) => c.key === "data_path")?.value?.trim() || "";
}

/**
 * 서버 기동 시 초기 환경 설정 값의 유효성을 검증합니다.
 * configs 테이블의 data_path(데이터 저장 디렉토리)가 실제 존재하지 않으면
 * 디렉토리를 자동 생성하고 systemlog 테이블에 부재 발견/생성 완료 2건을 기록합니다.
 * 디렉토리가 이미 존재하면 기록을 남기지 않습니다.
 */
function runStartupValidation(): void {
  try {
    const dataPath = getConfigDataPath();
    if (!dataPath) {
      return;
    }
    const absDataPath = resolve(dataPath);

    // 디렉토리가 이미 존재하면 기록 없이 통과
    if (existsSync(absDataPath) && statSync(absDataPath).isDirectory()) {
      return;
    }

    // 부재 발견 기록 후 디렉토리 생성 및 생성 완료 기록
    insertSystemLog(
      "CONFIG",
      `데이터 저장 디렉토리 부재 발견: ${absDataPath}`
    );
    mkdirSync(absDataPath, { recursive: true });
    insertSystemLog(
      "CONFIG",
      `데이터 저장 디렉토리 생성 완료: ${absDataPath}`
    );
    logServerSystem(
      "INFO",
      `데이터 저장 디렉토리가 없어 자동 생성함: ${absDataPath}`
    );
  } catch (error: unknown) {
    logServerSystem(
      "ERROR",
      `초기 환경 설정 검증 실패: ${getErrorMessage(error)}`
    );
  }
}

/**
 * Windows에서 존재하는 드라이브 루트 목록(예: ["C:\\", "D:\\"])을 탐지합니다.
 * 비 Windows 플랫폼에서는 단일 루트("/")만 반환합니다.
 *
 * @returns 드라이브/루트 경로 문자열 배열
 */
function getDriveRoots(): string[] {
  if (process.platform === "win32") {
    const drives: string[] = [];
    for (let i = 0; i < 26; i += 1) {
      const letter = String.fromCharCode(65 + i);
      const rootPath = `${letter}:\\`;
      if (existsSync(rootPath)) {
        drives.push(rootPath);
      }
    }
    return drives;
  }
  return ["/"];
}

app.use(express.json());
app.use(express.static(publicPath));

const devServerOrigins = [
  process.env.ADMIN_DEV_SERVER_URL,
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
].filter((value): value is string => Boolean(value));

/**
 * 로컬 Vite 개발 서버가 실행 중이면 SPA 및 모듈 요청을 그쪽으로 프록시합니다.
 * 이를 통해 프로덕션 번들 빌드 없이도 관리자 앱이 9600 포트에서 바로 렌더링됩니다.
 */
app.use(async (req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) {
    return next();
  }

  for (const devServerOrigin of devServerOrigins) {
    try {
      const upstreamUrl = new URL(req.originalUrl, devServerOrigin);
      const upstreamResponse = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          accept:
            req.get("accept") ||
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!upstreamResponse.ok) {
        continue;
      }

      const contentType = upstreamResponse.headers.get("content-type") || "";
      const shouldProxy =
        contentType.includes("text/html") ||
        contentType.includes("application/javascript") ||
        contentType.includes("text/javascript") ||
        contentType.includes("text/css") ||
        req.path.startsWith("/src/") ||
        req.path.startsWith("/@vite/") ||
        req.path.startsWith("/node_modules/");

      if (!shouldProxy) {
        return next();
      }

      res.status(upstreamResponse.status);
      for (const [
        headerName,
        headerValue,
      ] of upstreamResponse.headers.entries()) {
        if (headerName.toLowerCase() !== "content-encoding") {
          res.setHeader(headerName, headerValue);
        }
      }

      const body = Buffer.from(await upstreamResponse.arrayBuffer());
      res.send(body);
      return;
    } catch {
      continue;
    }
  }

  return next();
});

// SQLite 데이터베이스 및 디폴트 워커 초기화
initializeDatabase();

// 초기 환경 설정 값 검증 (데이터 저장 디렉토리 실존 확인 및 자동 생성)
runStartupValidation();

/** 세션별 RTT 샘플 최대 보관 개수 (링 버퍼 크기) */
const RTT_SAMPLE_LIMIT = 20;

/** 실시간 활성 클라이언트 세션 관리 맵 (clientId → ClientSession) */
export const activeClients = new Map<string, ClientSession>();

/**
 * [REST API 1] 등록된 클라이언트 목록 조회
 * Query Parameter: ?onlineOnly=true 지정 시 실시간 소켓 가동 노드만 필터링 반환
 */
app.get("/api/db/clients", (req, res) => {
  try {
    const onlineOnly = req.query.onlineOnly === "true";
    const clients = getAllClients();

    // 실시간 세션 맵과 대조하여 온라인/사이드바 상태 플래그 추가
    let result = clients.map((c) => {
      const session = activeClients.get(c.client_id);
      const isOnline = !!(
        session && session.socket.readyState === WebSocket.OPEN
      );
      return {
        ...c,
        is_online: isOnline,
        is_sidebar_open: isOnline ? !!session.isSidebarOpen : false,
      };
    });

    // onlineOnly 필터 적용
    if (onlineOnly) {
      result = result.filter((c) => c.is_online);
    }

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    logServerSystem("ERROR", `Clients API 에러 반환: ${errorMessage}`);
    res.status(500).json({ success: false, message: errorMessage });
  }
});

/**
 * [REST API 2] 특정 클라이언트 노드의 환경설정(별칭) 저장
 * 별칭은 플러그인 환경설정 저장 시 WebSocket으로도 전송되며, admin REST에서도 변경 가능합니다.
 * 실시간 세션 메타도 함께 갱신합니다.
 */
app.put("/api/db/clients/:clientId/config", (req, res) => {
  try {
    const { clientId } = req.params;
    const { alias } = req.body;

    // DB 환경설정 업데이트 (4컬럼 재구성: 별칭만 관리)
    updateClientConfig(clientId, alias);

    // 실시간 세션 메타 동기화
    const session = activeClients.get(clientId);
    if (session) {
      session.alias = alias;
    }

    logAdminActivity(
      "SUPER_ADMIN",
      "UPDATE_NODE_CONFIG",
      `노드 환경설정 변경 완료 [ID: ${clientId}] [별칭: ${alias}]`,
    );

    res.json({ success: true, message: "노드 환경설정이 저장되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [REST API 3] 전체 수집 워커 목록 인출
 */
app.get("/api/admin/workers", (_req, res) => {
  try {
    const workers = getAllWorkers();
    res.json({ success: true, data: workers });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [REST API 4] 신규 동적 수집 워커 생성 및 타깃 DB 동적 빌드
 */
app.post("/api/admin/workers", (req, res) => {
  try {
    const params: CreateWorkerParams = req.body;
    createDynamicWorker(params);

    logAdminActivity(
      "SUPER_ADMIN",
      "CREATE_WORKER",
      `신규 수집 워커 생성 완료 [ID: ${params.workerId}] [이름: ${params.workerName}]`,
    );

    res.json({
      success: true,
      message: "수집 워커가 성공적으로 생성되었습니다.",
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

const execAsync = promisify(exec);
const dnsLookup = promisify(dns.lookup);

/**
 * 내부 유틸리티: 셸 명령을 비동기로 실행합니다.
 * Windows에서 로케일 의존 명령(netstat 등)의 한글 출력이 깨지지 않도록
 * encoding 옵션으로 'euc-kr'을 지원합니다. (한글 코드페이지 CP949 출력을 디코딩)
 */
async function runShellCommand(
  command: string,
  encoding: "utf8" | "euc-kr" = "utf8",
): Promise<string> {
  const options = {
    maxBuffer: 12 * 1024 * 1024,
    windowsHide: true,
  } as const;
  if (encoding === "euc-kr") {
    const { stdout, stderr } = await execAsync(command, {
      ...options,
      encoding: "buffer",
    });
    const buffer = (stdout || stderr) as Buffer;
    return new TextDecoder("euc-kr").decode(buffer).trim();
  }
  const { stdout, stderr } = await execAsync(command, options);
  return (stdout || stderr).toString().trim();
}

function getServerLogTail(lines: number): string {
  try {
    const logPath = resolve(__dirname, "..", "logs", "server_system.log");
    if (!existsSync(logPath)) {
      return "서버 로그 파일을 찾을 수 없습니다.";
    }
    const content = readFileSync(logPath, "utf8");
    const allLines = content.trim().split(/\r?\n/);
    return allLines.slice(-lines).join("\n");
  } catch (error: unknown) {
    return `로그 조회 오류: ${getErrorMessage(error)}`;
  }
}

/**
 * [REST API 5] 시스템 환경 설정(configs) 목록 조회
 * 서버 기동 시 server/configs.json 디폴트로 시드된 설정 항목(변수명/값/코멘트)을 반환합니다.
 */
app.get("/api/admin/configs", (_req, res) => {
  try {
    res.json({ success: true, data: getAllConfigs() });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [REST API 5] 시스템 환경 설정(configs) 값 수정
 * 코멘트(description)는 유지하고 value만 갱신합니다. 존재하지 않는 키는 404를 반환합니다.
 * Body: { value: string }
 */
app.put("/api/admin/configs/:key", (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body as { value?: unknown };

    // 빈 문자열이 아닌 문자열 값만 허용 (입력 검증)
    if (typeof value !== "string" || value.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "value는 비어 있지 않은 문자열이어야 합니다.",
      });
      return;
    }

    const changed = updateConfigValue(key, value);
    if (changed === 0) {
      res.status(404).json({
        success: false,
        message: `설정 항목 [${key}]이(가) 존재하지 않습니다.`,
      });
      return;
    }

    logAdminActivity(
      "SUPER_ADMIN",
      "CONFIG_UPDATE",
      `환경 설정 변경 [${key}] = ${value}`
    );
    res.json({
      success: true,
      message: `설정 항목 [${key}]이(가) 저장되었습니다.`,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [REST API 5] 파일 시스템 디렉토리 브라우징 (파일 브라우저용)
 * path 미지정 시 드라이브 루트 목록을, path 지정 시 해당 디렉토리의
 * 하위 디렉토리 목록과 부모 경로를 반환합니다. 로컬 서버 전용이며
 * 전체 파일 시스템 탐색을 허용합니다.
 */
app.get("/api/admin/fs/browse", (req, res) => {
  try {
    const rawPath =
      typeof req.query.path === "string" ? req.query.path.trim() : "";

    // path 미지정/빈 문자열 → 드라이브 루트 목록 반환
    if (!rawPath) {
      res.json({
        success: true,
        data: {
          currentPath: "",
          parentPath: null,
          directories: getDriveRoots().map((root) => ({
            name: root,
            path: root,
          })),
        },
      });
      return;
    }

    const absPath = resolve(rawPath);

    // 존재하지 않는 경로 → 404
    if (!existsSync(absPath)) {
      res.status(404).json({
        success: false,
        message: `존재하지 않는 경로입니다: ${absPath}`,
      });
      return;
    }

    // 디렉토리가 아닌 경로 → 400
    if (!statSync(absPath).isDirectory()) {
      res.status(400).json({
        success: false,
        message: `디렉토리가 아닙니다: ${absPath}`,
      });
      return;
    }

    // 하위 디렉토리만 수집 (파일 제외, 파일명 오름차순 정렬)
    const entries = readdirSync(absPath, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: resolve(absPath, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parent = dirname(absPath);
    res.json({
      success: true,
      data: {
        currentPath: absPath,
        parentPath: parent === absPath ? null : parent,
        directories,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [REST API 5] Windows 파일 탐색기로 디렉토리 열기 (DB 관리 file_path 연동)
 * Body: { path: string }
 * 브라우저 내부 파일 브라우저 레이어가 아닌 OS 네이티브 탐색기를 실행합니다.
 * 파일 경로가 전달되면 해당 파일이 있는 부모 디렉토리까지만, 디렉토리 경로면 그 디렉토리를 엽니다.
 * 로컬 서버 전용이며 전체 파일 시스템 접근을 허용합니다.
 */
app.post("/api/admin/fs/open-explorer", (req, res) => {
  try {
    const { path: targetPath } = req.body as { path?: unknown };
    const rawPath = String(targetPath || "").trim();
    if (!rawPath) {
      res.status(400).json({
        success: false,
        message: "path 필드가 필요합니다.",
      });
      return;
    }

    const absPath = resolve(rawPath);

    // 존재하지 않는 경로 → 404
    if (!existsSync(absPath)) {
      res.status(404).json({
        success: false,
        message: `존재하지 않는 경로입니다: ${absPath}`,
      });
      return;
    }

    // 파일이면 부모 디렉토리, 디렉토리면 그대로 (파일 자체는 연결 프로그램 없이 디렉토리까지만)
    const isDirectory = statSync(absPath).isDirectory();
    const openDir = isDirectory ? absPath : dirname(absPath);
    if (!existsSync(openDir)) {
      res.status(404).json({
        success: false,
        message: `열 수 없는 경로입니다: ${openDir}`,
      });
      return;
    }

    // OS 네이티브 탐색기 실행 (실패해도 프로세스 실행 자체는 성공 처리)
    const command =
      os.platform() === "win32"
        ? `explorer "${openDir}"`
        : `xdg-open "${openDir}" 2>/dev/null || open "${openDir}"`;
    try {
      exec(command, { windowsHide: true });
    } catch {
      // 탐색기 실행 실패는 응답 오류로 반환하지 않고 로그만 남김
      logAdminActivity(
        "SUPER_ADMIN",
        "FS_OPEN_EXPLORER",
        `탐색기 실행 실패 [${openDir}]`
      );
    }

    logAdminActivity(
      "SUPER_ADMIN",
      "FS_OPEN_EXPLORER",
      `파일 탐색기 열기 [${openDir}] (원본: ${absPath}, 디렉토리: ${isDirectory})`
    );
    res.json({
      success: true,
      data: { openedPath: openDir, isDirectory },
      message: `파일 탐색기를 열었습니다: ${openDir}`,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [REST API 6] 디스크 스토리지 모니터링 상태 조회
 * 기본 저장 경로 우선순위: configs.data_path > STORAGE_ROOT_PATH > ./storage
 */
app.get("/api/admin/storage/status", (_req, res) => {
  try {
    const rootPath =
      getConfigDataPath() ||
      process.env.STORAGE_ROOT_PATH ||
      "./storage";
    res.json({
      success: true,
      data: {
        storageRootPath: resolve(rootPath),
        status: "NORMAL",
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [REST API 6] 서버 측 네트워크 진단 명령 실행
 */
app.post("/api/admin/network/diagnostic", async (req, res) => {
  const { command, targetId, payload } = req.body as {
    command?: string;
    targetId?: string;
    payload?: unknown;
  };

  if (!command) {
    res
      .status(400)
      .json({ success: false, message: "command 필드가 필요합니다." });
    return;
  }

  try {
    let output: unknown;
    let executedCommand = "";
    switch (command) {
      case "netstat_all":
        executedCommand =
          process.platform === "win32" ? "netstat -ano" : "netstat -an";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "netstat_9600":
        executedCommand =
          process.platform === "win32"
            ? "netstat -ano | findstr :9600"
            : "netstat -an | grep ':9600' || true";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "netstat_established":
        executedCommand =
          process.platform === "win32"
            ? "netstat -ano | findstr ESTABLISHED"
            : "netstat -an | grep ESTABLISHED || true";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "netstat_listening":
        executedCommand =
          process.platform === "win32"
            ? "netstat -ano | findstr LISTENING"
            : "netstat -an | grep LISTEN || true";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "netstat_e":
        executedCommand =
          process.platform === "win32" ? "netstat -e" : "netstat -es";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "netstat_s":
        executedCommand = "netstat -s";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "netstat_r":
        executedCommand = "netstat -r";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "netstat_watch_2s":
        executedCommand =
          process.platform === "win32"
            ? 'powershell -Command "netstat -ano; Start-Sleep -Seconds 2; netstat -ano"'
            : "sh -lc 'netstat -an; sleep 2; netstat -an'";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "tcp_9600":
        executedCommand =
          process.platform === "win32"
            ? "netstat -ano | findstr :9600"
            : "netstat -an | grep ':9600' || true";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "node_sockets": {
        // 가동 중인 모든 node.exe 프로세스가 점유한 소켓/포트 목록 일괄 출력
        // netstat 출력에는 프로세스명이 없고 PID만 존재하므로, node.exe PID 목록을 먼저
        // 수집한 뒤 netstat 출력과 교차 매칭하여 해당 PID가 점유한 소켓 라인만 필터링합니다.
        const isWin = process.platform === "win32";
        if (isWin) {
          // Windows: tasklist CSV 출력에서 node.exe PID(2번째 필드) 추출
          executedCommand =
            'tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH; netstat -ano';
          const taskOutput = await runShellCommand(
            'tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH',
            "euc-kr",
          );
          const nodePids = taskOutput
            .split(/\r?\n/)
            .map((line) => /^\s*"[^"]*"\s*,\s*"(\d+)"/.exec(line)?.[1])
            .filter((pid): pid is string => typeof pid === "string");

          // netstat 전체 출력 중 node.exe PID로 끝나는 라인만 교차 매칭
          const netstatOutput = await runShellCommand("netstat -ano", "euc-kr");
          const pidSet = new Set(nodePids);
          const sockets = netstatOutput
            .split(/\r?\n/)
            .filter((line) => {
              const pidMatch = /(\d+)\s*$/.exec(line.trim());
              return pidMatch ? pidSet.has(pidMatch[1]) : false;
            });
          output = { nodePids, socketCount: sockets.length, sockets };
        } else {
          // 비-Windows: pgrep로 node PID 수집 후 ss 출력과 교차 매칭 (best-effort)
          executedCommand = "pgrep -x node 2>/dev/null || true; ss -tunap 2>/dev/null || true";
          const pidOutput = await runShellCommand("pgrep -x node 2>/dev/null || true", "utf8");
          const nodePids = pidOutput
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);
          let socketText = "";
          try {
            socketText = await runShellCommand("ss -tunap 2>/dev/null || true", "utf8");
          } catch {
            socketText = "ss 명령을 사용할 수 없습니다.";
          }
          const pidSet = new Set(nodePids);
          const sockets = socketText
            .split(/\r?\n/)
            .filter((line) => {
              const pidMatch = /pid=(\d+)/.exec(line);
              return pidMatch ? pidSet.has(pidMatch[1]) : false;
            });
          output = { nodePids, socketCount: sockets.length, sockets };
        }
        break;
      }
      case "system_listen_ports":
        // 현재 컴퓨터 전체에서 접속 대기 중(State = Listen)인 포트 및 PID 스캔
        // Windows는 -o 옵션을 포함해 PID까지 함께 표시합니다.
        executedCommand =
          process.platform === "win32"
            ? "netstat -ano | findstr LISTENING"
            : "netstat -anp | grep LISTEN || true";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "disk_io_2s": {
        // 2초간 지속 쓰기 벤치마크로 물리 디스크 쓰기 성능(MB/s)을 측정합니다.
        executedCommand =
          'Node.js: 1MB chunk를 2초간 tmp/disk_io_2s_test.bin에 writeSync 반복 (디스크 쓰기 벤치마크)';
        const tempDir = resolve(__dirname, "..", "..", "tmp");
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
        const tempFile = resolve(tempDir, "disk_io_2s_test.bin");
        const chunk = Buffer.alloc(1024 * 1024, 0x61);
        const startTime = Date.now();
        const deadline = startTime + 2000;
        let totalBytes = 0;
        const fd = openSync(tempFile, "w");
        try {
          while (Date.now() < deadline) {
            writeSync(fd, chunk, 0, chunk.length);
            totalBytes += chunk.length;
          }
        } finally {
          closeSync(fd);
        }
        const elapsedSec = (Date.now() - startTime) / 1000;
        const writeMbps = totalBytes / (1024 * 1024) / elapsedSec;
        output = {
          durationSeconds: Number(elapsedSec.toFixed(2)),
          writtenBytes: totalBytes,
          writeMbps: Number(writeMbps.toFixed(2)),
        };
        break;
      }
      case "cpu_usage":
        executedCommand =
          "Node.js: os.cpus() + os.loadavg() + process.cpuUsage()";
        output = {
          cpus: os.cpus(),
          loadAverage: process.platform === "win32" ? null : os.loadavg(),
          processCpuUsage: process.cpuUsage(),
        };
        break;
      case "memory_usage":
        executedCommand =
          "Node.js: os.totalmem() + os.freemem() + process.memoryUsage()";
        output = {
          totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
          freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
          heapUsage: process.memoryUsage(),
        };
        break;
      case "sqlite_wal": {
        executedCommand =
          "Node.js: existsSync('databases/data.db-wal') (WAL 파일 존재 여부)";
        const walPath = resolve(
          __dirname,
          "..",
          "..",
          "databases",
          "data.db-wal",
        );
        output = {
          walExists: existsSync(walPath),
          walFilePath: walPath,
        };
        break;
      }
      case "server_pid":
        executedCommand = "Node.js: process.pid + process.title";
        output = { pid: process.pid, title: process.title };
        break;
      case "system_logs":
        executedCommand = "Node.js: getServerLogTail(40) (최근 40줄 로그)";
        output = getServerLogTail(40);
        break;
      case "external_connectivity": {
        const url = "https://example.com";
        executedCommand = `Node.js: fetch('${url}', { method: 'HEAD' })`;
        const response = await fetch(url, { method: "HEAD" });
        output = {
          url,
          status: response.status,
          ok: response.ok,
          redirected: response.redirected,
        };
        break;
      }
      case "dns_lookup": {
        const target = String(targetId || "example.com");
        executedCommand = `Node.js: dns.lookup('${target}')`;
        const result = await dnsLookup(target);
        output = result;
        break;
      }
      case "http_cors": {
        const url = "https://jsonplaceholder.typicode.com/posts/1";
        executedCommand = `Node.js: fetch('${url}')`;
        const response = await fetch(url);
        output = {
          url,
          status: response.status,
          ok: response.ok,
          contentType: response.headers.get("content-type"),
        };
        break;
      }
      case "port_scan":
        executedCommand =
          process.platform === "win32"
            ? "netstat -an | findstr LISTENING"
            : "netstat -an | grep LISTEN || true";
        output = await runShellCommand(
          executedCommand,
          process.platform === "win32" ? "euc-kr" : "utf8",
        );
        break;
      case "disk_io": {
        executedCommand =
          "Node.js: writeFileSync + readFileSync(tmp/disk_io_test.txt) I/O 벤치마크";
        const tempDir = resolve(__dirname, "..", "..", "tmp");
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
        const tempFile = resolve(tempDir, "disk_io_test.txt");
        const payloadText = "disk io inspection sample data\n".repeat(50);
        const startWrite = Date.now();
        writeFileSync(tempFile, payloadText, "utf8");
        const writeTime = Date.now() - startWrite;
        const startRead = Date.now();
        readFileSync(tempFile, "utf8");
        const readTime = Date.now() - startRead;
        output = { tempFile, writeTimeMs: writeTime, readTimeMs: readTime };
        break;
      }
      case "host_interfaces":
        executedCommand = "Node.js: os.networkInterfaces()";
        output = os.networkInterfaces();
        break;
      case "avg_rtt": {
        // 세션별 누적 RTT 샘플(최근 20개)을 기반으로 평균/최대/최소 RTT를 산출합니다.
        executedCommand =
          "Node.js: activeClients 루프 - 세션 rttSamples(최근 20개) 집계";
        const rttRows = Array.from(activeClients.entries())
          .filter(([, session]) => session.clientType === "plugin")
          .map(([clientId, session]) => {
            const samples = session.rttSamples ?? [];
            const avg =
              samples.length > 0
                ? samples.reduce((sum, v) => sum + v, 0) / samples.length
                : 0;
            return {
              clientId,
              alias: session.alias ?? undefined,
              isSidebarOpen: session.isSidebarOpen ?? false,
              sampleCount: samples.length,
              avgRttMs: Number(avg.toFixed(1)),
              minRttMs: samples.length > 0 ? Math.min(...samples) : null,
              maxRttMs: samples.length > 0 ? Math.max(...samples) : null,
              lastRttMs: samples.length > 0 ? samples[samples.length - 1] : null,
            };
          });
        output = { sampleLimit: RTT_SAMPLE_LIMIT, nodes: rttRows };
        break;
      }
      case "cleanup_dead_sockets": {
        // 비정상(OPEN 아님) 상태의 소켓 세션을 탐색해 강제 종료하고 세션 맵에서 제거합니다.
        executedCommand =
          "Node.js: activeClients 루프 - readyState !== OPEN인 소켓 close(4002) + 세션 제거";
        let cleaned = 0;
        for (const [clientId, session] of activeClients.entries()) {
          if (!session.socket || session.socket.readyState !== WebSocket.OPEN) {
            try {
              session.socket?.close(4002, "데드 소켓 정화");
            } catch {
              // 정화 중 개별 소켓 예외는 무시하고 계속 진행합니다.
            }
            activeClients.delete(clientId);
            cleaned += 1;
            logServerSystem("INFO", `데드 소켓 정화: ${clientId} 세션 제거`);
          }
        }
        output = { cleaned, remaining: activeClients.size };
        break;
      }
      case "diagnostic_report":
        executedCommand =
          "Node.js: process.uptime() + os.* + existsSync(WAL) + getServerLogTail(10) 종합 리포트";
        output = {
          uptimeSeconds: process.uptime(),
          port:
            typeof process.env.SERVER_PORT !== "undefined"
              ? Number(process.env.SERVER_PORT)
              : 9600,
          nodePid: process.pid,
          totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
          freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
          walMode: existsSync(
            resolve(__dirname, "..", "..", "databases", "data.db-wal"),
          ),
          logTail: getServerLogTail(10),
        };
        break;
      default:
        output = `지원되지 않는 진단 명령입니다: ${command}`;
        break;
    }

    res.json({
      success: true,
      data: { command, executedCommand, output },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

app.post("/api/admin/network/token-push", (req, res) => {
  try {
    const { tokenType, token } = req.body as {
      tokenType?: string;
      token?: string;
    };
    if (!tokenType || !token) {
      res.status(400).json({
        success: false,
        message: "tokenType 및 token 모두 필요합니다.",
      });
      return;
    }

    broadcastUpdatedToken(tokenType, token);
    res.json({ success: true, message: "실시간 토큰 푸시가 완료되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [REST API 6] 네트워크 헬스체크 및 서버 상태 진단
 * 서버 업타임, 포트 바인딩 상태, DB 상태, 메모리 사용량 등 종합 진단 정보 반환
 */
app.get("/api/admin/network/health", (_req, res) => {
  try {
    const requestStart = Date.now();
    const serverUptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const totalMemoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    const serverAddress = server.address();
    const portBound = serverAddress !== null;
    const port =
      typeof process.env.SERVER_PORT !== "undefined"
        ? Number(process.env.SERVER_PORT)
        : 9600;

    let walModeEnabled = false;
    try {
      initializeDatabase();
      walModeEnabled = true;
    } catch {
      walModeEnabled = false;
    }

    const responseTime = Date.now() - requestStart;

    res.json({
      success: true,
      data: {
        portBound,
        port,
        uptime: serverUptime > 0,
        startedAt: new Date(Date.now() - serverUptime * 1000).toISOString(),
        walModeEnabled,
        memoryUsage: totalMemoryMB,
        responseTime,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [REST API 7] 최근 수집 로그 인출 (최신 100건)
 */
app.get("/api/db/logs", (_req, res) => {
  try {
    const logs = getCrawlLogs(100, 0);
    res.json({ success: true, data: logs });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    logServerSystem("ERROR", `Logs API 에러 반환: ${errorMessage}`);
    res.status(500).json({ success: false, message: errorMessage });
  }
});

/**
 * [REST API 7] 플러그인 수신 메시지 원장(plugin_messages) 조회
 * serverlogs.db의 plugin_messages 원장 테이블에서 필터/페이지네이션으로 인출합니다.
 * Query: ?clientId=<uuid>&action=<action>&limit=<n>&offset=<n>
 */
app.get("/api/db/plugin_messages", (req, res) => {
  try {
    const messages = getPluginMessages({
      clientId: String(req.query.clientId || ""),
      action: String(req.query.action || ""),
      limit: Number(req.query.limit) || 100,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, data: messages });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    logServerSystem("ERROR", `Plugin Messages API 에러 반환: ${errorMessage}`);
    res.status(500).json({ success: false, message: errorMessage });
  }
});

/**
 * [REST API 7] 전체 수집 로그 일괄 소거
 */
app.delete("/api/db/logs", (_req, res) => {
  try {
    clearAllCrawlLogs();
    logAdminActivity(
      "SUPER_ADMIN",
      "DELETE_ALL_LOGS",
      "전체 수집 로그 일괄 소거",
    );
    res.json({ success: true, message: "모든 수집 로그가 소거되었습니다." });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    logServerSystem("ERROR", `Logs Delete API 에러 반환: ${errorMessage}`);
    res.status(500).json({ success: false, message: errorMessage });
  }
});

/**
 * [REST API 8] 특정 클라이언트 차단 추방 (Purge)
 * 백엔드 포트(9600)와 24시간 무중단 단일 웹소켓 통신망을 수립합니다.
 */
app.delete("/api/db/clients/:clientId", (req, res) => {
  try {
    const targetId = req.params.clientId;

    // DB에서 클라이언트 레코드 영구 삭제
    purgeClient(targetId);

    // 실시간 소켓이 가동 중일 경우 강제 종료
    if (activeClients.has(targetId)) {
      const session = activeClients.get(targetId);
      if (session && session.socket.readyState === WebSocket.OPEN) {
        session.socket.close(4002, "관리자에 의한 영구 차단 추방");
      }
      activeClients.delete(targetId);
    }

    logAdminActivity(
      "SUPER_ADMIN",
      "PURGE_CLIENT",
      `클라이언트 영구 추방: ${targetId}`,
    );
    res.json({ success: true, message: "클라이언트가 차단 정화되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/* =========================================================================
 * [DB 관리 매니저 REST API] (R-00203 확장 / R-00304 DB 매니저 UI 규격)
 * 대상 DB는 databases/ 및 databases/workers/ 내부의 .db 파일로 제한되며,
 * dbRel 쿼리 파라미터는 서버측 화이트리스트 검증을 거칩니다.
 * ========================================================================= */

/**
 * [DB API 1] 전체 DB 파일 목록 조회 (databases/ + databases/workers/)
 */
app.get("/api/admin/db/files", (_req, res) => {
  try {
    res.json({ success: true, data: listDbFiles() });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 2] 대상 DB의 테이블 목록 조회
 * Query: ?dbRel=databases/workers/foo.db
 */
app.get("/api/admin/db/tables", (req, res) => {
  try {
    const dbRel = String(req.query.dbRel || "");
    res.json({ success: true, data: listTables(dbRel) });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 3] 대상 DB 특정 테이블의 스키마 조회
 * Query: ?dbRel=...&table=...
 */
app.get("/api/admin/db/schema", (req, res) => {
  try {
    const dbRel = String(req.query.dbRel || "");
    const table = String(req.query.table || "");
    res.json({ success: true, data: getTableSchema(dbRel, table) });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 4] 대상 DB에 대해 임의 SQL 구문 실행
 * Body: { dbRel: string, sql: string }
 * 쓰기/DDL 구문 실행 시 관리자 활동 로그를 남깁니다.
 */
app.post("/api/admin/db/query", (req, res) => {
  try {
    const { dbRel, sql } = req.body as { dbRel?: string; sql?: string };
    if (!dbRel || !sql) {
      res
        .status(400)
        .json({ success: false, message: "dbRel과 sql 필드가 필요합니다." });
      return;
    }
    const result = executeQuery(dbRel, sql);
    if (!result.isSelect) {
      logAdminActivity(
        "SUPER_ADMIN",
        "DB_QUERY_WRITE",
        `DB 쓰기 쿼리 실행 [DB: ${dbRel}] [영향: ${result.affected}]`
      );
    }
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 5] 데이터 그리드용 테이블 행 조회 (페이지네이션/검색/정렬)
 * Query: ?dbRel=...&table=...&page=1&size=20&search=&searchField=&orderBy=&orderDir=
 * size 미지정 시 기본값 20 (configs.db_page_size와 연동은 관리자 UI에서 전달)
 */
app.get("/api/admin/db/rows", (req, res) => {
  try {
    const dbRel = String(req.query.dbRel || "");
    const table = String(req.query.table || "");
    const page = Number(req.query.page) || 1;
    const size = Number(req.query.size) || 20;
    const search = String(req.query.search || "");
    const searchField = String(req.query.searchField || "");
    const orderBy = String(req.query.orderBy || "");
    const orderDir = String(req.query.orderDir || "asc");
    res.json({
      success: true,
      data: fetchTableRows(dbRel, table, page, size, search, searchField, orderBy, orderDir),
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 6] 테이블 행 추가
 * Body: { dbRel, table, data: Record<string, unknown> }
 */
app.post("/api/admin/db/rows", (req, res) => {
  try {
    const { dbRel, table, data } = req.body as {
      dbRel?: string;
      table?: string;
      data?: Record<string, unknown>;
    };
    if (!dbRel || !table || !data) {
      res
        .status(400)
        .json({ success: false, message: "dbRel/table/data 필드가 필요합니다." });
      return;
    }
    const pk = insertTableRow(dbRel, table, data);
    logAdminActivity("SUPER_ADMIN", "DB_ROW_INSERT", `행 추가 [DB: ${dbRel}] [테이블: ${table}]`);
    res.json({ success: true, data: { pk }, message: "행이 추가되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 7] 테이블 행 수정
 * Body: { dbRel, table, data }
 * Path: /:pkValue
 */
app.put("/api/admin/db/rows/:pkValue", (req, res) => {
  try {
    const { dbRel, table, data } = req.body as {
      dbRel?: string;
      table?: string;
      data?: Record<string, unknown>;
    };
    const pkValue = String(req.params.pkValue);
    if (!dbRel || !table || !data) {
      res
        .status(400)
        .json({ success: false, message: "dbRel/table/data 필드가 필요합니다." });
      return;
    }
    updateTableRow(dbRel, table, pkValue, data);
    logAdminActivity("SUPER_ADMIN", "DB_ROW_UPDATE", `행 수정 [DB: ${dbRel}] [테이블: ${table}] [PK: ${pkValue}]`);
    res.json({ success: true, message: "행이 수정되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 8] 테이블 행 삭제
 * Query: ?dbRel=...&table=...
 * Path: /:pkValue
 */
app.delete("/api/admin/db/rows/:pkValue", (req, res) => {
  try {
    const dbRel = String(req.query.dbRel || "");
    const table = String(req.query.table || "");
    const pkValue = String(req.params.pkValue);
    deleteTableRow(dbRel, table, pkValue);
    logAdminActivity("SUPER_ADMIN", "DB_ROW_DELETE", `행 삭제 [DB: ${dbRel}] [테이블: ${table}] [PK: ${pkValue}]`);
    res.json({ success: true, message: "행이 삭제되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 9] 신규 테이블 생성
 * Body: { dbRel, tableName, columns: ColumnDefInput[] }
 */
app.post("/api/admin/db/tables", (req, res) => {
  try {
    const { dbRel, tableName, columns } = req.body as {
      dbRel?: string;
      tableName?: string;
      columns?: Parameters<typeof createTable>[2];
    };
    if (!dbRel || !tableName || !Array.isArray(columns)) {
      res
        .status(400)
        .json({ success: false, message: "dbRel/tableName/columns 필드가 필요합니다." });
      return;
    }
    createTable(dbRel, tableName, columns);
    logAdminActivity("SUPER_ADMIN", "DB_TABLE_CREATE", `테이블 생성 [DB: ${dbRel}] [테이블: ${tableName}]`);
    res.json({ success: true, message: "테이블이 생성되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 10] 테이블 삭제
 * Query: ?dbRel=...
 * Path: /:tableName
 */
app.delete("/api/admin/db/tables/:tableName", (req, res) => {
  try {
    const dbRel = String(req.query.dbRel || "");
    const tableName = String(req.params.tableName);
    dropTable(dbRel, tableName);
    logAdminActivity("SUPER_ADMIN", "DB_TABLE_DROP", `테이블 삭제 [DB: ${dbRel}] [테이블: ${tableName}]`);
    res.json({ success: true, message: "테이블이 삭제되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 11] 테이블 컬럼 추가
 * Body: { dbRel, column: ColumnDefInput }
 * Path: /:tableName
 */
app.post("/api/admin/db/tables/:tableName/columns", (req, res) => {
  try {
    const { dbRel, column } = req.body as {
      dbRel?: string;
      column?: Parameters<typeof addColumn>[2];
    };
    const tableName = String(req.params.tableName);
    if (!dbRel || !column) {
      res
        .status(400)
        .json({ success: false, message: "dbRel/column 필드가 필요합니다." });
      return;
    }
    addColumn(dbRel, tableName, column);
    logAdminActivity("SUPER_ADMIN", "DB_COLUMN_ADD", `컬럼 추가 [DB: ${dbRel}] [테이블: ${tableName}] [컬럼: ${column.name}]`);
    res.json({ success: true, message: "컬럼이 추가되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 12] 대상 DB 백업 생성
 * Body: { dbRel }
 */
app.post("/api/admin/db/backups", (req, res) => {
  try {
    const { dbRel } = req.body as { dbRel?: string };
    if (!dbRel) {
      res.status(400).json({ success: false, message: "dbRel 필드가 필요합니다." });
      return;
    }
    const fileName = createBackup(dbRel);
    logAdminActivity("SUPER_ADMIN", "DB_BACKUP_CREATE", `DB 백업 생성 [DB: ${dbRel}] [파일: ${fileName}]`);
    res.json({ success: true, data: { fileName }, message: "백업이 생성되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 13] 백업 파일 목록 조회
 */
app.get("/api/admin/db/backups", (_req, res) => {
  try {
    res.json({ success: true, data: listBackups() });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 14] 백업 파일 다운로드
 * Query: ?fileName=...
 */
app.get("/api/admin/db/backups/download", (req, res) => {
  try {
    const fileName = String(req.query.fileName || "");
    const { buffer, fileName: safeName } = getBackupBuffer(fileName);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(safeName)}"`
    );
    res.send(buffer);
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 15] DB 파일 업로드 복원
 * Body: { dbRel, contentBase64 }
 * 복원 전 원본을 backups/에 자동 보존 백업합니다.
 */
app.post(
  "/api/admin/db/restore",
  express.json({ limit: "200mb" }),
  (req, res) => {
    try {
      const { dbRel, contentBase64 } = req.body as {
        dbRel?: string;
        contentBase64?: string;
      };
      if (!dbRel || !contentBase64) {
        res
          .status(400)
          .json({ success: false, message: "dbRel/contentBase64 필드가 필요합니다." });
        return;
      }
      const message = restoreBackup(dbRel, contentBase64);
      logAdminActivity("SUPER_ADMIN", "DB_RESTORE", `DB 복원 완료 [DB: ${dbRel}]`);
      res.json({ success: true, message });
    } catch (error: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(error) });
    }
  }
);

/**
 * [DB API 15-2] 기존 백업 파일을 대상 DB에 직접 복원
 * Body: { dbRel, fileName }
 * 복원 전 원본을 backups/에 자동 보존 백업합니다.
 */
app.post("/api/admin/db/backups/restore", (req, res) => {
  try {
    const { dbRel, fileName } = req.body as {
      dbRel?: string;
      fileName?: string;
    };
    if (!dbRel || !fileName) {
      res
        .status(400)
        .json({ success: false, message: "dbRel/fileName 필드가 필요합니다." });
      return;
    }
    const message = restoreBackupFromFile(dbRel, fileName);
    logAdminActivity("SUPER_ADMIN", "DB_RESTORE", `백업 복원 완료 [DB: ${dbRel}] [파일: ${fileName}]`);
    res.json({ success: true, message });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * [DB API 16] 스토리지 모니터링 정보 조회
 * 물리 저장소 용량 + DB 파일 크기 + 백업 용량을 통합 반환합니다.
 */
app.get("/api/admin/db/storage-info", (_req, res) => {
  try {
    res.json({ success: true, data: getStorageInfo() });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * 연결된 모든 수집 노드(플러그인)로 최신 인증 토큰을 실시간 웹소켓 푸시합니다.
 * ADR-003: 백그라운드 페치 스크래핑 및 깃허브 동기화 규격 연동
 *
 * @param tokenType - 토큰 구분 식별자 (예: "githubToken")
 * @param newToken - 최신 인증 토큰 값
 */
export function broadcastUpdatedToken(
  tokenType: string,
  newToken: string,
): void {
  const tokenPacket: WebSocketMessage = {
    senderId: "server",
    targetId: "ALL",
    action: "UPDATE_AUTH_TOKEN",
    payloadType: "json",
    payload: { tokenType, token: newToken },
    meta: { timestamp: Date.now() },
  };

  activeClients.forEach((client) => {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(tokenPacket));
    }
  });
}

/**
 * 노드(플러그인) 세션 상태 변화를 연결된 모든 admin 클라이언트에 실시간 푸시합니다.
 * 세션 마운트, 세션 해제, 사이드바 상태 변경 시 호출되어 admin 대시보드의
 * 온라인 노드 목록이 DB 재조회 없이 즉시 갱신되도록 합니다.
 */
export function broadcastClientsChanged(): void {
  const changePacket: WebSocketMessage = {
    senderId: "server",
    targetId: "ALL",
    action: "CLIENTS_UPDATED",
    payloadType: "json",
    payload: { timestamp: Date.now() },
    meta: { timestamp: Date.now() },
  };

  activeClients.forEach((client) => {
    if (
      client.clientType === "admin" &&
      client.socket.readyState === WebSocket.OPEN
    ) {
      client.socket.send(JSON.stringify(changePacket));
    }
  });
}

// 웹소켓 서버 초기화
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const host =
    req.headers.host || `localhost:${process.env.SERVER_PORT || 9600}`;
  const url = new URL(req.url || "", `http://${host}`);

  // 연결 파라미터 추출 및 유효성 검증
  const clientId = url.searchParams.get("clientId");
  const clientType = url.searchParams.get("clientType") as ClientType;

  if (!clientId || (clientType !== "plugin" && clientType !== "admin")) {
    ws.close(4000, "식별 정보 누락으로 연결 거부");
    return;
  }

  // 중복 세션 가드 정화 (클라이언트 1개당 단 1개 소켓만 보장)
  if (activeClients.has(clientId)) {
    const existing = activeClients.get(clientId);
    if (existing && existing.socket.readyState === WebSocket.OPEN) {
      existing.socket.close(4001, "중복 세션 정화");
    }
    activeClients.delete(clientId);
  }

  // 새 세션 등록
  activeClients.set(clientId, {
    socket: ws,
    clientId,
    clientType,
    connectedAt: new Date(),
    isSidebarOpen: false,
    lastSeen: Date.now(),
  });

  // 세션 마운트 시 클라이언트 DB 자동 등록 (CRAWL_LOG 수신 여부와 무관)
  upsertClient(clientId, clientType);

  logServerSystem(
    "INFO",
    `세션 마운트 성공: [ID: ${clientId}] [TYPE: ${clientType}]`,
  );

  // 노드 상태 변화를 admin 대시보드에 실시간 푸시
  broadcastClientsChanged();

  ws.on("message", (data: WebSocket.RawData) => {
    try {
      // ws 'message' 이벤트의 data는 기본적으로 Buffer 형태이므로,
      // 이후 코드에서 문자열 API(substring 등)를 안전하게 사용할 수 있도록 string으로 변환한다.
      const rawData = typeof data === "string" ? data : data.toString();
      const message: WebSocketMessage = JSON.parse(rawData);
      message.senderId = clientId;

      // 마지막 통신 시각 갱신
      const session = activeClients.get(clientId);
      if (session) session.lastSeen = Date.now();

      // 0. 플러그인 수신 메시지 원장 저장 (serverlogs.db plugin_messages + 물리 파일 평면 구조)
      // 모든 액션(환경설정/수집/채팅/바이너리/지시 등)을 수신 순서대로 보존하며,
      // 저장 실패가 발생해도 소켓 통신은 중단되지 않도록 개별 try/catch로 가드합니다.
      try {
        let payloadJson: string | null = null;
        // binary_base64는 원본을 DB에 담지 않고 물리 파일로만 보존 (payload_json은 요약 기록)
        if (message.payloadType === "binary_base64") {
          payloadJson = JSON.stringify({
            binaryHint: "원본 바이너리는 물리 파일로 저장됩니다.",
          });
        } else if (typeof message.payload === "string") {
          payloadJson = message.payload;
        } else {
          payloadJson = JSON.stringify(message.payload ?? null);
        }

        const metaJson = message.meta
          ? JSON.stringify(message.meta)
          : null;

        // chunk_stream 조각은 원장에만 기록 (파일 저장은 조각 합본 단계에서 처리)
        const isChunkStream = message.payloadType === "chunk_stream";
        const messageId = insertPluginMessage(
          clientId,
          message.action,
          message.payloadType || "json",
          payloadJson,
          metaJson,
        );

        if (!isChunkStream) {
          const fileRes = savePluginMessageToFile({
            globalDefaultPath: getConfigDataPath() || undefined,
            clientId,
            action: message.action,
            payloadType: message.payloadType || "json",
            payload: message.payload,
            messageId,
          });
          // 저장된 물리 파일 경로를 원장 레코드에 반영
          updatePluginMessageFile(
            messageId,
            fileRes.savedFilePath,
            fileRes.fileSize
          );
        }
      } catch (storeError) {
        // 원장/파일 저장 실패 시 시스템 로그만 남기고 통신은 지속
        logServerSystem(
          "WARN",
          `플러그인 메시지 원장 저장 실패 [ID: ${clientId}]: ${getErrorMessage(storeError)}`,
        );
      }

      // 1. 사이드바 열림/닫힘 상태 업데이트 패킷 처리 (ADR-001 사이드바/오프스크린 아키텍처)
      if (message.action === "CLIENT_STATUS_UPDATE" && session) {
        const payload = message.payload as { isSidebarOpen?: boolean };
        session.isSidebarOpen = !!payload.isSidebarOpen;
        logPluginComm(
          clientId,
          "CLIENT_STATUS_UPDATE",
          `사이드바 상태: ${session.isSidebarOpen ? "OPEN(활성)" : "CLOSED(비활성)"}`,
        );
        // 사이드바 상태 변화를 admin 대시보드에 실시간 푸시
        broadcastClientsChanged();
        return;
      }

      // PONG_RESPONSE는 관리자 UI로 전달하여 관리자에서 각 노드의 응답을 확인할 수 있도록 중계
      if (message.action === "PONG_RESPONSE") {
        // 서버→플러그인 PING_TEST 왕복 지연(RTT)을 측정해 세션 링 버퍼에 누적
        if (session) {
          const pongPayload =
            typeof message.payload === "object" && message.payload !== null
              ? (message.payload as Record<string, unknown>)
              : {};
          const sentKey =
            typeof pongPayload.originalTimestamp === "number"
              ? String(pongPayload.originalTimestamp)
              : undefined;
          const sentAt = sentKey ? session.pendingPings?.[sentKey] : undefined;
          if (typeof sentAt === "number") {
            const rtt = Date.now() - sentAt;
            const samples = session.rttSamples ?? [];
            samples.push(rtt);
            if (samples.length > RTT_SAMPLE_LIMIT) samples.shift();
            session.rttSamples = samples;
            if (sentKey && session.pendingPings) {
              delete session.pendingPings[sentKey];
            }
          }
        }
        console.log("[server] forwarding PONG_RESPONSE to admin clients");
        activeClients.forEach((client) => {
          if (
            client.clientType === "admin" &&
            client.socket.readyState === WebSocket.OPEN
          ) {
            client.socket.send(JSON.stringify(message));
          }
        });
        return;
      }

      // 우선: 전체 브로드캐스트 패킷 처리 (targetId === "ALL") — 관리자가 ALL 대상으로 보낸 패킷을 수집 노드로 중계
      if (message.targetId === "ALL") {
        activeClients.forEach((client) => {
          if (
            client.clientId !== clientId &&
            client.socket.readyState === WebSocket.OPEN
          ) {
            client.socket.send(JSON.stringify(message));
          }
        });
        return;
      }

      // 1.5. Ping/Pong 네트워크 지연 시간 테스트 (네트워크 모니터링 지원)
      // 플러그인에서 서버로 직접 보낸 PING_TEST는 서버가 해당 플러그인에게 PONG_RESPONSE를 응답합니다.
      if (message.action === "PING_TEST") {
        // PING_TEST를 보낸 클라이언트가 플러그인인 경우에만 PONG_RESPONSE 응답
        const originalPayload =
          typeof message.payload === "object" && message.payload !== null
            ? (message.payload as Record<string, unknown>)
            : {};

        const pongResponse: WebSocketMessage = {
          senderId: "server",
          targetId: message.senderId,
          action: "PONG_RESPONSE",
          payloadType: "json",
          payload: {
            originalTimestamp:
              typeof originalPayload.timestamp === "number"
                ? originalPayload.timestamp
                : message.meta?.timestamp || Date.now(),
            responseTimestamp: Date.now(),
            clientId,
            sessionId:
              typeof originalPayload.sessionId === "string"
                ? originalPayload.sessionId
                : undefined,
          },
          meta: { timestamp: Date.now() },
        };

        if (
          session &&
          clientType === "plugin" &&
          ws.readyState === WebSocket.OPEN
        ) {
          ws.send(JSON.stringify(pongResponse));
          logPluginComm(
            clientId,
            "PING_TEST",
            "Ping/Pong 네트워크 테스트 응답 완료",
          );
        }

        return;
      }

      try {
        logPluginComm(
          clientId,
          message.action,
          `수신 패킷 처리: ${rawData.substring(0, 200)}`,
        );
      } catch (commLogError) {
        // 통신 로그 기록 실패 시에도 후속 액션 처리(별칭 저장/ACK)는 반드시 진행되도록 가드
        logServerSystem(
          "WARN",
          `플러그인 통신 로그 기록 실패 [ID: ${clientId}]: ${getErrorMessage(commLogError)}`,
        );
      }

      // 2. 플러그인 환경설정(별칭) 저장 요청 처리
      // 플러그인이 환경설정 탭에서 별칭을 설정·저장하면 서버로 전송되어 이 블록에서 저장합니다.
      // 별칭은 수시로 변경할 수 있으며, 저장 완료 시 ACK 패킷을 플러그인에 반환합니다.
      if (message.action === "CLIENT_CONFIG_UPDATE") {
        const payloadObj =
          typeof message.payload === "object" && message.payload !== null
            ? (message.payload as Record<string, unknown>)
            : {};
        const newAlias =
          typeof payloadObj.alias === "string" ? payloadObj.alias.trim() : "";

        // DB 환경설정 저장 + 실시간 세션 메타 동기화
        updateClientConfig(clientId, newAlias);
        if (session) {
          session.alias = newAlias;
        }

        // admin 대시보드에 별칭 변경 실시간 푸시
        broadcastClientsChanged();

        logPluginComm(
          clientId,
          "CLIENT_CONFIG_UPDATE",
          `플러그인 별칭 저장 완료 [별칭: ${newAlias}]`,
        );

        // 저장 성공 ACK 반환 (플러그인 UI에서 저장 결과 표시에 사용)
        const ackPacket: WebSocketMessage = {
          senderId: "server",
          targetId: clientId,
          action: "CLIENT_CONFIG_UPDATE_ACK",
          payloadType: "json",
          payload: { success: true, alias: newAlias },
          meta: { timestamp: Date.now() },
        };
        if (session && session.socket.readyState === WebSocket.OPEN) {
          session.socket.send(JSON.stringify(ackPacket));
        }
        return;
      }

      // 2-1. 저장 위치 조회 요청 처리 (플러그인 다운로드 매니저의 대상 디렉토리 안내)
      // 플러그인이 pageUrl/카테고리로 대상 저장 디렉토리를 서버에 조회하면,
      // data_path 기준 절대 경로와 상대 경로(images/<도메인>/<카테고리>)를 응답합니다.
      if (message.action === "GET_STORAGE_LOCATION") {
        const payloadObj = (
          typeof message.payload === "object" && message.payload !== null
            ? message.payload
            : {}
        ) as Record<string, unknown>;

        const pageUrl = String(payloadObj.pageUrl || "");
        let domain = "common";
        try {
          if (pageUrl) domain = normalizeRootDomain(new URL(pageUrl).hostname);
        } catch {
          // 도메인 파싱 실패 시 기본값 유지
        }
        const category =
          typeof payloadObj.category === "string" && payloadObj.category.trim()
            ? payloadObj.category.trim()
            : "normal";
        const rootPath = getConfigDataPath() || "./storage";
        const relDir = `images/${domain}/${category}`;
        const absDir = resolve(rootPath, relDir);

        const locationResponse: WebSocketMessage = {
          senderId: "server",
          targetId: clientId,
          action: "STORAGE_LOCATION_RESPONSE",
          payloadType: "json",
          payload: {
            success: true,
            domain,
            category,
            absRoot: rootPath,
            relDir,
            absDir,
          },
          meta: { timestamp: Date.now() },
        };
        if (session && session.socket.readyState === WebSocket.OPEN) {
          session.socket.send(JSON.stringify(locationResponse));
        }
        logPluginComm(
          clientId,
          "GET_STORAGE_LOCATION",
          `저장 위치 응답 완료: ${absDir}`,
        );
        return;
      }

      // 3. 수집 전송 액션 처리 (콘텐츠 타입별 세분화 — 이전 CRAWL_LOG 단일 액션을 대체)
      //   fullPage       : 전체 페이지/iframe 문서 (fullDom 물리 저장 + 워커 파이프라인)
      //   CRAWL_DOCUMENT : 구형 전체 페이지 문서 (fullPage와 동일 처리, 하위 호환)
      //   CRAWL_PARTIAL  : 페이지 일부/부분 데이터
      //   DomCapture     : 요소 선택 DOM 캡처 (outerHTML 단일 요소)
      //   CRAWL_METADATA : 메타 정보만 수집
      //   CRAWL_BINARY   : 바이너리/이미지 파일 (payloadType: binary_base64)
      //   CRAWL_IMAGE    : 페이지 이미지 수집 (성공 binary_base64 / 실패 json URL 참조, category 구분)
      //   SITE_INFO      : 사이트 정보 수집 (페이지 메타데이터 JSON 물리 저장)
      if (
        message.action === "CRAWL_DOCUMENT" ||
        message.action === "CRAWL_PARTIAL" ||
        message.action === "fullPage" ||
        message.action === "DomCapture" ||
        message.action === "CRAWL_METADATA" ||
        message.action === "CRAWL_BINARY" ||
        message.action === "CRAWL_IMAGE" ||
        message.action === "SITE_INFO"
      ) {
        const payloadObj = (
          typeof message.payload === "object" && message.payload !== null
            ? message.payload
            : { raw: message.payload }
        ) as Record<string, unknown>;

        // 수집 URL에서 도메인 추출
        const targetUrl = String(payloadObj.url || "");
        let domain = "common";
        try {
          if (targetUrl) domain = normalizeRootDomain(new URL(targetUrl).hostname);
        } catch {
          // 도메인 파싱 실패 시 기본값 유지
        }

        // 이미지 수집(CRAWL_IMAGE)은 이미지가 속한 페이지(pageUrl) 도메인으로 분류
        if (message.action === "CRAWL_IMAGE") {
          const pageUrl = String(payloadObj.pageUrl || "");
          try {
            if (pageUrl) domain = normalizeRootDomain(new URL(pageUrl).hostname);
          } catch {
            // 페이지 URL 파싱 실패 시 기존 도메인 유지
          }
        }

        // DB 로그 적재 및 레코드 ID 취득 (액션 구분 저장)
        const logId = insertCrawlLog(
          clientId,
          JSON.stringify(payloadObj),
          Date.now(),
          domain,
          "",
          0,
          message.action,
        );

        // HTML 원본 소스(fullDom)가 있을 경우에만 물리 파일 분리 저장소 적재 (R-00208)
        // 4컬럼 재구성으로 노드 전용 경로/담당 워커 컬럼이 제거되어,
        // 저장 경로는 기본(워커 기본 경로 > 글로벌 기본 경로)만 적용합니다.
        const fullDomHtml = String(payloadObj.fullDom || "");
        let savedPath = "";
        let savedSize = 0;

        if (fullDomHtml) {
          const assignedWorker = getWorkerById("default_worker");

          const saveRes = saveCrawledContentToFile({
            workerStoragePath: assignedWorker?.storage_root_path,
            globalDefaultPath: getConfigDataPath() || undefined,
            domain,
            dbLogId: logId,
            htmlContent: fullDomHtml,
          });

          savedPath = saveRes.savedFilePath;
          savedSize = saveRes.fileSize;

          // 저장된 파일 경로/크기를 기존 crawl_logs 레코드에 반영
          updateCrawlLogFile(logId, savedPath, savedSize);
        }

        // 이미지 전송 액션(CRAWL_IMAGE)은 전용 이미지 저장소에 보관 (R-00208)
        // 성공 페이로드(binary_base64)는 바이너리 이미지로, 실패 페이로드(json)는 URL 참조 파일로 저장
        // category를 함께 전달해 도메인/카테고리별 디렉토리로 분리 저장합니다.
        if (message.action === "CRAWL_IMAGE") {
          // 미디어 번들(xvideos 다운로드 매니저): assets 배열 + txtContent 포함 시 번들 저장
          if (Array.isArray(payloadObj.assets)) {
            const bundleOptions: SaveCrawledMediaBundleOptions = {
              globalDefaultPath: getConfigDataPath() || undefined,
              domain,
              pageUrl: String(payloadObj.pageUrl || ""),
              category:
                typeof payloadObj.category === "string"
                  ? payloadObj.category
                  : "normal",
              clickUrl:
                typeof payloadObj.clickUrl === "string"
                  ? payloadObj.clickUrl
                  : "",
              title:
                typeof payloadObj.title === "string" ? payloadObj.title : "",
              baseName:
                typeof payloadObj.baseName === "string" ? payloadObj.baseName : "",
              txtContent:
                typeof payloadObj.txtContent === "string"
                  ? payloadObj.txtContent
                  : "",
              assets: (payloadObj.assets as Array<Record<string, unknown>>).map(
                (asset) => ({
                  kind:
                    typeof asset.kind === "string" ? asset.kind : "asset",
                  url: String(asset.url || ""),
                  fileName:
                    typeof asset.fileName === "string" ? asset.fileName : "",
                  mimeType:
                    typeof asset.mimeType === "string" ? asset.mimeType : "",
                  data: typeof asset.data === "string" ? asset.data : "",
                })
              ),
            };
            const bundleRes = saveCrawledMediaBundle(bundleOptions);
            savedPath = bundleRes.savedFilePath;
            savedSize = bundleRes.fileSize;
            updateCrawlLogFile(logId, savedPath, savedSize);

            // 저장 완료 ACK: 실제 저장 경로/파일 목록을 플러그인에 응답 (항목별 완료 표시용)
            const savedAckPacket: WebSocketMessage = {
              senderId: "server",
              targetId: clientId,
              action: "CRAWL_MEDIA_SAVED",
              payloadType: "json",
              payload: {
                success: true,
                bundleId:
                  typeof payloadObj.bundleId === "string"
                    ? payloadObj.bundleId
                    : "",
                savedDir: bundleRes.savedDir,
                savedFiles: bundleRes.savedFiles,
                fileSize: bundleRes.fileSize,
              },
              meta: { timestamp: Date.now() },
            };
            if (session && session.socket.readyState === WebSocket.OPEN) {
              session.socket.send(JSON.stringify(savedAckPacket));
            }
            logPluginComm(
              clientId,
              "CRAWL_IMAGE",
              `미디어 번들 저장 완료 [${domain}/${bundleOptions.category}]: ${bundleRes.savedDir}`,
            );
          } else {
            const imageSaveRes = saveCrawledImage({
              globalDefaultPath: getConfigDataPath() || undefined,
              domain,
              fileName:
                typeof payloadObj.fileName === "string" ? payloadObj.fileName : "",
              mimeType:
                typeof payloadObj.mimeType === "string" ? payloadObj.mimeType : "",
              payloadType: message.payloadType || "json",
              data: typeof payloadObj.data === "string" ? payloadObj.data : "",
              url: String(payloadObj.url || ""),
              pageUrl: String(payloadObj.pageUrl || ""),
              category:
                typeof payloadObj.category === "string" ? payloadObj.category : "normal",
              error: typeof payloadObj.error === "string" ? payloadObj.error : "",
              clickUrl:
                typeof payloadObj.clickUrl === "string" ? payloadObj.clickUrl : "",
              title: typeof payloadObj.title === "string" ? payloadObj.title : "",
            });
            savedPath = imageSaveRes.savedFilePath;
            savedSize = imageSaveRes.fileSize;
            updateCrawlLogFile(logId, savedPath, savedSize);
          }
        }

        // 사이트 정보 수집(SITE_INFO)은 페이지 메타데이터를 JSON 물리 파일로 보관
        if (message.action === "SITE_INFO") {
          const infoSaveRes = saveSiteInfoToFile({
            globalDefaultPath: getConfigDataPath() || undefined,
            domain,
            info: payloadObj,
          });
          savedPath = infoSaveRes.savedFilePath;
          savedSize = infoSaveRes.fileSize;
          updateCrawlLogFile(logId, savedPath, savedSize);
        }

        // 전체 문서(fullPage/CRAWL_DOCUMENT)일 때만 디폴트 워커 파이프라인 단행 (R-00207)
        // 일부/메타/바이너리/이미지/사이트정보 데이터는 원장 보존으로 충분하며 워커 파이프라인을 수행하지 않습니다.
        if (message.action === "CRAWL_DOCUMENT" || message.action === "fullPage") {
          const assignedWorker2 = getWorkerById("default_worker");
          if (assignedWorker2) {
            executeWorkerPipeline(
              assignedWorker2,
              clientId,
              domain,
              savedPath,
              savedSize,
              payloadObj,
            );
          }
        }
        return;
      }

      // 4. 일반 채팅 메시지 처리 (원장 저장은 0번 훅에서 이미 수행)
      // admin 대시보드의 모든 클라이언트로 실시간 중계하여 채팅 UX를 제공합니다.
      if (message.action === "CHAT_MESSAGE") {
        activeClients.forEach((client) => {
          if (
            client.clientId !== clientId &&
            client.socket.readyState === WebSocket.OPEN
          ) {
            client.socket.send(JSON.stringify(message));
          }
        });
        return;
      }

      // 5. 브로드캐스트 패킷 라우팅 (targetId === "ALL")
      if (message.targetId === "ALL") {
        activeClients.forEach((client) => {
          if (
            client.clientId !== clientId &&
            client.socket.readyState === WebSocket.OPEN
          ) {
            client.socket.send(JSON.stringify(message));
          }
        });
        return;
      }

      // 6. 단일 타깃 릴레이 라우팅 (특정 UUID 지정)
      if (message.targetId && activeClients.has(message.targetId)) {
        const targetSession = activeClients.get(message.targetId);
        if (
          targetSession &&
          targetSession.socket.readyState === WebSocket.OPEN
        ) {
          // 서버→플러그인 PING_TEST 발신 시각을 기록해 PONG_RESPONSE 도착 시 RTT 측정에 사용
          if (message.action === "PING_TEST" && targetSession.clientType === "plugin") {
            const pingPayload =
              typeof message.payload === "object" && message.payload !== null
                ? (message.payload as Record<string, unknown>)
                : {};
            if (typeof pingPayload.timestamp === "number") {
              targetSession.pendingPings = targetSession.pendingPings ?? {};
              targetSession.pendingPings[String(pingPayload.timestamp)] = Date.now();
            }
          }
          targetSession.socket.send(JSON.stringify(message));
        }
      }
    } catch (messageError) {
      // 패킷 파싱/처리 예외 가드 (무중단 유지)
      // 예외를 조용히 삼키면 원인 추적이 불가하므로 실패 사유만 시스템 로그에 간결히 기록합니다.
      logServerSystem(
        "WARN",
        `플러그인 패킷 처리 예외 [ID: ${clientId}]: ${getErrorMessage(messageError)}`,
      );
    }
  });

  ws.on("close", () => {
    activeClients.delete(clientId);
    logServerSystem("INFO", `세션 해제 완료: [ID: ${clientId}]`);
    // 노드 상태 변화를 admin 대시보드에 실시간 푸시
    broadcastClientsChanged();
  });

  ws.on("error", (err) => {
    logServerSystem("WARN", `세션 예외 감지 [ID: ${clientId}]: ${err.message}`);
  });
});

// 통합 백엔드 포트 ${process.env.SERVER_PORT || 9600}으로 서버 가동
// 안전한 SPA 히스토리 모드 폴백: API 경로를 제외한 GET 요청에 대해 index.html 반환
app.use((req, res, next) => {
  try {
    if (req.method !== "GET") return next();
    if (req.path && req.path.startsWith("/api")) return next();
    const indexFile = resolve(publicPath, "index.html");
    if (!existsSync(indexFile))
      return res.status(404).send("index.html not found");
    return res.sendFile(indexFile);
  } catch (err) {
    return next(err);
  }
});

server.listen(Number(process.env.SERVER_PORT) || 9600, () => {
  logServerSystem(
    "INFO",
    `통합 백엔드 포트 ${process.env.SERVER_PORT || 9600} 정상 가동 완료`,
  );
  console.log(
    `[시스템] 통합 백엔드 API 및 데이터베이스 서비스 포트 ${process.env.SERVER_PORT || 9600} 구동 중`,
  );
});
