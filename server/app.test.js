/**
 * API 통합 테스트
 * P3: 통합 테스트 도입
 * supertest 기반 API 엔드포인트 테스트
 */

const request = require('supertest');
const { app } = require('./app');
const dbHelper = require('./db/helper');

describe('API 통합 테스트', () => {
  // 헬스 체크
  test('GET /health - 서버 상태 확인', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  // 공통 API
  test('GET /api - 공통 API 응답 확인', async () => {
    const res = await request(app).get('/api');
    expect(res.status).toBe(200);
  });

  // NLP API
  test('POST /api/nlp/sql - 자연어 to SQL 변환', async () => {
    const res = await request(app)
      .post('/api/nlp/sql')
      .send({ prompt: '회원 검색' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('OPTIONS /api/plugin/request - 확장 프로그램 CORS preflight 허용', async () => {
    const res = await request(app)
      .options('/api/plugin/request')
      .set('Origin', 'chrome-extension://abc123')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('chrome-extension://abc123');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  test('플러그인 승인 시 토큰이 발급되고 상태가 approved로 갱신된다', async () => {
    const requestId = await dbHelper.insertPluginRequest({
      browser_name: 'Test Browser',
      browser_version: '1.0',
      extension_id: 'test-ext',
      hostname: 'browser-extension'
    });

    const token = await dbHelper.approvePluginRequest(requestId);
    const row = await dbHelper.queryOne('SELECT status, approved_token, connected FROM plugin_requests WHERE id = ?', [requestId]);

    expect(token).toBeTruthy();
    expect(row.status).toBe('approved');
    expect(row.approved_token).toBe(token);
    expect(row.connected).toBe(0);
  });

  test('플러그인 상태 조회가 없는 요청에도 200과 pending를 반환한다', async () => {
    const res = await request(app).get('/api/plugin/status/9999999');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(res.body.token).toBeNull();
  });

  // 404 처리
  test('GET /unknown - 404 응답 확인', async () => {
    const res = await request(app).get('/unknown');
    expect(res.status).toBe(404);
  });
});