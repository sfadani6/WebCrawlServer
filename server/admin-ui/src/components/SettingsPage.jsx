import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';

function SettingsPage() {
  const [configList, setConfigList] = useState([]);
  const [configAttrs, setConfigAttrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirtyRows, setDirtyRows] = useState({});
  const [savingRows, setSavingRows] = useState({});

  // 속성 정의 모달 상태
  const [showAttrModal, setShowAttrModal] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrDesc, setNewAttrDesc] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchJSON('/admin/api/config'),
      fetchJSON('/admin/api/configattr')
    ]).then(([configs, attrs]) => {
      setConfigList(Array.isArray(configs) ? configs : []);
      setConfigAttrs(Array.isArray(attrs) ? attrs : []);
      setDirtyRows({});
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load settings data', err);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCellChange = (rowIndex, field, value) => {
    const updated = [...configList];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };
    setConfigList(updated);

    const rowIdx = updated[rowIndex].idx || `new_${rowIndex}`;
    setDirtyRows(prev => ({ ...prev, [rowIdx]: true }));
  };

  const handleSaveRow = async (rowIndex) => {
    const rowObj = configList[rowIndex];
    const rowIdx = rowObj.idx;

    if (!rowObj.attr_id) {
      alert('속성을 선택해야 합니다.');
      return;
    }

    setSavingRows(prev => ({ ...prev, [rowIdx]: true }));

    try {
      if (rowIdx) {
        // 기존 행 수정
        await fetchJSON(`/admin/api/config/${rowIdx}`, {
          method: 'PUT',
          body: JSON.stringify(rowObj)
        });
      } else {
        // 신규 행 추가
        await fetchJSON('/admin/api/config', {
          method: 'POST',
          body: JSON.stringify(rowObj)
        });
      }
      loadData();
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
      setSavingRows(prev => {
        const next = { ...prev };
        delete next[rowIdx];
        return next;
      });
    }
  };

  const handleDeleteRow = async (rowIndex) => {
    const rowObj = configList[rowIndex];
    const rowIdx = rowObj.idx;

    if (!window.confirm(`선택한 설정 항목을 정말 삭제하시겠습니까?`)) return;

    try {
      if (rowIdx) {
        await fetchJSON(`/admin/api/config/${rowIdx}`, { method: 'DELETE' });
      }
      loadData();
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  const handleAddConfigRow = () => {
    const defaultAttrId = configAttrs.length > 0 ? configAttrs[0].idx : 1;
    setConfigList([
      ...configList,
      {
        attr_id: defaultAttrId,
        val1: '',
        val2: '',
        memo: '',
        created_at: new Date().toISOString()
      }
    ]);
  };

  const handleClearAllConfig = async () => {
    if (!window.confirm('경고: config 테이블의 모든 설정 데이터를 초기화하시겠습니까?')) return;
    try {
      await fetchJSON('/admin/api/config_clear', { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(`초기화 실패: ${err.message}`);
    }
  };

  const handleAddAttrSubmit = async (e) => {
    e.preventDefault();
    if (!newAttrName.trim()) return;
    try {
      await fetchJSON('/admin/api/configattr', {
        method: 'POST',
        body: JSON.stringify({ name: newAttrName.trim(), description: newAttrDesc.trim() })
      });
      setNewAttrName('');
      setNewAttrDesc('');
      loadData();
    } catch (err) {
      alert(`속성 추가 실패: ${err.message}`);
    }
  };

  const handleDeleteAttr = async (attrIdx) => {
    if (!window.confirm('이 속성을 삭제하시겠습니까? 연결된 설정 항목들도 영향을 받을 수 있습니다.')) return;
    try {
      await fetchJSON(`/admin/api/configattr/${attrIdx}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(`속성 삭제 실패: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header section */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--gcp-text-primary)' }}>
            시스템 환경 설정 (main.db - config / configattr)
          </h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
            서버 기동 시 참조하는 브라우저, 크롤러, 시스템 전반의 환경 속성 및 설정 값을 조작합니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="gcp-btn gcp-btn-secondary" onClick={() => setShowAttrModal(true)}>
            🏷️ 속성 정의 (configattr) 관리
          </button>
          <button className="gcp-btn gcp-btn-secondary" style={{ color: 'var(--gcp-status-red)', borderColor: 'rgba(242,139,130,0.3)' }} onClick={handleClearAllConfig}>
            🗑️ 테이블 전체 삭제/초기화
          </button>
          <button className="gcp-btn" onClick={handleAddConfigRow}>
            + 설정 항목 추가
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div style={{ backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', backgroundColor: 'var(--gcp-bg-header)', borderBottom: '1px solid var(--gcp-border)', fontWeight: 600, fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
          <span>설정 데이터 그리드 목록 ({configList.length}건)</span>
          {Object.keys(dirtyRows).length > 0 && (
            <span className="gcp-badge gcp-badge-warn">● {Object.keys(dirtyRows).length}개 항목 변경됨</span>
          )}
        </div>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>설정 데이터 읽는 중...</div>
        ) : configList.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>
            등록된 설정 항목이 없습니다. '+ 설정 항목 추가' 버튼을 눌러 새 설정을 구성하세요.
          </div>
        ) : (
          <table className="gcp-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>idx</th>
                <th style={{ width: '180px' }}>속성 (configattr 매핑)</th>
                <th>문자열 필드 1 (val1)</th>
                <th>문자열 필드 2 (val2)</th>
                <th>메모 (memo)</th>
                <th style={{ width: '150px' }}>등록 날짜</th>
                <th style={{ width: '130px', textAlign: 'right' }}>행 작업</th>
              </tr>
            </thead>
            <tbody>
              {configList.map((row, idx) => {
                const rowKey = row.idx || `new_${idx}`;
                const isDirty = !!dirtyRows[rowKey];
                const isSaving = !!savingRows[rowKey];

                return (
                  <tr key={rowKey} style={{ backgroundColor: isDirty ? 'rgba(253, 214, 99, 0.08)' : undefined }}>
                    <td style={{ textAlign: 'center', color: 'var(--gcp-text-secondary)', fontSize: '11.5px', fontFamily: 'monospace' }}>
                      {row.idx || '신규'}
                    </td>
                    <td>
                      {/* 속성 드롭다운 (configattr idx 와 매핑) */}
                      <select
                        value={row.attr_id || ''}
                        onChange={e => handleCellChange(idx, 'attr_id', parseInt(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          backgroundColor: 'var(--gcp-bg-main)',
                          border: '1px solid var(--gcp-border)',
                          color: 'var(--gcp-text-primary)',
                          borderRadius: '3px',
                          fontSize: '12px'
                        }}
                      >
                        {configAttrs.map(attr => (
                          <option key={attr.idx} value={attr.idx}>
                            {attr.name} (id:{attr.idx})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="예: 브라우저 실행 위치"
                        value={row.val1 || ''}
                        onChange={e => handleCellChange(idx, 'val1', e.target.value)}
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
                        onFocus={(e) => { e.target.style.borderColor = 'var(--gcp-accent)'; e.target.style.backgroundColor = 'var(--gcp-bg-main)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="예: 실행 인자"
                        value={row.val2 || ''}
                        onChange={e => handleCellChange(idx, 'val2', e.target.value)}
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
                        onFocus={(e) => { e.target.style.borderColor = 'var(--gcp-accent)'; e.target.style.backgroundColor = 'var(--gcp-bg-main)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="메모 / 설명"
                        value={row.memo || ''}
                        onChange={e => handleCellChange(idx, 'memo', e.target.value)}
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
                        onFocus={(e) => { e.target.style.borderColor = 'var(--gcp-accent)'; e.target.style.backgroundColor = 'var(--gcp-bg-main)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
                      />
                    </td>
                    <td style={{ color: 'var(--gcp-text-secondary)', fontSize: '11.5px' }}>
                      {row.created_at ? new Date(row.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
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
                          onClick={() => handleSaveRow(idx)}
                          disabled={isSaving}
                        >
                          {isSaving ? '저장 중' : isDirty ? '저장*' : '저장'}
                        </button>
                        <button
                          className="gcp-btn gcp-btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--gcp-status-red)', borderColor: 'rgba(242,139,130,0.3)' }}
                          onClick={() => handleDeleteRow(idx)}
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
        )}
      </div>

      {/* 속성 정의 (configattr) 모달 */}
      {showAttrModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--gcp-bg-card)',
            border: '1px solid var(--gcp-border)',
            borderRadius: '6px',
            width: '540px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--gcp-text-primary)' }}>
              속성 정의 (configattr 테이블) 관리
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
              `config` 테이블의 '속성' 필드 드롭다운에서 참조되는 정의 목록입니다.
            </p>

            {/* 신규 속성 추가 폼 */}
            <form onSubmit={handleAddAttrSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="속성 이름 (예: 브라우저, 크롤러)"
                value={newAttrName}
                onChange={e => setNewAttrName(e.target.value)}
                style={{ flex: 1, padding: '6px 8px', backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', color: 'var(--gcp-text-primary)', borderRadius: '4px', fontSize: '12px' }}
              />
              <input
                type="text"
                placeholder="설명 (선택)"
                value={newAttrDesc}
                onChange={e => setNewAttrDesc(e.target.value)}
                style={{ flex: 1.5, padding: '6px 8px', backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', color: 'var(--gcp-text-primary)', borderRadius: '4px', fontSize: '12px' }}
              />
              <button type="submit" className="gcp-btn" disabled={!newAttrName.trim()} style={{ padding: '6px 12px' }}>
                + 추가
              </button>
            </form>

            {/* 속성 정의 목록 */}
            <div style={{ flexGrow: 1, overflowY: 'auto', border: '1px solid var(--gcp-border)', borderRadius: '4px' }}>
              <table className="gcp-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>idx</th>
                    <th>속성 이름</th>
                    <th>설명</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {configAttrs.map(attr => (
                    <tr key={attr.idx}>
                      <td style={{ fontFamily: 'monospace' }}>{attr.idx}</td>
                      <td style={{ fontWeight: 600, color: 'var(--gcp-accent)' }}>{attr.name}</td>
                      <td style={{ color: 'var(--gcp-text-secondary)', fontSize: '11.5px' }}>{attr.description || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--gcp-status-red)', cursor: 'pointer', fontSize: '12px' }}
                          onClick={() => handleDeleteAttr(attr.idx)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="gcp-btn gcp-btn-secondary" onClick={() => setShowAttrModal(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
