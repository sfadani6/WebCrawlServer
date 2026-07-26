/**
 * Standard Response Middleware - API 응답 형식 표준화
 * 
 * P2 개선: /api, /admin/api, WebSocket 응답 형식 통일
 * R-013 (security.md): 일관된 에러 응답으로 정보 노출 최소화
 */

/**
 * 성공 응답 래퍼
 * @param {Object} res - Express response 객체
 * @param {*} data - 응답 데이터
 * @param {number} [status=200] - HTTP 상태 코드
 */
function success(res, data, status = 200) {
  return res.status(status).json({
    status: 'success',
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * 실패 응답 래퍼
 * @param {Object} res - Express response 객체
 * @param {string} message - 에러 메시지
 * @param {number} [status=400] - HTTP 상태 코드
 * @param {Object} [details] - 추가 디테일
 */
function fail(res, message, status = 400, details = null) {
  const payload = {
    status: 'error',
    message,
    timestamp: new Date().toISOString()
  };
  if (details) payload.details = details;
  return res.status(status).json(payload);
}

/**
 * 페이지네이션 응답 래퍼
 * @param {Object} res - Express response 객체
 * @param {Array} items - 항목 배열
 * @param {number} total - 전체 개수
 * @param {number} limit - 페이지 크기
 * @param {number} offset - 오프셋
 */
function paginated(res, items, total, limit, offset) {
  return res.json({
    status: 'success',
    data: {
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + items.length < total
      }
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  success,
  fail,
  paginated
};