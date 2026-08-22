# admin DB 그리드 개선 — 페이지당 행 수·셀 미리보기·탐색기 열기 (ask-20260809231120)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260809231120.md`

## 완료 내용
- server/configs.json: `db_page_size`(20), `db_cell_preview_chars`(200) 시드 추가 (누락 키 자동 INSERT, admin 환경설정 자동 노출)
- server: `POST /api/admin/fs/open-explorer` 신규 (파일이면 부모 디렉토리, 디렉토리면 그대로, win32 explorer.exe/비Win xdg-open, 미존재 404, 관리자 활동 로그)
- server: `/api/admin/db/rows` 및 `fetchTableRows` size 미지정 기본값 50→20 (최대 200 유지)
- admin ValuePreviewModal.tsx 신규: 창 높이 기준 maxHeight(`innerHeight - 120px`) + 본문 스크롤 + 닫기/backdrop/ESC + 글자수·줄수 표시
- admin DbDataGrid.tsx: 셀 길이 제한(기본 200) + `더보기` 링크 + `file_path` 컬럼 정확 일치 시 folder_open 탐색기 버튼 + 실패 배너
- admin apiService.ts: openExplorerApi() 추가
- admin useDbManager.ts: selectTable(table, size=20) size 파라미터화
- admin DbBrowserPanel.tsx: dbPageSize 기본값 + 페이지당 행 수 드롭다운(20/50/100/200) + cellPreviewChars 전달
- admin SqlQueryPanel.tsx: cellPreviewChars → DbDataGrid 전달
- admin DbManagerView.tsx: dbPageSize/cellPreviewChars props 수신·전달, selectTable(table, dbPageSize)
- admin App.tsx: configs에서 두 키 파싱 → DbManagerView props 전달
- 검증: server tsc/빌드 통과 + pm2 재시작 online(9600), admin tsc 신규 에러 0건 + vite build 성공
- API 수동: configs 시드 확인(20/200), rows 기본 size=20·page2·size=50 정상, open-explorer 파일→부모 디렉토리 성공/미존재 404

## 후속 확인
- 잔여 예정 작업 없음 (API 수동 검증까지 완료된 블록)
