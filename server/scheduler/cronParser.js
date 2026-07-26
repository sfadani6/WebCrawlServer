/**
 * Cron Parser - 초간단 cron 표현식 파서
 * 
 * R-005 (scheduler.md) 1장: cron 표현식 형식 지원
 * node-cron 대신 순수 JavaScript 로 구현 (의존성 최소화)
 */

/**
 * cron 표현식을 다음 실행 시각으로 변환
 * @param {string} cronExpr - cron 표현식 (분 시 일 월 요일)
 * @returns {Date|null} 다음 실행 시각
 */
function getNextTime(cronExpr) {
  if (!cronExpr || typeof cronExpr !== 'string') {
    return null;
  }
  
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    console.warn(`[CronParser] 유효하지 않은 cron 표현식: ${cronExpr}`);
    return null;
  }
  
  const [min, hour, day, month, weekday] = parts;
  
  // node-cron 방식으로 간단히 처리 (향후 node-cron 로 교체 가능)
  // 현재는 1분 간격으로 단순화
  if (min !== '*' && parseInt(min) !== parseInt(new Date().getMinutes())) {
    // 실제 cron 로직은 추후 node-cron 사용
    return null;
  }
  
  const next = new Date();
  next.setMinutes(next.getMinutes() + 1);
  return next;
}

/**
 * cron 표현식 유효성 검사
 * @param {string} cronExpr - cron 표현식
 * @returns {boolean} 유효 여부
 */
function isValidCron(cronExpr) {
  if (!cronExpr || typeof cronExpr !== 'string') return false;
  
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  
  // 각 파트별 유효성 검사 (간단히)
  // 분: 0-59
  // 시: 0-23
  // 일: 1-31
  // 월: 1-12
  // 요일: 0-6 (일요일=0)
  
  return true; // 상세 검사는 추후 확장
}

/**
 * cron 표현식을 human readable 텍스트로 변환
 * @param {string} cronExpr - cron 표현식
 * @returns {string} 설명 텍스트
 */
function describe(cronExpr) {
  if (!isValidCron(cronExpr)) {
    return '유효하지 않은 cron 표현식';
  }
  
  const parts = cronExpr.trim().split(/\s+/);
  const [min, hour, day, month, weekday] = parts;
  
  let desc = '';
  
  if (min === '*' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return '매분';
  }
  
  if (hour !== '*' && min !== '*') {
    desc = `${hour}시 ${min}분`;
  } else if (hour !== '*') {
    desc = `${hour}시마다`;
  } else if (min !== '*') {
    desc = `${min}분마다`;
  }
  
  if (day !== '*') desc += ` (매일)`;
  if (month !== '*') desc += ` ${month}월`;
  if (weekday !== '*') desc += ` 요일: ${weekday}`;
  
  return desc || cronExpr;
}

module.exports = {
  getNextTime,
  isValidCron,
  describe
};