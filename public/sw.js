/*
  KKuK 오프라인 보기 (3단계 10)
  - 화면(HTML) : 인터넷 먼저, 끊기면 전에 열어 본 화면을 보여 준다 (여행, 일기, 도장, 홈)
  - 앱 파일(/_next/static) : 한 번 받으면 저장해 두고 쓴다 (이름에 버전이 들어 있어 바뀌지 않음)
  - 저장은 하지 않는다 (서버 동작은 인터넷이 있어야 함)
  - 로그아웃, 로그인 화면, 탈퇴 뒤에는 저장한 화면을 모두 지운다 (같은 기기 다른 사람 대비)
*/
const PAGES = "kkuk-pages-v1";
const STATIC = "kkuk-static-v1";
const KEEP = /^\/($|trips(\/|$)|diary(\/|$)|stamps$|j\/)/;
const OFFLINE_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KKuK</title>
<style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#F5F3EE;color:#2D3139;font-family:system-ui,sans-serif;text-align:center;padding:24px}
@media (prefers-color-scheme:dark){body{background:#17181C;color:#F1EFEA}}h1{font-size:20px;margin:0 0 8px}p{margin:0;font-size:15px;opacity:.75}button{margin-top:20px;height:44px;padding:0 20px;border:0;border-radius:999px;background:#2D3139;color:#fff;font-size:15px;font-weight:700}</style></head>
<body><div><h1>인터넷이 끊겼어요</h1><p>이 화면은 아직 열어 본 적이 없어서 보여 드릴 수 없어요.<br>연결되면 다시 열어 주세요.</p><button onclick="location.reload()">다시 시도</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== PAGES && k !== STATIC) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || /^\/(flags\/|icon-|logo\.png)/.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(STATIC);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (req.mode !== "navigate") return;
  const forget = url.pathname.startsWith("/login") || url.searchParams.has("out") || url.searchParams.has("bye");
  e.respondWith((async () => {
    if (forget) await caches.delete(PAGES);
    try {
      const res = await fetch(req);
      if (!forget && res.ok && !res.redirected && KEEP.test(url.pathname)) (await caches.open(PAGES)).put(req, res.clone());
      return res;
    } catch {
      const c = await caches.open(PAGES);
      return (await c.match(req)) || (await c.match(url.pathname)) ||
        new Response(OFFLINE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
  })());
});
