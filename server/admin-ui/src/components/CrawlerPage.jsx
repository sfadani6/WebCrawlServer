import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';

function CrawlerPage({ onNavigate }) {
  const [targets, setTargets] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', url: '', kind: 'rss', interval_seconds: '' });
  const [selectedTargetId, setSelectedTargetId] = useState('');

  const loadTargets = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchJSON('/admin/api/crawler/targets');
      setTargets(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const targetId = selectedTargetId || undefined;
      const data = await fetchJSON(`/admin/api/crawler/items${targetId ? `?target_id=${targetId}` : ''}`);
      setItems(data || []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { loadTargets(); }, []);
  useEffect(() => { if (selectedTargetId) loadItems(); }, [selectedTargetId]);

  const handleCreateTarget = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const body = {
        name: form.name.trim(),
        url: form.url.trim(),
        kind: form.kind,
        interval_seconds: form.interval_seconds ? Number(form.interval_seconds) : 0
      };
      await fetchJSON('/admin/api/crawler/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setForm({ name: '', url: '', kind: 'rss', interval_seconds: '' });
      loadTargets();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', margin: '0 0 8px 0' }}>크롤러</h1>
        <p style={{ margin: 0, color: 'var(--gcp-text-secondary)', fontSize: '13px' }}>
          RSS/JSON 기반 크롤링 타겟 관리 및 결과 조회
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(255, 138, 128, 0.12)', color: '#ff8a80', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleCreateTarget} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input
          placeholder="타겟 이름"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '160px' }}
        />
        <input
          placeholder="URL"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          required
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '260px' }}
        />
        <select
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)' }}
        >
          <option value="rss">RSS</option>
          <option value="json">JSON</option>
          <option value="page">Page</option>
        </select>
        <input
          placeholder="주기(초)"
          value={form.interval_seconds}
          onChange={(e) => setForm({ ...form, interval_seconds: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)', minWidth: '100px' }}
        />
        <button type="submit" style={{ padding: '8px 12px', background: 'var(--gcp-accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          타겟 생성
        </button>
      </form>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select
          value={selectedTargetId}
          onChange={(e) => setSelectedTargetId(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid var(--gcp-border)', borderRadius: '4px', background: 'var(--gcp-bg-main)', color: 'var(--gcp-text-primary)' }}
        >
          <option value="">타겟 선택</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.kind})</option>
          ))}
        </select>
      </div>

      <div style={{ border: '1px solid var(--gcp-border)', borderRadius: '6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--gcp-bg-header)', color: 'var(--gcp-text-secondary)' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>ID</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>이름</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>URL</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>종류</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>주기(초)</th>
              <th style={{ textAlign: 'left', padding: '10px 12px' }}>최근확인</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>불러오는 중...</td></tr>
            )}
            {!loading && targets.length === 0 && (
              <tr><td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>크롤러 타겟이 없습니다.</td></tr>
            )}
            {targets.map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--gcp-border)' }}>
                <td style={{ padding: '10px 12px' }}>{t.id}</td>
                <td style={{ padding: '10px 12px' }}>{t.name}</td>
                <td style={{ padding: '10px 12px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.url}</td>
                <td style={{ padding: '10px 12px' }}>{t.kind}</td>
                <td style={{ padding: '10px 12px' }}>{t.interval_seconds ?? '-'}</td>
                <td style={{ padding: '10px 12px' }}>{t.last_checked_at ? new Date(t.last_checked_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTargetId && (
        <div style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '16px', margin: '0 0 8px 0' }}>아이템 목록</h2>
          <div style={{ border: '1px solid var(--gcp-border)', borderRadius: '6px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--gcp-bg-header)', color: 'var(--gcp-text-secondary)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>제목</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>내용</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>발행일</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>수집일</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: 'var(--gcp-text-secondary)' }}>아이템이 없습니다.</td></tr>
                )}
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid var(--gcp-border)' }}>
                    <td style={{ padding: '10px 12px' }}>{item.id}</td>
                    <td style={{ padding: '10px 12px' }}>{item.title}</td>
                    <td style={{ padding: '10px 12px', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.content}</td>
                    <td style={{ padding: '10px 12px' }}>{item.published_at ? new Date(item.published_at).toLocaleString() : '-'}</td>
                    <td style={{ padding: '10px 12px' }}>{new Date(item.fetched_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default CrawlerPage;