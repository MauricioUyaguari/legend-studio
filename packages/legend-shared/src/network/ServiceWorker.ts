declare const self: ServiceWorkerGlobalScope;
// sw.ts
self.addEventListener('fetch', (event: FetchEvent) => {
  console.log('fetched', event);
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  console.log('message');
});

self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('installed');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('activated');
  event.waitUntil(self.clients.claim());
});

