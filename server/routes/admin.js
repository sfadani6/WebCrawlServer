/**
 * server/routes/admin.js — 관리자 페이지 라우터
 *
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-003 (structure.md): 서버 디렉토리 구조 참조
 *
 * 마운트 경로: /admin
 */

const express    = require('express');
const path       = require('path');

const router     = express.Router();
// 메인 관리자 페이지는 public/index.html (루트 레벨)
const PUBLIC_DIR = path.join(__dirname, '../../public');

// 대시보드 (GET /admin) — /admin/database/로 리다이렉트
// docs/ask.md: 데이터베이스 관리가 핵심 기능이므로 바로 이동
router.get('/', (req, res) => {
    res.redirect('/admin/database/');
});

// 서버 프로세스 목록 (미구현 - public/admin/ 디렉토리 미생성)
router.get('/process', (req, res) => {
    res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// 서버 프로세스 세부 정보 (미구현)
router.get('/process/detail', (req, res) => {
    res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// 프로세스 로그 목록 (미구현)
router.get('/process/logs', (req, res) => {
    res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// 데이터베이스 관리 라우트는 app.js에서 /admin/database로 별도 마운트됨 (adminUi.js 사용)

// 모듈 관리 (미구현)
router.get('/modules', (req, res) => {
    res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// 워크플로우 관리 (미구현)
router.get('/workflows', (req, res) => {
    res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// 스케줄러 관리 (미구현)
router.get('/scheduler', (req, res) => {
    res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// 로그 관리 (미구현)
router.get('/logs', (req, res) => {
    res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

// 설정 (미구현)
router.get('/settings', (req, res) => {
    res.status(404).json({ status: 'error', message: '아직 구현되지 않음' });
});

module.exports = router;
