/**
 * Scheduler Job Runner - 예약 작업 실행 엔진
 * 
 * R-005 (scheduler.md) 5장: overlap 정책(skip/queue/parallel)
 * R-005 6장: 실행 및 로그 기록
 * 
 * DB 연결: server/db/helper.js 공통 헬퍼 사용
 */

const { execute, queryOne, DB_PATH } = require('../db/helper');
const { executeScript } = require('../scripts/scriptEngine');
const cronParser = require('./cronParser');

// 실행 중인 작업 추적 (job_id -> Promise)
const runningJobs = new Map();

// 큐 대기열 (queue 정책용)
const jobQueue = [];
let isProcessingQueue = false;

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
 * 큐에 대기 중인 작업을 순차 처리
 */
async function processQueue() {
  if (isProcessingQueue || jobQueue.length === 0) return;
  isProcessingQueue = true;

  while (jobQueue.length > 0) {
    const { job, wss } = jobQueue.shift();
    try {
      await executeJobInternal(job, wss);
    } catch (error) {
      console.error(`[Scheduler] 큐 작업 ${job.id} 실행 오류:`, error);
    }
  }

  isProcessingQueue = false;
}

/**
 * 작업 내부 실행 로직
 */
async function executeJobInternal(job, wss) {
  const jobId = job.id;
  runningJobs.set(jobId, true);

  try {
    if (job.workflow_id) {
      const workflow = await queryOne(`SELECT * FROM workflows WHERE id = ?`, [job.workflow_id]);
      if (workflow && workflow.yaml_content) {
        const steps = parseWorkflowSteps(workflow.yaml_content);
        await executeScript(`scheduled_${jobId}`, steps, wss);
      }
    }

    await execute(
      `UPDATE scheduled_jobs SET last_executed_at = CURRENT_TIMESTAMP, status = 'waiting' WHERE id = ?`,
      [jobId]
    );

  } catch (error) {
    console.error(`[Scheduler] 작업 ${jobId} 실행 오류:`, error);
    await execute(
      `INSERT INTO activity_logs (source, action, status, message, workflow_id) VALUES (?, ?, ?, ?, ?)`,
      ['scheduler', 'run_job', 'error', error.message, jobId]
    );
  } finally {
    runningJobs.delete(jobId);
  }
}

/**
 * 작업 실행
 * @param {Object} job - scheduled_jobs 레코드
 * @param {Object} wss - WebSocket 서버
 */
async function runJob(job, wss) {
  const jobId = job.id;

  // 이미 실행 중이면 overlap 정책 확인
  if (runningJobs.has(jobId)) {
    switch (job.overlap_policy) {
      case 'skip':
        console.log(`[Scheduler] 작업 ${jobId} 이미 실행 중, skip`);
        return;
      case 'queue':
        console.log(`[Scheduler] 작업 ${jobId} 큐에 추가`);
        jobQueue.push({ job, wss });
        processQueue();
        return;
      case 'parallel':
        // parallel은 동시 실행 허용 (아래에서 실행)
        break;
      default:
        console.log(`[Scheduler] 알 수 없는 overlap_policy: ${job.overlap_policy}, skip 처리`);
        return;
    }
  }

  await executeJobInternal(job, wss);
}

/**
 * YAML 워크플로우 파싱 (steps 배열 추출)
 */
function parseWorkflowSteps(yamlContent) {
  try {
    const parsed = require('js-yaml').load(yamlContent);
    return parsed?.steps || [];
  } catch (error) {
    console.error('[Scheduler] YAML 파싱 오류:', error);
    return [];
  }
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
async function getDueJobs() {
  const now = new Date().toISOString();
  const rows = await queryOne(
    `SELECT * FROM scheduled_jobs WHERE status = 'waiting' 
     AND (next_execution_at IS NULL OR next_execution_at <= ?)`,
    [now]
  );
  return rows ? [rows] : [];
}

/**
 * 작업 수동 실행 (관리자 페이지에서 호출)
 */
async function runJobNow(jobId, wss) {
  const job = await queryOne(`SELECT * FROM scheduled_jobs WHERE id = ?`, [jobId]);
  if (!job) {
    throw new Error(`작업 없음: ${jobId}`);
  }
  await runJob(job, wss);
}

module.exports = {
  startScheduler,
  runJob,
  runJobNow,
  getDueJobs,
  runningJobs
};