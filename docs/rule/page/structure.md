# 페이지 구조 가이드라인 (docs/rule/page/structure.md)

> **문서 버전**: 1.0.0  
> **마지막 업데이트**: 2026-07-26  
> **작성자**: Mistral Vibe  
> **지침 유형**: 구조 디자인 가이드라인

---

## 1. 개요

본 문서는 WebCrawlServer 관리자 페이지의 **일관된 구조**를 유지하기 위한 가이드라인입니다.
모든 관리자 페이지는 **동일한 헤더**, **네비게이션 시스템**, **브레드크럼**을 사용해야 합니다.

---

## 2. 기본 원칙

### 2.1 구조 일관성
- **모든 페이지**는 동일한 상단 헤더 구조를 가져야 합니다.
- **네비게이션 메뉴**는 모든 페이지에서 동일해야 합니다.
- **브레드크럼**은 현재 위치를 명확히 표시해야 합니다.

### 2.2 분리 가능한 컴포넌트
- 헤더 (`<header>`)는 **독립적인 컴포넌트**로 관리해야 합니다.
- 본문 (`<main>`)은 **페이지별로 다를 수 있지만**, 헤더와 분리되어야 합니다.
- 푸터 (`<footer>`)는 **공통으로 사용**됩니다.

### 2.3 접근성 준수
- 모든 메뉴 항목은 **키보드로 접근** 가능해야 합니다.
- 현재 위치를 **시각적으로 강조**해야 합니다.
- **ARIA 속성**을 적절히 사용해야 합니다.

---

## 3. 페이지 구조 템플릿

### 3.1 기본 HTML 구조

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>페이지 제목 - WebCrawlServer</title>
    
    <!-- 공통 CSS -->
    <link rel="stylesheet" href="../css/styles.css">
    <!-- 관리자 전용 CSS -->
    <link rel="stylesheet" href="../css/admin.css">
</head>
<body>
    <!-- 헤더 (모든 페이지 동일) -->
    <header class="admin-header">
        <!-- 로고 -->
        <div class="admin-logo">...</div>
        
        <!-- 모바일 메뉴 토글 -->
        <button class="mobile-menu-toggle" onclick="toggleMobileMenu()">☰</button>
        
        <!-- 네비게이션 -->
        <nav class="admin-nav" id="main-nav">
            <ul class="admin-nav-list">
                <!-- 드롭다운 메뉴 구조 -->
                <li class="nav-item">
                    <a href="/admin">대시보드</a>
                </li>
                <li class="nav-item">
                    <a href="#">서버</a>
                    <div class="dropdown-menu">
                        <a href="/admin/process">프로세스 목록</a>
                        <a href="/admin/process/detail">프로세스 세부정보</a>
                    </div>
                </li>
                <!-- ... 기타 메뉴 ... -->
            </ul>
        </nav>
        
        <!-- 헤더 액션 -->
        <div class="admin-header-actions">
            <button class="btn btn-secondary btn-sm">액션</button>
        </div>
    </header>

    <!-- 브레드크럼 (현재 위치 표시) -->
    <nav class="breadcrumb" id="breadcrumb">
        <div class="breadcrumb-item"><a href="/admin">관리자</a></div>
        <div class="breadcrumb-item"><a href="/admin/process">서버 프로세스</a></div>
        <div class="breadcrumb-item active">프로세스 목록</div>
    </nav>

    <!-- 본문 (페이지별로 다름) -->
    <main class="admin-main">
        <div class="admin-container">
            <!-- 페이지 헤더 -->
            <div class="admin-page-header">
                <h1>페이지 제목</h1>
                <p class="admin-page-subtitle">부제목</p>
            </div>
            
            <!-- 알림 컨테이너 -->
            <div id="alert-container"></div>
            
            <!-- 페이지 콘텐츠 -->
            <section class="admin-section">...</section>
        </div>
    </main>

    <!-- 푸터 (모든 페이지 동일) -->
    <footer class="admin-footer">
        <p>&copy; 2026 WebCrawlServer. 모든 권리 보호.</p>
    </footer>

    <!-- JavaScript -->
    <script src="../js/main.js"></script>
    <script src="js/admin.js"></script>
