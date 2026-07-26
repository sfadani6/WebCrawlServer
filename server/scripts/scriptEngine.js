/**
 * MCP Script Engine - MCP 스크립트 단계 실행 엔진
 * 
 * R-004 (mcp.md) 4장: steps 배열 파싱 및 실행
 * R-004 5장: condition/loop/setVariable 처리
 */

const fs = require('fs-extra');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../db/helper');

// 실행 컨텍스트 저장소 (웹워크플로우 별 변수)
const executionContexts = new Map();

/**
 * 실행 컨텍스트 생성 또는 가져오기
 * @param {string} scriptId - 워크플로우/스크립트 고유 식별자
 * @returns {Object} 실행 컨텍스트 객체
 */
function getExecutionContext(scriptId) {
  if (!executionContexts.has(scriptId)) {
    executionContexts.set(scriptId, {
      variables: new Map(),
      currentStep: 0,
      status: 'waiting'
    });
  }
  return executionContexts.get(scriptId);
}

/**
 * 변수 설정 (setVariable 타입 핸들러)
 * @param {Object} context - 실행 컨텍스트
 * @param {Object} step - setVariable 단계
 * @returns {*} 설정된 변수 값
 */
function handleSetVariable(context, step) {
  const varName = step.target;
  const value = step.params?.value ?? step.params?.fromPrevious ?? null;
  context.variables.set(varName, value);
  return value;
}

/**
 * 조건 평가 (condition 타입 핸들러)
 * @param {Object} context - 실행 컨텍스트
 * @param {Object} step - condition 단계
 * @returns {boolean} 조건 결과
 */
function handleCondition(context, step) {
  const expression = step.params?.expression ?? '';
  // 간단한 표현식 평가 (변수명만 지원)
  // 예: "$loginSuccess === true" 또는 "count > 5"
  const varName = expression.replace(/[^a-zA-Z0-9_]/g, '').trim();
  const varValue = context.variables.get(varName);
  // 기본적으로 변수 존재 여부로 판단
  return varValue !== undefined && varValue !== false && varValue !== null;
}

/**
 * 반복 실행 (loop 타입 핸들러)
 * @param {Object} context - 실행 컨텍스트  
 * @param {Object} step - loop 단계
 * @param {Function} executeStepCallback - 단계 실행 콜백
 * @returns {Array} 실행 결과 배열
 */
async function handleLoop(context, step, executeStepCallback) {
  const results = [];
  const times = step.params?.times ?? 1;
  const until = step.params?.until ?? null;
  const maxIterations = step.params?.maxIterations ?? 1000;
  
  let iterations = 0;
  
  while (iterations < maxIterations) {
    // until 조건이 있으면 평가
    if (until) {
      const varName = until.replace(/[^a-zA-Z0-9_]/g, '').trim();
      const varValue = context.variables.get(varName);
      if (varValue) break;
    }
    
    // 내부 steps 실행
    if (step.steps && Array.isArray(step.steps)) {
      for (const innerStep of step.steps) {
        const result = await executeStepCallback(innerStep, context);
        results.push(result);
      }
    }
    
    iterations++;
    if (times && iterations >= times) break;
  }
  
  return results;
}

/**
 * 단계 실행 (핵심 로직)
 * @param {Object} step - 실행할 단계
 * @param {Object} context - 실행 컨텍스트
 * @param {Object} wss - WebSocket 서버 (응답 전송용)
 * @returns {Object} 실행 결과
 */
async function executeStep(step, context, wss) {
  const stepId = step.stepId || step.id || `step_${Date.now()}`;
  context.currentStep = stepId;
  
  try {
    let result;
    
    switch (step.type) {
      case 'setVariable':
        result = handleSetVariable(context, step);
        break;
        
      case 'condition':
        result = handleCondition(context, step);
        break;
        
      case 'loop':
        result = await handleLoop(context, step, (innerStep, ctx) => 
          executeStep(innerStep, ctx, wss)
        );
        break;
        
      case 'navigate':
        // 향후 구현: 브라우저 자동화
        result = { status: 'stub', message: 'navigate not implemented yet' };
        break;
        
      case 'click':
        // 향후 구현: 브라우저 자동화
        result = { status: 'stub', message: 'click not implemented yet' };
        break;
        
      case 'input':
        // 향후 구현: 브라우저 자동화
        result = { status: 'stub', message: 'input not implemented yet' };
        break;
        
      case 'extract':
        // 향후 구현: 브라우저 자동화
        result = { status: 'stub', message: 'extract not implemented yet' };
        break;
        
      case 'waitFor':
        // 향후 구현: 대기 로직
        result = { status: 'stub', message: 'waitFor not implemented yet' };
        break;
        
      case 'custom':
        // 액션 스크립트 위임
        const actionName = step.params?.action ?? step.action;
        const actionPath = path.join(__dirname, 'actions', `${actionName}.js`);
        if (await fs.pathExists(actionPath)) {
          const actionModule = require(actionPath);
          result = await actionModule.execute(step.params, context);
        } else {
          result = { status: 'error', message: `액션 파일 없음: ${actionName}` };
        }
        break;
        
      default:
        result = { status: 'error', message: `알 수 없는 단계 타입: ${step.type}` };
    }
    
    // 성공/실패 시 다음 단계 분기
    if (result?.status === 'error') {
      context.variables.set(`${stepId}_error`, result);
    }
    
    return result;
    
  } catch (error) {
    // 에러 로그 기록
    await logError(stepId, step.type, error);
    return { status: 'error', message: error.message, stack: error.stack };
  }
}

/**
 * 전체 스크립트 실행
 * @param {string} scriptId - 워크플로우/스크립트 고유 식별자
 * @param {Array} steps - 단계 배열
 * @param {Object} wss - WebSocket 서버
 * @returns {Object} 최종 실행 결과
 */
async function executeScript(scriptId, steps, wss) {
  const context = getExecutionContext(scriptId);
  const results = [];
  
  context.status = 'running';
  
  try {
    for (const step of steps) {
      // condition 단계일 경우 건너뛰고 내부 steps 실행
      if (step.type === 'condition' || step.type === 'loop') {
        const stepResult = await executeStep(step, context, wss);
        results.push({ stepId: step.stepId, result: stepResult });
        continue;
      }
      
      const result = await executeStep(step, context, wss);
      results.push({ stepId: step.stepId, result });
      
      // 일시 중지/실패 시 중단
      if (result.status === 'error' && !step.onFailure) {
        break;
      }
    }
    
    context.status = 'completed';
    return { status: 'success', results };
    
  } catch (error) {
    context.status = 'failed';
    await logError(scriptId, 'script', error);
    return { status: 'error', message: error.message };
  }
}

/**
 * 에러 로그 기록 (error_logs 테이블)
 * @param {string} sourceId - 소스 식별자
 * @param {string} sourceType - 소스 타입
 * @param {Error} error - 에러 객체
 */
async function logError(sourceId, sourceType, error) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      
      db.run(
        `INSERT INTO error_logs (error_type, error_message, stack_trace, context) VALUES (?, ?, ?, ?)`,
        [sourceType, error.message, error.stack, JSON.stringify({ sourceId })],
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
 * 모듈 내보내기
 */
module.exports = {
  executeScript,
  executeStep,
  getExecutionContext,
  executionContexts
};