# 이미지 수집 개선 — 500 상한·lazy 폴백·루트 도메인 저장 통일 (ask-20260810031128)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260810031128.md`

## 완료 내용
- content.ts: `MAX_IMAGE_COLLECT_COUNT` 50→500, `resolveImageSource()` lazy 폴백(data-src/data-original/data-lazy-src/data-url/data-lazy), `collectAndSendImages` 중복 URL Set 제거
- BasicTab.tsx: 사이트 전용 그리드 → 항상 3그룹 표시(일반/xchina.co/xvideos.com), 비매칭 그룹 disabled + "다른 도메인" 배지 + title 안내
- 서버 index.ts: `normalizeRootDomain()` 신규 — `www.` 제거한 루트 도메인으로 저장 폴더/crawl_logs domain 통일
- opera-plugin 동기화(2종: content.ts, BasicTab.tsx) + 양 플러그인 빌드 성공
- 문서: R-00208 §2.1(카테고리 하위 폴더·info·루트 도메인), R-00430 §5.3·§6 갱신
- 검증: server 빌드 + pm2 재시작 online, 플러그인 빌드 성공

## 후속 확인
- 브라우저 수동 확인: 3그룹 상시 표시/비매칭 비활성화 배지, lazy 포함·중복 제거·500 상한, `images/<루트도메인>/normal/` 저장 — `docs/todo.md` 예정 작업에서 관리 중
