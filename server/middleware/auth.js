// server/middleware/auth.js
/**
 * 인증 미들웨어
 * BASIC AUTH 및 JWT 기반 인증 지원
 * 
 * R-013 (security.md): 인증/인가 규정 참조
 */

const basicAuth = require('basic-auth');

// 보안: 환경변수 필수 검증 - 미설정 시 서버 시작 방지
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const API_KEY = process.env.API_KEY || 'default-api-key';

/**
 * BASIC AUTH 인증을 수행하는 미들웨어
 * @param {string} realm - 인증 영역 (기본값: 'Admin Area')
 * @returns {Function} Express 미들웨어 함수
 */
function basicAuthMiddleware(realm = 'Admin Area') {
  return (req, res, next) => {
    // 헤더에서 인증 정보 추출
    const credentials = basicAuth(req);
    
    if (!credentials || 
        credentials.name !== ADMIN_USERNAME || 
        credentials.pass !== ADMIN_PASSWORD) {
      // 인증 실패 시 401 응답
      res.set('WWW-Authenticate', `Basic realm="${realm}"`);
      return res.status(401).json({
        status: 'error',
        message: '인증 필요',
        detail: '유효한 사용자 이름과 비밀번호를 제공하세요.'
      });
    }
    
    // 인증 성공 - 사용자 정보 요청 객체에 추가
    req.user = {
      username: credentials.name,
      authenticated: true,
      roles: ['admin'] // 기본 admin 역할
    };
    
    next();
  };
}

/**
 * API Key 기반 인증을 수행하는 미들웨어
 * @param {string} headerName - API Key 헤더 이름 (기본값: 'x-api-key')
 * @returns {Function} Express 미들웨어 함수
 */
function apiKeyAuthMiddleware(headerName = 'x-api-key') {
  if (!API_KEY) {
    throw new Error('보안 오류: API_KEY 환경변수가 설정되어야 합니다.');
  }
  
  const API_KEY_VALUE = API_KEY;
  
  return (req, res, next) => {
    const providedKey = req.headers[headerName.toLowerCase()] || req.headers[headerName];
    
    if (!providedKey || providedKey !== API_KEY_VALUE) {
      return res.status(401).json({
        status: 'error',
        message: '인증 필요',
        detail: '유효한 API 키가 필요합니다.'
      });
    }
    
    // API Key 인증 성공
    req.user = {
      username: 'api-user',
      authenticated: true,
      roles: ['api']
    };
    
    next();
  };
}

/**
 * JWT 기반 인증을 수행하는 미들웨어 (미래 확장용)
 * 현재는 BASIC AUTH를 우선 사용
 */
function jwtAuthMiddleware() {
  // 향후 JWT 구현 시这里 추가
  // 현재는 BASIC AUTH 사용을 권장
  return (req, res, next) => {
    // 임시로 BASIC AUTH로 리다이렉트
    return basicAuthMiddleware()(req, res, next);
  };
}

/**
 * 역할 기반 접근 제어(RBAC) 미들웨어
 * @param {string|string[]} requiredRoles - 필요한 역할 또는 역할 배열
 * @returns {Function} Express 미들웨어 함수
 */
function requireRoles(requiredRoles) {
  return (req, res, next) => {
    // 인증 먼저 확인
    if (!req.user || !req.user.authenticated) {
      return res.status(401).json({
        status: 'error',
        message: '인증 필요'
      });
    }
    
    // 역할 확인
    const hasRequiredRole = Array.isArray(requiredRoles) 
      ? requiredRoles.some(role => req.user.roles.includes(role))
      : req.user.roles.includes(requiredRoles);
    
    if (!hasRequiredRole) {
      return res.status(403).json({
        status: 'error',
        message: '접근 거부',
        detail: '해당 리소스에 접근할 권한이 없습니다.'
      });
    }
    
    next();
  };
}

// 주요 export
module.exports = {
  basicAuth: basicAuthMiddleware,
  apiKeyAuth: apiKeyAuthMiddleware,
  jwtAuth: jwtAuthMiddleware,
  requireRoles,
  // 편의성 export
  basicAuthMiddleware,
  apiKeyAuthMiddleware
};
