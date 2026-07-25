import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';

function TableList({ dbName = 'main.db', selectedTable, onSelect }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchJSON(`/admin/api/tables?db=${encodeURIComponent(dbName)}`)
      .then(data => {
        setTables(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load tables', err);
        setLoading(false);
      });
  }, [dbName]);

  return (
    <div>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--gcp-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '8px'
      }}>
        테이블 목록 ({tables.length})
      </div>
      {loading ? (
        <div style={{ fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>로딩 중...</div>
      ) : tables.length === 0 ? (
        <div style={{ fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>테이블이 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {tables.map(name => {
            const isSelected = selectedTable === name;
            return (
              <button
                key={name}
                onClick={() => onSelect(name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: '3px',
                  backgroundColor: isSelected ? 'rgba(138, 180, 248, 0.15)' : 'transparent',
                  color: isSelected ? 'var(--gcp-accent)' : 'var(--gcp-text-primary)',
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>📋</span>
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TableList;
