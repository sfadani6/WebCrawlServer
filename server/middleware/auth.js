// server/middleware/auth.js
/**
 * 인증 미들웨어
 * BASIC AUTH - admin_credentials 테이블 기반 (bcryptjs 해시 비교)
 * 
 * R-013 (security.md): 인증/인가 규정 참조
 */

const basicAuth = require('basic-auth');
const bcrypt    = require('bcryptjs');

const API_KEY = process.env.API_KEY || 'default-api-key';

/**
 * 현재 로드된 자격증명 캐시 (서버 인메모리)
 * loadCredentials()로 초기화, refreshCredentials()로 갱신
 */
const credentialsCache = {
  username: null,
  passwordHash: null,
  loaded: false
};

/**
 * DB에서 관리자 자격증명을 불러와 캐시에 저장합니다.
 * app.js의 서버 시작 후 호출되거나, 변경 API에서 갱신됩니다.
 * @param {string} username - 관리자 아이디
 * @param {string} passwordHash - bcrypt 해시된 비밀번호
 */
function setCredentialsCache(username, passwordHash) {
  credentialsCache.username     = username;
  credentialsCache.passwordHash = passwordHash;
  credentialsCache.loaded       = true;
}

/**
 * 현재 캐시된 자격증명을 반환합니다.
 */
function getCredentialsCache() {
  return credentialsCache;
}

/**
 * BASIC AUTH 인증 미들웨어
 * bcryptjs 비동기 비교를 사용합니다.
 * @param {string} realm - 인증 영역 (기본값: 'Admin Area')
 * @returns {Function} Express 미들웨어 함수
 */
function basicAuthMiddleware(realm = 'Admin Area') {
  return async (req, res, next) => {
    const credentials = basicAuth(req);

    if (!credentials) {
      res.set('WWW-Authenticate', `Basic realm="${realm}"`);
      return res.status(401).json({
        status: 'error',
        message: '인증 필요',
        detail: '유효한 사용자 이름과 비밀번호를 제공하세요.'
      });
    }

    // 캐시가 아직 로드 안 된 경우 (서버 시작 직후 등)
    if (!credentialsCache.loaded) {
      res.set('WWW-Authenticate', `Basic realm="${realm}"`);
      return res.status(503).json({
        status: 'error',
        message: '서버 초기화 중입니다. 잠시 후 다시 시도하세요.'
      });
    }

    // 아이디 먼저 확인
    if (credentials.name !== credentialsCache.username) {
      res.set('WWW-Authenticate', `Basic realm="${realm}"`);
      return res.status(401).json({
        status: 'error',
        message: '인증 실패',
        detail: '아이디 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // bcryptjs로 비밀번호 해시 비교 (비동기)
    const valid = await bcrypt.compare(credentials.pass, credentialsCache.passwordHash);

    if (!valid) {
      res.set('WWW-Authenticate', `Basic realm="${realm}"`);
      return res.status(401).json({
        status: 'error',
        message: '인증 실패',
        detail: '아이디 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // 인증 성공
    req.user = {
      username: credentials.name,
      authenticated: true,
      roles: ['admin']
    };

    next();
  };
}

/**
 * API Key 기반 인증 미들웨어
 */
function apiKeyAuthMiddleware(headerName = 'x-api-key') {
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

    req.user = {
      username: 'api-user',
      authenticated: true,
      roles: ['api']
    };

    next();
  };
}

/**
 * JWT 기반 인증 (미래 확장용, 현재는 basicAuth로 위임)
 */
function jwtAuthMiddleware() {
  return (req, res, next) => {
    return basicAuthMiddleware()(req, res, next);
  };
}

/**
 * 역할 기반 접근 제어(RBAC) 미들웨어
 */
function requireRoles(requiredRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.authenticated) {
      return res.status(401).json({ status: 'error', message: '인증 필요' });
    }

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

module.exports = {
  basicAuth: basicAuthMiddleware,
  apiKeyAuth: apiKeyAuthMiddleware,
  jwtAuth: jwtAuthMiddleware,
  requireRoles,
  basicAuthMiddleware,
  apiKeyAuthMiddleware,
  // 자격증명 캐시 관리 함수 (app.js 및 adminDb.js에서 사용)
  setCredentialsCache,
  getCredentialsCache
};