</body>
</html>
```

---

## 4. 헤더 구조 상세

### 4.1 헤더 컴포넌트 (`<header>`)

**必素 요소:**
- 로고 (`admin-logo`): 사이트 이름과 Admin 표기
- 모바일 메뉴 토글 버튼 (`mobile-menu-toggle`): 768px 이하에서 표시
- 네비게이션 (`admin-nav`): 드롭다운 메뉴 포함
- 헤더 액션 (`admin-header-actions`): 메인 페이지, 도움말, 로그아웃 등

**헤더 HTML 구조:**
```html
<header class="admin-header">
    <div class="admin-header-content">
        <!-- 로고 -->
        <div class="admin-logo">
            <a href="/admin">
                <strong>WebCrawlServer</strong>
                <span>Admin</span>
            </a>
        </div>
        
        <!-- 모바일 메뉴 토글 -->
        <button class="mobile-menu-toggle" onclick="toggleMobileMenu()" aria-label="메뉴 열기">☰</button>
        
        <!-- 네비게이션 -->
        <nav class="admin-nav" id="main-nav">
            <ul class="admin-nav-list">
                <!-- 메뉴 항목들 -->
            </ul>
        </nav>
        
        <!-- 액션 버튼 -->
        <div class="admin-header-actions">
            <a href="/" class="btn btn-secondary btn-sm">메인 페이지</a>
            <button class="btn btn-secondary btn-sm">도움말</button>
        </div>
    </div>
</header>
```

### 4.2 네비게이션 메뉴 구조

**메뉴 타입:**
1. **단일 메뉴**: 클릭 시 직접 페이지로 이동
2. **드롭다운 메뉴**: 마우스 오버 시 하위 메뉴 표시

**드롭다운 메뉴 구조:**
```html
<!-- 단일 메뉴 -->
<li class="nav-item">
    <a href="/admin">대시보드</a>
</li>

<!-- 드롭다운 메뉴 -->
<li class="nav-item">
    <a href="#">서버</a>
    <div class="dropdown-menu">
        <div class="dropdown-header">서버 관리</div>
        <a href="/admin/process">프로세스 목록</a>
        <a href="/admin/process/detail">프로세스 세부정보</a>
        <div class="dropdown-divider"></div>
        <div class="dropdown-header">로그</div>
        <a href="/admin/process/logs">로그 기록 목록</a>
    </div>
</li>
```

### 4.3 메뉴 분류

| 메뉴 그룹 | 하위 메뉴 | 경로 | 설명 |
|-----------|----------|------|------|
| 대시보드 | - | `/admin` | 메인 대시보드 |
| 서버 | 프로세스 목록 | `/admin/process` | 서버 프로세스 모니터링 |
| 서버 | 프로세스 세부정보 | `/admin/process/detail` | 프로세스 상세 정보 |
| 서버 | 로그 기록 목록 | `/admin/process/logs` | 로그 파일 관리 |
| 데이터베이스 | DB 관리 | `/admin/database` | DB 상세 정보 |
| 데이터베이스 | DB 백업 | - | 백업 기능 (준비 중) |
| 데이터베이스 | DB 복원 | - | 복원 기능 (준비 중) |
| 모듈 | 모듈 목록 | `/admin/modules` | 모듈 관리 |
| 모듈 | 모듈 추가 | `/admin/modules/create` | 새 모듈 추가 |
| 워크플로우 | 워크플로우 목록 | `/admin/workflows` | 워크플로우 관리 |
| 워크플로우 | 워크플로우 생성 | `/admin/workflows/create` | 새 워크플로우 생성 |
| 스케줄러 | 예약 작업 목록 | `/admin/scheduler` | 스케줄러 관리 |
| 스케줄러 | 작업 예약 | `/admin/scheduler/create` | 새 작업 예약 |
| 로그 | 로그 보기 | `/admin/logs` | 로그 뷰어 |
| 로그 | 액티비티 로그 | `/admin/logs?type=activity` | 액티비티 로그 필터 |
| 로그 | 에러 로그 | `/admin/logs?type=error` | 에러 로그 필터 |
| 설정 | - | `/admin/settings` | 시스템 설정 |

---

## 5. 브레드크럼 (현재 위치 표시)

### 5.1 브레드크럼 구조

브레드크럼은 **현재 페이지의 계층 구조**를 표시합니다.

**기본 규칙:**
- 항상 **관리자**로부터 시작
- 현재 페이지는 **active** 클래스 적용
- 각 항목은 **/`**로 구분

