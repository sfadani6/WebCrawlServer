/**
 * Monitoring WebSocket Broadcaster - 실시간 리소스 사용량 전송
 * 
 * R-006 (monitoring.md) 2장: 리소스 사용량 수집
 * R-006 4장: 실시간 전송
 */

const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../db/helper');

// 모니터링 인터벌
let monitorInterval = null;

/**
 * 리소스 사용량 조회 및 WebSocket 전송
 * @param {Object} wss - WebSocket 서버
 */
function broadcastResourceUsage(wss) {
  if (!wss || !wss.clients) return;
  
  // 현재 프로세스 CPU/메모리 사용량 (process.hrtime 사용)
  const cpuUsage = process.cpuUsage();
  const memoryUsage = process.memoryUsage();
  
  const usageData = {
    type: 'monitor_status',
    timestamp: new Date().toISOString(),
    protocolVersion: '1.0',
    data: {
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // ms 단위
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB 단위
      memoryTotal: memoryUsage.heapTotal / 1024 / 1024,
      uptime: process.uptime()
    }
  };
  
  // 모든 연결된 클라이언트에 전송
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(usageData));
    }
  });
}

/**
 * activity_logs 에 리소스 사용량 기록
 */
function logResourceUsage() {
  const cpuUsage = process.cpuUsage();
  const memoryUsage = process.memoryUsage();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      
      db.run(
        `INSERT INTO activity_logs (source, action, status, cpu_usage, memory_usage) VALUES (?, ?, ?, ?, ?)`,
        ['monitoring', 'resource_check', 'success', 
         (cpuUsage.user + cpuUsage.system) / 1000000,
         memoryUsage.heapUsed / 1024 / 1024],
        (err) => {
          db.close();
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
}

/**
 * 모니터링 시작
 * @param {Object} wss - WebSocket 서버
 * @param {number} intervalSec - 전송 간격 (초)
 */
function startMonitor(wss, intervalSec = 10) {
  console.log(`[Monitor] 모니터링 시작 (간격: ${intervalSec}초)`);
  
  // 기존 인터벌 정리
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }
  
  // 주기적 실행
  monitorInterval = setInterval(() => {
    // 리소스 사용량 기록
    logResourceUsage().catch(err => {
      console.error('[Monitor] 리소스 로그 기록 오류:', err);
    });
    
    // 실시간 전송
    broadcastResourceUsage(wss);
  }, intervalSec * 1000);
  
  // 즉시 한 번 실행
  logResourceUsage().catch(() => {});
  broadcastResourceUsage(wss);
}

/**
 * 모니터링 정지
 */
function stopMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[Monitor] 모니터링 정지');
  }
}

module.exports = {
  startMonitor,
  stopMonitor
};