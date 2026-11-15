// Service Worker click handler for Smith Solutions background browser notifications
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var data = (event.notification && event.notification.data) || {};
  var targetTab = data.tab === 'cashier' ? 'cashier' : 'inventory';
  var targetUrl = targetTab === 'cashier' ? '/caja' : '/inventario';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if ('focus' in client) {
            try {
              client.postMessage({
                type: 'SMITH_NOTIFICATION_CLICK',
                tab: targetTab,
              });
            } catch (_) {
              // ignore postMessage errors
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
