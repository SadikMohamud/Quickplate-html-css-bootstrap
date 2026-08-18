// Minimal service worker for ZAAT.
// v1 keeps this intentionally simple: it makes the app installable and
// passes requests straight through to the network. Offline caching of
// the card view is a candidate for v2.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network passthrough.
});