**예시:**
```html
<!-- 대시보드 -->
<nav class="breadcrumb">
    <div class="breadcrumb-item"><a href="/admin">관리자</a></div>
    <div class="breadcrumb-item active">대시보드</div>
</nav>

<!-- 서버 프로세스 목록 -->
<nav class="breadcrumb">
    <div class="breadcrumb-item"><a href="/admin">관리자</a></div>
    <div class="breadcrumb-item active">서버 프로세스</div>
</nav>

<!-- 서버 프로세스 세부 정보 -->
<nav class="breadcrumb">
    <div class="breadcrumb-item"><a href="/admin">관리자</a></div>
    <div class="breadcrumb-item"><a href="/admin/process">서버 프로세스</a></div>
    <div class="breadcrumb-item active">세부 정보</div>
</nav>

<!-- 로그 기록 목록 -->
<nav class="breadcrumb">
    <div class="breadcrumb-item"><a href="/admin">관리자</a></div>
    <div class="breadcrumb-item"><a href="/admin/process">서버 프로세스</a></div>
    <div class="breadcrumb-item active">로그 기록</div>
</nav>
```

### 5.2 브레드크럼 이름 매핑

| 경로 부분 | 표시 이름 |
|-----------|-----------|
| admin | 관리자 |
| process | 서버 프로세스 |
| detail | 세부 정보 |
| logs | 로그 기록 |
| database | 데이터베이스 |
| modules | 모듈 |
| workflows | 워크플로우 |
| scheduler | 스케줄러 |
| settings | 설정 |

---

## 6. JavaScript 네비게이션 초기화

### 6.1 초기화 함수

```javascript
// 네비게이션 초기화 (main.js에 포함)
function initializeNavigation() {
    var currentPath = window.location.pathname;
    
    // 모든 네비게이션 링크 가져오기
    var navLinks = document.querySelectorAll('.nav-item > a, .dropdown-menu a');
    
    // 현재 페이지와 일치하는 메뉴 찾기
    navLinks.forEach(function(link) {
        var linkPath = link.getAttribute('href');
        if (linkPath && linkPath !== '#' && !linkPath.startsWith('javascript:')) {
            var linkPathWithoutQuery = linkPath.split('?')[0];
            var currentPathWithoutQuery = currentPath.split('?')[0];
            
            if (currentPathWithoutQuery.endsWith(linkPathWithoutQuery)) {
                link.classList.add('active');
                
                // 부모 네비게이션 아이템도 열기
                var parentItem = link.closest('.nav-item');
                if (parentItem) {
                    parentItem.classList.add('open');
                    var parentLink = parentItem.querySelector('> a');
                    if (parentLink) {
                        parentLink.classList.add('active');
                    }
                }
            }
        }
    });
    
    // 브레드크럼 업데이트
    updateBreadcrumb();
}

// 브레드크럼 업데이트
function updateBreadcrumb() {
    var breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;
    
    var pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0 || pathParts[0] !== 'admin') return;
    
    var menuNames = {
        'admin': '관리자',
        'process': '서버 프로세스',
        'detail': '세부 정보',
        'logs': '로그 기록',
        'database': '데이터베이스',
        'modules': '모듈',
        'workflows': '워크플로우',
        'scheduler': '스케줄러',
        'settings': '설정'
    };
    
    var html = '<div class="breadcrumb-item"><a href="/admin">관리자</a></div>';
    var accumulatedPath = '';
    
    for (var i = 0; i < pathParts.length; i++) {
        var part = pathParts[i];
        if (i > 0) accumulatedPath += '/';
        accumulatedPath += part;
        var displayName = menuNames[part] || part;
        
        if (i < pathParts.length - 1) {
            html += '<div class="breadcrumb-item"><a href="/' + accumulatedPath + '">' + displayName + '</a></div>';
        } else {
            html += '<div class="breadcrumb-item active">' + displayName + '</div>';
        }
    }
    
    breadcrumb.innerHTML = html;
}

// 모바일 메뉴 토글
function toggleMobileMenu() {
    var nav = document.getElementById('main-nav');
    if (nav) {
        nav.classList.toggle('open');
    }
}
```

