/**
 * Workflow Engine - YAML 워크플로우 실행 엔진
 * 
 * R-008 (workflow-management.md): 워크플로우 실행
 * R-004 (mcp.md) 4장: steps 배열 실행
 */

const yaml = require('js-yaml');
const { executeScript } = require('../scripts/scriptEngine');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../db/helper');

/**
 * 워크플로우 로드
 * @param {string} workflowId - 워크플로우 ID
 * @returns {Promise<Object>} 워크플로우 객체
 */
async function loadWorkflow(workflowId) {
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
 * 워크플로우 실행
 * @param {string} workflowId - 워크플로우 ID
 * @param {Object} wss - WebSocket 서버
 * @returns {Promise<Object>} 실행 결과
 */
async function runWorkflow(workflowId, wss) {
  try {
    const workflow = await loadWorkflow(workflowId);
    
    if (!workflow || !workflow.yaml_content) {
      return { status: 'error', message: '워크플로우를 찾을 수 없습니다.' };
    }
    
    // YAML 파싱
    const parsed = yaml.load(workflow.yaml_content);
    const steps = parsed?.steps || [];
    
    // 스크립트 실행
    const result = await executeScript(`workflow_${workflowId}`, steps, wss);
    
    return result;
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

/**
 * 워크플로우 검증
 * @param {string} yamlContent - YAML 내용
 * @returns {Object} { valid: boolean, errors: Array }
 */
function validateWorkflow(yamlContent) {
  const errors = [];
  
  try {
    const parsed = yaml.load(yamlContent);
    
    if (!parsed) {
      errors.push('빈 워크플로우입니다.');
      return { valid: false, errors };
    }
    
    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      errors.push('steps 배열이 필요합니다.');
      return { valid: false, errors };
    }
    
    for (const step of parsed.steps) {
      if (!step.type) {
        errors.push(`단계에 type 필드가 없습니다: ${JSON.stringify(step)}`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  } catch (error) {
    errors.push(`YAML 파싱 오류: ${error.message}`);
    return { valid: false, errors };
  }
}

module.exports = {
  loadWorkflow,
  runWorkflow,
  validateWorkflow
};