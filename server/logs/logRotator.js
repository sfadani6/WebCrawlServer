/**
 * Log Rotator - 일자별 로그 파일 자동 생성·교체
 * 
 * R-009 (logging.md) 1장: 날짜별 로그 파일 생성
 */

const fs = require('fs-extra');
const path = require('path');

// 현재 로그 파일 핸들
let currentLogStream = null;
let currentLogDate = null;

/**
 * 로그 디렉터리 확인 및 생성
 */
async function ensureLogDir() {
  const logDir = path.join(__dirname, '../../logs');
  await fs.ensureDir(logDir);
  return logDir;
}

/**
 * 현재 날짜의 로그 파일 스트림 가져오기
 * 날짜가 바뀌면 기존 파일을 닫고 새 파일 열기
 */
async function getCurrentLogStream() {
  const logDir = await ensureLogDir();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // 날짜가 바뀌었거나 스트림이 없으면 새로 생성
  if (!currentLogStream || currentLogDate !== today) {
    // 기존 스트림 닫기
    if (currentLogStream) {
      currentLogStream.end();
    }
    
    currentLogDate = today;
    const logFile = path.join(logDir, `${today}.log`);
    currentLogStream = fs.createWriteStream(logFile, { flags: 'a' });
  }
  
  return currentLogStream;
}

/**
 * 로그 기록
 * @param {string} level - 로그 레벨 (info, warn, error)
 * @param {string} message - 로그 메시지
 * @param {Object} meta - 메타데이터 (선택)
 */
async function log(level, message, meta = {}) {
  try {
    const stream = await getCurrentLogStream();
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    
    stream.write(JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('[LogRotator] 로그 기록 실패:', error);
  }
}

/**
 * info 레벨 로그
 */
async function info(message, meta) {
  return log('info', message, meta);
}

/**
 * warn 레벨 로그
 */
async function warn(message, meta) {
  return log('warn', message, meta);
}

/**
 * error 레벨 로그
 */
async function error(message, meta) {
  return log('error', message, meta);
}

/**
 * 로그 파일 목록 조회
 * @returns {Array<string>} 로그 파일명 배열
 */
async function listLogFiles() {
  const logDir = await ensureLogDir();
  const files = await fs.readdir(logDir);
  return files.filter(f => f.endsWith('.log')).sort().reverse();
}

/**
 * 로그 파일 내용 읽기
 * @param {string} filename - 로그 파일명
 * @returns {string} 파일 내용
 */
async function readLogFile(filename) {
  const logDir = await ensureLogDir();
  const filePath = path.join(logDir, filename);
  
  if (await fs.pathExists(filePath)) {
    return fs.readFile(filePath, 'utf8');
  }
  return '';
}

/**
 * 로그 로테이터 시작 - 자정에 자동 교체
 */
function startLogRotator() {
  // 자정 체크 인터벌 (1분마다)
  setInterval(async () => {
    const today = new Date().toISOString().split('T')[0];
    if (currentLogDate && currentLogDate !== today) {
      // 날짜가 바뀌었음
      console.log(`[LogRotator] 로그 파일 로테이션: ${currentLogDate} -> ${today}`);
      if (currentLogStream) {
        currentLogStream.end();
      }
      currentLogStream = null; // 다음 호출 시 새 파일 생성
    }
  }, 60000);
  
  console.log('[LogRotator] 로그 로테이터 시작');
}

module.exports = {
  log,
  info,
  warn,
  error,
  getCurrentLogStream,
  listLogFiles,
  readLogFile,
  startLogRotator
};