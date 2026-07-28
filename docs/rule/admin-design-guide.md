# WebCrawlServer 관리자 페이지 디자인 가이드라인

> **문서 버전**: 1.0.0  
> **마지막 업데이트**: 2026-07-26  
> **작성자**: Mistral Vibe

---

## 1. 디자인 철학

### 1.1 기본 원칙

| 원칙 | 설명 | 적용 예시 |
|------|------|-----------|
| ** 단순함 ** | 복잡한 UI는 피하고, 직관적인 인터페이스 제공 | 최대 3단계까지의 메뉴 Depth |
| ** 가벼움 ** | 브라우저 성능에 최소한의 부하 | 외부 라이브러리 최소화, CSS/JS 파일 분리 |
| ** 가독성 ** | 정보가 명확하고 쉽게 읽기 | 그레이 스케일 색상 팔레트, 적절한 콘트라스트 |
| ** 일관성 ** | 전체 페이지에서 통일된 디자인 언어 | 동일한 색상, 간격, 구성 요소 사용 |
| ** 접근성 ** | 모든 사용자가 사용할 수 있도록 | 키보드 네비게이션, ARIA 속성, sufficient color contrast |

### 1.2 디자인 시스템

#### 색상 시스템 (그레이 스케일 기반)

```text
--color-white:      #ffffff    (배경, 카드)
--color-gray-50:    #f8f9fa    (연한 배경)
--color-gray-100:   #f1f3f4    (테두리, 구분선)
--color-gray-200:   #e9ecef    (테두리, 배경)
--color-gray-300:   #dee2e6    (문자, 테두리)
--color-gray-400:   #ced4da    (비활성 상태)
--color-gray-500:   #adb5bd    (보조 문자)
--color-gray-600:   #8898aa    (아이콘, 서브 텍스트)
--color-gray-700:   #495057    (주요 텍스트)
--color-gray-800:   #343a40    (제목, 강조)
--color-gray-900:   #212529    (가장 진한 텍스트)

강조 색상 (최소 사용):
--color-success:     #28a745    (성공 상태)
--color-warning:     #ffc107    (경고 상태)
--color-error:       #dc3545    (에러 상태)
```

**사용 가이드:**
- 주요 텍스트: `--color-gray-800` 또는 `--color-gray-900`
- 보조 텍스트: `--color-gray-600` 또는 `--color-gray-500`
- 배경: `--color-white` 또는 `--color-gray-50`
- 테두리: `--color-gray-200` 또는 `--color-gray-300`
- 강조 색상은 **상태 표시에만** 사용할 것

#### 공간 시스템 (Spacing)

```css
--spacing-xs:  0.25rem  (4px)   - 작은 간격
--spacing-sm:  0.5rem   (8px)   - 버튼 패딩, 작은 여백
--spacing-md:  1rem     (16px)  - 기본 간격
--spacing-lg:  1.5rem   (24px)  - 섹션 패딩
--spacing-xl:  2rem     (32px)  - 큰 간격
--spacing-2xl: 3rem     (48px)  - 매우 큰 간격
```

**사용 가이드:**
- 버튼 내부 여백: `var(--spacing-sm) var(--spacing-lg)`
- 카드 내부 여백: `var(--spacing-lg)`
- 섹션 간 간격: `var(--spacing-xl)`
- 텍스트 간 간격: `var(--spacing-sm)` 또는 `var(--spacing-md)`

#### 글꼴 시스템 (Typography)

```css
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif

--font-size-sm:    0.875rem  (14px)   - 작은 텍스트, 힌트
--font-size-base:  1rem      (16px)   - 기본 텍스트
--font-size-lg:    1.125rem  (18px)   - 서브타이틀
--font-size-xl:    1.25rem   (20px)   - 타이틀
--font-size-2xl:   1.5rem    (24px)   - 큰 타이틀
--font-size-3xl:   2rem      (32px)   - 페이지 제목
```

#### 둥글기 (Border Radius)

```css
--radius-sm: 0.25rem  (4px)   - 작은 둥글기
--radius-md: 0.5rem   (8px)   - 버튼, 입력 필드
--radius-lg: 0.75rem  (12px)  - 카드, 섹션
--radius-xl: 1rem     (16px)  - 큰 카드
```

#### 그림자 (Shadow)

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05)    - 작은 그림자
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1)      - 중간 그림자 (hover 효과)
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1)    - 큰 그림자 (모달)
```

---

## 2. 폴더 구조

```text
public/
├── index.html              # 메인 페이지
├── css/
│   └── styles.css         # 공통 스타일 (그레이 스케일 기반)
├── js/
│   └── main.js            # 공통 JavaScript
└── admin/
    ├── index.html          # 관리자 대시보드
    ├── modules/            # 모듈 관리 페이지 (미래)
    ├── workflows/          # 워크플로우 관리 페이지 (미래)
    ├── scheduler/          # 스케줄러 관리 페이지 (미래)
    ├── logs/               # 로그 보기 페이지 (미래)
    ├── settings/           # 설정 페이지 (미래)
    ├── css/
    │   └── admin.css      # 관리자 전용 스타일
    └── js/
        └── admin.js        # 관리자 전용 JavaScript
```

---

## 3. 페이지 구조

### 3.1 메인 페이지

**파일**: `/public/index.html`  
**목적**: 사용자에게 WebCrawlServer에 대한 개요 제공

**구조:**
```html
<header class="header">...</header>
<section class="nav-section">
  <div class="nav-grid">
    <div class="card">...</div>
  </div>
</section>
<section class="section">...</section>
<footer class="footer">...</footer>
```

### 3.2 관리자 대시보드

**파일**: `/public/admin/index.html`  
**목적**: 시스템 상태 모니터링 및 빠른 액세스 제공

**구조:**
```html
<header class="admin-header">
  <nav class="admin-nav">...</nav>
