/**
 * WebCrawlServer - 관리자 페이지 JavaScript
 * 디자인 원칙: 가벼움, 단순함, 기능 중심
 */

// ===== DOM Ready =====
domReady(function() {
    // 초기화
    initializeDashboard();
});

// ===== 전역 키보드 탐색 (접근성) =====
document.addEventListener('keydown', function(e) {
    // Escape 키: 모바일 사이드바 닫기
    if (e.key === 'Escape') {
        var sidebar = document.getElementById('main-nav');
        var overlay = document.getElementById('sidebar-overlay');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('open');
            // 포커스를 토글 버튼으로 복원
            var toggle = document.querySelector('.mobile-menu-toggle');
            if (toggle) toggle.focus();
        }
        // 열린 모달 닫기
        document.querySelectorAll('.admin-modal:not(.hidden)').forEach(function(modal) {
            var closeBtn = modal.querySelector('.admin-modal-close');
            if (closeBtn) closeBtn.click();
        });
    }
    // Tab 순환 시 사이드바가 열려 있으면 포커스 트랩
    if (e.key === 'Tab') {
        var sidebar = document.getElementById('main-nav');
        if (sidebar && sidebar.classList.contains('open')) {
            var focusable = sidebar.querySelectorAll(
                'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (!focusable.length) return;
            var first = focusable[0];
            var last  = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
});

// ===== 대시보드 초기화 =====
function initializeDashboard() {
    // 통계 데이터 로드
    loadStatistics();
    
    // 시스템 상태 로드
    loadSystemStatus();
    
    // 최근 활동 로드
    loadRecentActivities();
    
    // 실시간 업데이트 설정
    setupAutoRefresh();
}

// ===== 통계 데이터 로드 =====
function loadStatistics() {
    // 서버 통계 API 호출 (예: /api/stats)
    fetchJSON('/api/stats')
        .then(function(data) {
            updateStatistics(data);
        })
        .catch(function(error) {
            console.error('통계 로드 실패:', error);
            // 실패 시 기본값 표시
            updateStatistics({
                modules: 0,
                workflows: 0,
                scheduledJobs: 0,
                activityLogs: 0
            });
        });
}

// ===== 통계 업데이트 =====
function updateStatistics(data) {
    var totalModules = document.getElementById('total-modules');
    var totalWorkflows = document.getElementById('total-workflows');
    var totalScheduled = document.getElementById('total-scheduled');
    var totalLogs = document.getElementById('total-logs');
    
    if (totalModules) totalModules.textContent = data.modules || 0;
    if (totalWorkflows) totalWorkflows.textContent = data.workflows || 0;
    if (totalScheduled) totalScheduled.textContent = data.scheduledJobs || 0;
    if (totalLogs) totalLogs.textContent = data.activityLogs || 0;
}

// ===== 시스템 상태 로드 (/api/status 기반) =====
function loadSystemStatus() {
    fetchJSON('/api/status')
        .then(function(data) {
            updateSystemStatus(data);
        })
        .catch(function(error) {
            console.error('시스템 상태 로드 실패:', error);
            updateSystemStatus({
                server: 'offline',
                database: 'offline',
                websocket: 'idle',
                websocketClients: 0,
                mcp: 'offline'
            });
        });
}

// ===== 시스템 상태 업데이트 =====
function updateSystemStatus(data) {
    var serverStatus = document.getElementById('server-status');
    var dbStatus     = document.getElementById('db-status');
    var wsStatus     = document.getElementById('ws-status');
    var mcpStatus    = document.getElementById('mcp-status');

    if (serverStatus) {
        serverStatus.textContent = data.server === 'online' ? '정상 동작 중' : '오류 발생';
    }
    if (dbStatus) {
        dbStatus.textContent = data.database === 'online' ? '연결됨' : '연결 끊김';
    }
    if (wsStatus) {
        var clients = data.websocketClients || 0;
        wsStatus.textContent = clients > 0 ? '활성 (' + clients + '명 연결)' : '대기 중';
    }
    if (mcpStatus) {
        mcpStatus.textContent = data.mcp === 'ready' ? '준비 완료' : '오류';
    }

    // 상태 인디케이터 색상 업데이트
    setIndicator('server-status',   data.server   === 'online');
    setIndicator('db-status',       data.database === 'online');
    setIndicator('ws-status',       data.websocket !== 'offline');
    setIndicator('mcp-status',      data.mcp      === 'ready');
}

// 상태 인디케이터 (점) 클래스 전환
function setIndicator(valueId, isOnline) {
    var el = document.getElementById(valueId);
    if (!el) return;
    var item      = el.closest('.status-item');
    if (!item) return;
    var indicator = item.querySelector('.status-indicator');
    if (!indicator) return;
    indicator.classList.toggle('online',  isOnline);
    indicator.classList.toggle('offline', !isOnline);
}

// ===== 최근 활동 로드 =====
function loadRecentActivities() {
    // 활동 로그 API 호출 (예: /api/activities?limit=10)
    fetchJSON('/api/activities?limit=10')
        .then(function(data) {
            updateRecentActivities(data);
        })
        .catch(function(error) {
            console.error('최근 활동 로드 실패:', error);
            // 실패 시 더미 데이터 표시
            updateRecentActivities([
                { type: '워크플로우', module: 'crawler', action: '데이터 수집', status: 'success', timestamp: '2026-07-26T12:00:00Z' },
                { type: '스케줄러', module: 'monitor', action: '상태 체크', status: 'success', timestamp: '2026-07-26T11:50:00Z' },
                { type: '모듈', module: 'db_monitor', action: '로그 기록', status: 'success', timestamp: '2026-07-26T11:40:00Z' }
            ]);
        });
}

// ===== 최근 활동 업데이트 =====
function updateRecentActivities(activities) {
    var container = document.getElementById('recent-activities');
    if (!container) return;
    
    // 기존 내용 제거
    container.innerHTML = '';
    
    if (!activities || activities.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center">활동 내역이 없습니다.</td></tr>';
        return;
    }
    
    // 새로운 행 추가
    activities.forEach(function(activity) {
        var row = document.createElement('tr');
        
        var typeCell = document.createElement('td');
        typeCell.textContent = activity.type || 'unknown';
        row.appendChild(typeCell);
        
        var moduleCell = document.createElement('td');
        moduleCell.textContent = activity.module || '-';
        row.appendChild(moduleCell);
        
        var actionCell = document.createElement('td');
        actionCell.textContent = activity.action || '-';
        row.appendChild(actionCell);
        
        var statusCell = document.createElement('td');
        var badge = document.createElement('span');
        badge.className = 'badge badge-' + (activity.status || 'info');
        badge.textContent = activity.status === 'success' ? '성공' : 
                           activity.status === 'error' ? '실패' : 
                           activity.status === 'warning' ? '경고' : '정보';
        statusCell.appendChild(badge);
        row.appendChild(statusCell);
        
        var timeCell = document.createElement('td');
        timeCell.textContent = activity.timestamp ? formatDate(new Date(activity.timestamp)) : '-';
        row.appendChild(timeCell);
        
        container.appendChild(row);
    });
}

// ===== 자동 새로고침 설정 =====
function setupAutoRefresh() {
    // 30초마다 통계 새로고침
    setInterval(function() {
        loadStatistics();
    }, 30000);
    
    // 60초마다 시스템 상태 새로고침
    setInterval(function() {
        loadSystemStatus();
    }, 60000);
}

// ===== 모듈 관리 함수 =====
var ModuleManager = {
    // 모듈 목록 로드
    loadList: function(page, limit, callback) {
        var url = '/api/modules?page=' + (page || 1) + '&limit=' + (limit || 20);
        fetchJSON(url)
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 모듈 생성
    create: function(moduleData, callback) {
        fetchJSON('/api/modules', {
            method: 'POST',
            body: JSON.stringify(moduleData)
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 모듈 업데이트
    update: function(moduleId, moduleData, callback) {
        fetchJSON('/api/modules/' + moduleId, {
            method: 'PUT',
            body: JSON.stringify(moduleData)
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 모듈 삭제
    delete: function(moduleId, callback) {
        fetchJSON('/api/modules/' + moduleId, {
            method: 'DELETE'
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 모듈 활성화/비활성화
    toggleActive: function(moduleId, isActive, callback) {
        fetchJSON('/api/modules/' + moduleId + '/toggle', {
            method: 'POST',
            body: JSON.stringify({ active: isActive })
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    }
};

// ===== 워크플로우 관리 함수 =====
var WorkflowManager = {
    // 워크플로우 목록 로드
    loadList: function(page, limit, callback) {
        var url = '/api/workflows?page=' + (page || 1) + '&limit=' + (limit || 20);
        fetchJSON(url)
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 워크플로우 생성
    create: function(workflowData, callback) {
        fetchJSON('/api/workflows', {
            method: 'POST',
            body: JSON.stringify(workflowData)
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 워크플로우 삭제
    delete: function(workflowId, callback) {
        fetchJSON('/api/workflows/' + workflowId, {
            method: 'DELETE'
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 워크플로우 실행
    execute: function(workflowId, callback) {
        fetchJSON('/api/workflows/' + workflowId + '/execute', {
            method: 'POST'
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    }
};

// ===== 스케줄러 관리 함수 =====
var SchedulerManager = {
    // 스케줄러 목록 로드
    loadList: function(page, limit, callback) {
        var url = '/api/scheduler?page=' + (page || 1) + '&limit=' + (limit || 20);
        fetchJSON(url)
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 스케줄러 생성
    create: function(scheduleData, callback) {
        fetchJSON('/api/scheduler', {
            method: 'POST',
            body: JSON.stringify(scheduleData)
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 스케줄러 삭제
    delete: function(scheduleId, callback) {
        fetchJSON('/api/scheduler/' + scheduleId, {
            method: 'DELETE'
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 스케줄러 일시 정지/재개
    togglePause: function(scheduleId, isPaused, callback) {
        fetchJSON('/api/scheduler/' + scheduleId + '/toggle', {
            method: 'POST',
            body: JSON.stringify({ paused: isPaused })
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    }
};

// ===== 로그 관리 함수 =====
var LogManager = {
    // 로그 목록 로드
    loadList: function(page, limit, type, callback) {
        var url = '/api/logs?page=' + (page || 1) + '&limit=' + (limit || 20);
        if (type) url += '&type=' + type;
        
        fetchJSON(url)
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 로그 삭제 (기간별)
    deleteByDate: function(startDate, endDate, callback) {
        fetchJSON('/api/logs/delete', {
            method: 'POST',
            body: JSON.stringify({ startDate: startDate, endDate: endDate })
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 로그 내려받기
    download: function(type, startDate, endDate) {
        var url = '/api/logs/download?type=' + (type || 'all');
        if (startDate) url += '&startDate=' + startDate;
        if (endDate) url += '&endDate=' + endDate;
        
        window.open(url, '_blank');
    }
};

// ===== 설정 관리 함수 =====
var SettingsManager = {
    // 설정 로드
    load: function(callback) {
        fetchJSON('/api/settings')
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    },
    
    // 설정 업데이트
    update: function(settingsData, callback) {
        fetchJSON('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(settingsData)
        })
            .then(function(data) {
                if (callback) callback(null, data);
            })
            .catch(function(error) {
                if (callback) callback(error, null);
            });
    }
};

// ===== WebSocket 관리 함수 =====
var wsSocket = null;

function connectAdminWebSocket() {
    // 관리자 WebSocket 연결
    wsSocket = connectWebSocket('/admin', 
        function(message, event) {
            // 메시지 처리
            handleWebSocketMessage(message);
        },
        function(event) {
            console.log('[Admin WebSocket] 연결됨');
            // 연결 후 작업 실행
        },
        function(event) {
            console.log('[Admin WebSocket] 연결 종료');
            // 재연결 시도
            setTimeout(connectAdminWebSocket, 5000);
        },
        function(error) {
            console.error('[Admin WebSocket] 오류:', error);
        }
    );
    
    return wsSocket;
}

function handleWebSocketMessage(message) {
    // 실시간 업데이트 메시지 처리
    switch (message.type) {
        case 'stats_update':
            updateStatistics(message.data);
            break;
        case 'status_update':
            updateSystemStatus(message.data);
            break;
        case 'activity_added':
            // 새로운 활동 추가
            addActivity(message.data);
            break;
        case 'notification':
            // 알림 표시
            showAlert('info', message.message, 5000);
            break;
    }
}

function addActivity(activity) {
    var container = document.getElementById('recent-activities');
    if (!container) return;
    
    // 기존 첫 번째 행 복제하여 새로운 행 생성
    var firstRow = container.querySelector('tr');
    if (!firstRow) return;
    
    var newRow = firstRow.cloneNode(true);
    
    // 데이터 업데이트
    var cells = newRow.querySelectorAll('td');
    if (cells.length >= 5) {
        cells[0].textContent = activity.type || 'unknown';
        cells[1].textContent = activity.module || '-';
        cells[2].textContent = activity.action || '-';
        
        var badge = cells[3].querySelector('.badge');
        if (badge) {
            badge.className = 'badge badge-' + (activity.status || 'info');
            badge.textContent = activity.status === 'success' ? '성공' : 
                               activity.status === 'error' ? '실패' : 
                               activity.status === 'warning' ? '경고' : '정보';
        }
        
        cells[4].textContent = activity.timestamp ? formatDate(new Date(activity.timestamp)) : '-';
    }
    
    // 상단에 삽입
    container.insertBefore(newRow, firstRow);
    
    // 10개 이상이면 마지막 행 제거
    var rows = container.querySelectorAll('tr');
    if (rows.length > 10) {
        container.removeChild(rows[rows.length - 1]);
    }
}

// ===== 페이지네이션 유틸리티 =====
function setupPagination(totalItems, itemsPerPage, currentPage, callback) {
    var totalPages = Math.ceil(totalItems / itemsPerPage);
    var pagination = document.getElementById('pagination');
    
    if (!pagination) return;
    
    pagination.innerHTML = '';
    
    // 이전 버튼
    var prevLi = document.createElement('li');
    var prevBtn = document.createElement('button');
    prevBtn.textContent = '이전';
    prevBtn.disabled = currentPage <= 1;
    prevBtn.addEventListener('click', function() {
        if (currentPage > 1 && callback) callback(currentPage - 1);
    });
    prevLi.appendChild(prevBtn);
    pagination.appendChild(prevLi);
    
    // 페이지 번호
    for (var i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || 
            (i >= currentPage - 2 && i <= currentPage + 2)) {
            var pageLi = document.createElement('li');
            var pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.className = i === currentPage ? 'active' : '';
            pageBtn.addEventListener('click', function(pageNum) {
                return function() {
                    if (callback) callback(pageNum);
                };
            }(i));
            pageLi.appendChild(pageBtn);
            pagination.appendChild(pageLi);
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            var ellipsisLi = document.createElement('li');
            ellipsisLi.textContent = '...';
            pagination.appendChild(ellipsisLi);
        }
    }
    
    // 다음 버튼
    var nextLi = document.createElement('li');
    var nextBtn = document.createElement('button');
    nextBtn.textContent = '다음';
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.addEventListener('click', function() {
        if (currentPage < totalPages && callback) callback(currentPage + 1);
    });
    nextLi.appendChild(nextBtn);
    pagination.appendChild(nextLi);
}

// ===== 검색 유틸리티 =====
function setupSearch(inputId, searchCallback, delay) {
    var input = document.getElementById(inputId);
    if (!input) return;
    
    var timeout;
    input.addEventListener('input', function(e) {
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            if (searchCallback) searchCallback(e.target.value);
        }, delay || 300);
    });
}

// ===== arousal Typhoon =====
function exportData(data, filename, type) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: type || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===== 현재 페이지 URL 업데이트 =====
function updateCurrentPageUrl(page) {
    var searchParams = new URLSearchParams(window.location.search);
    searchParams.set('page', page);
    history.pushState(null, '', '?' + searchParams.toString());
}
