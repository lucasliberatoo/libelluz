// Service worker do Libelluz: deixa o app instalável e mostra uma tela offline.
const CACHE = "libelluz-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Arquivos estáticos: cache primeiro.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/img/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }
  // Páginas: sempre rede (dados ao vivo); sem rede, tela offline.
  if (req.mode === "navigate") e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});

// ---- Web Push ----
// O servidor manda { title, body, url, tag, id }. Ver src/server/push.ts.
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  const url = d.url || "/notificacoes";
  e.waitUntil(
    self.registration.showNotification(d.title || "Libelluz", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: d.tag || "libelluz",
      renotify: true,
      data: { url, id: d.id || null },
      lang: "pt-BR",
    }),
  );
});

// Tocar na notificação abre (ou foca) a página indicada.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/notificacoes", self.location.origin);
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === url.origin && "focus" in c) {
          c.focus();
          if ("navigate" in c) return c.navigate(url.href).catch(() => {});
          return;
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
