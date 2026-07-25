// server/routes/nlp.js
/**
 * 자연어 입력을 SQL 로 변환하는 간단한 예시 라우터
 * 현재는 매우 기본적인 패턴 매칭만 지원합니다.
 */
const express = require('express');
const router = express.Router();

// POST /api/nlp/sql
router.post('/sql', (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ status: 'error', message: 'prompt is required' });
  }

  // 간단 패턴 매칭 (예시용)
  const lowered = prompt.toLowerCase();
  let sql = '';
  if (lowered.includes('삭제') && lowered.includes('회원')) {
    // "김씨 회원만 삭제"와 같은 문장을 처리
    const match = lowered.match(/([\w가-힣]+)\s*회원/);
    const name = match ? match[1] : '';
    sql = `DELETE FROM users WHERE name LIKE '${name}%';`;
  } else if (lowered.includes('전체') && lowered.includes('조회')) {
    sql = 'SELECT * FROM users;';
  } else {
    sql = '-- 현재 지원되지 않는 문장입니다.';
  }

  res.json({ status: 'ok', sql });
});

module.exports = router;
