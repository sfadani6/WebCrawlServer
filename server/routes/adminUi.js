// server/routes/adminUi.js
const express = require('express');
const path = require('path');
const router = express.Router();

// 빌드된 UI 파일 위치 (server/admin-ui/dist)
const staticPath = path.join(__dirname, '../admin-ui/dist');
router.use(express.static(staticPath));

// SPA 라우팅: 모든 경로에 index.html 반환
router.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

module.exports = router;
