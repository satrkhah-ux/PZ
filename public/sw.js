// Pizzara service worker — Web Push, plus just enough cache to keep the till
// alive when the cafe's line goes down.
//
// Only ONE page is cached: /cashier. Everything else still needs the server, and
// pretending otherwise would show staff stale orders and stale money. The rule
// is network-first for that page, so while the line is up the till always runs
// the newest deploy and the cache is merely refreshed behind it; the cached copy
// is served only when the network actually fails.
const SHELL = "pz-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Build assets carry a content hash in their name, so a cached one can never
  // be the wrong version — serve it straight from disk and skip the network.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate" && url.pathname === "/cashier") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // Cache ONLY a real cashier page. A dead session redirects to
          // /sign-in, and caching that under /cashier would lock the till out
          // of its own screen for as long as the line stays down.
          let finalPath = url.pathname;
          try {
            finalPath = new URL(res.url).pathname;
          } catch {
            /* opaque — treat as not cacheable */
          }
          if (res.ok && finalPath === "/cashier") {
            const copy = res.clone();
            (await caches.open(SHELL)).put("/cashier", copy);
          }
          return res;
        } catch {
          const hit = await caches.match("/cashier");
          if (hit) return hit;
          throw new Error("offline and nothing cached");
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* non-JSON payload */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "بيزارا كافيه", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir: "rtl",
      lang: "ar",
      tag: data.tag,
      vibrate: [200, 100, 200],
      data: { url: data.url || "/orders" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/orders";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