### 6.2 DOM Ready 초기화

```javascript
domReady(function() {
    updateServerInfo();
    initializeNavigation();  // 네비게이션 초기화
    initSubmenuToggle();
    initTabs();
    initModal();
    globalEventBinding();
});
```

---

## 7. CSS 스타일 가이드

### 7.1 헤더 스타일

```css
/* 헤더 */
.admin-header {
    background-color: var(--color-dark-1);
    color: var(--color-light);
    border-bottom: 1px solid var(--color-dark-3);
    position: sticky;
    top: 0;
    z-index: 100;
}

.admin-header-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 var(--spacing-lg);
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
}

/* 로고 */
.admin-logo a {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: var(--color-white);
    text-decoration: none;
    font-size: var(--font-size-lg);
    font-weight: 600;
}

.admin-logo span {
    color: var(--color-gray-3);
    font-size: var(--font-size-sm);
}
```

### 7.2 네비게이션 스타일

```css
/* 네비게이션 */
.admin-nav {
    flex: 1;
    max-width: 800px;
    margin: 0 var(--spacing-lg);
    position: relative;
}

.admin-nav-list {
    display: flex;
    gap: var(--spacing-xs);
    list-style: none;
    padding: 0;
    margin: 0;
    justify-content: center;
    overflow-x: auto;
}

/* 네비게이션 아이템 */
.nav-item {
    position: relative;
}

.nav-item > a {
    display: block;
    padding: var(--spacing-sm) var(--spacing-md);
    color: var(--color-gray-3);
    text-decoration: none;
    font-size: var(--font-size-sm);
    font-weight: 500;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    white-space: nowrap;
}

.nav-item > a:hover,
.nav-item > a.active {
    background-color: var(--color-dark-3);
    color: var(--color-white);
}

.nav-item.open > a {
    background-color: var(--color-dark-4);
    color: var(--color-white);
}

/* 드롭다운 메뉴 */
.dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    background-color: var(--color-dark-2);
    border: 1px solid var(--color-dark-3);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    min-width: 200px;
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all var(--transition-fast);
}

.nav-item:hover .dropdown-menu,
.nav-item.open .dropdown-menu {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}

.dropdown-menu a {
    display: block;
    padding: var(--spacing-sm) var(--spacing-md);
    color: var(--color-gray-3);
    text-decoration: none;
    font-size: var(--font-size-sm);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    white-space: nowrap;
}

.dropdown-menu a:hover,
.dropdown-menu a.active {
    background-color: var(--color-dark-3);
    color: var(--color-white);
}

.dropdown-divider {
    height: 1px;
    background-color: var(--color-dark-3);
    margin: var(--spacing-xs) 0;
}

.dropdown-header {
    padding: var(--spacing-sm) var(--spacing-md);
    color: var(--color-gray-2);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
}
```

### 7.3 브레드크럼 스타일

```css
/* 브레드크럼 */
.breadcrumb {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: var(--color-dark-1);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--color-gray-3);
    overflow-x: auto;
    margin-bottom: var(--spacing-lg);
}

.breadcrumb-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
}

.breadcrumb-item:not(:last-child)::after {
    content: '/';
    color: var(--color-gray-1);
}

.breadcrumb-item a {
    color: var(--color-gray-3);
    text-decoration: none;
}

.breadcrumb-item a:hover {
    color: var(--color-white);
}

.breadcrumb-item.active {
    color: var(--color-white);
    font-weight: 500;
}
```

---

## 8. 모바일 대응

### 8.1 모바일 메뉴 기능

- **768px 이하**: 헤더 네비게이션이 드롭다운 방식으로 변환
- **모바일 메뉴 토글 버튼**: 햄버거 아이콘(☰) 표시
- **메뉴 열기/닫기**: `toggleMobileMenu()` 함수 호출

### 8.2 모바일 CSS

