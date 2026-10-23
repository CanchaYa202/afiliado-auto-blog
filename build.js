// Generador estático sin dependencias. Lee content/posts/*.md y genera dist/.
const fs = require('fs'), path = require('path');
const cfg = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
const OUT = 'dist', POSTS = 'content/posts';
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function parseFM(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return [{}, src];
  const fm = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':'); if (i < 0) continue;
    const k = line.slice(0, i).trim(); let v = line.slice(i + 1).trim();
    if (v.startsWith('[')) { try { v = JSON.parse(v); } catch { v = v.slice(1,-1).split(',').map(x=>x.trim().replace(/^["']|["']$/g,'')).filter(Boolean); } }
    else v = v.replace(/^["']|["']$/g, '');
    fm[k] = v;
  }
  return [fm, m[2]];
}

// Agrega el tag de afiliado a cualquier enlace de Amazon (dp/ o s?k=)
function tagUrl(u) {
  if (!/^https?:\/\/(www\.)?amazon\.[a-z.]+\//.test(u)) return u;
  const url = new URL(u); url.searchParams.set('tag', cfg.amazonTag); return url.toString();
}
const isAmazon = u => /amazon\.[a-z.]+\//.test(u);

function inline(t) {
  t = esc(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, href) => {
    href = href.replace(/&amp;/g, '&');
    const a = isAmazon(href);
    return `<a href="${esc(tagUrl(href))}"${a ? ' rel="sponsored nofollow noopener" target="_blank"' : ''}>${txt}</a>`;
  });
  return t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
function md(src) {
  const out = []; let list = null, para = [];
  const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushL = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd(); let m;
    if (!line.trim()) { flushP(); flushL(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)/))) { flushP(); flushL(); const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)/)) || (m = line.match(/^\s*\d+\.\s+(.*)/))) {
      flushP(); const t = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
      if (list !== t) { flushL(); out.push(`<${t}>`); list = t; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    if ((m = line.match(/^>\s?(.*)/))) { flushP(); flushL(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    flushL(); para.push(line.trim());
  }
  flushP(); flushL(); return out.join('\n');
}

const DISCLOSURE = 'Como Asociado de Amazon gano con las compras que cumplen los requisitos. Esto no cambia el precio que pagás.';
const css = `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;padding:1rem 1.2rem;line-height:1.65;color:#1d1d1f;background:#fff}
header a{color:inherit;text-decoration:none}header{border-bottom:1px solid #eee;margin-bottom:1.5rem}a{color:#0b63c5}
.disc{background:#fff8e1;border:1px solid #f3d27a;padding:.6rem .9rem;border-radius:8px;font-size:.92rem}
.card{border-bottom:1px solid #eee;padding:1rem 0}.meta{color:#666;font-size:.9rem}footer{margin-top:3rem;border-top:1px solid #eee;color:#666;font-size:.85rem;padding-top:1rem}
blockquote{border-left:4px solid #0b63c5;margin:1rem 0;padding:.3rem 1rem;background:#f5f9ff}h1{line-height:1.25}`;
function page({ title, description, canonical, body, type = 'website' }) {
  return `<!doctype html><html lang="${cfg.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${type}"><meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary"><link rel="alternate" type="application/rss+xml" title="${esc(cfg.title)}" href="${cfg.url}/rss.xml"><style>${css}</style></head>
<body><header><h2><a href="/">${esc(cfg.title)}</a></h2></header>${body}
<footer><p>${esc(DISCLOSURE)}</p><p>© ${new Date().getFullYear()} ${esc(cfg.title)} · <a href="/rss.xml">RSS</a></p></footer></body></html>`;
}

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + '/posts', { recursive: true });
const posts = fs.existsSync(POSTS) ? fs.readdirSync(POSTS).filter(f => f.endsWith('.md')).map(f => {
  const [fm, body] = parseFM(fs.readFileSync(path.join(POSTS, f), 'utf8'));
  const slug = f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
  return { ...fm, slug, date: fm.date || f.slice(0, 10), html: md(body), tags: [].concat(fm.tags || []) };
}).filter(p => p.draft !== 'true').sort((a, b) => b.date.localeCompare(a.date)) : [];

for (const p of posts) {
  const url = `${cfg.url}/posts/${p.slug}`;
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, datePublished: p.date, author: { '@type': 'Person', name: cfg.author }, description: p.description };
  const body = `<article><h1>${esc(p.title)}</h1><p class="meta">${p.date} · ${p.tags.map(esc).join(', ')}</p>
<p class="disc">${esc(DISCLOSURE)}</p>${p.html}<p class="disc">${esc(DISCLOSURE)}</p></article>
<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
  fs.writeFileSync(`${OUT}/posts/${p.slug}.html`, page({ title: `${p.title} | ${cfg.title}`, description: p.description, canonical: url, body, type: 'article' }));
}
const list = posts.map(p => `<div class="card"><h3><a href="/posts/${p.slug}">${esc(p.title)}</a></h3><p class="meta">${p.date}</p><p>${esc(p.description || '')}</p></div>`).join('');
fs.writeFileSync(`${OUT}/index.html`, page({ title: cfg.title, description: cfg.description, canonical: cfg.url + '/', body: `<p>${esc(cfg.description)}</p>${list || '<p>Pronto, nuevas guías.</p>'}` }));
fs.writeFileSync(`${OUT}/404.html`, page({ title: 'No encontrado', description: 'Página no encontrada', canonical: cfg.url, body: '<h1>Página no encontrada</h1><p><a href="/">Volver al inicio</a></p>' }));
fs.writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${cfg.url}/</loc></url>\n${posts.map(p => `<url><loc>${cfg.url}/posts/${p.slug}</loc><lastmod>${p.date}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(`${OUT}/rss.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(cfg.title)}</title><link>${cfg.url}</link><description>${esc(cfg.description)}</description><language>es</language>\n${posts.map(p => `<item><title>${esc(p.title)}</title><link>${cfg.url}/posts/${p.slug}</link><guid>${cfg.url}/posts/${p.slug}</guid><pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate><description>${esc(p.description || '')}</description></item>`).join('\n')}\n</channel></rss>\n`);
fs.writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${cfg.url}/sitemap.xml\n`);
fs.writeFileSync(`${OUT}/posts.json`, JSON.stringify(posts.map(({ html, ...p }) => p), null, 1));
console.log(`OK: ${posts.length} posts -> ${OUT}/`);
