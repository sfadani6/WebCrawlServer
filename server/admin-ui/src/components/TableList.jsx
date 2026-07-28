import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';

function TableList({ dbName = 'main.db', selectedTable, onSelect }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [columns, setColumns] = useState([
    { name: 'id', type: 'INTEGER', constraints: 'PRIMARY KEY AUTOINCREMENT' },
    { name: 'title', type: 'TEXT', constraints: 'NOT NULL' }
  ]);
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadTables = () => {
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
  };

  useEffect(() => {
    loadTables();
  }, [dbName]);

  const handleAddColumnRow = () => {
    setColumns([...columns, { name: '', type: 'TEXT', constraints: '' }]);
  };

  const handleRemoveColumnRow = (index) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index, field, value) => {
    const updated = [...columns];
    updated[index][field] = value;
    setColumns(updated);
  };

  const handleCreateTableSubmit = async (e) => {
    e.preventDefault();
    if (!newTableName.trim()) {
      setModalError('테이블 이름을 입력해주세요.');
      return;
    }

    const validCols = columns.filter(c => c.name.trim() !== '');
    if (validCols.length === 0) {
      setModalError('최소 1개 이상의 유효한 컬럼을 지정해야 합니다.');
      return;
    }

    setCreating(true);
    setModalError('');

    try {
      await fetchJSON(`/admin/api/tables?db=${encodeURIComponent(dbName)}`, {
        method: 'POST',
        body: JSON.stringify({
          tableName: newTableName.trim(),
          columns: validCols
        })
      });
      setShowCreateTableModal(false);
      setNewTableName('');
      setColumns([
        { name: 'id', type: 'INTEGER', constraints: 'PRIMARY KEY AUTOINCREMENT' },
        { name: 'title', type: 'TEXT', constraints: 'NOT NULL' }
      ]);
      setCreating(false);
      loadTables();
      onSelect(newTableName.trim());
    } catch (err) {
      setModalError(err.message || '테이블 생성 실패');
      setCreating(false);
    }
  };

  const handleDeleteTable = async (tableName, e) => {
    e.stopPropagation();
    if (!window.confirm(`정말 '${tableName}' 테이블을 완전히 삭제(DROP TABLE)하시겠습니까?\n테이블 내 모든 데이터가 삭제됩니다.`)) {
      return;
    }

    try {
      await fetchJSON(`/admin/api/tables/${encodeURIComponent(tableName)}?db=${encodeURIComponent(dbName)}`, {
        method: 'DELETE'
      });
      loadTables();
      if (selectedTable === tableName) {
        onSelect('');
      }
    } catch (err) {
      alert(err.message || '테이블 삭제 실패');
    }
  };

  return (
    <div>
      {/* Top Header & Create Table Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gcp-text-secondary)', textTransform: 'uppercase' }}>
          테이블 목록 ({tables.length})
        </span>
        <button 
          className="gcp-btn" 
          style={{ padding: '3px 8px', fontSize: '11px' }}
          onClick={() => setShowCreateTableModal(true)}
        >
          + 테이블 생성
        </button>
      </div>

      {/* Table Item List */}
      {loading ? (
        <div style={{ fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>로딩 중...</div>
      ) : tables.length === 0 ? (
        <div style={{ fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>테이블이 없습니다. 새 테이블을 생성하세요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {tables.map(name => {
            const isSelected = selectedTable === name;
            return (
              <div
                key={name}
                onClick={() => onSelect(name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  backgroundColor: isSelected ? 'rgba(138, 180, 248, 0.15)' : 'transparent',
                  color: isSelected ? 'var(--gcp-accent)' : 'var(--gcp-text-primary)',
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'background-color 0.1s'
                }}
                className="table-item-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <span>📋</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                </div>
                <button
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--gcp-status-red)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    opacity: 0.7
                  }}
                  onClick={(e) => handleDeleteTable(name, e)}
                  title="테이블 삭제 (DROP TABLE)"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 테이블 생성 레이어 모달 */}
      {showCreateTableModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--gcp-bg-card)',
            border: '1px solid var(--gcp-border)',
            borderRadius: '6px',
            width: '560px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--gcp-text-primary)' }}>
              새 테이블 생성 ({dbName})
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
              테이블 명과 생성할 컬럼의 데이터 타입, 제약 조건을 구성하세요.
            </p>

            {modalError && (
              <div style={{ padding: '8px 12px', backgroundColor: 'rgba(242,139,130,0.2)', border: '1px solid var(--gcp-status-red)', color: 'var(--gcp-status-red)', borderRadius: '4px', fontSize: '12px', marginBottom: '12px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateTableSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--gcp-text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                  테이블 이름 (Table Name)
                </label>
                <input
                  type="text"
                  placeholder="예: users, products, orders"
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    backgroundColor: 'var(--gcp-bg-main)',
                    border: '1px solid var(--gcp-border)',
                    color: 'var(--gcp-text-primary)',
                    borderRadius: '4px',
                    fontSize: '12.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gcp-text-secondary)', textTransform: 'uppercase' }}>
                  컬럼 구성 (Columns)
                </span>
                <button 
                  type="button" 
                  className="gcp-btn gcp-btn-secondary" 
                  onClick={handleAddColumnRow}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                >
                  + 컬럼 추가
                </button>
              </div>

              {/* Column Rows Container */}
              <div style={{ flexGrow: 1, overflowY: 'auto', border: '1px solid var(--gcp-border)', borderRadius: '4px', padding: '8px', marginBottom: '16px', backgroundColor: 'var(--gcp-bg-main)' }}>
                {columns.map((col, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="컬럼명 (예: name)"
                      value={col.name}
                      onChange={e => handleColumnChange(idx, 'name', e.target.value)}
                      style={{
                        flex: 2,
                        padding: '5px 8px',
                        backgroundColor: 'var(--gcp-bg-card)',
                        border: '1px solid var(--gcp-border)',
                        color: 'var(--gcp-text-primary)',
                        borderRadius: '3px',
                        fontSize: '12px'
                      }}
                    />
                    <select
                      value={col.type}
                      onChange={e => handleColumnChange(idx, 'type', e.target.value)}
                      style={{
                        flex: 1.2,
                        padding: '5px 8px',
                        backgroundColor: 'var(--gcp-bg-card)',
                        border: '1px solid var(--gcp-border)',
                        color: 'var(--gcp-text-primary)',
                        borderRadius: '3px',
                        fontSize: '12px'
                      }}
                    >
                      <option value="TEXT">TEXT</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="REAL">REAL</option>
                      <option value="BLOB">BLOB</option>
                      <option value="TIMESTAMP">TIMESTAMP</option>
                    </select>
                    <input
                      type="text"
                      placeholder="제약 조건 (예: NOT NULL, PRIMARY KEY)"
                      value={col.constraints}
                      onChange={e => handleColumnChange(idx, 'constraints', e.target.value)}
                      style={{
                        flex: 2.5,
                        padding: '5px 8px',
                        backgroundColor: 'var(--gcp-bg-card)',
                        border: '1px solid var(--gcp-border)',
                        color: 'var(--gcp-text-primary)',
                        borderRadius: '3px',
                        fontSize: '12px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveColumnRow(idx)}
                      disabled={columns.length <= 1}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--gcp-status-red)',
                        cursor: columns.length <= 1 ? 'not-allowed' : 'pointer',
                        padding: '4px',
                        opacity: columns.length <= 1 ? 0.3 : 1
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button 
                  type="button" 
                  className="gcp-btn gcp-btn-secondary" 
                  onClick={() => setShowCreateTableModal(false)}
                  disabled={creating}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="gcp-btn"
                  disabled={creating || !newTableName.trim()}
                >
                  {creating ? '테이블 생성 중...' : '테이블 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TableList;
