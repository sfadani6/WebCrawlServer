import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';

function WorkflowsPage({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', yaml_content: '', module_id: '' });
  const [modules, setModules] = useState([]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      // 향후 워크플로우 목록 전용 API 경로로 교체 예정
      setItems([]);
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
        yaml_content: form.yaml_content,
        module_id: form.module_id ? Number(form.module_id) : null,
        is_active: 1
      };
      alert('워크플로우 전용 API가 아직 연결되지 않았습니다.');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', margin: '0 0 8px 0' }}>워크플로우 Engine</h1>
        <p style={{ margin: 0, color: 'var(--gcp-text-secondary)', fontSize: '13px' }}>
          YAML 편집, 실행, 모니터링
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(255, 138, 128, 0.12)', color: '#ff8a80', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input
          placeholder="워크플로우 이름"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '160px' }}
        />
        <input
          placeholder="모듈 ID"
          value={form.module_id}
          onChange={(e) => setForm({ ...form, module_id: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '100px' }}
        />
        <button type="submit" style={{ padding: '8px 12px', background: 'var(--gcp-accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          생성
        </button>
      </form>

      <div style={{ border: '1px solid var(--gcp-border)', borderRadius: '6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--gcp-bg-header)', color: 'var(--gcp-text-secondary)' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>ID</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>이름</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>모듈ID</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>활성</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>생성일</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>불러오는 중...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>워크플로우가 없습니다.</td></tr>
            )}
            {items.map((w) => (
              <tr key={w.id} style={{ borderTop: '1px solid var(--gcp-border)' }}>
                <td style={{ padding: '10px 12px' }}>{w.id}</td>
                <td style={{ padding: '10px 12px' }}>{w.name}</td>
                <td style={{ padding: '10px 12px' }}>{w.module_id ?? '-'}</td>
                <td style={{ padding: '10px 12px' }}>{w.is_active ? 'Y' : 'N'}</td>
                <td style={{ padding: '10px 12px' }}>{w.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WorkflowsPage;