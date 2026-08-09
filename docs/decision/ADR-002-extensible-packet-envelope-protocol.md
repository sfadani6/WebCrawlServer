# ADR-002: 확장형 웹소켓 통신 패킷 봉투(Packet Envelope) 프로토콜 규격 채택

> **상태**: 승인됨 (Accepted)  
> **날짜**: 2026-08-05  
> **결정자**: 시스템 아키텍트 & 개발 팀  
> **관련 문서**: AGENTS.md, R-00206, R-00420, R-00470  

---

## 1. 배경 및 문제 정의 (Context & Problem Statement)

기존 `WebCrawlServer`와 플러그인 간 웹소켓 메시지는 비정형화된 JSON 객체를 주고받아 다음과 같은 확장성 및 타입 안전성 문제를 안고 있었습니다.

1. **메시지 타입 미비 및 예외 위험**:
   - `senderId`, `targetId`, `action` 외에 수신 패킷이 단순 텍스트인지, JSON인지, 바이너리 이미지인지 명확히 구별하는 표준 필드가 부재함.
2. **바이너리/파일 송수신 한계**:
   - 크롤링 중 캡처한 이미지, PDF, 파비콘 등의 파일 자원을 전송할 때 파일명, MIME 타입, 파일 크기 등의 메타데이터를 담을 표준 규격이 없음.
3. **추적성 및 동적 매개변수 확장성 부족**:
   - 단일 패킷 단위의 고유 추적 ID(`traceId`)가 없어 요청-응답 매칭이 어려우며, 신규 기능 추가 시 패킷 최상위 필드가 계속 오염되는 현상 발생.

---

## 2. 고려된 대안들 (Considered Options)

### 대안 1: 비정형 JSON 사용 및 기능별 속성 추가 (기존 방식)
- **장점**: 개발 초기 신속한 작성 가능.
- **단점**: 패킷 구조가 누더기처럼 오염되며 타입 안전성이 파괴되고 바이너리 수송 불가.

### 대안 2: 표준 패킷 봉투(Packet Envelope) 프로토콜 채택 (선택안)
- **장점**:
  - `senderId`, `targetId`, `action`, `payloadType`, `payload`, `meta` 6대 통일 필드 구조 정립.
  - `payloadType`을 통해 `json`, `binary_base64`, `raw_text`, `chunk_stream`을 명확히 구분.
  - `meta.extraParams`를 통한 동적 Key-Value 파라미터 무한 확장 지원.
- **단점**: 패킷 인코딩/디코딩 시 래핑 오버헤드가 약간 존재함.

---

## 3. 아키텍처 결정 사항 (Decision)

**대안 2 (표준 패킷 봉투 프로토콜 규격)를 전체 시스템 통신 표준으로 채택합니다.**

### 패킷 봉투 표준 명세 (`WebSocketPacket<T>`):
```typescript
export type PayloadType = "json" | "binary_base64" | "raw_text" | "chunk_stream";

export interface FileMetadata {
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  chunkIndex?: number;
  totalChunks?: number;
}

export interface PacketMetadata {
  timestamp: number;
  traceId?: string;
  fileMeta?: FileMetadata;
  extraParams?: Record<string, unknown>;
}

export interface WebSocketPacket<T = unknown> {
  senderId: string;                     // 송신 노드 ID (clientId)
  targetId?: string | "ALL" | "SERVER"; // 수신 대상
  action: string;                       // 수행지시 액션 식별자
  payloadType: PayloadType;             // "json" | "binary_base64" | "raw_text" | "chunk_stream"
  payload: T;                           // 데이터 바디
  meta: PacketMetadata;                 // 타임스탬프, 추적 ID, 파일 메타, 동적 파라미터
}
```

---

## 4. 파급 효과 및 이점 (Consequences)

### 긍정적 이점:
- **타입 엄격성 및 신뢰성 확보**: TypeScript 제네릭(`WebSocketPacket<T>`)을 활용하여 백엔드, 오프스크린, 사이드바 간 송수신 데이터의 컴파일 타임 타입 검증 완비.
- **바이너리 파일 수송 완전 지원**: 이미지, 캡처 파일, ZIP 데이터 등을 Base64 또는 스트림 덩어리로 안전하게 전송.
- **유연한 미래 확장성**: `meta.extraParams` 객체를 통해 기존 통신 규격을 깨뜨리지 않고 어떠한 매개변수도 동적으로 추가 가능.

### 적용 위치:
- `plugins/basic-plugin/src/types/index.ts`
- `plugins/basic-plugin/src/offscreen.ts`
- `server/src/index.ts`
