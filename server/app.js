/**
 * WebCrawlServer - 메인 서버 진입점
 * 
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-001 (architecture.md): 시스템 구성 참조
 * R-003 (structure.md): 서버 디렉토리 구조 참조
 * R-004 (mcp.md): MCP 프로토콜 적용
 */

const express          = require('express');
const path             = require('path');
const http             = require('http');
const { WebSocketServer } = require('ws');
const sqlite3          = require('sqlite3').verbose();
const fs               = require('fs-extra');
const helmet           = require('helmet');
const cors             = require('cors');
const rateLimit        = require('express-rate-limit');

// 분리된 모듈 로드
const { DB_PATH }      = require('./db/helper');
const createApiRouter  = require('./routes/api');
const adminDbRouter    = require('./routes/adminDb');
const adminRouter      = require('./routes/admin');
const crawlerRouter    = require('./routes/crawler');
const nlpRouter        = require('./routes/nlp');
const pluginRouter     = require('./routes/plugin');
const { basicAuth, setCredentialsCache } = require('./middleware/auth');
const { fail }         = require('./middleware/response');
const bcrypt           = require('bcryptjs');
const { startScheduler } = require('./scheduler/jobRunner');
const { startMonitor } = require('./monitor/monitorWs');
const { startLogRotator } = require('./logs/logRotator');
const { startCrawlerMonitor } = require('./monitor/crawlerMonitor');
const { setupConnectionTracking, registerConnection, unregisterConnection } = require('./monitor/connectionManager');

// === 환경변수 검증 ===
// R-013 (security.md): 민감 정보는 환경변수로만 설정
const ENV_VARS = [
  { key: 'WS_TOKEN', desc: 'WebSocket 인증 토큰', required: true },
  { key: 'ADMIN_USERNAME', desc: '관리자 아이디', required: false },
  { key: 'ADMIN_PASSWORD', desc: '관리자 비밀번호', required: false },
  { key: 'API_KEY', desc: 'API 키', required: false },
  { key: 'ALLOWED_ORIGINS', desc: 'CORS 허용 Origin 목록', required: false },
  { key: 'LOG_RETENTION_DAYS', desc: '로그 보관 일수', required: false },
  { key: 'NODE_ENV', desc: '실행 환경 (development/production)', required: false }
];

for (const ev of ENV_VARS) {
  if (ev.required && !process.env[ev.key]) {
    console.warn(`[보안 경고] ${ev.desc}(${ev.key}) 환경변수가 설정되지 않았습니다.`);
  }
}

// === 보안 관련 상수 정의 (WebSocket/CORS에서 공유) ===
// CORS 설정 - 허용된 origin만 접근 가능
const allowedOrigins = (process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : [
    'http://localhost:3000',
    'http://localhost:9600',
    'http://127.0.0.1:9600'
  ]).map((value) => value.trim()).filter(Boolean);

function isExtensionOrigin(origin) {
  return /^(chrome|opera|moz)-extension:\/\/.+$/i.test(origin || '');
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (isExtensionOrigin(origin)) return true;
  return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
}

// WebSocket 인증 토큰 (환경변수 또는 기본값)
const WS_TOKEN = process.env.WS_TOKEN || 'default-ws-token';
if (!process.env.WS_TOKEN) {
  console.log('[WebSocket] WS_TOKEN 환경변수가 설정되지 않아 기본 토큰(default-ws-token)으로 동작합니다.');
}

// === Express 앱 설정 ===
const app    = express();
const server = http.createServer(app);

