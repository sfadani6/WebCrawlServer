import React, { useState } from 'react';

const INITIAL_NODES = [
  { id: 'node_1', type: 'navigate', name: '페이지 이동 (navigate)', target: 'https://example.com', params: {}, x: 80, y: 100 },
  { id: 'node_2', type: 'waitFor', name: '요소 대기 (waitFor)', target: '#login-btn', params: { timeout: 5000 }, x: 340, y: 100 },
  { id: 'node_3', type: 'click', name: '버튼 클릭 (click)', target: '#login-btn', params: {}, x: 600, y: 100 },
  { id: 'node_4', type: 'extract', name: '데이터 추출 (extract)', target: '.content-title', params: { multiple: true }, x: 860, y: 100 }
];

const STEP_TYPES = [
  { type: 'navigate', label: '🌐 페이지 이동', defaultTarget: 'https://', icon: '🌐' },
  { type: 'waitFor', label: '⏳ 요소 대기', defaultTarget: '#selector', icon: '⏳' },
  { type: 'click', label: '🖱️ 클릭', defaultTarget: '.button', icon: '🖱️' },
  { type: 'input', label: '⌨️ 텍스트 입력', defaultTarget: 'input[name="q"]', icon: '⌨️' },
  { type: 'extract', label: '📊 데이터 추출', defaultTarget: '.item-title', icon: '📊' },
  { type: 'scroll', label: '📜 스크롤', defaultTarget: 'window', icon: '📜' },
  { type: 'condition', label: '🔀 조건 분기', defaultTarget: '${val} === true', icon: '🔀' },
  { type: 'loop', label: '🔁 반복', defaultTarget: '10', icon: '🔁' }
];

