/**
 * WebCrawlServer 브라우저 플러그인 - 콘텐츠 스크립트
 * 
 * 웹 페이지 DOM 조작 및 데이터 수집
 * - 백그라운드 스크립트의 명령을 받아 페이지에서 실행
 * - 요소 선택, 클릭, 입력, 데이터 추출 등
 * - 페이지 정보 수집 및 크롤링
 * 
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-004 (mcp.md): MCP 프로토콜 스텝 타입 준수
 */

// ============================================================
// 메시지 리스너 (백그라운드 스크립트 통신)
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WCS Content] 메시지 수신:', message.type);

  switch (message.type) {
    case 'wcs_waitFor':
      handleWaitFor(message)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'wcs_extract':
      handleExtract(message)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'wcs_click':
      handleClick(message)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'wcs_input':
      handleInput(message)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'wcs_scroll':
      handleScroll(message)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'wcs_collectImages':
      handleCollectImages(message)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'wcs_crawlPage':
      handleCrawlPage()
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'wcs_custom':
      handleCustom(message)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    default:
      sendResponse({ error: `알 수 없는 메시지 타입: ${message.type}` });
  }

  return false;
});

// ============================================================
// 핸들러 구현
// ============================================================

/** 요소 대기 */
async function handleWaitFor(message) {
  const { selector, timeout } = message;
  if (!selector) throw new Error('선택자가 필요합니다.');

  const startTime = Date.now();
  const maxWait = timeout || 10000;

  return new Promise((resolve, reject) => {
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve({
          found: true,
          selector,
          tagName: element.tagName,
          visible: isElementVisible(element),
          text: element.textContent.trim().substring(0, 200)
        });
        return;
      }

      if (Date.now() - startTime > maxWait) {
        resolve({ found: false, selector, timeout: true });
        return;
      }

      setTimeout(check, 200);
    };

    check();
  });
}

/** 데이터 추출 */
async function handleExtract(message) {
  const { selector, attribute, multiple } = message;
  if (!selector) throw new Error('선택자가 필요합니다.');

  if (multiple) {
    const elements = document.querySelectorAll(selector);
    const results = [];

    elements.forEach((el, index) => {
      results.push({
        index,
        tagName: el.tagName,
        text: el.textContent.trim(),
        html: el.innerHTML.substring(0, 500),
        attributes: extractAttributes(el, attribute),
        href: el.href || null,
        src: el.src || null
      });
    });

    return { count: results.length, items: results };
  }

  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`요소를 찾을 수 없음: ${selector}`);
  }

  return {
    tagName: element.tagName,
    text: element.textContent.trim(),
    html: element.innerHTML.substring(0, 1000),
    attributes: extractAttributes(element, attribute),
    href: element.href || null,
    src: element.src || null,
    rect: element.getBoundingClientRect()
  };
}

/** 클릭 */
async function handleClick(message) {
  const { selector } = message;
  if (!selector) throw new Error('선택자가 필요합니다.');

  const element = findElement(selector);
  if (!element) throw new Error(`요소를 찾을 수 없음: ${selector}`);

  // 요소가 보이도록 스크롤
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(300);

  // 클릭 이벤트 발생
  element.click();

  return {
    clicked: true,
    selector,
    tagName: element.tagName,
    text: element.textContent.trim().substring(0, 100)
  };
}

/** 입력 */
async function handleInput(message) {
  const { selector, value } = message;
  if (!selector) throw new Error('선택자가 필요합니다.');
  if (value === undefined || value === null) throw new Error('입력값이 필요합니다.');

  const element = findElement(selector);
  if (!element) throw new Error(`요소를 찾을 수 없음: ${selector}`);

  // 요소가 보이도록 스크롤
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(200);

  // 기존 값 지우기
  element.focus();
  element.value = '';
  
  // input 이벤트 발생
  element.dispatchEvent(new Event('focus', { bubbles: true }));
  element.dispatchEvent(new Event('input', { bubbles: true }));

  // 값 설정
  element.value = value;

  // change 이벤트 발생
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));

  return {
    input: true,
    selector,
    value,
    tagName: element.tagName
  };
}

/** 스크롤 */
async function handleScroll(message) {
  const { direction, amount } = message;
  const scrollAmount = amount || 300;

  switch (direction) {
    case 'up':
      window.scrollBy(0, -scrollAmount);
      break;
    case 'down':
      window.scrollBy(0, scrollAmount);
      break;
    case 'left':
      window.scrollBy(-scrollAmount, 0);
      break;
    case 'right':
      window.scrollBy(scrollAmount, 0);
      break;
    case 'top':
      window.scrollTo(0, 0);
      break;
    case 'bottom':
      window.scrollTo(0, document.body.scrollHeight);
      break;
    default:
      window.scrollBy(0, scrollAmount);
  }

  return {
    scrolled: true,
    direction: direction || 'down',
    amount: scrollAmount,
    scrollX: window.scrollX,
    scrollY: window.scrollY
  };
}

