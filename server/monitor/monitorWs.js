/**
 * Monitoring WebSocket Broadcaster - 실시간 리소스 사용량 전송
 * 
 * R-006 (monitoring.md) 2장: 리소스 사용량 수집
 * R-006 4장: 실시간 전송
 * 
 * activity_logs 기록: 10초 간격에서 5분(300초) 간격 샘플링으로 변경
 * (로그 테이블 급증 방지, 장기 운영 시 하루 144건으로 제한)
 */

const { execute } = require('../db/helper');

// 모니터링 인터벌
let monitorInterval = null;

// 샘플링 카운터 (10초 주기에서 n번째마다 DB 기록)
let logCounter = 0;
const LOG_SAMPLE_INTERVAL = 30; // 10초 * 30 = 300초(5분)마다 DB 기록

/**
 * 리소스 사용량 조회 및 WebSocket 전송
 * @param {Object} wss - WebSocket 서버
 */
function broadcastResourceUsage(wss) {
  if (!wss || !wss.clients) return;
  
  const cpuUsage = process.cpuUsage();
  const memoryUsage = process.memoryUsage();
  
  const usageData = {
    type: 'monitor_status',
    timestamp: new Date().toISOString(),
    protocolVersion: '1.0',
    data: {
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000,
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024,
      memoryTotal: memoryUsage.heapTotal / 1024 / 1024,
      uptime: process.uptime()
    }
  };
  
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(usageData));
    }
  });
}

/**
 * activity_logs 에 리소스 사용량 기록 (샘플링 적용)
 * 5분(300초)마다 1회만 기록하여 로그 테이블 증가 억제
 */
async function logResourceUsage() {
  logCounter++;
  if (logCounter % LOG_SAMPLE_INTERVAL !== 0) return; // 샘플링

  const cpuUsage = process.cpuUsage();
  const memoryUsage = process.memoryUsage();

  try {
    await execute(
      `INSERT INTO activity_logs (source, action, status, cpu_usage, memory_usage) VALUES (?, ?, ?, ?, ?)`,
      ['monitoring', 'resource_check', 'success',
       (cpuUsage.user + cpuUsage.system) / 1000000,
       memoryUsage.heapUsed / 1024 / 1024]
    );
  } catch (err) {
    console.error('[Monitor] 리소스 로그 기록 오류:', err);
  }
}

/**
 * 모니터링 시작
 * @param {Object} wss - WebSocket 서버
 * @param {number} intervalSec - 전송 간격 (초)
 */
function startMonitor(wss, intervalSec = 10) {
  console.log(`[Monitor] 모니터링 시작 (간격: ${intervalSec}초, DB 기록: ${intervalSec * LOG_SAMPLE_INTERVAL}초 간격)`);
  
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }
  
  monitorInterval = setInterval(() => {
    logResourceUsage().catch(() => {});
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