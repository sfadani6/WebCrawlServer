/**
 * Header Loader - 공통 헤더 동적 로드 유틸리티
 * 모든 관리자 페이지에서 사용됩니다.
 */

// 헤더 로드 함수
function loadHeader(callback) {
    var headerContainer = document.getElementById('header-container');
    
    if (!headerContainer) {
        // 헤더 컨테이너가 없는 경우, 기존 구조를 유지
        if (callback) callback();
        return;
    }
    
    // 헤더 HTML을 비동기적으로 로드
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/admin/includes/header.html', true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                // 헤더 HTML 삽입
                var response = xhr.responseText;
                
                // <head> 내의 스타일과 메타 태그만 추출
                var headContent = extractHeadContent(response);
                
                // <body> 내의 콘텐츠 추출 (헤더 + 브레드크럼)
                var bodyContent = extractBodyContent(response);
                
                // 기존 <head>에 스타일 추가
                insertStyles(headContent);
                
                // 헤더 컨테이너에 헤더 + 브레드크럼 삽입
                headerContainer.innerHTML = bodyContent;
                
                // 콜백 호출
                if (callback) callback();
            } else {
                console.error('헤더 로드 실패: HTTP ' + xhr.status);
                if (callback) callback();
            }
        }
    };
    xhr.send();
}

// <head> 콘텐츠 추출
function extractHeadContent(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var head = doc.querySelector('head');
    return head ? head.innerHTML : '';
}

// <body> 콘텐츠 추출 (헤더 + 브레드크럼)
function extractBodyContent(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var body = doc.querySelector('body');
    return body ? body.innerHTML : '';
}

// 스타일 삽입
function insertStyles(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var styles = doc.querySelectorAll('style');
    
    styles.forEach(function(style) {
        var newStyle = document.createElement('style');
        newStyle.textContent = style.textContent;
        document.head.appendChild(newStyle);
    });
}

// 페이지 초기화
function initPageWithHeader() {
    loadHeader(function() {
        // 헤더 로드 후 초기화 작업 수행
        if (typeof initializeNavigation === 'function') {
            initializeNavigation();
        }
    });
}

// DOM Ready 시 자동 초기화
domReady(function() {
    // header-container가 있는 경우에만 로드
    if (document.getElementById('header-container')) {
        initPageWithHeader();
    }
});
