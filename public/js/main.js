/**
 * WebCrawlServer - 메인 JavaScript
 * 디자인 원칙: 가벼움, 단순함, 의존성 최소화
 */

// ===== DOM Ready =====
function domReady(callback) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        callback();
    } else {
        document.addEventListener('DOMContentLoaded', callback);
    }
}

// ===== 서버 정보 업데이트 =====
function updateServerInfo() {
    var host = window.location.host;
    var serverAddressEl = document.getElementById('server-address');
    var wsAddressEl = document.getElementById('ws-address');
    
    if (serverAddressEl) {
        serverAddressEl.textContent = 'http://' + host;
    }
    if (wsAddressEl) {
        wsAddressEl.textContent = 'ws://' + host;
    }
}

// ===== 하위 메뉴 토글 =====
function initSubmenuToggle() {
    var toggleButtons = document.querySelectorAll('[data-toggle="submenu"]');
    toggleButtons.forEach(function(button) {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            var targetId = this.getAttribute('data-target');
            var targetEl = document.getElementById(targetId);
            
            if (targetEl) {
                var isHidden = targetEl.classList.contains('hidden');
                if (isHidden) {
                    targetEl.classList.remove('hidden');
                    this.setAttribute('aria-expanded', 'true');
                } else {
                    targetEl.classList.add('hidden');
                    this.setAttribute('aria-expanded', 'false');
                }
            }
        });
    });
}

// ===== 탭 기능 =====
function initTabs() {
    var tabGroups = document.querySelectorAll('[data-tabs]');
    tabGroups.forEach(function(group) {
        var tabButtons = group.querySelectorAll('[data-tab]');
        var tabContents = document.querySelectorAll('[data-tab-content]');
        
        tabButtons.forEach(function(button) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                var tabId = this.getAttribute('data-tab');
                
                // 모든 탭 버튼에서 active 제거
                tabButtons.forEach(function(btn) {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                });
                
                // 클릭한 버튼에 active 추가
                this.classList.add('active');
                this.setAttribute('aria-selected', 'true');
                
                // 모든 탭 콘텐츠 숨기기
                tabContents.forEach(function(content) {
                    if (content.getAttribute('data-tab-content') === tabId) {
                        content.classList.remove('hidden');
                    } else {
                        content.classList.add('hidden');
                    }
                });
            });
        });
    });
}

// ===== 모달 기능 =====
function initModal() {
    var modalTriggers = document.querySelectorAll('[data-modal]');
    var modalClose = document.querySelectorAll('[data-close-modal]');
    
    modalTriggers.forEach(function(trigger) {
        trigger.addEventListener('click', function(e) {
            e.preventDefault();
            var modalId = this.getAttribute('data-modal');
            var modalEl = document.getElementById(modalId);
            
            if (modalEl) {
                modalEl.classList.remove('hidden');
                modalEl.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';
                
                // 포커스 트랩
                var focusableElements = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                }
            }
        });
    });
    
    modalClose.forEach(function(closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            var modalEl = this.closest('[role="dialog"]');
            if (modalEl) {
                modalEl.classList.add('hidden');
                modalEl.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        });
    });
    
    // 모달 바깥 클릭 시 닫기
    document.querySelectorAll('[role="dialog"]').forEach(function(modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.add('hidden');
                this.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        });
    });
}