function VisualWorkflowEditor({ onNavigate }) {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [selectedNode, setSelectedNode] = useState(null);
  const [workflowName, setWorkflowName] = useState('웹 수집 자동화 워크플로우 #1');
  const [showJsonModal, setShowJsonModal] = useState(false);

  const handleAddNode = (stepTypeObj) => {
    const newNodeId = `node_${Date.now()}`;
    const lastNode = nodes[nodes.length - 1];
    const newX = lastNode ? lastNode.x + 240 : 100;
    const newY = lastNode ? lastNode.y : 100;

    const newNode = {
      id: newNodeId,
      type: stepTypeObj.type,
      name: `${stepTypeObj.label}`,
      target: stepTypeObj.defaultTarget,
      params: {},
      x: newX,
      y: newY
    };

    setNodes([...nodes, newNode]);
    setSelectedNode(newNode);
  };

  const handleUpdateNode = (id, field, value) => {
    const updated = nodes.map(n => n.id === id ? { ...n, [field]: value } : n);
    setNodes(updated);
    if (selectedNode && selectedNode.id === id) {
      setSelectedNode({ ...selectedNode, [field]: value });
    }
  };

  const handleDeleteNode = (id) => {
    setNodes(nodes.filter(n => n.id !== id));
    if (selectedNode && selectedNode.id === id) {
      setSelectedNode(null);
    }
  };

  const exportSteps = () => {
    return nodes.map((node, index) => ({
      stepId: index + 1,
      type: node.type,
      target: node.target,
      params: node.params
    }));
  };

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      {/* 상단 툴바 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px', backgroundColor: 'var(--gcp-bg-card)',
        padding: '12px 16px', border: '1px solid var(--gcp-border)', borderRadius: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>⚡</span>
          <div>
            <input
              type="text"
              value={workflowName}
              onChange={e => setWorkflowName(e.target.value)}
              style={{
                fontSize: '15px', fontWeight: 600, color: 'var(--gcp-text-primary)',
                backgroundColor: 'transparent', border: 'none', outline: 'none'
              }}
            />
            <div style={{ fontSize: '11px', color: 'var(--gcp-text-secondary)' }}>
              React Flow 스타일 드래그 앤 드롭 시각적 워크플로우 설계 캔버스
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="gcp-btn gcp-btn-secondary" onClick={() => setShowJsonModal(true)}>
            📄 JSON/YAML 내보내기
          </button>
          <button className="gcp-btn" onClick={() => alert('워크플로우가 저장되었습니다.')}>
            💾 워크플로우 저장
          </button>
        </div>
      </div>

      {/* 메인 에디터 영역 (팔레트 + 캔버스 + 속성 패널) */}
      <div style={{ display: 'flex', flexGrow: 1, gap: '16px', overflow: 'hidden' }}>
        {/* 왼쪽: 스텝 노드 팔레트 */}
        <div style={{
          width: '200px', backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)',
          borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0
        }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--gcp-text-secondary)', textTransform: 'uppercase' }}>
            노드 팔레트 (클릭하여 추가)
          </div>
          {STEP_TYPES.map(st => (
            <button
              key={st.type}
              className="gcp-btn gcp-btn-secondary"
              onClick={() => handleAddNode(st)}
              style={{ justifyContent: 'flex-start', fontSize: '12px', padding: '8px 10px' }}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* 중앙: 캔버스 영역 */}
        <div style={{
          flexGrow: 1, backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)',
          borderRadius: '6px', position: 'relative', overflow: 'auto', padding: '40px',
          backgroundImage: 'radial-gradient(var(--gcp-border) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '40px', position: 'relative' }}>
            {nodes.map((node, idx) => {
              const isSelected = selectedNode && selectedNode.id === node.id;
              return (
                <React.Fragment key={node.id}>
                  {/* 노드 카드 */}
                  <div
                    onClick={() => setSelectedNode(node)}
                    style={{
                      width: '200px',
                      backgroundColor: 'var(--gcp-bg-card)',
                      border: `2px solid ${isSelected ? 'var(--gcp-accent)' : 'var(--gcp-border)'}`,
                      borderRadius: '8px',
                      padding: '12px',
                      boxShadow: isSelected ? '0 0 12px rgba(138, 180, 248, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="gcp-badge gcp-badge-active" style={{ fontSize: '10px' }}>Step {idx + 1}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                        style={{ background: 'none', border: 'none', color: 'var(--gcp-status-red)', cursor: 'pointer', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--gcp-text-primary)', marginBottom: '4px' }}>
                      {node.name}
                    </div>

                    <div style={{
                      fontSize: '11px', color: 'var(--gcp-text-secondary)',
                      backgroundColor: 'var(--gcp-bg-main)', padding: '4px 6px', borderRadius: '4px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {node.target || '(경로/선택자 미지정)'}
                    </div>
                  </div>

                  {/* 노드간 연결 화살표 */}
                  {idx < nodes.length - 1 && (
                    <div style={{ fontSize: '20px', color: 'var(--gcp-accent)', flexShrink: 0 }}>
                      ➔
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {nodes.length === 0 && (
              <div style={{ color: 'var(--gcp-text-secondary)', fontSize: '13px', textAlign: 'center', width: '100%' }}>
                왼쪽 노드 팔레트에서 스텝을 추가하여 워크플로우를 구성하세요.
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 선택 노드 속성 편집 패널 */}
        <div style={{
          width: '260px', backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)',
          borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gcp-text-primary)', borderBottom: '1px solid var(--gcp-border)', paddingBottom: '8px' }}>
            ⚙️ 노드 속성 설정
          </div>

          {selectedNode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--gcp-text-secondary)', marginBottom: '4px' }}>
                  노드 타입
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedNode.type}
                  style={{ width: '100%', padding: '6px', backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', color: 'var(--gcp-text-secondary)', borderRadius: '4px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--gcp-text-secondary)', marginBottom: '4px' }}>
                  노드 라벨
                </label>
                <input
                  type="text"
                  value={selectedNode.name}
                  onChange={e => handleUpdateNode(selectedNode.id, 'name', e.target.value)}
                  style={{ width: '100%', padding: '6px', backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', color: 'var(--gcp-text-primary)', borderRadius: '4px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--gcp-text-secondary)', marginBottom: '4px' }}>
                  대상 URL / CSS 선택자 (Target)
                </label>
                <input
                  type="text"
                  value={selectedNode.target}
                  onChange={e => handleUpdateNode(selectedNode.id, 'target', e.target.value)}
                  style={{ width: '100%', padding: '6px', backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)', color: 'var(--gcp-text-primary)', borderRadius: '4px' }}
                />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--gcp-text-secondary)', textAlign: 'center', marginTop: '20px' }}>
              캔버스에서 노드를 선택하여 상세 속성을 수정하세요.
            </div>
          )}
        </div>
      </div>

      {/* JSON 모달 */}
      {showJsonModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--gcp-bg-card)', border: '1px solid var(--gcp-border)',
            borderRadius: '6px', width: '560px', padding: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--gcp-text-primary)' }}>
              📄 생성된 워크플로우 JSON 스펙
            </h3>
            <textarea
              readOnly
              value={JSON.stringify({ workflowName, steps: exportSteps() }, null, 2)}
              rows={14}
              style={{
                width: '100%', backgroundColor: 'var(--gcp-bg-main)', border: '1px solid var(--gcp-border)',
                color: 'var(--gcp-status-green)', fontFamily: 'monospace', fontSize: '11.5px', padding: '10px', borderRadius: '4px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="gcp-btn gcp-btn-secondary" onClick={() => setShowJsonModal(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisualWorkflowEditor;