// WebSocket 서버 생성 (MCP 프로토콜 지원) - Origin 검증 및 인증 추가
// 보안: 메시지 크기 제한 (1MB)
const wss = new WebSocketServer({
  server,
  maxPayload: 1024 * 1024, // 1MB
  verifyClient: (info, callback) => {
    const origin = info.origin;
    const reqUrl = info.req.url || '';
    
    // Chrome Extension 및 Opera Extension, Firefox Extension 프로토콜 지원
    const isExtension = origin && (origin.startsWith('chrome-extension://') || origin.startsWith('opera-extension://') || origin.startsWith('moz-extension://'));
    const isOriginAllowed = isExtension || allowedOrigins.includes(origin) || allowedOrigins.includes('*');
    
    if (!isOriginAllowed && origin !== undefined) {
      console.log(`[WebSocket] 거부된 Origin: ${origin}`);
      return callback(false, 403, 'Forbidden');
    }
    
    // 토큰 검증 - 쿼리 파라미터에서 token 추출 및 DB 검증
    try {
      const url = new URL(reqUrl, `http://${info.req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        console.log(`[WebSocket] 인증 실패: 토큰 누락`);
        return callback(false, 401, 'Unauthorized');
      }

      // DB에서 승인된 토큰인지 확인 (async 처리)
      const dbHelper = require('./db/helper');
      dbHelper.queryOne(
        `SELECT id, browser_name, browser_version, extension_id FROM plugin_requests WHERE approved_token = ? AND status = 'approved'`,
        [token]
      ).then(row => {
        if (row) {
          console.log(`[WebSocket] 인증 성공: 유효한 토큰 (ID: ${row.id})`);
          // 인증 성공 시 정보 저장 (connection 이벤트에서 사용할 수 있도록)
          info.pluginRequestId = row.id;
          info.browserName = row.browser_name;
          info.browserVersion = row.browser_version;
          info.extensionId = row.extension_id;
          callback(true);
        } else {
          console.log(`[WebSocket] 인증 실패: 유효하지 않은 토큰`);
          callback(false, 401, 'Unauthorized');
        }
      }).catch(err => {
        console.error(`[WebSocket] DB 검증 오류:`, err);
        callback(false, 500, 'Internal Server Error');
      });
      
      // async 작업 중이므로 여기서 바로 return 함
      return;
    } catch (err) {
      console.log(`[WebSocket] URL 파싱 오류:`, err.message);
      return callback(false, 400, 'Bad Request');
    }
  }
});

// === 보안 미들웨어 설정 ===
// 보안 헤더 추가 (helmet)
app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    console.warn(`[CORS] 차단된 Origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.options('*', cors({
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// 요청 본문 크기 제한 (1MB)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 레이트 리밋 설정 (특히 /api/nlp 경로에 적용)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: Number(process.env.API_RATE_LIMIT_MAX || 100), // 15분당 요청 최대
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: '너무 많은 요청입니다. 잠시 후 다시 시도하세요.'
  }
});

// 플러그인 연결 요청은 일반 API 폭주와 분리하여 허용량을 넉넉히 둠
const pluginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PLUGIN_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: '플러그인 요청이 너무 많습니다. 잠시 후 다시 시도하세요.'
  }
});

// NLP API는 더 엄격한 레이트 리밋 적용
const nlpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 50, // 15분당 50회 요청 최대
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'NLP API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.'
  }
});

// 관리자 API 레이트 리밋 설정 (DB 조작 및 실시간 편집 지원)
const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 1000, // 15분당 1000회
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: '관리자 API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.'
  }
});

// 정적 파일 서비스 (CSS, JS 등 공용 리소스)
// React SPA는 adminUiRouter에서 제공하므로, 정적 파일 미들웨어는 /static 경로로만 제한
app.use('/static', express.static(path.join(__dirname, '../public')));

// === 기본 라우트 ===

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'WebCrawlServer',
    version: '0.1.0'
  });
});

// === API 라우터 마운트 ===
app.use('/api/plugin', pluginLimiter, pluginRouter);
app.use('/api', apiLimiter, createApiRouter(wss));
app.use('/admin/api', adminApiLimiter, adminRouter); // 새로운 관리자 API
app.use('/admin/api', adminApiLimiter, basicAuth(), adminDbRouter);
app.use('/admin/api/crawler', crawlerRouter);
app.use('/api/nlp', nlpLimiter, require('./routes/nlp'));

// === 통합 콘솔 SPA 라우터 마운트 (React admin-ui 서빙) ===
// R-003 (structure.md): 모든 관리자 웹 라우트를 adminUiRouter로 통합 서빙
const adminUiRouter = require('./routes/adminUi');
app.use('/database', adminUiRouter);
app.use('/modules', adminUiRouter);   // verification_report.md에 따른 404 에러 수정
app.use('/workflows', adminUiRouter);
app.use('/scheduler', adminUiRouter);
app.use('/logs', adminUiRouter);
app.use('/settings', adminUiRouter);
app.use('/admin', adminUiRouter);
app.use('/', adminUiRouter);