// ===== 확인 모달 =====
function showConfirmModal(title, message, callback) {
    var modal = document.getElementById('confirm-modal');
    if (!modal) return;
    
    var titleEl = modal.querySelector('[data-modal-title]');
    var messageEl = modal.querySelector('[data-modal-message]');
    var confirmBtn = modal.querySelector('[data-confirm]');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    // 콜백 임시 저장
    confirmBtn.onclick = function(e) {
        e.preventDefault();
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        callback(true);
    };
    
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

// ===== 알림 메시지 =====
function showAlert(type, message, timeout) {
    var alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;
    
    var alertEl = document.createElement('div');
    alertEl.className = 'alert alert-' + type;
    alertEl.textContent = message;
    alertEl.setAttribute('role', 'alert');
    
    alertContainer.appendChild(alertEl);
    
    // 자동 제거
    if (timeout) {
        setTimeout(function() {
            alertEl.style.opacity = '0';
            setTimeout(function() {
                alertEl.remove();
            }, 300);
        }, timeout);
    }
    
    return alertEl;
}

// ===== AJAX 유틸리티 =====
function fetchJSON(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    options.headers['Content-Type'] = 'application/json';
    options.headers['Accept'] = 'application/json';
    
    return fetch(url, options)
        .then(function(response) {
            if (!response.ok) {
                return response.json().then(function(data) {
                    throw { status: response.status, message: data.message || '에러가 발생했습니다.', data: data };
                }).catch(function() {
                    throw { status: response.status, message: '서버 오류가 발생했습니다.' };
                });
            }
            return response.json();
        });
}

function fetchText(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    options.headers['Accept'] = 'text/plain';
    
    return fetch(url, options)
        .then(function(response) {
            if (!response.ok) {
                throw { status: response.status, message: '에러가 발생했습니다.' };
            }
            return response.text();
        });
}

// ===== 로딩 인디케이터 =====
function showLoading(element) {
    var loadingEl = document.createElement('span');
    loadingEl.className = 'loading';
    loadingEl.setAttribute('aria-label', '로딩 중');
    
    if (element) {
        element.appendChild(loadingEl);
    }
    
    return loadingEl;
}

function hideLoading(loadingEl) {
    if (loadingEl && loadingEl.parentNode) {
        loadingEl.parentNode.removeChild(loadingEl);
    }
}

// ===== 날짜 포맷 =====
function formatDate(date, format) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    format = format || 'YYYY-MM-DD HH:mm:ss';
    
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    var hours = String(date.getHours()).padStart(2, '0');
    var minutes = String(date.getMinutes()).padStart(2, '0');
    var seconds = String(date.getSeconds()).padStart(2, '0');
    
    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

// ===== 상대 시간 포맷 =====
function formatRelativeTime(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) {
        return diff + '초 전';
    }
    
    var minutes = Math.floor(diff / 60);
    if (minutes < 60) {
        return minutes + '분 전';
    }
    
    var hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return hours + '시간 전';
    }
    
    var days = Math.floor(hours / 24);
    if (days < 30) {
        return days + '일 전';
    }
    
    var months = Math.floor(days / 30);
    if (months < 12) {
        return months + '개월 전';
    }
    
    return Math.floor(months / 12) + '년 전';
}

// ===== 복사 클립보드 =====
function copyToClipboard(text, callback) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
            if (callback) callback(true);
        }).catch(function() {
            if (callback) callback(false);
        });
    } else {
        // 폴백
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            if (callback) callback(true);
        } catch (e) {
            if (callback) callback(false);
        }
        
        document.body.removeChild(textarea);
    }
}

// ===== URL 파라미터 가져오기 =====
function getUrlParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// ===== URL 파라미터 설정 =====
function setUrlParam(name, value) {
    var params = new URLSearchParams(window.location.search);
    params.set(name, value);
    return '?' + params.toString();
}

// ===== 저장소 유틸리티 =====
var storage = {
    get: function(key, defaultValue) {
        try {
            var value = localStorage.getItem(key);
            return value === null ? defaultValue : JSON.parse(value);
        } catch (e) {
            return defaultValue;
        }
    },
    set: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('로컬 스토리지 저장 실패:', e);
        }
    },
    remove: function(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('로컬 스토리지 삭제 실패:', e);
        }
    },
    clear: function() {
        try {
            localStorage.clear();
        } catch (e) {
            console.error('로컬 스토리지 초기화 실패:', e);
        }
    }
};

// ===== 초기화 =====
domReady(function() {
    // 서버 정보 업데이트
    updateServerInfo();
    
    // 네비게이션 초기화 (드롭다운 메뉴 활성화)
    initializeNavigation();
    
    // 하위 메뉴 토글 초기화
    initSubmenuToggle();
    
    // 탭 기능 초기화
    initTabs();
    
    // 모달 기능 초기화
    initModal();
    
    // 전역 이벤트 바인딩
    globalEventBinding();
});

// ===== 네비게이션 초기화 =====
function initializeNavigation() {
    var currentPath = window.location.pathname;
    
    // 모든 네비게이션 링크 가져오기
    var navLinks = document.querySelectorAll('.nav-item > a, .dropdown-menu a');
    
    // 현재 페이지와 일치하는 메뉴 찾기
    navLinks.forEach(function(link) {
        var linkPath = link.getAttribute('href');
        if (linkPath && linkPath !== '#' && !linkPath.startsWith('javascript:')) {
            // 경로 비교 (쿼리 스트링 무시)
            var linkPathWithoutQuery = linkPath.split('?')[0];
            var currentPathWithoutQuery = currentPath.split('?')[0];
            
            if (currentPathWithoutQuery.endsWith(linkPathWithoutQuery)) {
                link.classList.add('active');
                
                // 부모 네비게이션 아이템도 열기
                var parentItem = link.closest('.nav-item');
                if (parentItem) {
                    parentItem.classList.add('open');
                    var parentLink = parentItem.querySelector('> a');
                    if (parentLink) {
                        parentLink.classList.add('active');
                    }
                }
            }
        }
    });
    
    // 브레드크럼 업데이트
    updateBreadcrumb();
}