```css
/* 모바일 메뉴 토글 */
.mobile-menu-toggle {
    display: none;
    background: none;
    border: none;
    color: var(--color-light);
    font-size: var(--font-size-xl);
    cursor: pointer;
    padding: var(--spacing-xs);
    line-height: 1;
}

@media (max-width: 768px) {
    .mobile-menu-toggle {
        display: block;
    }
    
    .admin-nav {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background-color: var(--color-dark-1);
        border-top: 1px solid var(--color-dark-3);
        max-height: 0;
        overflow: hidden;
        transition: max-height var(--transition-normal);
        z-index: 100;
    }
    
    .admin-nav.open {
        max-height: 600px;
    }
    
    .admin-nav-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
        justify-content: flex-start;
    }
    
    .dropdown-menu {
        position: static;
        opacity: 1;
        visibility: visible;
        transform: none;
        box-shadow: none;
        border: none;
        display: none;
        background-color: var(--color-dark-2);
        padding-left: var(--spacing-md);
    }
    
    .nav-item:hover .dropdown-menu,
    .nav-item.open .dropdown-menu {
        display: block;
    }
    
    .dropdown-menu a {
        padding: var(--spacing-xs) var(--spacing-md);
    }
}
```

---

## 9. 페이지 생성 체크리스트

### 9.1 새로운 관리자 페이지 만들기

- [ ] `public/admin/[category]/[page].html` 생성
- [ ] **헤더 포함**: 동일한 헤더 구조 복사
- [ ] **네비게이션 메뉴**: 모든 드롭다운 메뉴 포함
- [ ] **브레드크럼**: 현재 위치 표시
- [ ] **제목**: 적절한 `<title>` 태그 설정
- [ ] ** CSS**: `styles.css`와 `admin.css` 연결
- [ ] **JS**: `main.js`와 `admin.js` 연결
- [ ] **цией**: `domReady()` 호출 포함

### 9.2 헤더 검증

- [ ] 로고가 `/admin`으로 연결되어 있는가?
- [ ] 모바일 메뉴 토글 버튼이 있는가?
- [ ] 모든 드롭다운 메뉴가 포함되어 있는가?
- [ ] `id="main-nav"`가 네비게이션에 설정되어 있는가?
- [ ] `id="breadcrumb"`가 브레드크럼에 설정되어 있는가?

### 9.3 네비게이션 검증

- [ ] 현재 페이지가 활성화(`active` 클래스)되는가?
- [ ] 부모 드롭다운 메뉴가 열려(`open` 클래스) 있는가?
- [ ] `initializeNavigation()`이 호출되는가?
- [ ] `toggleMobileMenu()`가 정의되어 있는가?

---

## 10. 유지보수 가이드

### 10.1 헤더 수정 시

1. **모든 페이지 동기화**: 헤더를 수정하면 **모든 관리자 페이지**를 업데이트해야 합니다.
2. **테스트**: 모든 페이지에서 헤더가 정상적으로 표시되는지 확인하세요.
3. **문서 업데이트**: 헤더 구조가 변경되면 본 문서를 업데이트하세요.

### 10.2 새로운 메뉴 추가 시

1. **모든 페이지에 추가**: 새로운 메뉴는 **모든 관리자 페이지**의 헤더에 추가해야 합니다.
2. **드롭다운 구조 유지**: 메뉴가 많으면 드롭다운으로 그룹화하세요.
3. **브레드크럼 매핑**: `updateBreadcrumb()` 함수에 새로운 메뉴 이름 매핑 추가하세요.

### 10.3 메뉴 삭제 시

1. **모든 페이지에서 삭제**: 사용하지 않는 메뉴는 **모든 페이지**에서 삭제하세요.
2. **라우팅 확인**: `app.js`에서 해당 경로의 라우팅도 삭제하세요.
3. **브레드크럼 매핑 삭제**: `updateBreadcrumb()` 함수에서 삭제된 메뉴 매핑 제거하세요.

---

## 11. 버전 역사

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 1.0.0 | 2026-07-26 | 초기 버전 생성 | Mistral Vibe |

---

## 12. 참고 문서

- [AGENTS.md](../../AGENTS.md) - AI 운영 규칙
- [README.md](../../README.md) - 프로젝트 소개
- [architecture.md](../architecture.md) - 시스템 구조 (R-001)
- [structure.md](../structure.md) - 디렉토리 구조 (R-003)
- [admin-design-guide.md](../admin-design-guide.md) - 관리자 디자인 가이드라인