// === WebSocket 메시지 처리 (MCP 프로토콜) ===
// R-004 (mcp.md) 1장: 메시지 헤더 필수 필드 참조
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] 클라이언트 연결: ${clientIp}`);

  // IP 주소 저장 (하트비트 로그에서 사용)
  ws.clientIp = clientIp;
  
  // 연결 정보 추출 (verifyClient에서 저장된 정보)
  const connectionInfo = {
    browserName: req.browserName,
    browserVersion: req.browserVersion,
    extensionId: req.extensionId,
    pluginRequestId: req.pluginRequestId
  };
  
  // 연결 등록 (ConnectionManager)
  const connectionId = registerConnection(ws, req, connectionInfo);
  ws.connectionId = connectionId;

  // 연결 시 초기 메시지 전송
  ws.send(JSON.stringify({
    type: 'heartbeat',
    message: 'WebCrawlServer에 연결되었습니다.',
    timestamp: new Date().toISOString(),
    protocolVersion: '1.0'
  }));

  // Heartbeat(connection keep-alive) 설정
  // 30초마다 ping 전송, 응답이 없으면 연결 종료
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // MCP 프로토콜 필수 타입 정의 (R-004 1장)
  const MCP_MESSAGE_TYPES = ['request', 'script', 'response', 'event', 'heartbeat'];

  // 메시지 수신 처리
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`[WebSocket] 수신 메시지:`, data);

      // R-004 (mcp.md) 1장: 필수 필드 검증
      const validationErrors = [];
      const requiredFields = ['messageId', 'type', 'module', 'action', 'timestamp', 'protocolVersion'];
      
      for (const field of requiredFields) {
        if (!data[field]) {
          validationErrors.push(`필수 필드 누락: ${field}`);
        }
      }

      // scriptId는 스크립트 관련 메시지에만 필수이지만, 포함 시 검증
      if (data.type === 'script' && !data.scriptId) {
        validationErrors.push('스크립트 타입 메시지에는 scriptId가 필수입니다.');
      }

      // type 필드 값 검증
      if (data.type && !MCP_MESSAGE_TYPES.includes(data.type)) {
        validationErrors.push(`유효하지 않은 type: ${data.type}. 유효한 값: ${MCP_MESSAGE_TYPES.join(', ')}`);
      }

      // 검증 실패 시 오류 응답
      if (validationErrors.length > 0) {
        ws.send(JSON.stringify({
          type: 'response',
          status: 'error',
          message: 'MCP 프로토콜 필수 필드 오류',
          errors: validationErrors,
          timestamp: new Date().toISOString(),
          protocolVersion: '1.0'
        }));
        return;
      }

      // R-004 (mcp.md) 3장: 요청/응답 포맷 준수
      const response = {
        messageId: data.messageId || `msg_${Date.now()}`,
        type: 'response',
        module: data.module || 'server',
        action: data.action || 'unknown',
        scriptId: data.scriptId || null,  // R-004 1장: scriptId 필드 추가
        timestamp: new Date().toISOString(),
        protocolVersion: data.protocolVersion || '1.0',
        status: 'success',
        data: { message: '메시지 처리 완료' }
      };

      // 표준 명령어 처리 (R-004 2장 참조)
      switch (data.action) {
        case 'open_browser':
          response.data.result = '브라우저 열기 명령어 수신';
          break;
        case 'crawl_page':
          response.data.result = '페이지 크롤링 명령어 수신';
          break;
        case 'run_process':
          response.data.result = '프로세스 실행 명령어 수신';
          break;
        case 'stop_process':
          response.data.result = '프로세스 종료 명령어 수신';
          break;
        case 'send_message':
          response.data.result = '메시지 전송 명령어 수신';
          break;
        case 'log_event':
          response.data.result = '이벤트 로그 명령어 수신';
          break;
        case 'monitor_status':
          response.data.result = '모니터링 상태 명령어 수신';
          break;
        case 'manage_db':
          response.data.result = 'DB 관리 명령어 수신';
          break;
        default:
          response.data.result = '알 수 없는 명령어';
      }

      ws.send(JSON.stringify(response));

    } catch (error) {
      console.error(`[WebSocket] 메시지 처리 오류:`, error);
      ws.send(JSON.stringify({
        type: 'response',
        status: 'error',
        message: '메시지 파싱 또는 처리 오류',
        error: error.message,
        timestamp: new Date().toISOString(),
        protocolVersion: '1.0'
      }));
    }
  });

  // 연결 종료 처리
  ws.on('close', () => {
    console.log(`[WebSocket] 클라이언트 연결 종료: ${clientIp}`);
    unregisterConnection(ws);
  });

  // 오류 처리
  ws.on('error', (error) => {
    console.error(`[WebSocket] 클라이언트 오류:`, error);
    unregisterConnection(ws);
  });

  // 활동 로그 업데이트 (메시지 수신 시)
  ws.on('message', () => {
    if (ws.connectionId) {
      const { updateActivity } = require('./monitor/connectionManager');
      updateActivity(ws.connectionId);
    }
  });
});

// WebSocket Heartbeat 인터벌 - 30초마다 모든 클라이언트에 ping 전송
// 죽은 연결(zombie connection) 감지 및 정리
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log(`[WebSocket] 비활성 클라이언트 연결 종료: ${ws.clientIp || 'unknown'}`);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// 서버 종료 시 heartbeat 인터벌 정리
server.on('close', () => {
  clearInterval(heartbeatInterval);
});

// === 오류 처리 미들웨어 (표준 응답 적용) ===
app.use((err, req, res, next) => {
  console.error(`[Express] 서버 오류:`, err);
  const isDev = process.env.NODE_ENV === 'development';
  const details = isDev ? { error: err.message, stack: err.stack } : undefined;
  // 표준 응답 래퍼 사용
  return fail(res, '내부 서버 오류', 500, details);
});

// === 404 처리 ===
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: '페이지를 찾을 수 없습니다.'
  });
});

// === DB 초기화 === 
// R-007 (database.md) 1장: SQLite3 파일은 database/main.db에 고정
function initializeDatabase() {
  const dbDir = path.join(__dirname, '../database');

  fs.ensureDirSync(dbDir);
  console.log(`[DB] 데이터베이스 디렉토리 확인: ${dbDir}`);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('[DB] 데이터베이스 연결 오류:', err);
        return reject(err);
      }

      console.log('[DB] SQLite 데이터베이스 연결 성공');

      db.run('PRAGMA journal_mode=WAL;', () => {});
      db.run('PRAGMA foreign_keys = ON;', () => {});

      const coreTables = [
        `CREATE TABLE IF NOT EXISTS modules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL,
          config TEXT,
          tags TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS crawler_targets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          url TEXT NOT NULL,
          kind TEXT NOT NULL,
          interval_seconds INTEGER DEFAULT 0,
          last_checked_at TIMESTAMP,
          last_result TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
    `CREATE TABLE IF NOT EXISTS plugin_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      browser_name TEXT,
      browser_version TEXT,
      extension_id TEXT,
      hostname TEXT,
      status TEXT DEFAULT 'pending',
      approved_token TEXT,
      approved_at TIMESTAMP,
      connected BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS crawler_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER NOT NULL,
      external_id TEXT,
      title TEXT,
      content TEXT,
      raw TEXT,
      published_at TIMESTAMP,
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(target_id) REFERENCES crawler_targets(id)
    )`,
        `CREATE TABLE IF NOT EXISTS workflows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          yaml_content TEXT NOT NULL,
          module_id INTEGER,
          is_active BOOLEAN DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (module_id) REFERENCES modules(id)
        )`,
        `CREATE TABLE IF NOT EXISTS scheduled_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          workflow_id INTEGER NOT NULL,
          cron_expression TEXT,
          once_at TIMESTAMP,
          interval_seconds INTEGER,
          status TEXT NOT NULL DEFAULT 'waiting',
          overlap_policy TEXT NOT NULL DEFAULT 'skip',
          last_executed_at TIMESTAMP,
          next_execution_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workflow_id) REFERENCES workflows(id)
        )`,
        `CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT,
          cpu_usage REAL,
          memory_usage REAL,
          module_id INTEGER,
          workflow_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (module_id) REFERENCES modules(id),
          FOREIGN KEY (workflow_id) REFERENCES workflows(id)
        )`,
        `CREATE TABLE IF NOT EXISTS error_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          error_type TEXT NOT NULL,
          error_message TEXT NOT NULL,
          stack_trace TEXT,
          context TEXT,
          activity_log_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (activity_log_id) REFERENCES activity_logs(id)
        )`,
        `CREATE TABLE IF NOT EXISTS schema_migrations (
          migration_id TEXT PRIMARY KEY,
          target_type TEXT NOT NULL,
          module TEXT,
          description TEXT NOT NULL,
          applied_sql TEXT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS configattr (
          idx INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS config (
          idx INTEGER PRIMARY KEY AUTOINCREMENT,
          attr_id INTEGER NOT NULL,
          val1 TEXT,
          val2 TEXT,
          memo TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (attr_id) REFERENCES configattr(idx) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS admin_credentials (
          id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
          username TEXT NOT NULL,
          password TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      let completed = 0;
      const total = coreTables.length;
      if (total === 0) { db.close(); return resolve(); }

      coreTables.forEach((sql) => {
        db.run(sql, (err) => {
          if (err) {
            console.error('[DB] 테이블 생성 오류:', err);
          } else {
            completed++;
            if (completed === total) {
              db.run(
                `INSERT OR IGNORE INTO configattr (idx, name, description) VALUES 
                 (1, '브라우저', '브라우저 실행 경로 및 인자 설정'),
                 (2, '크롤러', '크롤러 동시 실행 및 딜레이 설정'),
                 (3, '시스템', '서버 시스템 전반 환경 설정')`,
                (err) => {
                  if (err) console.error('[DB] configattr 시딩 오류:', err);

                  db.get(`SELECT id FROM admin_credentials WHERE id = 1`, (err, row) => {
                    if (err) {
                      console.error('[DB] 관리자 계정 조회 오류:', err);
                      db.close();
                      return resolve();
                    }

                    if (!row) {
                      const INIT_USER = process.env.ADMIN_USERNAME || 'adminkim';
                      const INIT_PASS = process.env.ADMIN_PASSWORD || 'akssj#kasjf';
                      const hash = bcrypt.hashSync(INIT_PASS, 12);
                      db.run(
                        `INSERT OR IGNORE INTO admin_credentials (id, username, password) VALUES (1, ?, ?)`,
                        [INIT_USER, hash],
                        (err) => {
                          if (err) console.error('[DB] 관리자 계정 시딩 오류:', err);
                          else console.log(`[DB] 관리자 계정 초기화 완료 (username: ${INIT_USER})`);
                          db.close();
                          resolve();
                        }
                      );
                    } else {
                      db.close();
                      resolve();
                    }
                  });
                }
              );
            }
          }
        });
      });
    });
  });
}

// === 서버 시작 ===
// AI Studio 환경: 기본 포트 3000, 0.0.0.0 바인딩
const PORT = process.env.PORT || 3000;

// DB 초기화 후 서버 시작
initializeDatabase()
  .then(() => {
    // 관리자 자격증명을 DB에서 로드하여 auth 미들웨어 캐시에 설정
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
        if (err) return reject(err);
        db.get(`SELECT username, password FROM admin_credentials WHERE id = 1`, (err, row) => {
          db.close();
          if (err) return reject(err);
          if (row) {
            setCredentialsCache(row.username, row.password);
            console.log(`[AUTH] 관리자 계정 캐시 로드 완료 (username: ${row.username})`);
          } else {
            // 테이블에 아직 행이 없으면 (시딩 중) 기본값으로 폴백
            bcrypt.hash('akssj#kasjf', 12).then(hash => {
              setCredentialsCache('adminkim', hash);
              console.log('[AUTH] 관리자 계정 폴백 캐시 설정 (adminkim)');
            });
          }
          resolve();
        });
      });
    });
  })
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`========================================`);
      console.log(`  WebCrawlServer가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`  - Express HTTP 서버: http://localhost:${PORT}`);
      console.log(`  - WebSocket 서버: ws://localhost:${PORT}`);
      console.log(`  - 헬스 체크: http://localhost:${PORT}/health`);
      console.log(`  - DB 위치: ${path.join(__dirname, '../database/main.db')}`);
      console.log(`========================================`);
      
      // 스케줄러 시작 (R-005 scheduler.md)
      startScheduler(wss);
      
      // 모니터링 시작 (R-006 monitoring.md)
      startMonitor(wss);
      
      // 로그 로테이터 시작 (R-009 logging.md)
      startLogRotator();

      // 크롤러 자동 폴링 시작
      startCrawlerMonitor(wss);
    });
  })
  .catch((err) => {
    console.error('[DB] 초기화 실패로 인해 서버를 시작할 수 없습니다:', err);
    process.exit(1);
  });

// === 내보내기 (테스트용) ===
module.exports = { app, server, wss };