</header>
<main class="admin-main">
  <section class="admin-stats-grid">...</section>
  <section class="admin-section">...</section>
</main>
<footer class="admin-footer">...</footer>
```

---

## 4. 컴포넌트 가이드

### 4.1 버튼

**클래스**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-warning`, `.btn-danger`  
**사이즈**: `.btn-sm`, `.btn-lg`

```html
<button class="btn btn-primary">저장</button>
<button class="btn btn-secondary">취소</button>
```

### 4.2 카드

**클래스**: `.card`, `.admin-card`, `.stat-card`

```html
<div class="card">
  <div class="card-header"><h2>제목</h2></div>
  <div class="card-content"><p>내용</p></div>
</div>
```

### 4.3 테이블

**클래스**: `.table-container`, `.table`

```html
<div class="table-container">
  <table class="table">
    <thead><tr><th>헤더</th></tr></thead>
    <tbody><tr><td>데이터</td></tr></tbody>
  </table>
</div>
```

### 4.4 폼

**클래스**: `.admin-form`, `.form-group`, `.form-control`, `.form-hint`

```html
<form class="admin-form">
  <div class="form-group">
    <label for="name">이름</label>
    <input type="text" id="name" class="form-control">
    <span class="form-hint">힌트</span>
  </div>
</form>
```

### 4.5 배지

**클래스**: `.badge`, `.badge-success`, `.badge-warning`, `.badge-error`, `.badge-info`

```html
<span class="badge badge-success">성공</span>
<span class="badge badge-error">실패</span>
```

### 4.6 모달

**클래스**: `.admin-modal`, `.admin-modal-content`, `.admin-modal-header`, `.admin-modal-body`, `.admin-modal-footer`

```html
<div class="admin-modal hidden" role="dialog" aria-hidden="true">
  <div class="admin-modal-content">
    <div class="admin-modal-header"><h2>제목</h2></div>
    <div class="admin-modal-body">내용</div>
    <div class="admin-modal-footer">
      <button class="btn btn-secondary">취소</button>
      <button class="btn btn-primary">확인</button>
    </div>
  </div>
</div>
```

---

## 5. JavaScript 구조

### 5.1 공통 기능 (`/public/js/main.js`)

- DOM Ready 유틸리티
- AJAX 유틸리티 (`fetchJSON`, `fetchText`)
- 날짜 포맷팅 (`formatDate`, `formatRelativeTime`)
- 클립보드 복사 (`copyToClipboard`)
- URL 파라미터 관리
- 스토리지 유틸리티
- WebSocket 연결 (`connectWebSocket`)

### 5.2 관리자 전용 (`/public/admin/js/admin.js`)

- 대시보드 초기화
- 통계/상태 로드 및 업데이트
- API 클라이언트 (ModuleManager, WorkflowManager, SchedulerManager, LogManager, SettingsManager)
- 페이지네이션, 검색 유틸리티
- WebSocket 실시간 업데이트

---

## 6. 반응형 디자인

### 6.1 Breakpoints

```css
@media (max-width: 1400px) { /* 대형 데스크톱 */ }
@media (max-width: 1200px) { /* 데스크톱 */ }
@media (max-width: 992px) { /* 태블릿 가로 */ }
@media (max-width: 768px) { /* 태블릿 세로 */ }
@media (max-width: 480px) { /* 모바일 */ }
```

### 6.2 그리드 시스템

```css
/* 데스크톱 */
.grid { grid-template-columns: repeat(4, 1fr); }
/* 태블릿 */
@media (max-width: 992px) { .grid { grid-template-columns: repeat(2, 1fr); } }
/* 모바일 */
@media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }
```

---

## 7. 성능 최적화

- **외부 라이브러리 사용 금지** (jQuery, Bootstrap 등)
- **Vanilla JavaScript/CSS만 사용**
- **CSS 변수 사용**으로 일관성 유지
- **이벤트 위임**으로 DOM 조작 최소화
- **SVG 아이콘** 사용 (데이터 URI 내장 가능)

---

## 8. 접근성

- **키보드 네비게이션** 지원 (Tab 순서, `tabindex`)
- **ARIA 속성** 사용 (`role`, `aria-label`, `aria-hidden`)
- **색상 콘트라스트** WCAG AA 표준 준수 (4.5:1 이상)
- **의미론적인 HTML** 사용

---

## 9. 페이지 생성 체크리스트

- [ ] HTML5 표준 준수 (DOCTYPE, lang, viewport)
- [ ] CSS 변수 및 시스템 사용
- [ ] JavaScript 오류 처리 포함
- [ ] 모바일 반영형 디자인 적용
- [ ] 접근성 확인 (키보드, 스크린리더)

---

## 10. 유지보수 가이드

### CSS
- 새로운 클래스는 재사용 가능하게 설계
- 중복 코드 최소화
- 주석으로 섹션 구분

### JavaScript
- 함수/변수: camelCase (`loadStatistics`, `currentPage`)
- 상수: UPPER_CASE (`MAX_ITEMS`)
- 비동기 처리 시 오류 처리 포함

### HTML
- 클래스: kebab-case (`admin-header`, `stat-card`)
- ID: camelCase (`totalModules`, `serverStatus`)
- data 속성: kebab-case (`data-module-id`)

---

## 11. 참고 문서

- [AGENTS.md](../../AGENTS.md)
- [README.md](../../README.md)
- [architecture.md](./architecture.md)
- [structure.md](./structure.md)
- [mcp.md](./mcp.md)

---

## 버전 역사

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0.0 | 2026-07-26 | 초기 버전 생성 |
