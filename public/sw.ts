// src/sw.ts
/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Pulizia cache vecchie versioni
cleanupOutdatedCaches();

// Precache tutti gli asset generati da Vite
// (VitePWA li inserisce automaticamente qui)
declare let self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST);

// Questo permette al SW di prendere il controllo subito dopo l'installazione
clientsClaim();

// ────────────────────────────────────────────────
// Strategie di caching runtime
// ────────────────────────────────────────────────

// 1. API di traduzione → NetworkFirst + fallback cache
registerRoute(
  ({ url }) => url.origin === 'https://translate.googleapis.com',
  new NetworkFirst({
    cacheName: 'translation-api',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 24 * 60 * 60, // 24 ore
      }),
    ],
  })
);

// 2. Font e immagini esterne (se ne usi) → CacheFirst
registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 giorni
      }),
    ],
  })
);

// 3. Tutto il resto (js, css, html generati) → StaleWhileRevalidate
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'document',
  new StaleWhileRevalidate({
    cacheName: 'app-shell',
  })
);

// ────────────────────────────────────────────────
// Skip waiting e claim clients (aggiornamento rapido)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});