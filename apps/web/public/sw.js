const CACHE = "defesabit-v2";
const OFFLINE_URL = "/dashboard";

// Instala e pré-cacheia a página principal
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(["/", "/dashboard", "/manifest.json"])
    )
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estratégia: network-first, fallback para cache
self.addEventListener("fetch", (e) => {
  // Ignora requisições de API e websockets
  if (
    e.request.url.includes("/api/") ||
    e.request.url.includes("/_next/") ||
    e.request.method !== "GET"
  ) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((cached) => cached || caches.match(OFFLINE_URL))
      )
  );
});
