const CACHE_NAME = "macro-radar-v2026-06-14-2";
const API_CACHE = "macro-radar-api-v2026-06-14-2";
const OFFLINE_ASSETS = [
  "/manifest.json",
  "/icon.svg",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];
const NETWORK_FIRST_PATHS = new Set([
  "/",
  "/index.html",
  "/script.js",
  "/styles.css",
  "/supabase.js",
]);
const ONESIGNAL_WORKERS = new Set([
  "/OneSignalSDKWorker.js",
  "/OneSignalSDKUpdaterWorker.js",
]);
const API_ROUTES = [
  "/api/markets",
  "/api/news",
  "/api/brief",
  "/api/timeline",
  "/api/alerts",
  "/api/forecast",
  "/api/push-config",
  "/api/onesignal-config",
  "/api/supabase-config",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== API_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function apiNetworkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Offline and no cached API response is available");
  }
}

async function networkFirstNoStore(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) return response;
  } catch {
    // Fall through to cache for basic offline support.
  }

  const cached = await caches.match(request);
  if (cached) return cached;
  return fetch(request);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;

  if (ONESIGNAL_WORKERS.has(url.pathname)) {
    return;
  }

  if (API_ROUTES.includes(url.pathname)) {
    event.respondWith(apiNetworkFirst(event.request));
    return;
  }

  if (NETWORK_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(networkFirstNoStore(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
