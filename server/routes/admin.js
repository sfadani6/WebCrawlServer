/**
 * server/routes/admin.js — 관리자 페이지 정적 파일 라우터
 *
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-003 (structure.md): 서버 디렉토리 구조 참조
 *
 * 마운트 경로: /admin
 * 역할: public/admin/ 하위의 HTML 파일들을 경로에 맞게 제공합니다.
 */

const express    = require('express');
const path       = require('path');

const router     = express.Router();
const ADMIN_DIR  = path.join(__dirname, '../../public/admin');

// 대시보드 (GET /admin)
router.get('/', (req, res) => {
    res.sendFile(path.join(ADMIN_DIR, 'index.html'));
});

// 서버 프로세스 목록 (GET /admin/process)
router.get('/process', (req, res) => {
    res.sendFile(path.join(ADMIN_DIR, 'process/index.html'));
});

// 서버 프로세스 세부 정보 (GET /admin/process/detail)
router.get('/process/detail', (req, res) => {
    res.sendFile(path.join(ADMIN_DIR, 'process/detail.html'));
});

// 프로세스 로그 목록 (GET /admin/process/logs)
router.get('/process/logs', (req, res) => {
    res.sendFile(path.join(ADMIN_DIR, 'process/logs/index.html'));
});

// 데이터베이스 관리 (GET /admin/database)
router.get('/database', (req, res) => {
    res.sendFile(path.join(ADMIN_DIR, 'database/index.html'));
});

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
