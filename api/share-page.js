// Vercel serverless function: GET /api/share-page?id=<id>
// Pretty URL (vercel.json rewrite): /s/<id>
//
// The public page behind a shared card ("Slow Build Acres grew $412 of food").
// Facebook, iMessage, X etc. read the Open Graph tags and show the card image
// as a big preview; people who tap through land here and see the card plus
// "Get Henalytics" buttons. That's how a brag post in a homesteading group
// turns into downloads.
//
// Only the card's own fields are shown (title, subtitle, up to 6 stats, the
// image the user rendered). Rows are written by the app (src/shareCard.js);
// this endpoint reads them with the service role. Unknown ids → friendly 404
// page that still points to the app.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const ID_RE = /^[a-z0-9]{10}$/;
const SITE = 'https://henalytics.com';
const APP_STORE = 'https://apps.apple.com/app/id6768749008';
const PLAY = 'https://play.google.com/store/apps/details?id=com.henalytics.app';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function page({ title, description, image, url, emoji, stats, notFound }) {
  const statHtml = (stats || []).map((s) => `
      <div class="stat"><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div></div>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Henalytics</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Henalytics">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(image)}">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${notFound ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="noindex, follow">'}
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Be+Vietnam+Pro:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { --bg:#F4EDE0; --card:#FAF5EA; --ink:#2C1810; --soft:#5C4530; --leaf:#5A7A3C; --yolk:#E8B547; --line:#2C181030; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1E140D; --card:#2A1D14; --ink:#F4EDE0; --soft:#CDBBA5; --line:#F4EDE030; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:'Be Vietnam Pro', -apple-system, sans-serif; }
  main { max-width:560px; margin:0 auto; padding:24px 16px 40px; }
  .brand { font-family:'DM Serif Display', Georgia, serif; font-size:22px; text-decoration:none; color:var(--ink); }
  .hero { margin:18px 0 0; border-radius:16px; overflow:hidden; border:1.5px solid var(--line); background:#2C1810; }
  .hero img { display:block; width:100%; height:auto; }
  h1 { font-family:'DM Serif Display', Georgia, serif; font-weight:400; font-size:28px; line-height:1.15; margin:20px 0 6px; }
  .sub { color:var(--soft); font-size:15px; line-height:1.5; margin:0 0 14px; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin:0 0 22px; }
  .stat { background:var(--card); border:1.5px solid var(--line); border-radius:12px; padding:12px; }
  .stat .v { font-size:20px; font-weight:700; }
  .stat .l { font-size:12px; color:var(--soft); margin-top:2px; }
  .cta { background:var(--card); border:1.5px solid var(--ink); border-radius:16px; padding:18px; }
  .cta h2 { font-family:'DM Serif Display', Georgia, serif; font-weight:400; font-size:22px; margin:0 0 6px; }
  .cta p { margin:0 0 14px; color:var(--soft); line-height:1.5; font-size:14px; }
  .btns { display:flex; flex-direction:column; gap:8px; }
  .btn { display:block; text-align:center; padding:14px; border-radius:10px; font-weight:700; font-size:15px; text-decoration:none; border:2px solid var(--ink); }
  .btn.primary { background:var(--ink); color:var(--bg); }
  .btn.ghost { color:var(--ink); }
  footer { margin-top:24px; font-size:12px; color:var(--soft); text-align:center; }
  footer a { color:var(--soft); }
</style>
</head>
<body>
<main>
  <a class="brand" href="${SITE}">🐔 Henalytics</a>
  ${image ? `<div class="hero"><img src="${esc(image)}" alt="${esc(title)}" width="1200" height="630"></div>` : ''}
  <h1>${emoji ? `${esc(emoji)} ` : ''}${esc(title)}</h1>
  ${description ? `<p class="sub">${esc(description)}</p>` : ''}
  ${statHtml ? `<div class="stats">${statHtml}</div>` : ''}
  <div class="cta">
    <h2>Track your own homestead, free</h2>
    <p>Henalytics is the homestead notebook for eggs, gardens, animals and sales. Log in a tap, and it does the math: what your garden is worth, cost per dozen, what's working.</p>
    <div class="btns">
      <a class="btn primary" href="${APP_STORE}">Get it on the App Store</a>
      <a class="btn primary" href="${PLAY}">Get it on Google Play</a>
      <a class="btn ghost" href="${SITE}/">Use it on the web</a>
    </div>
  </div>
  <footer>Shared from Henalytics · <a href="${SITE}/garden-value">What's your garden worth?</a> · <a href="${SITE}/privacy.html">Privacy</a></footer>
</main>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const raw = req.query && req.query.id;
  const id = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const notFound = () => {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(404).send(page({
      title: 'Henalytics: the homestead notebook',
      description: 'This shared card is gone, but you can track your own eggs, garden and animals free.',
      url: SITE, notFound: true,
    }));
  };
  if (!ID_RE.test(id)) return notFound();

  const SUPABASE = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE || !KEY) return notFound();

  let row = null;
  try {
    const r = await fetch(`${SUPABASE}/rest/v1/share_cards?select=id,user_id,title,subtitle,emoji,stats,image_path&id=eq.${id}&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
    });
    if (r.ok) { const rows = await r.json(); row = Array.isArray(rows) ? rows[0] : null; }
  } catch (_) { row = null; }
  if (!row) return notFound();

  // The image must live in the owner's own folder of the public bucket.
  const imageOk = typeof row.image_path === 'string'
    && row.image_path.startsWith(`${row.user_id}/`)
    && /^[0-9a-f-]{36}\/[a-z0-9]{10}\.(jpg|png)$/.test(row.image_path);
  const image = imageOk ? `${SUPABASE}/storage/v1/object/public/share-cards/${row.image_path}` : null;

  // Best-effort view counter; never blocks the page.
  fetch(`${SUPABASE}/rest/v1/rpc/share_card_viewed`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: id }),
  }).catch(() => {});

  const stats = Array.isArray(row.stats) ? row.stats.slice(0, 6).filter((s) => s && s.label && s.value) : [];
  res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=300');
  return res.status(200).send(page({
    title: row.title,
    description: row.subtitle || 'Tracked with Henalytics, the free homestead notebook.',
    image,
    url: `${SITE}/s/${id}`,
    emoji: row.emoji,
    stats,
  }));
}
