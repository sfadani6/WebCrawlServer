const express = require('express');
const router = express.Router();
const { basicAuth } = require('../middleware/auth');
const dbHelper = require('../db/helper');

// 플러그인 접속 요청 (브라우저 -> 서버)
router.post('/request', async (req, res) => {
  // 브라우저와 확장 프로그램 정보를 저장하고, 승인 대기쪽으로 보냄
  // 응답은 202 Accepted와 요청 ID 반환
  try {
    const { browser_name, browser_version, extension_id, hostname } = req.body;
    if (!browser_name || !extension_id) {
      return res.status(400).json({ error: '브라우저 이름과 확장 ID는 필수입니다.' });
    }
    const requestId = await dbHelper.insertPluginRequest({
      browser_name,
      browser_version,
      extension_id,
      hostname,
      status: 'pending'
    });
    res.status(202).json({ requestId, message: '요청 접수' });
  } catch (err) {
    console.error('[plugin.request] 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

// 승인 대기 중인 플러그인 요청 목록 조회
router.get('/pending', basicAuth, async (req, res) => {
  try {
    const requests = await dbHelper.getPluginRequests({ status: 'pending' });
    res.json(requests);
  } catch (err) {
    console.error('[plugin.pending] 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

// 승인된 플러그인 목록 조회
router.get('/approved', basicAuth, async (req, res) => {
  try {
    const requests = await dbHelper.getPluginRequests({ status: 'approved' });
    res.json(requests);
  } catch (err) {
    console.error('[plugin.approved] 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

// 플러그인 요청 승인 (토큰 발급)
router.post('/:id/approve', basicAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const approvedToken = await dbHelper.approvePluginRequest(id);
    res.json({ token: approvedToken });
  } catch (err) {
    console.error('[plugin.approve] 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

// 플러그인 요청 거절
router.post('/:id/reject', basicAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await dbHelper.updatePluginRequestStatus(id, 'rejected');
    res.json({ message: '거부 처리' });
  } catch (err) {
    console.error('[plugin.reject] 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

// 플러그인 승인 상태 확인 (폴링용)
router.get('/status/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await dbHelper.queryOne(
      `SELECT status, approved_token FROM plugin_requests WHERE id = ?`,
      [requestId]
    );

    if (!request) {
      return res.json({
        status: 'pending',
        token: null,
        message: '요청이 아직 존재하지 않습니다.'
      });
    }

    res.json({
      status: request.status || 'pending',
      token: request.status === 'approved' ? request.approved_token : null
    });
  } catch (err) {
    console.error('[plugin.status] 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

// 플러그인 연결 종료 (강제 disconnect)
router.post('/:id/disconnect', basicAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await dbHelper.updatePluginRequestStatus(id, 'disconnected');
    res.json({ message: '연결 종료' });
  } catch (err) {
    console.error('[plugin.disconnect] 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;