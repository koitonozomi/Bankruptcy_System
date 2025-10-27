// public/service-worker.js

// バックエンドからプッシュ通知が届いたときの処理
self.addEventListener('push', event => {
  const data = event.data.json(); // バックエンドから送られたJSONデータ
  
  const options = {
    body: data.body,
    icon: 'icon.png',
    badge: 'icon.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 通知をクリックしたときの処理（任意）
self.addEventListener('notificationclick', event => {
  event.notification.close();
  // ここに、クリック時に特定のURLを開くなどの処理を追加できます
});