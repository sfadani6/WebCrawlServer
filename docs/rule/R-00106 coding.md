# R-00106 docs/rule/R-00106 coding.md

본 문서는 `WebCrawlServer` 프로젝트의 코드 작성 규칙, 소스 파일 헤더 표기 규정 및 코드 문서화(JSDoc/주석) 표준 지침입니다.

---

## 1. 기본 코드 표준

1.1 **TypeScript 사용**: 모든 코드는 JavaScript 대신 TypeScript 사용을 원칙으로 합니다.  
1.2 **ESM 규격 준수**: 모듈 시스템은 ESM(`import` / `export`)을 사용하며, CommonJS(`require`, `module.exports`) 사용은 금지합니다.  
1.3 **타입 엄격성**: 타입을 명시적으로 정의하며, `any` 타입 사용을 금지합니다. (외부 라이브러리 반환값 등 불가피한 경우 `unknown`과 타입 어서션을 활용)  
1.4 **비동기 처리**: Promise 연산 및 비동기 함수는 `async/await` 패턴으로 작성합니다.  

---

## 2. 소스 파일 헤더 표기 규정 (필수)

모든 소스 코드(.ts, .tsx, .js, .css 등) 및 문서 출력물의 최상단 첫 번째 라인에는 **상대 파일 경로와 파일 이름**을 주석 형태로 반드시 표기해야 합니다.

```typescript
// plugins/basic-plugin/src/popup.tsx
```

---

## 3. 기능 및 식별자 상세 주석 표준

코드 가독성과 유지보수성을 제고하기 위해 주요 기능, 함수, 클래스, 메서드, 변수 및 상상에 대해 상세한 한글 주석을 반드시 작성해야 합니다.

### 3.1 함수 및 클래스 주석 표준 (JSDoc)
모든 함수, 메서드, 클래스 상단에는 수행 기능, 매개변수(`@param`), 반환값(`@returns`) 및 예외 사항을 설명하는 JSDoc 형태의 한글 주석을 작성합니다.

```typescript
/**
 * 지정된 타깃 클라이언트에 원격 수집 지시 제어 명령 패킷을 웹소켓으로 송출합니다.
 *
 * @param socket - 활성화된 웹소켓 인스턴스 참조
 * @param targetId - 수신 타깃 기기 ID (ALL 입력 시 전체 브로드캐스트)
 * @param action - 지시 액션 식별자 (예: 'CRAWL_START', 'CRAWL_STOP')
 * @param payload - 바디 페이로드 객체
 * @returns 메시지 송출 성공 여부 (true / false)
 */
export function sendSocketMessage(
  socket: WebSocket | null,
  targetId: string,
  action: string,
  payload: unknown
): boolean {
  // ... 구현 코드
}
```

### 3.2 변수 및 상수 주석 표준
모든 전역 상수, 빌드 주입 환경변수, 주요 상태 변수 선언부에는 변수의 역할, 단위, 기본값 및 지정 가능한 값의 범위를 상세 주석으로 명시합니다.

```typescript
/** 팝업 창의 초기 기본 가로 너비 (단위: px, 기본값: 360, 범위: 320~600) */
export const POPUP_WIDTH: number = 360;

/** 백엔드 통합 웹소켓 및 REST API 서비스 포트 번호 (기본값: 9600) */
export const SERVER_PORT: number = 9600;
```

---

## 4. 예외 처리 및 로그 가드

4.1 **상세 에러 기록**: 예외 발생 시 단순 무시(`catch {}`)를 금지하며, 발생 원인과 메시지를 로그로 남겨야 합니다.  
4.2 **방어적 프로그래밍**: 외부 입력값 및 API 응답 데이터에 대한 검증 구문을 작성하여 앱 크래리를 방지합니다.

---

## 5. CSS 및 Tailwind 규칙

### 5.1 Tailwind CSS 클래스 사용 가이드

#### 5.1.1 텍스트 선택 관련 클래스
- **`select-none`**: 엄격히 제한되어 사용됩니다. **텍스트가 포함된 요소에는 절대 사용하지 않습니다.**
  - R-00302 3.4절의 접근성 가이드라인을 준수해야 합니다.
  - 사용 시에는 반드시 주석으로 사용 이유를 명시해야 합니다.
- **`select-auto`**: 기본 텍스트 선택 동작을 명시적으로 복원해야 하는 경우에만 사용합니다.
- **`select-text`**: 유효하지 않은 Tailwind 클래스이므로 **절대 사용하지 않습니다**. (2026-08-03 이전에 사용된 적이 있지만, 이는 Tailwind CSS에 존재하지 않는 클래스입니다)

#### 5.1.2 클래스 유효성 검증
- 사용하기 전에 Tailwind CSS 공식 문서([tailwindcss.com](https://tailwindcss.com))를 확인하여 클래스가 유효한지 검증합니다.
- 유효하지 않은 클래스는 **절대 사용하지 않습니다**.
- 의문이 있을 경우에는 `npx tailwindcss -i input.css -o output.css --minify`로 빌드 테스트를 수행하여 클래스가 적용되는지 확인합니다.  