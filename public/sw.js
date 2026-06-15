const SW_VERSION = "pwa-foundation-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "GET_SW_VERSION") {
    event.source?.postMessage({ type: "SW_VERSION", version: SW_VERSION });
  }
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
