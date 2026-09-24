/* Root-scoped worker for Web Push delivery. */
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() ?? "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "Stock price alert", {
    body: data.body || "A price alert was triggered.",
    icon: "/icon.png",
    badge: "/icon.png",
    data: { url: data.url || "/" },
    tag: data.tag || undefined
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    return existing ? existing.focus().then(client => client.navigate(target)) : self.clients.openWindow(target);
  }));
});
