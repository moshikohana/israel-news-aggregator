/*
 * Service Worker - מאפשר לאפליקציה לעבוד אופליין אחרי התקנה.
 * קוד האפליקציה נשמר במטמון בהתקנה; מודלי ה-GLB (כמה מגהבייט)
 * נשמרים לפי דרישה, בפעם הראשונה שצופים בחיה.
 */
const VERSION = 'ar-animals-v4';
const ASSETS = [
    './',
    './index.html',
    './css/ar.css',
    './js/animals.js',
    './js/ar-animals.js',
    './vendor/three.module.min.js',
    './vendor/loaders/GLTFLoader.js',
    './vendor/utils/BufferGeometryUtils.js',
    './vendor/utils/SkeletonUtils.js',
    './js/models.js',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(VERSION)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

    // מגישים מהמטמון מיד, ומרעננים ברקע לגרסה הבאה
    event.respondWith(
        caches.match(req).then((cached) => {
            const network = fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const copy = res.clone();
                        caches.open(VERSION).then((cache) => cache.put(req, copy));
                    }
                    return res;
                })
                .catch(() => cached || caches.match('./index.html'));
            return cached || network;
        })
    );
});
