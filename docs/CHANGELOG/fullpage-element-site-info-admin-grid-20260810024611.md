# fullPage/요소선택 액션 개편 + SITE_INFO 수집 + admin 그리드 정렬·검색 (ask-20260810024611)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260810024611.md`

## 완료 내용
- 플러그인 액션 개편: 전체 페이지 → `fullPage`(버튼 누를 때 현재 렌더링 DOM 재캡처 outerHTML), 요소 선택 → `DomCapture`, 구형 CRAWL_DOCUMENT/PARTIAL 하위 호환 유지 (content.ts/chromeService/usePopupState/BasicTab/sidepanel/popup)
- 이미지 수집 3버튼: 일반 상시 + xchina.co(normal/album/cover/info)·xvideos.com(normal/info) 사이트 전용, `matchSiteDomain()` 호스트 정확/접미사 매칭, category 페이로드 전달
- 정보 수집 `SITE_INFO` 액션 신규: 메타 JSON → `<기본경로>/images/<도메인>/info/<ts>-<seq>.json` 물리 저장
- 서버: `saveCrawledImage` `images/<도메인>/<카테고리>` 저장, CRAWL_IMAGE category 전달, SITE_INFO 분기, 워커 파이프라인 조건 `CRAWL_DOCUMENT || fullPage`
- 서버: `fetchTableRows` searchField/orderBy/orderDir 파라미터 + 컬럼 화이트리스트 + `%`/`_` LIKE `ESCAPE '\'` + rows 라우트 파싱
- admin 데이터 브라우저: 컬럼 헤더 ▲▼ 서버 정렬(onSortChange) + 검색 필드 드롭다운(전체/개별 컬럼) + 테이블 전환 시 리셋
- admin SQL 실행기: 예제 쿼리 20개 드롭다운(선택 시 에디터 삽입) + 결과 그리드 `clientSort` 클라이언트 정렬
- opera-plugin 동기화(6종 복사 + 헤더 교체) + 양 플러그인 빌드 성공
- 문서: R-00203(rows API 규격), R-00304(§3.1/§3.3/체크리스트) 갱신
- 검증: server 빌드 + pm2 재시작 online, admin vite build, API 수동(정렬/검색/이스케이프/주입 안전)

## 후속 확인
- 브라우저 수동 확인: 사이트 전용 이미지 버튼/카테고리 저장, fullPage 재캡처, admin 헤더 정렬/필드 검색/예제 쿼리 — `docs/todo.md` 예정 작업에서 관리 중
