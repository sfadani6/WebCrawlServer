/**
 * WebCrawlServer - 메인 서버 진입점
 * 
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-001 (architecture.md): 시스템 구성 참조
 * R-003 (structure.md): 서버 디렉토리 구조 참조
 * R-004 (mcp.md): MCP 프로토콜 적용
 */

const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs-extra');

// === Express 앱 설정 ===
const app = express();
const server = http.createServer(app);

// WebSocket 서버 생성 (MCP 프로토콜 지원)
const wss = new WebSocketServer({ server });

// === 미들웨어 설정 ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 서비스 (관리자 페이지 및 공용 파일)
app.use('/static', express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../public')));

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

// 메인 페이지 - index.html 제공
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// === 관리자 페이지 라우트 ===

// 관리자 대시보드
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// 서버 프로세스 목록
app.get('/admin/process', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/process/index.html'));
});

// 서버 프로세스 세부 정보
app.get('/admin/process/detail', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/process/detail.html'));
});

// 로그 기록 목록
app.get('/admin/process/logs', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/process/logs/index.html'));
});

// 데이터베이스 관리
app.get('/admin/database', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/database/index.html'));
});

// 모듈 관리 (미래 사용)
app.get('/admin/modules', (req, res) => {
  res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// 워크플로우 관리 (미래 사용)
app.get('/admin/workflows', (req, res) => {
  res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// 스케줄러 관리 (미래 사용)
app.get('/admin/scheduler', (req, res) => {
  res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// 로그 관리 (미래 사용)
app.get('/admin/logs', (req, res) => {
  res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// === WebSocket 메시지 처리 (MCP 프로토콜) ===
// R-004 (mcp.md) 1장: 메시지 헤더 필수 필드 참조
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] 클라이언트 연결: ${clientIp}`);

  // 연결 시 초기 메시지 전송
  ws.send(JSON.stringify({
    type: 'heartbeat',
    message: 'WebCrawlServer에 연결되었습니다.',
    timestamp: new Date().toISOString(),
    protocolVersion: '1.0'
  }));

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

// === 오류 처리 미들웨어 ===
app.use((err, req, res, next) => {
  console.error(`[Express] 서버 오류:`, err);
  res.status(500).json({
    status: 'error',
    message: '내부 서버 오류',
    error: process.env.NODE_ENV === 'development' ? err.message : '오류 detalles 사용 불가'
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

  const dbPath = path.join(dbDir, 'main.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
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
              console.log(`[DB] 모든 코어 테이블 생성 완료 (${total}개)`);
              db.close();
              resolve();
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
