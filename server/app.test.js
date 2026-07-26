/**
 * API 통합 테스트
 * P3: 통합 테스트 도입
 * supertest 기반 API 엔드포인트 테스트
 */

const request = require('supertest');
const { app } = require('./app');

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

  // 404 처리
  test('GET /unknown - 404 응답 확인', async () => {
    const res = await request(app).get('/unknown');
    expect(res.status).toBe(404);
  });
});