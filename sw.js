const CACHE = 'football-realm-v12';
const STATIC = ['./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // ปล่อยผ่านตรงๆ ไม่ยุ่งเลยสำหรับ: request ที่ไม่ใช่ GET (Cache API รองรับแค่ GET เท่านั้น)
  // หรือ request ข้าม origin (เช่น เรียก Supabase) — ไม่ควร cache คำขอ API ของบุคคลที่สามอยู่แล้ว
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) {
    return; // ไม่เรียก e.respondWith() = เบราว์เซอร์จัดการ request นี้ตามปกติ ไม่ผ่าน SW
  }
  // Network-first: index.html ต้อง bypass HTTP cache ของเบราว์เซอร์ด้วย ไม่ใช่แค่ของ SW
  // (GitHub Pages ส่ง cache-control แบบมี max-age มา ถ้าไม่บังคับ no-store fetch() อาจได้ของแคชเก่ากลับมาเงียบๆ)
  if (e.request.url.includes('index.html') || e.request.url.endsWith('/')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Cache-first สำหรับ assets อื่น (รูป icon ฯลฯ)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// แจ้ง client ให้ reload เมื่อ SW ใหม่ activate
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
