// server/routes/nlp.js
/**
 * 자연어 입력을 SQL 로 변환하는 안전한 라우터
 * SQL Injection 취약점 제거: 파라미터화 쿼리 사용
 * 보안: 미리보기(preview)만 반환하여 관리자 확인 후 실행하도록 함
 */
const express = require('express');
const router = express.Router();

/**
 * SQL 문과 파라미터를 포함하는 안전한 SQL 문 구문 객체
 * @typedef {Object} SafeSqlStatement
 * @property {string} sql - 파라미터 플레이스홀더가 포함된 SQL 문
 * @property {Array} params - 바인딩할 파라미터 배열
 */

// POST /api/nlp/sql
router.post('/sql', (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ status: 'error', message: 'prompt is required' });
  }

  // 간단 패턴 매칭 (예시용)
  const lowered = prompt.toLowerCase();
  let sql = '';
  let params = [];
  
  if (lowered.includes('삭제') && lowered.includes('회원')) {
    // "김씨 회원만 삭제"와 같은 문장을 처리
    const match = lowered.match(/([\w가-힣]+)\s*회원/);
    const name = match ? match[1] : '';
    // 보안: 파라미터화 쿼리 사용
    sql = 'DELETE FROM users WHERE name LIKE ?';
    params = [`${name}%`];
  } else if (lowered.includes('전체') && lowered.includes('조회')) {
    sql = 'SELECT * FROM users;';
    params = [];
  } else {
    sql = '-- 현재 지원되지 않는 문장입니다.';
    params = [];
  }

  // 보안: 실제 실행이 아닌 미리보기만 반환
  // 관리자가 확인 후 실행하도록 confirm 단계가 필요합니다.
  res.json({ 
    status: 'ok', 
    sql,
    params,
    warning: '이 SQL은 미리보기입니다. 실제 실행을 원할 경우 확인 후 separate execute 엔드포인트를 사용하세요.',
    requiresConfirmation: sql.startsWith('DELETE') || sql.startsWith('UPDATE') || sql.startsWith('INSERT') || sql.startsWith('DROP')
  });
});

module.exports = router;
