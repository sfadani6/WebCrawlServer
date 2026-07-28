/**
 * Cron Parser - cron 표현식 파서
 * 
 * R-005 (scheduler.md) 1장: cron 표현식 형식 지원
 * 순수 JavaScript 구현 (의존성 최소화)
 * 
 * 지원 형식:
 * - 기본 5필드: 분(0-59) 시(0-23) 일(1-31) 월(1-12) 요일(0-7, 0=일)
 * - 특수문자: *(모든값), ,(목록), -(범위), /(간격)
 */

/**
 * 필드별 값 범위
 */
const FIELD_RANGES = {
  minute:     { min: 0, max: 59 },
  hour:       { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month:      { min: 1, max: 12 },
  dayOfWeek:  { min: 0, max: 7 }  // 0과 7은 일요일
};

/**
 * cron 필드를 파싱하여 가능한 값 집합으로 변환
 * @param {string} field - cron 필드 문자열
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {Set<number>} 가능한 값 집합
 */
function parseField(field, min, max) {
  const values = new Set();
  
  // 쉼표로 구분된 목록 처리 (예: 1,3,5)
  const parts = field.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    
    // 간격 표현 처리 (예: */5, 1-10/2)
    const stepMatch = trimmed.match(/^(\S+)\/(\d+)$/);
    if (stepMatch) {
      const [, range, stepStr] = stepMatch;
      const step = parseInt(stepStr, 10);
      let rangeStart = min;
      let rangeEnd = max;
      
      if (range !== '*') {
        const rangeParts = range.split('-');
        rangeStart = parseInt(rangeParts[0], 10);
        rangeEnd = rangeParts.length > 1 ? parseInt(rangeParts[1], 10) : max;
      }
      
      for (let v = rangeStart; v <= rangeEnd; v += step) {
        if (v >= min && v <= max) values.add(v);
      }
      continue;
    }
    
    // 범위 표현 처리 (예: 1-5)
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let v = start; v <= end; v++) {
        if (v >= min && v <= max) values.add(v);
      }
      continue;
    }
    
    // 와일드카드
    if (trimmed === '*') {
      for (let v = min; v <= max; v++) values.add(v);
      continue;
    }
    
    // 단일 숫자
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      values.add(num);
    }
  }
  
  return values;
}

/**
 * cron 표현식을 파싱하여 각 필드의 가능한 값 집합을 반환
 * @param {string} cronExpr - cron 표현식
 * @returns {Object|null} { minute, hour, dayOfMonth, month, dayOfWeek } 각 Set
 */
function parseCron(cronExpr) {
  if (!cronExpr || typeof cronExpr !== 'string') return null;
  
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  
  const [minField, hourField, dayField, monthField, weekdayField] = parts;
  
  try {
    return {
      minute:     parseField(minField,     FIELD_RANGES.minute.min,     FIELD_RANGES.minute.max),
      hour:       parseField(hourField,    FIELD_RANGES.hour.min,      FIELD_RANGES.hour.max),
      dayOfMonth: parseField(dayField,     FIELD_RANGES.dayOfMonth.min, FIELD_RANGES.dayOfMonth.max),
      month:      parseField(monthField,   FIELD_RANGES.month.min,     FIELD_RANGES.month.max),
      dayOfWeek:  parseField(weekdayField, FIELD_RANGES.dayOfWeek.min, FIELD_RANGES.dayOfWeek.max)
    };
  } catch {
    return null;
  }
}

/**
 * cron 표현식에 대해 지정된 시각 이후의 다음 실행 시각을 계산
 * @param {string} cronExpr - cron 표현식 (분 시 일 월 요일)
 * @param {Date} [fromDate] - 기준 시각 (기본: 현재)
 * @returns {Date|null} 다음 실행 시각
 */
function getNextTime(cronExpr, fromDate) {
  const fields = parseCron(cronExpr);
  if (!fields) {
    console.warn(`[CronParser] 유효하지 않은 cron 표현식: ${cronExpr}`);
    return null;
  }
  
  const start = fromDate ? new Date(fromDate) : new Date();
  // 1년 후까지만 검색 (무한 루프 방지)
  const maxDate = new Date(start);
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  
  // 검색 시작 시각을 현재 분의 시작으로 설정
  const next = new Date(start);
  next.setSeconds(0);
  next.setMilliseconds(0);
  
  // 다음 실행 시각 탐색
  while (next <= maxDate) {
    if (fields.month.has(next.getMonth() + 1) &&
        fields.dayOfMonth.has(next.getDate()) &&
        fields.dayOfWeek.has(next.getDay()) &&
        fields.hour.has(next.getHours()) &&
        fields.minute.has(next.getMinutes())) {
      // 기준 시각 이후인지 확인
      if (next > start) {
        return next;
      }
    }
    // 1분씩 증가
    next.setMinutes(next.getMinutes() + 1);
  }
  
  return null; // 1년 내에 찾을 수 없음
}

/**
 * cron 표현식 유효성 검사
 * @param {string} cronExpr - cron 표현식
 * @returns {boolean} 유효 여부
 */
function isValidCron(cronExpr) {
  return parseCron(cronExpr) !== null;
}

/**
 * cron 표현식을 human readable 텍스트로 변환
 * @param {string} cronExpr - cron 표현식
 * @returns {string} 설명 텍스트
 */
function describe(cronExpr) {
  const fields = parseCron(cronExpr);
  if (!fields) {
    return '유효하지 않은 cron 표현식';
  }
  
  const parts = cronExpr.trim().split(/\s+/);
  const [minField, hourField, dayField, monthField, weekdayField] = parts;
  
  let desc = '';
  
  if (minField === '*' && hourField === '*' && dayField === '*' && monthField === '*' && weekdayField === '*') {
    return '매분';
  }
  
  if (hourField !== '*' && minField !== '*') {
    const minutes = Array.from(fields.minute).sort().join(', ');
    const hours = Array.from(fields.hour).sort().join(', ');
    desc = `${hours}시 ${minutes}분`;
  } else if (hourField !== '*') {
    const hours = Array.from(fields.hour).sort().join(', ');
    desc = `${hours}시마다`;
  } else if (minField !== '*') {
    const minutes = Array.from(fields.minute).sort().join(', ');
    desc = `매시간 ${minutes}분`;
  } else {
    desc = '매분';
  }
  
  if (dayField !== '*') {
    const days = Array.from(fields.dayOfMonth).sort().join(', ');
    desc += ` (매월 ${days}일)`;
  }
  if (monthField !== '*') {
    const months = Array.from(fields.month).sort().join(', ');
    desc += ` ${months}월`;
  }
  if (weekdayField !== '*') {
    const weekdays = Array.from(fields.dayOfWeek).sort().join(', ');
    const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const names = weekdays.map(d => weekdayNames[d] || d).join(', ');
    desc += ` (${names}요일)`;
  }
  
  return desc || cronExpr;
}

module.exports = {
  getNextTime,
  isValidCron,
  describe,
  parseCron,
  parseField
};