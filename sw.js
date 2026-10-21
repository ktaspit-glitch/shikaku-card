// オフラインでも うごく ための しくみ。アプリを なおしたら この ばんごうが かわり、ふるい ものが いれかわる。
const CACHE = 'shikaku-20261021203928';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const VER = CACHE.split('-').pop();

// GitHub Pages は ファイルを 10ぷん とっておく（max-age=600）ので、ばんごう を つけて あたらしい ものを とりに いく。
// （ふるい index.html を あたらしい ばんごう で しまいこんで しまわない ように）
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) =>
    fetch(u + '?v=' + VER, { cache: 'reload' }).then((res) => {
      if (!res.ok) throw new Error(u);
      return c.put(u, res);
    })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;
  const isPage = req.mode === 'navigate' || (url.origin === location.origin && /(\/|\.html)$/.test(url.pathname));
  if (isPage) {
    // アプリの ページ：つながって いれば いつも あたらしい もの を だす。
    // つながらない・おそい（4びょう）ときは、しまって ある もの を だす（オフラインでも ひらける）。
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const net = fetch(req, { cache: 'no-cache' }).then((res) => {
        if (!res || !res.ok) throw new Error('bad');
        cache.put('./', res.clone());
        return res;
      });
      e.waitUntil(net.catch(() => {}));
      try {
        return await Promise.race([net, new Promise((_, ng) => setTimeout(() => ng(new Error('slow')), 4000))]);
      } catch (err) {
        return (await cache.match('./')) || (await cache.match('./index.html')) || net;
      }
    }));
    return;
  }
  // え・もじ など：まず しまって ある もの を だし、うらで あたらしい ものに いれかえる。
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: url.origin === location.origin });
    const fresh = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
