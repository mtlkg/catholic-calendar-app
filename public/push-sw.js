/* Web push worker for The Catholic Calendar.
   Messaging only — this worker never caches pages or assets. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "The Catholic Calendar", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "The Catholic Calendar";
  const options = {
    body: data.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/catholic-calendar" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/catholic-calendar";

  event.waitUntil(
    (async () => {
      const url = new URL(target, self.location.origin).href;
      const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      for (const client of windowClients) {
        if ("navigate" in client && "focus" in client) {
          await client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