// ===== 브레드크럼 업데이트 =====
function updateBreadcrumb() {
    var breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;
    
    var pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0 || pathParts[0] !== 'admin') return;
    
    // 메뉴 이름 매핑
    var menuNames = {
        'admin': '관리자',
        'process': '서버 프로세스',
        'detail': '세부 정보',
        'logs': '로그 기록',
        'database': '데이터베이스',
        'modules': '모듈',
        'workflows': '워크플로우',
        'scheduler': '스케줄러',
        'settings': '설정'
    };
    
    // 브레드크럼 재구성
    var html = '';
    var accumulatedPath = '';
    
    // 항상 관리자 홈으로 시작
    html += '<div class="breadcrumb-item"><a href="/admin">관리자</a></div>';
    
    for (var i = 0; i < pathParts.length; i++) {
        var part = pathParts[i];
        if (i > 0) accumulatedPath += '/';
        accumulatedPath += part;
        var displayName = menuNames[part] || part;
        
        if (i < pathParts.length - 1) {
            html += '<div class="breadcrumb-item"><a href="/' + accumulatedPath + '">' + displayName + '</a></div>';
        } else {
            html += '<div class="breadcrumb-item active">' + displayName + '</div>';
        }
    }
    
    breadcrumb.innerHTML = html;
}

// ===== 모바일 메뉴 토글 =====
function toggleMobileMenu() {
    var nav = document.getElementById('main-nav');
    if (nav) {
        nav.classList.toggle('open');
    }
}

// ===== 전역 이벤트 바인딩 =====
function globalEventBinding() {
    // 복사 버튼
    var copyButtons = document.querySelectorAll('[data-copy]');
    copyButtons.forEach(function(button) {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            var target = this.getAttribute('data-copy');
            var text = '';
            
            if (target.startsWith('#')) {
                var targetEl = document.querySelector(target);
                text = targetEl ? targetEl.textContent || targetEl.value || '' : '';
            } else {
                text = target;
            }
            
            if (text) {
                copyToClipboard(text, function(success) {
                    var message = success ? '복사되었습니다.' : '복사에 실패했습니다.';
                    showAlert('info', message, 2000);
                });
            }
        });
    });
    
    // 삭제 확인 버튼
    var deleteButtons = document.querySelectorAll('[data-delete]');
    deleteButtons.forEach(function(button) {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            var message = this.getAttribute('data-delete-message') || '정말로 삭제하시겠습니까?';
            var action = this.getAttribute('data-delete-action');
            
            showConfirmModal('삭제 확인', message, function(confirm) {
                if (confirm && action) {
                    window.location.href = action;
                }
            });
        });
    });
}

// ===== Health Check =====
function checkServerHealth(callback) {
    fetch('/health')
        .then(function(response) {
            if (response.ok) {
                return response.json();
            }
            throw new Error('서버 응답 오류');
        })
        .then(function(data) {
            if (callback) callback(true, data);
        })
        .catch(function(error) {
            if (callback) callback(false, error);
        });
}

// ===== WebSocket 연결 =====
function connectWebSocket(url, onMessage, onOpen, onClose, onError) {
    var socket;
    
    try {
        // SSL 체크
        var isSecure = window.location.protocol === 'https:';
        var wsProtocol = isSecure ? 'wss:' : 'ws:';
        var wsUrl = wsProtocol + '//' + window.location.host + (url || '');
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = function(e) {
            if (onOpen) onOpen(e);
        };
        
        socket.onmessage = function(e) {
            try {
                var data = JSON.parse(e.data);
                if (onMessage) onMessage(data, e);
            } catch (err) {
                if (onMessage) onMessage(e.data, e);
            }
        };
        
        socket.onclose = function(e) {
            if (onClose) onClose(e);
        };
        
        socket.onerror = function(e) {
            if (onError) onError(e);
        };
    } catch (e) {
        console.error('WebSocket 연결 실패:', e);
        if (onError) onError(e);
    }
    
    return socket;
}
