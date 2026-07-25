// server/routes/adminUi.js
const express = require('express');
const path = require('path');
const router = express.Router();

// 빌드된 UI 파일 위치 (server/admin-ui/dist)
const staticPath = path.join(__dirname, '../admin-ui/dist');

// 정적 자원 (JS, CSS, 이미지) 서빙
router.use(express.static(staticPath));

// SPA 라우팅: HTML5 History API 지원을 위해 모든 콘솔 페이지 요청 시 index.html 반환
router.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

module.exports = router;
