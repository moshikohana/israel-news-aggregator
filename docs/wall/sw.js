/*
 * Service Worker לטפט החי - הכל נשמר במטמון בהתקנה, כך שהטפט עובד
 * גם בלי רשת. קריאות לרשת (מזג אוויר, חדשות) לא נשמרות במטמון -
 * הן תמיד טריות, ואם אין רשת הן פשוט נכשלות בשקט.
 */
const VERSION = 'live-wallpaper-v1';
const ASSETS = [
    './',
    './index.html',
    './css/wall.css',
    './js/wall.js',
    './js/scene.js',
    './js/character.js',
    './js/desktop.js',
    './js/brain.js',
    './js/voice.js',
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
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;          // מזג אוויר חיצוני - ישר לרשת
    if (/more_\w+_articles/.test(url.pathname)) return;       // חדשות - תמיד טריות

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
