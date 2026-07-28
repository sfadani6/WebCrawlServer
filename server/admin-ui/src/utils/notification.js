/**
 * 브라우저 데스크톱 Web Notification 헬퍼
 */

export function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('이 브라우저는 데스크톱 알림을 지원하지 않습니다.');
    return Promise.resolve('denied');
  }

  if (Notification.permission === 'default') {
    return Notification.requestPermission();
  }

  return Promise.resolve(Notification.permission);
}

export function sendDesktopNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'webcrawlserver-notice',
      ...options
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (e) {
    console.error('데스크톱 알림 전송 오류:', e);
    return null;
  }
}
