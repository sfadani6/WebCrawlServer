import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';

function SchedulerPage({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', workflow_id: '', cron_expression: '', interval_seconds: '', overlap_policy: 'skip' });

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      // 향후 스케줄러 목록 전용 API 경로로 교체 예정
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
        workflow_id: form.workflow_id ? Number(form.workflow_id) : null,
        cron_expression: form.cron_expression || null,
        interval_seconds: form.interval_seconds ? Number(form.interval_seconds) : null,
        overlap_policy: form.overlap_policy,
        status: 'waiting'
      };
      // scheduler 전용 엔드포인트가 필요함
      alert('스케줄러 전용 API가 아직 연결되지 않았습니다.');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', margin: '0 0 8px 0' }}>스케줄러 (Cron)</h1>
        <p style={{ margin: 0, color: 'var(--gcp-text-secondary)', fontSize: '13px' }}>
          Cron 작업 CRUD, 실행 이력
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(255, 138, 128, 0.12)', color: '#ff8a80', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input
          placeholder="작업 이름"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '160px' }}
        />
        <input
          placeholder="워크플로우 ID"
          value={form.workflow_id}
          onChange={(e) => setForm({ ...form, workflow_id: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '120px' }}
        />
        <input
          placeholder="Cron Expression"
          value={form.cron_expression}
          onChange={(e) => setForm({ ...form, cron_expression: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '160px' }}
        />
        <select
          value={form.overlap_policy}
          onChange={(e) => setForm({ ...form, overlap_policy: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '140px' }}
        >
          <option value="skip">skip</option>
          <option value="queue">queue</option>
          <option value="parallel">parallel</option>
        </select>
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
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>워크플로우ID</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>Cron</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>정책</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>불러오는 중...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>스케줄 작업이 없습니다.</td></tr>
            )}
            {items.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--gcp-border)' }}>
                <td style={{ padding: '10px 12px' }}>{s.id}</td>
                <td style={{ padding: '10px 12px' }}>{s.name}</td>
                <td style={{ padding: '10px 12px' }}>{s.workflow_id ?? '-'}</td>
                <td style={{ padding: '10px 12px' }}>{s.cron_expression ?? '-'}</td>
                <td style={{ padding: '10px 12px' }}>{s.overlap_policy}</td>
                <td style={{ padding: '10px 12px' }}>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SchedulerPage;