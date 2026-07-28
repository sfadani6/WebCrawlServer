import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';

function ModulesPage({ onNavigate }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', type: '', config: '', tags: '' });
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchJSON('/api/stats');
      // 모듈 목록은 별도 엔드포인트가 없으므로 필요 시 /admin/api/modules로 확장 가능
      setModules([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const body = {
        name: form.name.trim(),
        type: form.type.trim(),
        config: form.config || null,
        tags: form.tags || null,
        is_active: 1
      };
      // 현재 모듈 전용 엔드포인트가 없으므로 adminDb의 범용 CRUD를 활용하는 구조로 구현
      // 실제 구현 시 모듈 관리 전용 API가 필요함
      alert('모듈 전용 API가 아직 연결되지 않았습니다.');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', margin: '0 0 8px 0' }}>모듈 관리</h1>
        <p style={{ margin: 0, color: 'var(--gcp-text-secondary)', fontSize: '13px' }}>
          모듈 CRUD, 상태 조회 및 구성 관리
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(255, 138, 128, 0.12)', color: '#ff8a80', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input
          placeholder="모듈 이름"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '160px' }}
        />
        <input
          placeholder="타입"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          required
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '120px' }}
        />
        <input
          placeholder="태그(콤마 구분)"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '160px' }}
        />
        <textarea
          placeholder="config(json)"
          value={form.config}
          onChange={(e) => setForm({ ...form, config: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '260px', minHeight: '60px' }}
        />
        <button type="submit" style={{ padding: '8px 12px', background: 'var(--gcp-accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {editingId ? '수정' : '생성'}
        </button>
        {editingId && (
          <button type="button" onClick={() => setEditingId(null)} style={{ padding: '8px 12px', background: 'var(--gcp-bg-hover)', color: 'var(--gcp-text-primary)', border: '1px solid var(--gcp-border)', borderRadius: '4px', cursor: 'pointer' }}>
            취소
          </button>
        )}
      </form>

      <div style={{ border: '1px solid var(--gcp-border)', borderRadius: '6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--gcp-bg-header)', color: 'var(--gcp-text-secondary)' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>ID</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>이름</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>타입</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>태그</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>생성일</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>불러오는 중...</td></tr>
            )}
            {!loading && modules.length === 0 && (
              <tr><td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>모듈이 없습니다.</td></tr>
            )}
            {modules.map((m) => (
              <tr key={m.id} style={{ borderTop: '1px solid var(--gcp-border)' }}>
                <td style={{ padding: '10px 12px' }}>{m.id}</td>
                <td style={{ padding: '10px 12px' }}>{m.name}</td>
                <td style={{ padding: '10px 12px' }}>{m.type}</td>
                <td style={{ padding: '10px 12px' }}>{m.tags}</td>
                <td style={{ padding: '10px 12px' }}>{m.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ModulesPage;