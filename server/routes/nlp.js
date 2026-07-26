// server/routes/nlp.js
/**
 * 자연어 입력을 SQL 로 변환하는 안전한 라우터
 * SQL Injection 취약점 제거: 파라미터화 쿼리 사용
 * 보안: 미리보기(preview)만 반환하여 관리자 확인 후 실행하도록 함
 * 
 * 2026-07-26: 패턴 확장 (회원 검색, 전체 조회, 컬럼 선택 등)
 */

const express = require('express');
const router = express.Router();

/**
 * SQL 문과 파라미터를 포함하는 안전한 SQL 문 구문 객체
 * @typedef {Object} SafeSqlStatement
 * @property {string} sql - 파라미터 플레이스홀더가 포함된 SQL 문
 * @property {Array} params - 바인딩할 파라미터 배열
 */

// 테이블/컬럼 화이트리스트
const ALLOWED_TABLES = new Set(['users', 'modules', 'workflows', 'scheduled_jobs', 'activity_logs', 'error_logs']);
const ALLOWED_COLUMNS = {
  users: new Set(['id', 'name', 'email', 'created_at', 'updated_at']),
  modules: new Set(['id', 'name', 'type', 'created_at', 'updated_at']),
  workflows: new Set(['id', 'name', 'is_active', 'created_at', 'updated_at']),
  scheduled_jobs: new Set(['id', 'name', 'status', 'cron_expression', 'next_execution_at']),
  activity_logs: new Set(['id', 'source', 'action', 'status', 'created_at']),
  error_logs: new Set(['id', 'error_type', 'error_message', 'created_at'])
};

function normalizeName(name) {
  return String(name).toLowerCase().trim();
}

function isAllowedTable(name) {
  return ALLOWED_TABLES.has(normalizeName(name));
}

function getColumnsForTable(table) {
  const set = ALLOWED_COLUMNS[normalizeName(table)];
  return set ? Array.from(set) : [];
}

// POST /api/nlp/sql
router.post('/sql', (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ status: 'error', message: 'prompt is required' });
  }

  const lowered = prompt.toLowerCase();
  let sql = '';
  let params = [];

  // 1) 회원 삭제 (기존)
  if (lowered.includes('삭제') && lowered.includes('회원')) {
    const match = lowered.match(/([\w가-힣]+)\s*회원/);
    const name = match ? match[1] : '';
    if (!isAllowedTable('users')) {
      return res.status(400).json({ status: 'error', message: '허용되지 않은 테이블입니다.' });
    }
    sql = 'DELETE FROM users WHERE name LIKE ?';
    params = [`${name}%`];
  }
  // 2) 전체 조회 (기존)
  else if (lowered.includes('전체') && lowered.includes('조회')) {
    if (!isAllowedTable('users')) {
      return res.status(400).json({ status: 'error', message: '허용되지 않은 테이블입니다.' });
    }
    sql = 'SELECT * FROM users;';
    params = [];
  }
  // 3) 회원 검색 (신규)
  else if (lowered.includes('검색') && lowered.includes('회원')) {
    const match = lowered.match(/([\w가-힣]+)\s*회원/);
    const keyword = match ? match[1] : '';
    if (!isAllowedTable('users')) {
      return res.status(400).json({ status: 'error', message: '허용되지 않은 테이블입니다.' });
    }
    sql = 'SELECT id, name, email, created_at FROM users WHERE name LIKE ? OR email LIKE ?';
    params = [`%${keyword}%`, `%${keyword}%`];
  }
  // 4) 특정 컬럼 조회 (신규)
  else if (lowered.includes('조회') && lowered.includes('이메일')) {
    if (!isAllowedTable('users')) {
      return res.status(400).json({ status: 'error', message: '허용되지 않은 테이블입니다.' });
    }
    const allowedCols = getColumnsForTable('users');
    const wanted = ['name', 'email'];
    const selectCols = wanted.filter(c => allowedCols.includes(c)).join(', ');
    sql = `SELECT ${selectCols} FROM users`;
    params = [];
  }
  else {
    sql = '-- 현재 지원되지 않는 문장입니다.';
    params = [];
  }

  res.json({
    status: 'ok',
    sql,
    params,
    warning: '이 SQL은 미리보기입니다. 실제 실행을 원할 경우 확인 후 separate execute 엔드포인트를 사용하세요.',
    requiresConfirmation: sql.startsWith('DELETE') || sql.startsWith('UPDATE') || sql.startsWith('INSERT') || sql.startsWith('DROP')
  });
});

module.exports = router;