/** 이미지 수집 */
async function handleCollectImages(message) {
  const { selector } = message;
  const imageSelector = selector || 'img';
  const images = document.querySelectorAll(imageSelector);
  const results = [];

  images.forEach((img, index) => {
    const src = img.src || img.getAttribute('data-src') || '';
    if (src && !src.startsWith('data:')) {
      results.push({
        index,
        src,
        alt: img.alt || '',
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        title: img.title || ''
      });
    }
  });

  return {
    count: results.length,
    images: results
  };
}

/** 전체 페이지 크롤링 */
async function handleCrawlPage() {
  const pageInfo = {
    url: window.location.href,
    title: document.title,
    meta: extractMetaTags(),
    links: extractLinks(),
    headings: extractHeadings(),
    text: document.body.innerText.substring(0, 50000),
    html: document.documentElement.outerHTML.substring(0, 100000),
    images: extractAllImages(),
    scripts: extractScripts(),
    styles: extractStyles(),
    timestamp: new Date().toISOString()
  };

  return pageInfo;
}

/** 커스텀 액션 */
async function handleCustom(message) {
  const { action, params } = message;

  switch (action) {
    case 'getSelection':
      return { text: window.getSelection().toString() };

    case 'getLocalStorage':
      return { items: { ...localStorage } };

    case 'getCookies':
      return { cookies: document.cookie };

    case 'getFormData':
      return extractFormData(params && params.formSelector);

    case 'executeScript':
      if (params && params.code) {
        const result = eval(params.code);
        return { result };
      }
      throw new Error('executeScript: code 파라미터가 필요합니다.');

    case 'highlight':
      if (params && params.selector) {
        const elements = document.querySelectorAll(params.selector);
        elements.forEach(el => {
          el.style.outline = '2px solid red';
          el.style.outlineOffset = '2px';
        });
        return { highlighted: elements.length };
      }
      throw new Error('highlight: selector 파라미터가 필요합니다.');

    case 'getNetworkInfo':
      return {
        url: window.location.href,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookiesEnabled: navigator.cookieEnabled,
        screenWidth: screen.width,
        screenHeight: screen.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };

    default:
      throw new Error(`알 수 없는 커스텀 액션: ${action}`);
  }
}

// ============================================================
// 유틸리티 함수
// ============================================================

/** 요소 찾기 (선택자 또는 XPath) */
function findElement(selector) {
  // CSS 선택자로 시도
  let element = document.querySelector(selector);
  if (element) return element;

  // XPath로 시도
  try {
    const result = document.evaluate(
      selector,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    if (result.singleNodeValue) return result.singleNodeValue;
  } catch (e) {
    // XPath 실패 무시
  }

  return null;
}

/** 요소 가시성 확인 */
function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

/** 속성 추출 */
function extractAttributes(element, specificAttribute) {
  if (specificAttribute) {
    return { [specificAttribute]: element.getAttribute(specificAttribute) };
  }

  const attrs = {};
  for (const attr of element.attributes) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

/** 메타 태그 추출 */
function extractMetaTags() {
  const metas = document.querySelectorAll('meta');
  const result = {};

  metas.forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
    const content = meta.getAttribute('content') || '';
    if (name && content) {
      result[name] = content;
    }
  });

  return result;
}

/** 링크 추출 */
function extractLinks() {
  const links = document.querySelectorAll('a[href]');
  const result = [];

  links.forEach(link => {
    const href = link.href;
    if (href && !href.startsWith('javascript:')) {
      result.push({
        href,
        text: link.textContent.trim().substring(0, 100),
        rel: link.rel || ''
      });
    }
  });

  return result.slice(0, 500); // 최대 500개
}

/** 제목 추출 */
function extractHeadings() {
  const result = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };

  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
    document.querySelectorAll(tag).forEach(el => {
      result[tag].push(el.textContent.trim());
    });
  });

  return result;
}

/** 모든 이미지 추출 */
function extractAllImages() {
  const images = document.querySelectorAll('img');
  const result = [];

  images.forEach(img => {
    const src = img.src || img.getAttribute('data-src') || '';
    if (src && !src.startsWith('data:')) {
      result.push({
        src,
        alt: img.alt || '',
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      });
    }
  });

  return result.slice(0, 200); // 최대 200개
}

/** 스크립트 태그 추출 */
function extractScripts() {
  const scripts = document.querySelectorAll('script');
  const result = [];

  scripts.forEach(script => {
    if (script.src) {
      result.push({ type: 'external', src: script.src });
    }
  });

  return result;
}

/** 스타일 정보 추출 */
function extractStyles() {
  const result = {
    stylesheets: [],
    inlineStyles: []
  };

  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    result.stylesheets.push(link.href);
  });

  return result;
}

/** 폼 데이터 추출 */
function extractFormData(formSelector) {
  const form = formSelector ? document.querySelector(formSelector) : document.querySelector('form');
  if (!form) throw new Error('폼을 찾을 수 없습니다.');

  const formData = new FormData(form);
  const data = {};

  formData.forEach((value, key) => {
    data[key] = value;
  });

  return data;
}

/** 지연 함수 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('[WCS Content] WebCrawlServer 콘텐츠 스크립트 로드 완료');