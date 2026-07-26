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
const { basicAuth, setCredentialsCache } = require('./middleware/auth');
const bcrypt           = require('bcryptjs');

// === Express 앱 설정 ===
const app    = express();
const server = http.createServer(app);

// WebSocket 인증 토큰 (환경변수 또는 기본값)
const WS_TOKEN = process.env.WS_TOKEN || 'default-ws-token';

// WebSocket 서버 생성 (MCP 프로토콜 지원) - Origin 검증 및 인증 추가
// 보안: 메시지 크기 제한 (1MB)
const wss = new WebSocketServer({
  server,
  maxPayload: 1024 * 1024, // 1MB
  verifyClient: (info, callback) => {
    const origin = info.origin;
    const reqUrl = info.req.url || '';
    
    // Origin 검증 - 허용된 origin만 연결 허용
    // 단순화: allowedOrigins 배열에 포함된 origin만 허용
    const isOriginAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes('*');
    
    if (!isOriginAllowed && origin !== undefined) {
      console.log(`[WebSocket] 거부된 Origin: ${origin}`);
      return callback(false, 403, 'Forbidden');
    }
    
    // 토큰 검증 - 쿼리 파라미터에서 token 추출
    try {
      const url = new URL(reqUrl, `http://${info.req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      
      if (!token || token !== WS_TOKEN) {
        console.log(`[WebSocket] 인증 실패: invalid token`);
        return callback(false, 401, 'Unauthorized');
      }
    } catch (err) {
      console.log(`[WebSocket] URL 파싱 오류:`, err.message);
      return callback(false, 400, 'Bad Request');
    }
    
    // 모든 검증 통과
    callback(true);
  }
});

// === 보안 미들웨어 설정 ===
// 보안 헤더 추가 (helmet)
app.use(helmet());

// CORS 설정 - 허용된 origin만 접근 가능
const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : [
    'http://localhost:3000',
    'http://localhost:9600',
    'http://127.0.0.1:9600'
  ];

app.use(cors({
  origin: allowedOrigins,
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
  max: 100, // 15분당 100회 요청 최대
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: '너무 많은 요청입니다. 잠시 후 다시 시도하세요.'
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
app.use('/api', apiLimiter, createApiRouter(wss));
app.use('/admin/api', adminApiLimiter, basicAuth(), adminDbRouter);
app.use('/api/nlp', nlpLimiter, require('./routes/nlp'));

// === 통합 콘솔 SPA 라우터 마운트 (server/routes/adminUi.js) ===
const adminUiRouter = require('./routes/adminUi');
app.use('/database', adminUiRouter);
app.use('/modules', adminUiRouter);
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
  });

  // 오류 처리
  ws.on('error', (error) => {
    console.error(`[WebSocket] 클라이언트 오류:`, error);
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

// === 오류 처리 미들웨어 ===
app.use((err, req, res, next) => {
  console.error(`[Express] 서버 오류:`, err);
  res.status(500).json({
    status: 'error',
    message: '내부 서버 오류',
    error: process.env.NODE_ENV === 'development' ? err.message : '오류 상세 정보 사용 불가'
  });
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
// R-007 1장: DB 연결 전 디렉토리 존재 여부 확인, 없으면 생성
// R-007 1장: WAL 모드 활성화
// R-007 6장: PRAGMA foreign_keys = ON
async function initializeDatabase() {
  const dbDir = path.join(__dirname, '../database');
  
  // 디렉토리 생성
  await fs.ensureDir(dbDir);
  console.log(`[DB] 데이터베이스 디렉토리 확인: ${dbDir}`);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('[DB] 데이터베이스 연결 오류:', err);
        return reject(err);
      }

      console.log('[DB] SQLite 데이터베이스 연결 성공');

      // WAL 모드 활성화 (R-007 1장)
      db.run('PRAGMA journal_mode=WAL;', (err) => {
        if (err) {
          console.error('[DB] WAL 모드 설정 오류:', err);
        } else {
          console.log('[DB] WAL 모드 활성화');
        }
      });

      // 외래 키 제약 활성화 (R-007 6장)
      db.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) {
          console.error('[DB] 외래 키 설정 오류:', err);
        } else {
          console.log('[DB] 외래 키 제약 활성화');
        }
      });

      // 코어 테이블 생성 (R-007 3장)
      const coreTables = [
        // modules 테이블
        `CREATE TABLE IF NOT EXISTS modules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL,
          config TEXT,
          tags TEXT,
          metadata TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // workflows 테이블
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
        
        // scheduled_jobs 테이블
        `CREATE TABLE IF NOT EXISTS scheduled_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          workflow_id INTEGER NOT NULL,
          cron_expression TEXT,
          once_at TIMESTAMP,
          interval_seconds INTEGER,
          status TEXT NOT NULL DEFAULT 'active',
          overlap_policy TEXT NOT NULL DEFAULT 'skip',
          last_executed_at TIMESTAMP,
          next_execution_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workflow_id) REFERENCES workflows(id)
        )`,
        
        // activity_logs 테이블
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
        
        // error_logs 테이블
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
        
        // schema_migrations 테이블 (R-007 5장)
        `CREATE TABLE IF NOT EXISTS schema_migrations (
          migration_id TEXT PRIMARY KEY,
          target_type TEXT NOT NULL,
          module TEXT,
          description TEXT NOT NULL,
          applied_sql TEXT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // configattr 테이블 (설정 속성 정의)
        `CREATE TABLE IF NOT EXISTS configattr (
          idx INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // config 테이블 (설정 값 저장)
        `CREATE TABLE IF NOT EXISTS config (
          idx INTEGER PRIMARY KEY AUTOINCREMENT,
          attr_id INTEGER NOT NULL,
          val1 TEXT,
          val2 TEXT,
          memo TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (attr_id) REFERENCES configattr(idx) ON DELETE CASCADE
        )`,

        // admin_credentials 테이블 (관리자 계정 저장)
        `CREATE TABLE IF NOT EXISTS admin_credentials (
          id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
          username TEXT NOT NULL,
          password TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      let completed = 0;
      const total = coreTables.length;

      if (total === 0) {
        db.close();
        return resolve();
      }

      coreTables.forEach((sql) => {
        db.run(sql, (err) => {
          if (err) {
            console.error('[DB] 테이블 생성 오류:', err);
          } else {
            completed++;
            if (completed === total) {
              // 초기 configattr 데이터 시딩
              db.run(`INSERT OR IGNORE INTO configattr (idx, name, description) VALUES 
                (1, '브라우저', '브라우저 실행 경로 및 인자 설정'),
                (2, '크롤러', '크롤러 동시 실행 및 딜레이 설정'),
                (3, '시스템', '서버 시스템 전반 환경 설정')`, (err) => {

                // admin_credentials 초기값 시딩 (최초 한 번만)
                db.get(`SELECT id FROM admin_credentials WHERE id = 1`, async (err, row) => {
                  if (!row) {
                    // 초기 관리자 계정 설정
                    const INIT_USER = process.env.ADMIN_USERNAME || 'adminkim';
                    const INIT_PASS = process.env.ADMIN_PASSWORD || 'akssj#kasjf';
                    const hash = await bcrypt.hash(INIT_PASS, 12);
                    db.run(
                      `INSERT OR IGNORE INTO admin_credentials (id, username, password) VALUES (1, ?, ?)`,
                      [INIT_USER, hash],
                      (err) => {
                        if (err) console.error('[DB] 관리자 계정 시딩 오류:', err);
                        else console.log(`[DB] 관리자 계정 초기화 완료 (username: ${INIT_USER})`);
                      }
                    );
                  }
                  console.log(`[DB] 모든 코어 테이블 생성 완료 (${total + 1}개) 및 초기 시딩 완료`);
                  db.close();
                  resolve();
                });
              });
            }
          }
        });
      });
    });
  });
}

// === 서버 시작 ===
// R-001 architecture.md: 기본 포트 9600
const PORT = process.env.PORT || 9600;

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
    server.listen(PORT, () => {
      console.log(`========================================`);
      console.log(`  WebCrawlServer가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`  - Express HTTP 서버: http://localhost:${PORT}`);
      console.log(`  - WebSocket 서버: ws://localhost:${PORT}`);
      console.log(`  - 헬스 체크: http://localhost:${PORT}/health`);
      console.log(`  - DB 위치: ${path.join(__dirname, '../database/main.db')}`);
      console.log(`========================================`);
    });
  })
  .catch((err) => {
    console.error('[DB] 초기화 실패로 인해 서버를 시작할 수 없습니다:', err);
    process.exit(1);
  });

// === 내보내기 (테스트용) ===
module.exports = { app, server, wss };
