import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';

function LogsPage({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({ type: 'activity', source: '', status: '' });

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      // 향후 로그 목록 전용 API 경로로 교체 예정
      setItems([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', margin: '0 0 8px 0' }}>활동 및 에러 로그</h1>
        <p style={{ margin: 0, color: 'var(--gcp-text-secondary)', fontSize: '13px' }}>
          활동 로그/에러 로그 조회, 필터링
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(255, 138, 128, 0.12)', color: '#ff8a80', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)' }}
        >
          <option value="activity">활동 로그</option>
          <option value="error">에러 로그</option>
        </select>
        <input
          placeholder="소스 필터"
          value={filter.source}
          onChange={(e) => setFilter({ ...filter, source: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '160px' }}
        />
        <input
          placeholder="상태 필터"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '120px' }}
        />
      </div>

      <div style={{ border: '1px solid var(--gcp-border)', borderRadius: '6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--gcp-bg-header)', color: 'var(--gcp-text-secondary)' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>ID</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>소스</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>액션</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>상태</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>메시지</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>생성일</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>불러오는 중...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>로그가 없습니다.</td></tr>
            )}
            {items.map((log) => (
              <tr key={log.id} style={{ borderTop: '1px solid var(--gcp-border)' }}>
                <td style={{ padding: '10px 12px' }}>{log.id}</td>
                <td style={{ padding: '10px 12px' }}>{log.source}</td>
                <td style={{ padding: '10px 12px' }}>{log.action}</td>
                <td style={{ padding: '10px 12px' }}>{log.status}</td>
                <td style={{ padding: '10px 12px', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</td>
                <td style={{ padding: '10px 12px' }}>{log.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LogsPage;