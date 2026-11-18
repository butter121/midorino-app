// インストールできるようにするための最小のサービスワーカー。
// いつもネットから最新を取り、つながらないときだけ前回の画面を使う（古い版が残らないように）。
// ただし絵の画像（cards/*.webp・art/<種類>/*.webp）は重くて変わらないので「手元にあれば手元から」。差し替えは各フォルダの
// index.json の v を変えると URL（?v=）が変わって取り直す。古い v の絵はそのとき消す。
const CACHE = 'kiridani-v2';
const CARDS = 'kiridani-cards-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== CARDS).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));

const isCardArt = (url) => /\/(cards|art\/[a-z0-9_-]+)\/[^/]+\.webp$/.test(url.pathname);

async function cardArt(req) {
  const c = await caches.open(CARDS);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) {
    const url = new URL(req.url);
    // 同じ絵の古い版（?v= 違い）を消してから入れる
    for (const k of await c.keys()) { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) await c.delete(k); }
    await c.put(req, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (isCardArt(url)) { e.respondWith(cardArt(req)); return; }
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('./')))
  );
});
