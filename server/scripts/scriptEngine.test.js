/**
 * scriptEngine 단위 테스트
 * P3: 단위 테스트 도입
 */

const { extractFromHtml, getExecutionContext } = require('./scriptEngine');

describe('scriptEngine 단위 테스트', () => {
  // extractFromHtml 테스트
  test('extractFromHtml - 텍스트 추출', () => {
    const html = '<div class="title">Hello World</div>';
    const result = extractFromHtml(html, '.title', 'text');
    expect(result).toEqual(['Hello World']);
  });

  test('extractFromHtml - HTML 추출', () => {
    const html = '<div class="content"><span>내용</span></div>';
    const result = extractFromHtml(html, '.content', 'html');
    expect(result).toContain('<span>내용</span>');
  });

  test('extractFromHtml - 속성 추출', () => {
    const html = '<a href="https://example.com">링크</a>';
    const result = extractFromHtml(html, 'a', 'attribute');
    expect(result).toContain('https://example.com');
  });

  test('extractFromHtml - 결과 없음', () => {
    const html = '<div>내용</div>';
    const result = extractFromHtml(html, '.not-found', 'text');
    expect(result).toEqual([]);
  });

  // getExecutionContext 테스트
  test('getExecutionContext - 컨텍스트 생성', () => {
    const context = getExecutionContext('test_script_1');
    expect(context).toBeDefined();
    expect(context.variables).toBeDefined();
    expect(context.status).toBe('waiting');
  });

  test('getExecutionContext - 동일 ID 재호출 시 기존 컨텍스트 반환', () => {
    const context1 = getExecutionContext('test_script_2');
    context1.variables.set('testKey', 'testValue');
    const context2 = getExecutionContext('test_script_2');
    expect(context2.variables.get('testKey')).toBe('testValue');
  });
});