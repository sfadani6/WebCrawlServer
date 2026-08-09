// server/scripts/start-server.js
// Cross-platform PM2-backed server starter. Creates ../logs, builds dist, and starts/restarts the named PM2 process.
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(serverRoot, "..");
const logsDir = path.join(projectRoot, "logs");
try {
  fs.mkdirSync(logsDir, { recursive: true });
} catch (e) {
  // ignore
}

// 서버 포트는 env(SERVER_PORT) 우선, 기본값 9600으로 고정한다.
// (기존 getAvailablePort 포트 자동 이동 제거: 기동 중인 서버가 9600을 점유하고 있어도
//  server:start 재실행 시 9601로 밀리는 문제가 있어, 단일 고정 포트 운영으로 결정)
const serverPort = Number(process.env.SERVER_PORT || 9600);

// Windows 콘솔 창 깜빡임 방지: 셸 래퍼(npm.cmd/npx.cmd/cmd.exe)를 경유하지 않고
// node.exe가 로컬 node_modules의 CLI 스크립트(tsc, pm2)를 직접 실행합니다.
const nodePath = process.execPath;
const fileExists = (p) => fs.existsSync(p);
const tscPath = [
  path.resolve(serverRoot, "node_modules", "typescript", "bin", "tsc"),
  path.resolve(projectRoot, "node_modules", "typescript", "bin", "tsc"),
].find(fileExists);
const pm2CliPath = [
  path.resolve(serverRoot, "node_modules", "pm2", "bin", "pm2"),
  path.resolve(projectRoot, "node_modules", "pm2", "bin", "pm2"),
].find(fileExists);

if (!tscPath || !pm2CliPath) {
  console.error("필수 CLI(typescript/pm2)를 node_modules에서 찾을 수 없습니다.");
  process.exit(1);
}

// 서버 TypeScript 빌드 (셸 미경유)
const buildResult = spawnSync(nodePath, [tscPath, "-p", "tsconfig.json"], {
  cwd: serverRoot,
  stdio: "inherit",
  windowsHide: true,
});
if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

// 기존 PM2 프로세스를 삭제(없으면 무시)하고 --no-vizion으로 재시작합니다.
// --no-vizion: PM2 데몬이 git status/tag를 실행하며 콘솔 창을 띄우는 vizion 기능 비활성화
spawnSync(nodePath, [pm2CliPath, "delete", "WebCrawlServer"], {
  cwd: serverRoot,
  stdio: "ignore",
  windowsHide: true,
});

const pm2Result = spawnSync(
  nodePath,
  [
    pm2CliPath,
    "start",
    "dist/index.js",
    "--name",
    "WebCrawlServer",
    "--no-vizion",
    "--update-env",
  ],
  {
    cwd: serverRoot,
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      SERVER_PORT: String(serverPort),
    },
  },
);

if (pm2Result.status !== 0) {
  process.exit(pm2Result.status ?? 1);
}

console.log(`server-started on port ${serverPort}`);
process.exit(0);
