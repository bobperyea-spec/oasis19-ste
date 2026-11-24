// Oasis19 service worker: caches the app shell so it opens instantly and
// shows a friendly page offline. Posts and news always come from the network.
// Also receives photos/text shared from the phone's share sheet.
const CACHE = 'oasis19-shell-v30';
const SHELL = ['/community/', '/community/index.html', '/community/app.js?v=29', '/community/tables.js?v=22', '/community/tables-extras.js?v=22', '/community/community.css?v=25', '/community/vendor-supabase.js', '/community/icon-192.png', '/community/icon-512.png'];

self.addEventListener('install', (e) => {
e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
e.waitUntil(
caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'oasis19-share').map((k) => caches.delete(k))))
.then(() => self.clients.claim())
);
});
self.addEventListener('fetch', (e) => {
const req = e.request;
const url = new URL(req.url);
if (req.method === 'POST' && url.origin === location.origin && url.pathname === '/community/share-target') {
e.respondWith((async () => {
try {
const fd = await req.formData();
const c = await caches.open('oasis19-share');
const f = fd.get('media');
const meta = { title: fd.get('title') || '', text: fd.get('text') || '', url: fd.get('url') || '', name: (f && f.name) || '' };
await c.put('/community/shared-meta', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
if (f && f.size) await c.put('/community/shared-file', new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg' } }));
} catch (err) {}
return Response.redirect('/community/?shared=1', 303);
})());
return;
}
if (req.method !== 'GET') return;
if (url.origin !== location.origin) return;
if (url.pathname.endsWith('news.php')) return;
if (req.mode === 'navigate') {
e.respondWith(fetch(req).then((res) => {
const copy = res.clone();
caches.open(CACHE).then((c) => c.put('/community/index.html', copy));
return res;
}).catch(() => caches.match('/community/index.html')));
return;
}
// static assets: serve cache immediately, refresh in the background
e.respondWith(caches.match(req).then((hit) => {
const net = fetch(req).then((res) => {
if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
return res;
}).catch(() => hit);
return hit || net;
}));
});
