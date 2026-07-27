import React, { useState, useEffect, useCallback } from 'react';
import { fetchJSON } from '../api';

// 인라인 토큰 표시 컴포넌트 (승인된 플러그인 행 아래에 표시)
function InlineToken({ token, onDismiss }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <tr>
      <td colSpan={6} style={{ padding: '0', borderTop: 'none' }}>
        <div style={{
          backgroundColor: 'rgba(26, 115, 232, 0.08)',
          border: '1px solid rgba(26, 115, 232, 0.35)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', whiteSpace: 'nowrap' }}>
            🔑 발급된 토큰 (한 번만 표시됨)
          </span>
          <code style={{
            flex: 1, fontFamily: 'monospace', fontSize: '12px',
            color: 'var(--gcp-accent)', wordBreak: 'break-all'
          }}>
            {token}
          </code>
          <button
            className="gcp-btn"
            style={{ padding: '3px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
            onClick={handleCopy}
          >
            {copied ? '✅ 복사됨' : '📋 복사'}
          </button>
          <button
            className="gcp-btn gcp-btn-secondary"
            style={{ padding: '3px 8px', fontSize: '11px' }}
            onClick={onDismiss}
            title="토큰 닫기"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}


// 플러그인 연결 절차를 화면에 항상 노출하는 안내 컴포넌트
function ConnectionGuide({ wsUrl, pendingCount, approvedCount }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(wsUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const steps = [
    '브라우저 확장 프로그램의 옵션 페이지를 엽니다.',
    '서버 주소에 아래 WebSocket URL을 입력하고 저장합니다.',
    '확장 프로그램에서 연결 버튼을 누르면 이 화면의 승인 대기 탭에 요청이 표시됩니다.',
    '승인 버튼을 누르면 플러그인이 승인 토큰을 받아 WebSocket에 연결합니다.'
  ];

  return (
    <div style={{
      backgroundColor: 'rgba(26, 115, 232, 0.08)',
      border: '1px solid rgba(26, 115, 232, 0.35)',
      borderRadius: '4px',
      padding: '14px 16px',
      marginBottom: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--gcp-text-primary)', marginBottom: '8px' }}>
            💬 연결 도우미
          </div>
          <div style={{ fontSize: '12px', color: 'var(--gcp-text-secondary)', lineHeight: '1.7', marginBottom: '10px' }}>
            채팅창처럼 별도 메시지를 입력하는 방식이 아니라, 브라우저 플러그인이 먼저 연결 요청을 보내고 관리자가 승인하는 방식입니다.
            현재 화면에서 바로 확인해야 할 단계는 아래 순서입니다.
          </div>
          <ol style={{ margin: '0 0 0 18px', padding: 0, fontSize: '12px', color: 'var(--gcp-text-primary)', lineHeight: '1.8' }}>
            {steps.map(step => <li key={step}>{step}</li>)}
          </ol>
        </div>
        <div style={{ minWidth: '280px', backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', borderRadius: '4px', padding: '10px 12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', marginBottom: '6px' }}>복사할 서버 주소</div>
          <code style={{ display: 'block', fontFamily: 'monospace', fontSize: '12.5px', color: 'var(--gcp-accent)', marginBottom: '10px', wordBreak: 'break-all' }}>
            {wsUrl}
          </code>
          <button className="gcp-btn" onClick={handleCopy} style={{ width: '100%', justifyContent: 'center' }}>
            {copied ? '✅ 복사됨' : '📋 WebSocket URL 복사'}
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
            <div>승인 대기: <strong style={{ color: 'var(--gcp-text-primary)' }}>{pendingCount}</strong></div>
            <div>승인됨: <strong style={{ color: 'var(--gcp-text-primary)' }}>{approvedCount}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PluginsPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingList, setPendingList] = useState([]);
  const [approvedList, setApprovedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newTokens, setNewTokens] = useState({}); // { [id]: token } — 승인 직후 인라인 표시용
  const [actionLoading, setActionLoading] = useState({}); // { [id]: true }

  // WebSocket 서버 URL (현재 호스트 기반)
  const serverPort = window.location.port || '9600';
  const wsUrl = `ws://${window.location.hostname}:${serverPort}`;

  const loadPending = useCallback(async () => {
    try {
      const data = await fetchJSON('/api/plugin/pending');
      setPendingList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[PluginsPage] 승인 대기 목록 조회 실패:', err);
    }
  }, []);

  const loadApproved = useCallback(async () => {
    try {
      const data = await fetchJSON('/api/plugin/approved');
      setApprovedList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[PluginsPage] 승인된 목록 조회 실패:', err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadPending(), loadApproved()]);
    } catch (err) {
      setError('데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [loadPending, loadApproved]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleApprove = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const result = await fetchJSON(`/api/plugin/${id}/approve`, { method: 'POST' });
      // 토큰을 인라인으로 표시하기 위해 newTokens에 저장
      setNewTokens(prev => ({ ...prev, [id]: result.token }));
      await loadPending();
      await loadApproved();
      // 승인 후 '연결된 플러그인' 탭으로 자동 전환
      setActiveTab('approved');
    } catch (err) {
      alert(`승인 실패: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('이 플러그인 요청을 거부하시겠습니까?')) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await fetchJSON(`/api/plugin/${id}/reject`, { method: 'POST' });
      await loadPending();
    } catch (err) {
      alert(`거부 실패: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDisconnect = async (id) => {
    if (!window.confirm('이 플러그인 연결을 종료하시겠습니까?')) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await fetchJSON(`/api/plugin/${id}/disconnect`, { method: 'POST' });
      await loadApproved();
    } catch (err) {
      alert(`연결 종료 실패: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleCreateTestRequest = async () => {
    try {
      const result = await fetchJSON('/api/plugin/request', {
        method: 'POST',
        body: JSON.stringify({
          browser_name: 'Admin Test Browser',
          browser_version: 'test',
          extension_id: 'admin-test-extension',
          hostname: 'admin-ui-test'
        })
      });

      if (result?.requestId) {
        await loadPending();
        alert(`테스트 요청이 생성되었습니다. ID: ${result.requestId}`);
      } else {
        throw new Error('요청 ID를 받지 못했습니다.');
      }
    } catch (err) {
      alert(`테스트 요청 생성 실패: ${err.message}`);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('ko-KR', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const truncate = (str, max = 28) => {
    if (!str) return '—';
    return str.length > max ? str.slice(0, max) + '…' : str;
  };

  return (
    <div style={{ padding: '20px 24px' }}>

      {/* 상단 헤더 */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--gcp-text-primary)' }}>
            🔌 플러그인 관리
          </h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
            브라우저 플러그인의 연결 요청을 승인하고 현재 연결 상태를 관리합니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="gcp-btn"
            onClick={handleCreateTestRequest}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🧪 테스트 요청 생성
          </button>
          <button
            className="gcp-btn gcp-btn-secondary"
            onClick={loadAll}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {loading ? '⏳' : '🔄'} 새로고침
          </button>
        </div>
      </div>

      <ConnectionGuide wsUrl={wsUrl} pendingCount={pendingList.length} approvedCount={approvedList.length} />

      {/* 서버 연결 정보 패널 */}
      <div style={{
        backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)',
        borderRadius: '4px', padding: '14px 16px', marginBottom: '16px'
      }}>
        <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--gcp-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          📡 서버 연결 정보
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', borderRadius: '4px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', marginBottom: '4px' }}>WebSocket URL</div>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--gcp-accent)', fontWeight: 600 }}>
              {wsUrl}
            </div>
          </div>
          <div style={{ backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', borderRadius: '4px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', marginBottom: '4px' }}>승인 대기</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: pendingList.length > 0 ? 'var(--gcp-status-yellow)' : 'var(--gcp-text-primary)' }}>
              {pendingList.length} 건
            </div>
          </div>
          <div style={{ backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', borderRadius: '4px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)', marginBottom: '4px' }}>승인된 플러그인</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: approvedList.length > 0 ? 'var(--gcp-status-green)' : 'var(--gcp-text-primary)' }}>
              {approvedList.length} 개
            </div>
          </div>
        </div>
        <div style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--gcp-text-secondary)', lineHeight: '1.6' }}>
          플러그인 옵션 페이지에서 <strong style={{ color: 'var(--gcp-text-primary)' }}>서버 주소</strong>를 위 WebSocket 주소로 설정한 뒤 확장 프로그램의 연결 버튼을 누르세요.
          연결 요청이 들어오면 승인 대기 탭에서 승인할 수 있습니다.
        </div>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(234,67,53,0.1)', border: '1px solid var(--gcp-status-red)',
          borderRadius: '4px', padding: '10px 14px', marginBottom: '12px',
          fontSize: '12px', color: 'var(--gcp-status-red)'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--gcp-border)' }}>
        {[
          { id: 'pending', label: `승인 대기 (${pendingList.length})` },
          { id: 'approved', label: `연결된 플러그인 (${approvedList.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '9px 16px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--gcp-accent)' : 'var(--gcp-text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--gcp-accent)' : '2px solid transparent',
              marginBottom: '-1px', transition: 'color 0.1s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div style={{
        backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)',
        borderTop: 'none', borderRadius: '0 0 4px 4px', overflow: 'hidden'
      }}>
        {/* 승인 대기 탭 */}
        {activeTab === 'pending' && (
          pendingList.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--gcp-text-secondary)', fontSize: '13px' }}>
              {loading ? '⏳ 불러오는 중...' : '승인 대기 중인 플러그인 요청이 없습니다. 위 연결 도우미의 순서대로 확장 프로그램에서 연결 버튼을 눌러 요청을 생성하세요.'}
            </div>
          ) : (
            <table className="gcp-table">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>ID</th>
                  <th style={{ width: '130px' }}>브라우저</th>
                  <th>Extension ID</th>
                  <th style={{ width: '140px' }}>호스트명</th>
                  <th style={{ width: '140px' }}>요청 일시</th>
                  <th style={{ width: '160px', textAlign: 'right' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {pendingList.map(item => (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--gcp-text-secondary)', fontFamily: 'monospace' }}>{item.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--gcp-text-primary)' }}>
                        {item.browser_name || '—'}
                      </div>
                      {item.browser_version && (
                        <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
                          v{item.browser_version}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}
                        title={item.extension_id}
                      >
                        {truncate(item.extension_id)}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
                      {item.hostname || '—'}
                    </td>
                    <td style={{ fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>
                      {formatDate(item.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          className="gcp-btn"
                          style={{ padding: '3px 10px', fontSize: '11px' }}
                          onClick={() => handleApprove(item.id)}
                          disabled={actionLoading[item.id]}
                        >
                          {actionLoading[item.id] ? '⏳' : '✅ 승인'}
                        </button>
                        <button
                          className="gcp-btn gcp-btn-secondary"
                          style={{ padding: '3px 10px', fontSize: '11px', color: 'var(--gcp-status-red)', borderColor: 'var(--gcp-status-red)' }}
                          onClick={() => handleReject(item.id)}
                          disabled={actionLoading[item.id]}
                        >
                          🚫 거부
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* 연결된 플러그인 탭 */}
        {activeTab === 'approved' && (
          approvedList.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--gcp-text-secondary)', fontSize: '13px' }}>
              {loading ? '⏳ 불러오는 중...' : '승인된 플러그인이 없습니다. 승인 대기 탭에서 요청을 승인하세요.'}
            </div>
          ) : (
            <table className="gcp-table">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>ID</th>
                  <th style={{ width: '130px' }}>브라우저</th>
                  <th>Extension ID</th>
                  <th style={{ width: '140px' }}>호스트명</th>
                  <th style={{ width: '140px' }}>승인 일시</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {approvedList.map(item => (
                  <React.Fragment key={item.id}>
                    <tr>
                      <td style={{ color: 'var(--gcp-text-secondary)', fontFamily: 'monospace' }}>{item.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--gcp-text-primary)' }}>
                          {item.browser_name || '—'}
                        </div>
                        {item.browser_version && (
                          <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
                            v{item.browser_version}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}
                          title={item.extension_id}
                        >
                          {truncate(item.extension_id)}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--gcp-text-secondary)' }}>
                        {item.hostname || '—'}
                      </td>
                      <td style={{ fontSize: '11.5px', color: 'var(--gcp-text-secondary)' }}>
                        {formatDate(item.approved_at)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="gcp-btn gcp-btn-secondary"
                          style={{ padding: '3px 10px', fontSize: '11px', color: 'var(--gcp-status-red)', borderColor: 'var(--gcp-status-red)' }}
                          onClick={() => handleDisconnect(item.id)}
                          disabled={actionLoading[item.id]}
                        >
                          {actionLoading[item.id] ? '⏳' : '⛔ 연결 종료'}
                        </button>
                      </td>
                    </tr>
                    {/* 승인 직후 인라인 토큰 표시 */}
                    {newTokens[item.id] && (
                      <InlineToken
                        token={newTokens[item.id]}
                        onDismiss={() => setNewTokens(prev => {
                          const next = { ...prev };
                          delete next[item.id];
                          return next;
                        })}
                      />
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )
        )}

      </div>
    </div>
  );
}

export default PluginsPage;
