import React, { useEffect, useState, useCallback } from 'react';
import DataEditor, { GridCellKind } from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { fetchJSON } from '../api';

function SpreadsheetView({ dbName = 'main.db', tableName }) {
  const [schema, setSchema] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    if (!tableName) return;
    setLoading(true);
    
    const dbParam = `?db=${encodeURIComponent(dbName)}`;

    Promise.all([
      fetchJSON(`/admin/api/tables/${tableName}/schema${dbParam}`),
      fetchJSON(`/admin/api/tables/${tableName}/rows${dbParam}&limit=1000&offset=0`)
    ])
    .then(([schemaData, rowsData]) => {
      setSchema(schemaData || []);
      setRows(rowsData || []);
      
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
  }, [dbName, tableName]);

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
    const rowData = rows[row];
    const rowId = rowData.rowid || rowData.id;
    
    if (!rowId) {
       alert("행 식별자(rowid 또는 id)가 없어 수정할 수 없습니다.");
       return;
    }

    const updatedRows = [...rows];
    updatedRows[row] = { ...rowData, [colName]: newValue.data };
    setRows(updatedRows);

    const dbParam = `?db=${encodeURIComponent(dbName)}`;
    fetch(`/admin/api/tables/${tableName}/rows/${rowId}${dbParam}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [colName]: newValue.data })
    }).catch(err => {
      console.error('Failed to save cell', err);
      setRows(rows);
    });
  }, [rows, columns, dbName, tableName]);

  const deleteSelectedRows = useCallback((selection) => {
     if (!selection || !selection.rows) return;
     const indices = selection.rows.toArray();
     if (indices.length === 0) return;
     
     if (!window.confirm(`선택한 ${indices.length}개의 행을 삭제하시겠습니까?`)) return;

     const idsToDelete = indices.map(i => rows[i]?.rowid || rows[i]?.id).filter(Boolean);
     if (idsToDelete.length === 0) return;
     
     const dbParam = `?db=${encodeURIComponent(dbName)}`;
     fetch(`/admin/api/tables/${tableName}/rows${dbParam}`, {
       method: 'DELETE',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ ids: idsToDelete })
     }).then(() => {
        setRows(prev => prev.filter((r, i) => !indices.includes(i)));
     }).catch(err => {
        console.error("Delete failed", err);
     });
  }, [rows, dbName, tableName]);

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
      if (data.id) {
        setRows(prev => [{ ...newRow, rowid: data.id, id: data.id }, ...prev]);
      } else {
        setRows(prev => [{ ...newRow }, ...prev]);
      }
    } catch(err) {
      console.error("Add row failed", err);
    }
  };

  if (!tableName) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--gcp-text-secondary)' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>👈</div>
        <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--gcp-text-primary)' }}>좌측 목록에서 관리할 테이블을 선택하세요.</h3>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>인라인 셀 편집 및 가상 스크롤 그리드를 지원합니다.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Table Toolbar */}
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--gcp-bg-header)',
        borderBottom: '1px solid var(--gcp-border)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gcp-text-primary)' }}>📋 {tableName}</span>
          <span className="gcp-badge gcp-badge-active">{rows.length} 행 (Rows)</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="gcp-btn" onClick={addNewRow} style={{ padding: '4px 10px', fontSize: '11.5px' }}>
            + 새 행 추가
          </button>
        </div>
      </div>

      {/* Grid Content Area */}
      {loading ? (
        <div style={{ padding: '20px', color: 'var(--gcp-text-secondary)' }}>테이블 데이터 로딩 중...</div>
      ) : (
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
              onDelete={deleteSelectedRows}
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
