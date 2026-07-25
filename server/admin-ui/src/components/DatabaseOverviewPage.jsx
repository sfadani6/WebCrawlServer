import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';
import TableList from './TableList';
import SpreadsheetView from './SpreadsheetView';

function DatabaseOverviewPage({ selectedDb, selectedTable, onSelectDb, onSelectTable }) {
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadDatabases = () => {
    setLoading(true);
    fetchJSON('/admin/api/databases')
      .then(data => {
        setDatabases(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load databases', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDatabases();
  }, []);

  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    if (!newDbName.trim()) return;
    setCreating(true);
    setErrorMsg('');
    try {
      const res = await fetchJSON('/admin/api/databases', {
        method: 'POST',
        body: JSON.stringify({ name: newDbName })
      });
      setShowCreateModal(false);
      setNewDbName('');
      setCreating(false);
      loadDatabases();
      // 생성된 DB 바로 선택
      if (res.database && res.database.name) {
        onSelectDb(res.database.name);
      }
    } catch (err) {
      setErrorMsg(err.message || '데이터베이스 생성 실패');
      setCreating(false);
    }
  };

  // Case 1: 특정 데이터베이스가 선택된 경우 -> 해당 DB의 테이블 목록 및 스프레드시트 뷰 표시
  if (selectedDb) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* DB 콤팩트 상단 서브 헤더 */}
        <div style={{
          height: '40px',
          backgroundColor: 'var(--gcp-bg-header)',
          borderBottom: '1px solid var(--gcp-border)',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          padding: '0 16px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="gcp-btn gcp-btn-secondary" 
              onClick={() => { onSelectDb(null); onSelectTable(''); }}
              style={{ padding: '3px 8px', fontSize: '11.5px' }}
            >
              ← DB 목록으로 돌아가기
            </button>
            <span style={{ color: 'var(--gcp-border)' }}>|</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gcp-text-primary)' }}>
              🗄️ 데이터베이스: <span style={{ color: 'var(--gcp-accent)' }}>{selectedDb}</span>
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
            선택된 테이블: <strong style={{ color: 'var(--gcp-text-primary)' }}>{selectedTable || '선택 안 됨'}</strong>
          </div>
        </div>

        {/* 좌측 테이블 Explorer + 우측 Spreadsheet View */}
        <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          <aside style={{
            width: '230px',
            backgroundColor: 'var(--gcp-bg-sidebar)',
            borderRight: '1px solid var(--gcp-border)',
            padding: '12px',
            flexShrink: 0,
            overflowY: 'auto'
          }}>
            <TableList dbName={selectedDb} selectedTable={selectedTable} onSelect={onSelectTable} />
          </aside>

          <main style={{ flexGrow: 1, overflow: 'hidden', backgroundColor: 'var(--gcp-bg-main)' }}>
            <SpreadsheetView dbName={selectedDb} tableName={selectedTable} />
          </main>
        </div>
      </div>
    );
  }

  // Case 2: 특정 DB 미선택 시 -> 데이터베이스 요약 정보 목록 및 생성 페이지
  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header section */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--gcp-text-primary)' }}>데이터베이스 요약 및 관리</h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
            서버에 등록된 SQLite 데이터베이스 목록과 요약 정보를 확인하고 신규 DB를 생성합니다.
          </p>
        </div>
        <button className="gcp-btn" onClick={() => setShowCreateModal(true)}>
          + 새 데이터베이스 생성
        </button>
      </div>

      {/* Database Table View */}
      <div style={{ backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', backgroundColor: 'var(--gcp-bg-header)', borderBottom: '1px solid var(--gcp-border)', fontWeight: 600, fontSize: '13px' }}>
          등록된 SQLite 데이터베이스 목록 ({databases.length})
        </div>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>데이터베이스 정보 읽는 중...</div>
        ) : databases.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>등록된 데이터베이스 파일이 없습니다. 새 DB를 생성하세요.</div>
        ) : (
          <table className="gcp-table">
            <thead>
              <tr>
                <th>데이터베이스 파일명</th>
                <th>크기 (Size)</th>
                <th>테이블 수</th>
                <th>저널 모드 (Journal Mode)</th>
                <th>최종 수정일시</th>
                <th>상태</th>
                <th style={{ textAlign: 'right' }}>관리 및 조작</th>
              </tr>
            </thead>
            <tbody>
              {databases.map((db, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: 'var(--gcp-accent)', cursor: 'pointer' }} onClick={() => onSelectDb(db.name)}>
                    🗄️ {db.name}
                  </td>
                  <td>{db.sizeFormatted}</td>
                  <td><span className="gcp-badge gcp-badge-active">{db.tablesCount} 개 테이블</span></td>
                  <td style={{ fontFamily: 'monospace' }}>{db.journalMode.toUpperCase()}</td>
                  <td style={{ color: 'var(--gcp-text-secondary)', fontSize: '11.5px' }}>
                    {new Date(db.updatedAt).toLocaleString('ko-KR')}
                  </td>
                  <td><span className="gcp-badge gcp-badge-active">● ACTIVE</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="gcp-btn" 
                      style={{ padding: '3px 10px', fontSize: '11px' }}
                      onClick={() => onSelectDb(db.name)}
                    >
                      테이블 관리 →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 새 데이터베이스 생성 모달 */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--gcp-bg-card)',
            border: '1px solid var(--gcp-border)',
            borderRadius: '6px',
            width: '420px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--gcp-text-primary)' }}>신규 SQLite 데이터베이스 생성</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
              생성할 데이터베이스 파일 이름을 입력하세요. (예: `app_logs.db`, `user_data.db`)
            </p>
            {errorMsg && (
              <div style={{ padding: '8px 12px', backgroundColor: 'rgba(242,139,130,0.2)', border: '1px solid var(--gcp-status-red)', color: 'var(--gcp-status-red)', borderRadius: '4px', fontSize: '12px', marginBottom: '12px' }}>
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleCreateDatabase}>
              <input
                type="text"
                placeholder="데이터베이스 이름 (예: my_database.db)"
                value={newDbName}
                onChange={e => setNewDbName(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: 'var(--gcp-bg-main)',
                  border: '1px solid var(--gcp-border)',
                  color: 'var(--gcp-text-primary)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  marginBottom: '16px',
                  outline: 'none'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button 
                  type="button" 
                  className="gcp-btn gcp-btn-secondary" 
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="gcp-btn"
                  disabled={creating || !newDbName.trim()}
                >
                  {creating ? '생성 중...' : '데이터베이스 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DatabaseOverviewPage;
