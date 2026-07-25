import React, { useEffect, useState, useCallback } from 'react';
import DataEditor, { GridCellKind } from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { fetchJSON } from '../api';

function SpreadsheetView({ tableName }) {
  const [schema, setSchema] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    if (!tableName) return;
    setLoading(true);
    
    // Fetch schema and data
    Promise.all([
      fetchJSON(`/admin/api/tables/${tableName}/schema`),
      fetchJSON(`/admin/api/tables/${tableName}/rows?limit=1000&offset=0`)
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
  }, [tableName]);

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

    fetch(`/admin/api/tables/${tableName}/rows/${rowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [colName]: newValue.data })
    }).catch(err => {
      console.error('Failed to save cell', err);
      setRows(rows); // Revert
    });
  }, [rows, columns, tableName]);

  const deleteSelectedRows = useCallback((selection) => {
     if (!selection || !selection.rows) return;
     const indices = selection.rows.toArray();
     if (indices.length === 0) return;
     
     if (!window.confirm(`선택한 ${indices.length}개의 행을 삭제하시겠습니까?`)) return;

     const idsToDelete = indices.map(i => rows[i]?.rowid || rows[i]?.id).filter(Boolean);
     if (idsToDelete.length === 0) return;
     
     fetch(`/admin/api/tables/${tableName}/rows`, {
       method: 'DELETE',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ ids: idsToDelete })
     }).then(() => {
        setRows(prev => prev.filter((r, i) => !indices.includes(i)));
     }).catch(err => {
        console.error("Delete failed", err);
     });
  }, [rows, tableName]);

  const addNewRow = async () => {
    const newRow = {};
    schema.forEach(col => {
      if (col.name !== 'id' && col.name !== 'rowid') {
        newRow[col.name] = col.dflt_value || '';
      }
    });

    try {
      const res = await fetch(`/admin/api/tables/${tableName}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow)
      });
      const data = await res.json();
      if (data.id) {
        setRows(prev => [{ ...newRow, rowid: data.id, id: data.id }, ...prev]);
      } else {
        // Fallback if no lastID returned easily
        setRows(prev => [{ ...newRow }, ...prev]);
      }
    } catch(err) {
      console.error("Add row failed", err);
    }
  };

  if (!tableName) {
    return (
      <div className="spreadsheet-view" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
        <h3>관리할 테이블을 선택해주세요.</h3>
      </div>
    );
  }

  return (
    <div className="spreadsheet-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2a2a2a', borderBottom: '1px solid #444' }}>
        <h2 style={{ margin: 0, color: '#fff' }}>{tableName}</h2>
        <div>
          <button 
            onClick={addNewRow}
            style={{ padding: '8px 16px', background: '#007acc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            + 새 행 추가
          </button>
        </div>
      </div>
      {loading ? (
        <div style={{ padding: '20px' }}>데이터 로딩 중...</div>
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
                bgCell: '#1e1e1e',
                bgHeader: '#2a2a2a',
                textDark: '#ffffff',
                textHeader: '#ffffff',
                borderColor: '#444444',
                bgCellMedium: '#222222',
                accentColor: '#007acc',
                accentLight: '#007acc33'
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default SpreadsheetView;
