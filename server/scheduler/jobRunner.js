/**
 * Scheduler Job Runner - 예약 작업 실행 엔진
 * 
 * R-005 (scheduler.md) 5장: overlap 정책(skip/queue/parallel)
 * R-005 6장: 실행 및 로그 기록
 */

const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../db/helper');
const { executeScript } = require('../scripts/scriptEngine');
const cronParser = require('./cronParser');

// 실행 중인 작업 추적 (job_id -> Promise)
const runningJobs = new Map();

/**
 * cron 표현식을 다음 실행 시각으로 변환
 * @param {string} cronExpr - cron 표현식 (분 시 일 월 요일)
 * @returns {Date|null} 다음 실행 시각
 */
function getNextCronTime(cronExpr) {
  if (!cronExpr) return null;
  return cronParser.getNextTime(cronExpr);
}

/**
 * 작업 실행
 * @param {Object} job - scheduled_jobs 레코드
 * @param {Object} wss - WebSocket 서버
 */
async function runJob(job, wss) {
  const jobId = job.id;
  
  // 이미 실행 중이면 skip 정책 확인
  if (runningJobs.has(jobId)) {
    if (job.overlap_policy === 'skip') {
      console.log(`[Scheduler] 작업 ${jobId} 이미 실행 중, skip`);
      return;
    }
    if (job.overlap_policy === 'queue') {
      // queue 정책은 현재 미구현 - 추후 확장
      console.log(`[Scheduler] 작업 ${jobId} queue 정책 미구현`);
      return;
    }
    // parallel은 동시 실행 허용
  }
  
  runningJobs.set(jobId, true);
  
  try {
    // 워크플로우 실행 (workflow_id 가 있는 경우)
    if (job.workflow_id) {
      const workflow = await getWorkflowById(job.workflow_id);
      if (workflow && workflow.yaml_content) {
        const steps = parseWorkflowSteps(workflow.yaml_content);
        await executeScript(`scheduled_${jobId}`, steps, wss);
      }
    }
    
    // 실행 완료 시각 업데이트
    await updateJobExecution(jobId);
    
  } catch (error) {
    console.error(`[Scheduler] 작업 ${jobId} 실행 오류:`, error);
    await logActivity(jobId, 'scheduler', 'error', error.message);
  } finally {
    runningJobs.delete(jobId);
  }
}

/**
 * 워크플로우 조회
 */
function getWorkflowById(workflowId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      db.get(`SELECT * FROM workflows WHERE id = ?`, [workflowId], (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row);
      });
    });
  });
}

/**
 * YAML 워크플로우 파싱 (steps 배열 추출)
 */
function parseWorkflowSteps(yamlContent) {
  // js-yaml 을 사용한 YAML 파싱 (향후 구현)
  // 현재는 간단히 steps 배열 반환
  try {
    const parsed = require('js-yaml').load(yamlContent);
    return parsed?.steps || [];
  } catch (error) {
    console.error('[Scheduler] YAML 파싱 오류:', error);
    return [];
  }
}

/**
 * 작업 실행 시각 업데이트
 */
function updateJobExecution(jobId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      db.run(
        `UPDATE scheduled_jobs SET last_executed_at = CURRENT_TIMESTAMP, status = 'waiting' WHERE id = ?`,
        [jobId],
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
 * 활동 로그 기록
 */
function logActivity(jobId, source, action, status, message) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      db.run(
        `INSERT INTO activity_logs (source, action, status, message, workflow_id) VALUES (?, ?, ?, ?, ?)`,
        [source, action, status, message, jobId],
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
 * 스케줄러 시작 - 주기적 작업 체크
 * @param {Object} wss - WebSocket 서버
 * @param {number} intervalMs - 체크 간격 (밀리초)
 */
function startScheduler(wss, intervalMs = 30000) {
  console.log(`[Scheduler] 스케줄러 시작 (체크 간격: ${intervalMs}ms)`);
  
  setInterval(async () => {
    try {
      const dueJobs = await getDueJobs();
      
      for (const job of dueJobs) {
        // status 가 waiting 인 작업만 실행
        if (job.status !== 'waiting') continue;
        
        runJob(job, wss);
      }
    } catch (error) {
      console.error('[Scheduler] 작업 조회 오류:', error);
    }
  }, intervalMs);
}

/**
 * 실행 시각이 된 작업 조회
 */
function getDueJobs() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      
      const now = new Date().toISOString();
      db.all(
        `SELECT * FROM scheduled_jobs WHERE status = 'waiting' 
         AND (next_execution_at IS NULL OR next_execution_at <= ?)`,
        [now],
        (err, rows) => {
          db.close();
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  });
}

/**
 * 작업 수동 실행 (관리자 페이지에서 호출)
 */
async function runJobNow(jobId, wss) {
  const job = await getJobById(jobId);
  if (!job) {
    throw new Error(`작업 없음: ${jobId}`);
  }
  await runJob(job, wss);
}

/**
 * 작업 단건 조회
 */
function getJobById(jobId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      db.get(`SELECT * FROM scheduled_jobs WHERE id = ?`, [jobId], (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row);
      });
    });
  });
}

module.exports = {
  startScheduler,
  runJob,
  runJobNow,
  getDueJobs,
  runningJobs
};