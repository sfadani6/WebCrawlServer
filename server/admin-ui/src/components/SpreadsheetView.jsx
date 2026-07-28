import React, { useEffect, useState, useCallback } from 'react';
import DataEditor, { GridCellKind } from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { fetchJSON } from '../api';

function SpreadsheetView({ dbName = 'main.db', tableName }) {
  const [schema, setSchema] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState([]);
  const [dirtyRows, setDirtyRows] = useState({}); // { [rowId]: true }
  const [savingRows, setSavingRows] = useState({}); // { [rowId]: true }
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'canvas'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(() => {
    if (!tableName) return;
    setLoading(true);
    const dbParam = `?db=${encodeURIComponent(dbName)}`;
    const offset = (currentPage - 1) * pageSize;
    const sortParam = sortColumn ? `&order_by=${sortColumn}&order_dir=${sortDirection}` : '';
    const searchParam = searchTerm ? `&query=1` : '';

    Promise.all([
      fetchJSON(`/admin/api/tables/${tableName}/schema${dbParam}`),
      fetchJSON(`/admin/api/tables/${tableName}/rows${dbParam}&limit=${pageSize}&offset=${offset}${sortParam}${searchParam}`)
    ])
    .then(([schemaData, rowsData]) => {
      setSchema(schemaData || []);
      setRows(rowsData || []);
      setDirtyRows({});
      
      const gridColumns = (schemaData || []).map(col => ({
        title: col.name,
        id: col.name,
        width: 150
      }));
      setColumns(gridColumns);
      setLoading(false);
    })
    .catch(err => {
      console.error('Failed to load table data', err);
      setLoading(false);
    });
  }, [dbName, tableName, currentPage, pageSize, sortColumn, sortDirection, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 셀 값 변경 핸들러
  const handleCellChange = (rowIndex, colName, value) => {
    const updatedRows = [...rows];
    const rowObj = { ...updatedRows[rowIndex], [colName]: value };
    updatedRows[rowIndex] = rowObj;
    setRows(updatedRows);

    const rowId = rowObj.rowid || rowObj.id || rowIndex;
    setDirtyRows(prev => ({ ...prev, [rowId]: true }));
  };

  // 행 우측 [저장] 버튼 클릭 시
  const handleSaveRow = async (rowIndex) => {
    const rowObj = rows[rowIndex];
    const rowId = rowObj.rowid || rowObj.id;

    if (!rowId) {
      alert('행 식별자(rowid 또는 id)를 찾을 수 없습니다.');
      return;
    }

    setSavingRows(prev => ({ ...prev, [rowId]: true }));
    const dbParam = `?db=${encodeURIComponent(dbName)}`;

    try {
      await fetch(`/admin/api/tables/${tableName}/rows/${rowId}${dbParam}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rowObj)
      });
      setDirtyRows(prev => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
      setSavingRows(prev => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
      setSavingRows(prev => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    }
  };

  // 행 우측 [행 삭제] 버튼 클릭 시
  const handleDeleteRow = async (rowIndex) => {
    const rowObj = rows[rowIndex];
    const rowId = rowObj.rowid || rowObj.id;

    if (!window.confirm(`선택한 행(ID: ${rowId || rowIndex + 1})을 정말 삭제하시겠습니까?`)) {
      return;
    }

    const dbParam = `?db=${encodeURIComponent(dbName)}`;
    try {
      if (rowId) {
        await fetch(`/admin/api/tables/${tableName}/rows/${rowId}${dbParam}`, {
          method: 'DELETE'
        });
      }
      setRows(prev => prev.filter((_, idx) => idx !== rowIndex));
    } catch (err) {
      alert(`행 삭제 실패: ${err.message}`);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const dbParam = `?db=${encodeURIComponent(dbName)}`;
      try {
        if (file.name.endsWith('.csv')) {
          await fetch(`/admin/api/tables/${tableName}/restore/csv${dbParam}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/csv' },
            body: text
          });
        } else {
          const jsonData = JSON.parse(text);
          await fetch(`/admin/api/tables/${tableName}/restore${dbParam}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonData)
          });
        }
        alert('데이터 가져오기 완료');
        loadData();
      } catch (err) {
        alert(`가져오기 실패: ${err.message}`);
      }
    };
    input.click();
  };

  // 파일 내보내기
  const handleExport = (format) => {
    if (!tableName || !rows.length) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    let content = '';
    let mimeType = '';
    let extension = '';

    if (format === 'csv' || format === 'xlsx') {
      const header = schema.map(col => col.name).join(',');
      const body = rows.map(row => schema.map(col => {
        const val = row[col.name];
        const str = val === null || val === undefined ? '' : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(','));
      // UTF-8 BOM (\uFEFF) 추가로 엑셀(Excel) 한글 깨짐 방지
      content = '\uFEFF' + [header, ...body].join('\r\n');
      mimeType = format === 'xlsx' ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8';
      extension = format === 'xlsx' ? 'xlsx' : 'csv';
    } else {
      content = JSON.stringify(rows, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}_export_${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 정렬 핸들러
  const handleSort = (colName) => {
    if (sortColumn === colName) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colName);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // 검색 핸들러
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // 페이지 이동
  const goToPage = (page) => {
    if (page < 1) return;
    setCurrentPage(page);
  };

  // 새 행 추가
  const addNewRow = async () => {
    const newRow = {};
    schema.forEach(col => {
      if (col.name !== 'id' && col.name !== 'rowid') {
        newRow[col.name] = col.dflt_value || '';
      }
    });

    try {
      const dbParam = `?db=${encodeURIComponent(dbName)}`;
      const res = await fetch(`/admin/api/tables/${tableName}/rows${dbParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow)
      });
      const data = await res.json();
      loadData();
    } catch(err) {
      alert(`행 추가 실패: ${err.message}`);
    }
  };

  // Canvas DataEditor getCellContent
  const getCellContent = useCallback(([col, row]) => {
    if (row >= rows.length || col >= columns.length) {
      return { kind: GridCellKind.Text, data: '', displayData: '', allowOverlay: false };
    }
    const colName = columns[col].id;
    const val = rows[row][colName];
    const displayVal = val === null || val === undefined ? '' : String(val);
    return {
      kind: GridCellKind.Text,
      data: displayVal,
      displayData: displayVal,
      allowOverlay: true,
      readonly: colName === 'rowid'
    };
  }, [rows, columns]);

  const onCellEdited = useCallback((cell, newValue) => {
    const [col, row] = cell;
    if (row >= rows.length || col >= columns.length) return;
    const colName = columns[col].id;
    handleCellChange(row, colName, newValue.data);
  }, [rows, columns]);

  if (!tableName) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--gcp-text-secondary)' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>👈</div>
        <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--gcp-text-primary)' }}>좌측 목록에서 관리할 테이블을 선택하세요.</h3>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>인라인 셀 편집 및 행 단위 저장/삭제 기능을 제공합니다.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Table Header Toolbar */}
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--gcp-bg-header)',
        borderBottom: '1px solid var(--gcp-border)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gcp-text-primary)' }}>📋 {tableName}</span>
          <span className="gcp-badge gcp-badge-active">{rows.length} 행</span>
          {Object.keys(dirtyRows).length > 0 && (
            <span className="gcp-badge gcp-badge-warn">● {Object.keys(dirtyRows).length}개 행 수정됨</span>
          )}
          {/* 검색 입력 */}
          <input
            type="text"
            placeholder="🔍 검색..."
            value={searchTerm}
            onChange={handleSearch}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: 'var(--gcp-bg-main)',
              border: '1px solid var(--gcp-border)',
              borderRadius: '4px',
              color: 'var(--gcp-text-primary)',
              width: '150px',
              outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid var(--gcp-border)', borderRadius: '4px', overflow: 'hidden' }}>
            <button 
              className="gcp-btn gcp-btn-secondary"
              style={{
                borderRadius: 0,
                border: 'none',
                backgroundColor: viewMode === 'table' ? 'var(--gcp-bg-hover)' : 'transparent',
                color: viewMode === 'table' ? 'var(--gcp-accent)' : 'var(--gcp-text-secondary)',
                fontSize: '11px',
                padding: '4px 8px'
              }}
              onClick={() => setViewMode('table')}
            >
              테이블 뷰 (행 저장/삭제)
            </button>
            <button 
              className="gcp-btn gcp-btn-secondary"
              style={{
                borderRadius: 0,
                border: 'none',
                backgroundColor: viewMode === 'canvas' ? 'var(--gcp-bg-hover)' : 'transparent',
                color: viewMode === 'canvas' ? 'var(--gcp-accent)' : 'var(--gcp-text-secondary)',
                fontSize: '11px',
                padding: '4px 8px'
              }}
              onClick={() => setViewMode('canvas')}
            >
              캔버스 대용량 뷰
            </button>
          </div>
          <button className="gcp-btn gcp-btn-secondary" onClick={() => handleExport('xlsx')} style={{ padding: '4px 8px', fontSize: '11px' }}>Excel(.xlsx) 내보내기</button>
          <button className="gcp-btn gcp-btn-secondary" onClick={() => handleExport('csv')} style={{ padding: '4px 8px', fontSize: '11px' }}>CSV 내보내기</button>
          <button className="gcp-btn gcp-btn-secondary" onClick={() => handleExport('json')} style={{ padding: '4px 8px', fontSize: '11px' }}>JSON 내보내기</button>
          <button className="gcp-btn gcp-btn-secondary" onClick={handleImport} style={{ padding: '4px 8px', fontSize: '11px' }}>가져오기</button>
          <button className="gcp-btn" onClick={addNewRow} style={{ padding: '4px 10px', fontSize: '11.5px' }}>
            + 새 행 추가
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div style={{ padding: '20px', color: 'var(--gcp-text-secondary)' }}>데이터 로딩 중...</div>
      ) : viewMode === 'table' ? (
        /* 고밀도 데이터 그리드 테이블 + 우측 끝 [저장] & [행 삭제] 버튼 */
        <div style={{ flexGrow: 1, overflow: 'auto', padding: '0' }}>
          <table className="gcp-table" style={{ minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                {schema.map(col => (
                  <th key={col.name} onClick={() => handleSort(col.name)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    {col.name} <span style={{ fontSize: '10px', opacity: 0.6 }}>({col.type})</span>
                    {sortColumn === col.name && (
                      <span style={{ marginLeft: '4px', fontSize: '10px' }}>
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                ))}
                <th style={{ width: '130px', textAlign: 'right', position: 'sticky', right: 0, backgroundColor: 'var(--gcp-bg-header)' }}>
                  행 작업 (Action)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((rowObj, rIdx) => {
                const rowId = rowObj.rowid || rowObj.id || rIdx;
                const isDirty = !!dirtyRows[rowId];
                const isSaving = !!savingRows[rowId];

                return (
                  <tr key={rIdx} style={{ backgroundColor: isDirty ? 'rgba(253, 214, 99, 0.08)' : undefined }}>
                    <td style={{ textAlign: 'center', color: 'var(--gcp-text-secondary)', fontSize: '11px' }}>{rIdx + 1}</td>
                    {schema.map(col => {
                      const val = rowObj[col.name] === null || rowObj[col.name] === undefined ? '' : String(rowObj[col.name]);
                      return (
                        <td key={col.name} style={{ padding: '3px 6px' }}>
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleCellChange(rIdx, col.name, e.target.value)}
                            disabled={col.name === 'rowid'}
                            style={{
                              width: '100%',
                              backgroundColor: 'transparent',
                              border: '1px solid transparent',
                              color: 'var(--gcp-text-primary)',
                              fontSize: '12px',
                              padding: '3px 6px',
                              borderRadius: '3px',
                              outline: 'none'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = 'var(--gcp-accent)';
                              e.target.style.backgroundColor = 'var(--gcp-bg-main)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = 'transparent';
                              e.target.style.backgroundColor = 'transparent';
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', position: 'sticky', right: 0, backgroundColor: 'var(--gcp-bg-card)', borderLeft: '1px solid var(--gcp-border)' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button
                          className="gcp-btn"
                          style={{ 
                            padding: '2px 8px', 
                            fontSize: '11px',
                            backgroundColor: isDirty ? 'var(--gcp-accent)' : 'var(--gcp-bg-hover)',
                            color: isDirty ? '#18191c' : 'var(--gcp-text-secondary)',
                            fontWeight: isDirty ? 600 : 400
                          }}
                          onClick={() => handleSaveRow(rIdx)}
                          disabled={isSaving}
                        >
                          {isSaving ? '저장 중' : isDirty ? '저장*' : '저장'}
                        </button>
                        <button
                          className="gcp-btn gcp-btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--gcp-status-red)', borderColor: 'rgba(242,139,130,0.3)' }}
                          onClick={() => handleDeleteRow(rIdx)}
                          title="행 삭제"
                        >
                          행 삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* 페이지네이션 컨트롤 */}
      <div style={{
        padding: '6px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--gcp-bg-header)',
        borderTop: '1px solid var(--gcp-border)',
        flexShrink: 0,
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>페이지 크기:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            style={{
              padding: '2px 4px',
              fontSize: '12px',
              backgroundColor: 'var(--gcp-bg-main)',
              border: '1px solid var(--gcp-border)',
              borderRadius: '3px',
              color: 'var(--gcp-text-primary)'
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="gcp-btn gcp-btn-secondary"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{ padding: '2px 8px', fontSize: '11px' }}
          >
            ◀ 이전
          </button>
          <span>페이지 {currentPage}</span>
          <button
            className="gcp-btn gcp-btn-secondary"
            onClick={() => goToPage(currentPage + 1)}
            disabled={rows.length < pageSize}
            style={{ padding: '2px 8px', fontSize: '11px' }}
          >
            다음 ▶
          </button>
        </div>
      </div>
      
      {/* Canvas 대용량 그리드 뷰 */}
      {!loading && viewMode === 'canvas' && (
        <div style={{ flexGrow: 1, position: 'relative' }}>
          {columns.length > 0 && (
            <DataEditor
              getCellContent={getCellContent}
              columns={columns}
              rows={rows.length}
              onCellEdited={onCellEdited}
              width="100%"
              height="100%"
              smoothScrollX={true}
              smoothScrollY={true}
              rowMarkers="both"
              theme={{
                bgCell: '#18191c',
                bgHeader: '#202124',
                textDark: '#ffffff',
                textHeader: '#9aa0a6',
                borderColor: '#33353b',
                bgCellMedium: '#242529',
                accentColor: '#8ab4f8',
                accentLight: 'rgba(138, 180, 248, 0.2)'
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default SpreadsheetView;
