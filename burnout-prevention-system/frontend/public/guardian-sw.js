/**
 * GUARDIAN SERVICE WORKER
 * Handles notification display even when the tab is not in focus.
 */

self.addEventListener('install', (e) => {
    console.log('[Guardian SW] Installed');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Guardian SW] Activated');
    e.waitUntil(self.clients.claim());
});

// Listen for notification-trigger messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_BREAK_NOTIFICATION') {
        const { title, body, tag } = event.data;
        console.log('[Guardian SW] Showing notification:', title);

        self.registration.showNotification(title, {
            body,
            icon: '/favicon.ico',
            tag: tag || 'guardian-break',
            requireInteraction: true,
            silent: false,
            vibrate: [200, 100, 200],
        });
    }
});

// When user clicks the notification, focus/open the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow('/');
        })
    );
});
