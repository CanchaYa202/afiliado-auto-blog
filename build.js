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

// --- Afiliados ---
// 1) data/ml-links.json: { "url original": "link de afiliado generado en el portal" } (prioridad máxima)
// 2) Fallback Mercado Libre: agrega matt_tool/matt_word si mlAffiliateId está configurado y useParamFallback=true
// 3) Amazon (secundario): agrega ?tag= solo si amazonTag está configurado y no es placeholder
const ML = cfg.mercadolibre || {};
const mlMap = fs.existsSync('data/ml-links.json') ? JSON.parse(fs.readFileSync('data/ml-links.json', 'utf8')) : {};
const isSet = v => v && !/^PENDIENTE/i.test(v);
const isML = u => /^https?:\/\/([a-z0-9-]+\.)*mercadolibre\.com(\.ar)?\//.test(u) || /^https?:\/\/meli\.la\//.test(u);
const isAmazon = u => /^https?:\/\/(www\.)?amazon\.[a-z.]+\//.test(u);
const isAffiliate = u => isML(u) || isAmazon(u);
function tagUrl(u) {
  if (mlMap[u]) return mlMap[u];
  if (isML(u)) {
    if (ML.useParamFallback && isSet(ML.mlAffiliateId) && !/meli\.la|\/sec\//.test(u)) {
      const url = new URL(u); url.searchParams.set('matt_tool', ML.mlAffiliateId);
      if (ML.mattWord) url.searchParams.set('matt_word', ML.mattWord); return url.toString();
    }
    return u;
  }
  if (isAmazon(u) && isSet(cfg.amazonTag)) { const url = new URL(u); url.searchParams.set('tag', cfg.amazonTag); return url.toString(); }
  return u;
}
function inline(t) {
  t = esc(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, href) => {
    href = href.replace(/&amp;/g, '&');
    const a = isAffiliate(href);
    return `<a href="${esc(tagUrl(href))}"${a ? ' rel="sponsored nofollow noopener" target="_blank"' : ''}>${txt}</a>`;
  });
  return t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
const BRAND = 'Cuál Conviene';
const TAGLINE = 'Comparativas y guías para comprar mejor en Argentina';
const slugify = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/<[^>]+>/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const firstHref = h => { const m = h.match(/href="([^"]+)"/); return m ? m[1].replace(/&amp;/g,'&') : null; };
const CTA = href => `<a class="cta" href="${esc(href)}" rel="sponsored nofollow noopener" target="_blank">Ver precio en Mercado Libre <span aria-hidden="true">→</span></a>`;
function md(src, toc) {
  const out = []; let list = null, items = [], para = [], table = null;
  const flushP = () => { if (para.length) { const raw = para.join(' '); const h = inline(raw); out.push(`<p>${h}</p>`);
    const ml = (raw.match(/\]\((https?:[^)\s]+)\)/g)||[]).map(x=>x.slice(2,-1)).find(isML);
    if (ml) out.push(`<p class="cta-wrap">${CTA(tagUrl(ml))}</p>`); para = []; } };
  const flushL = () => { if (!list) return;
    const allML = list === 'ul' && items.length && items.every(i => /\]\(https?:[^)]*mercadolibre|\]\(https?:\/\/meli\.la/.test(i));
    if (allML) {
      out.push('<div class="products">' + items.map(i => { const h = inline(i); const href = firstHref(h);
        const name = (i.match(/\[([^\]]+)\]/)||[,''])[1].replace(/\s+en Mercado Libre$/i,'');
        const rest = inline(i.replace(/\[[^\]]+\]\([^)]+\)/,'').replace(/^[\s:—–-]+/,''));
        return `<div class="product"><div class="product-ic" aria-hidden="true">🛒</div><div class="product-body"><h4>${inline(name)}</h4>${rest.trim()?`<p>${rest}</p>`:''}${CTA(href)}</div></div>`; }).join('') + '</div>');
    } else out.push(`<${list}>${items.map(i=>`<li>${inline(i)}</li>`).join('')}</${list}>`);
    list = null; items = []; };
  const flushT = () => { if (!table) return; const rows = table.filter(r => !/^\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\||\|$/g,'').split('|').map(c=>c.trim()));
    const [hd, ...bd] = rows; out.push(`<div class="table-wrap"><table><thead><tr>${hd.map(c=>`<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${bd.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); table = null; };
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd(); let m;
    if (/^\s*\|/.test(line)) { flushP(); flushL(); (table = table || []).push(line.trim()); continue; } else flushT();
    if (!line.trim()) { flushP(); flushL(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)/))) { flushP(); flushL(); const n = m[1].length; const h = inline(m[2]); const id = slugify(m[2]);
      if (n === 2 && toc) toc.push({ id, h }); out.push(`<h${n} id="${id}">${h}</h${n}>`); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)/)) || (m = line.match(/^\s*\d+\.\s+(.*)/))) {
      flushP(); const t = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
      if (list !== t) { flushL(); list = t; } items.push(m[1]); continue;
    }
    if ((m = line.match(/^>\s?(.*)/))) { flushP(); flushL(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    flushL(); para.push(line.trim());
  }
  flushT(); flushP(); flushL(); return out.join('\n');
}

const DISCLOSURE = 'Este sitio puede recibir una comisión por compras realizadas a través de algunos enlaces, sin costo extra para vos.';
const css = `:root{--b:#2D3277;--b2:#1f2459;--y:#FFE600;--t:#1b1d2b;--m:#5b6075;--l:#e7e9f2;--bg:#f6f7fb}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--t);background:#fff;line-height:1.6}
a{color:var(--b)}img{max-width:100%;display:block}.wrap{max-width:1120px;margin:0 auto;padding:0 1.1rem}
.top{position:sticky;top:0;z-index:10;background:var(--b);color:#fff;box-shadow:0 2px 12px rgba(20,24,70,.25)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;height:62px;gap:1rem}
.brand{display:flex;align-items:center;gap:.6rem;color:#fff;text-decoration:none;font-weight:800;font-size:1.15rem;letter-spacing:-.01em}
.brand img{width:38px;height:38px;border-radius:50%;border:2px solid var(--y)}
.nav{display:flex;gap:1.1rem;font-size:.95rem;font-weight:600}.nav a{color:#fff;text-decoration:none;opacity:.9}.nav a:hover{color:var(--y);opacity:1}
@media(max-width:560px){.nav .hide-m{display:none}}
.hero{background:linear-gradient(135deg,var(--b) 0%,#3a40a0 100%);color:#fff;padding:3.2rem 0 3.6rem;position:relative;overflow:hidden}
.hero:after{content:"";position:absolute;right:-80px;top:-80px;width:280px;height:280px;border-radius:50%;background:var(--y);opacity:.14}
.hero h1{font-size:clamp(1.8rem,5vw,3rem);line-height:1.12;margin:.4rem 0 .8rem;letter-spacing:-.025em;max-width:760px}
.hero h1 span{color:var(--y)}.hero p{font-size:1.1rem;opacity:.9;max-width:600px;margin:0 0 1.4rem}
.pill{display:inline-block;background:var(--y);color:var(--b);font-weight:700;font-size:.78rem;padding:.25rem .7rem;border-radius:99px;text-transform:uppercase;letter-spacing:.04em}
.hero .social a{display:inline-block;margin:0 .5rem .5rem 0;padding:.5rem 1rem;border:1.5px solid rgba(255,255,255,.4);border-radius:99px;color:#fff;text-decoration:none;font-weight:600;font-size:.9rem}
.hero .social a:hover{background:#fff;color:var(--b)}
.sec{padding:2.4rem 0 3rem;background:var(--bg)}.sec h2{font-size:1.5rem;margin:0 0 1.2rem;letter-spacing:-.01em}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:1.3rem}
.card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(20,24,70,.08);border:1px solid var(--l);display:flex;flex-direction:column;text-decoration:none;color:inherit;transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(20,24,70,.14)}
.cover{aspect-ratio:16/10;width:100%;object-fit:contain;background:var(--b)}
.ph{aspect-ratio:16/10;background:linear-gradient(135deg,var(--b),#4b52b8);color:#fff;padding:1.3rem;display:flex;flex-direction:column;justify-content:flex-end;position:relative}
.ph:before{content:"";position:absolute;right:-40px;top:-40px;width:150px;height:150px;border-radius:50%;background:var(--y);opacity:.9}
.ph b{font-size:1.25rem;line-height:1.2;position:relative;letter-spacing:-.01em}.ph small{position:relative;color:var(--y);font-weight:700;margin-bottom:.4rem}
.card-b{padding:1rem 1.2rem 1.3rem;display:flex;flex-direction:column;gap:.5rem;flex:1}
.card h3{margin:0;font-size:1.12rem;line-height:1.3}.card p{margin:0;color:var(--m);font-size:.94rem}
.tags{display:flex;flex-wrap:wrap;gap:.35rem}.tag{background:#eef0fb;color:var(--b);font-size:.74rem;font-weight:600;padding:.18rem .6rem;border-radius:99px}
.meta{color:var(--m);font-size:.85rem}.more{margin-top:auto;font-weight:700;color:var(--b);font-size:.92rem}
.art-head{background:var(--bg);border-bottom:1px solid var(--l);padding:2rem 0 1.6rem}
.art{max-width:720px;margin:0 auto;padding:0 1.1rem}
.art-head h1{font-size:clamp(1.6rem,4.5vw,2.4rem);line-height:1.18;letter-spacing:-.02em;margin:.6rem 0}
.lead{font-size:1.12rem;color:var(--m);margin:0 0 .8rem}
.crumb{font-size:.85rem}.crumb a{text-decoration:none;font-weight:600}
.art-cover{max-width:720px;margin:1.5rem auto 0;padding:0 1.1rem}.art-cover img{border-radius:16px;width:100%;max-height:460px;object-fit:contain;background:var(--b)}
.body{font-size:1.07rem;line-height:1.75;padding-top:1.4rem;padding-bottom:2rem}
.body h2{font-size:1.5rem;line-height:1.25;margin:2.4rem 0 .8rem;letter-spacing:-.015em;scroll-margin-top:80px;padding-top:.2rem;border-top:3px solid var(--y);display:inline-block}
.body h3{font-size:1.2rem;margin:1.8rem 0 .5rem}.body h4{margin:1.2rem 0 .3rem}
.body p,.body li{color:#2a2d3d}.body li{margin:.35rem 0}.body ul,.body ol{padding-left:1.3rem}
.body strong{color:var(--t)}.body a{text-decoration-thickness:1.5px;text-underline-offset:2px}
blockquote{margin:1.4rem 0;padding:.9rem 1.1rem;background:#f1f2fb;border-left:4px solid var(--b);border-radius:0 10px 10px 0}
.disc{background:#fffbd6;border:1px solid #f1df5c;color:#5a4d00;padding:.7rem 1rem;border-radius:10px;font-size:.88rem;line-height:1.5}
.toc{background:var(--bg);border:1px solid var(--l);border-radius:12px;padding:1rem 1.2rem;margin:1.4rem 0;font-size:.95rem}
.toc b{display:block;margin-bottom:.4rem}.toc ol{margin:0;padding-left:1.2rem}.toc a{text-decoration:none}
.cta{display:inline-flex;align-items:center;gap:.4rem;background:var(--y);color:var(--b)!important;font-weight:800;text-decoration:none!important;padding:.7rem 1.2rem;border-radius:10px;font-size:.98rem;box-shadow:0 2px 0 #d9c300;transition:transform .1s,box-shadow .1s}
.cta:hover{transform:translateY(-1px);box-shadow:0 4px 0 #d9c300}.cta-wrap{margin:.2rem 0 1.4rem}
.products{display:grid;gap:.9rem;margin:1.2rem 0 1.6rem}
.product{display:flex;gap:1rem;border:1px solid var(--l);border-radius:14px;padding:1rem;background:#fff;box-shadow:0 1px 3px rgba(20,24,70,.06)}
.product-ic{flex:0 0 52px;height:52px;border-radius:12px;background:#eef0fb;display:grid;place-items:center;font-size:1.5rem}
.product h4{margin:0 0 .3rem;font-size:1.05rem;line-height:1.3}.product p{margin:0 0 .7rem;font-size:.95rem;color:var(--m)}.product .cta{margin-top:.3rem}
.table-wrap{overflow-x:auto;margin:1.2rem 0;border:1px solid var(--l);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:.95rem}th{background:var(--b);color:#fff;text-align:left;font-weight:700}
th,td{padding:.65rem .85rem;border-bottom:1px solid var(--l)}tbody tr:nth-child(even){background:var(--bg)}
.foot{background:var(--b2);color:#cfd2ea;padding:2.4rem 0 1.6rem;font-size:.9rem;margin-top:0}
.foot .wrap{display:grid;gap:1.4rem}.foot a{color:#fff}.foot .brand{font-size:1.05rem}
.foot .social{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center}.foot .social a{background:rgba(255,255,255,.1);padding:.45rem .9rem;border-radius:99px;text-decoration:none;font-weight:600}
.foot .social a:hover{background:var(--y);color:var(--b)}.foot .disc2{opacity:.85;max-width:700px}.foot .copy{opacity:.6;font-size:.82rem;border-top:1px solid rgba(255,255,255,.12);padding-top:1rem}
.empty{padding:2rem;text-align:center;color:var(--m)}`;
const SOCIAL = `<a href="https://x.com/cualconvieneAR" rel="me noopener" target="_blank">X</a> <a href="https://www.instagram.com/cualconvienear/" rel="me noopener" target="_blank">Instagram</a> <a href="https://www.tiktok.com/@cualconvienear" rel="me noopener" target="_blank">TikTok</a>`;
function page({ title, description, canonical, body, type = 'website', image }) {
  const img = image || `${cfg.url}/img/logo-512.png`;
  return `<!doctype html><html lang="${cfg.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta name="theme-color" content="#2D3277">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="/favicon.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:site_name" content="${BRAND}"><meta property="og:locale" content="es_AR"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${type}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${img}">
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}"><meta name="twitter:site" content="@cualconvieneAR"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${img}">
<link rel="alternate" type="application/rss+xml" title="${BRAND}" href="${cfg.url}/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style></head>
<body><header class="top"><div class="wrap"><a class="brand" href="/"><img src="/img/logo.png" alt="" width="38" height="38">${BRAND}</a>
<nav class="nav"><a href="/">Inicio</a><a href="/#guias">Guías</a><a class="hide-m" href="https://x.com/cualconvieneAR" rel="me noopener" target="_blank">Seguinos</a></nav></div></header>
<main>${body}</main>
<footer class="foot"><div class="wrap"><a class="brand" href="/"><img src="/img/logo.png" alt="" width="38" height="38">${BRAND}</a>
<div class="social"><b>Seguinos:</b> ${SOCIAL}</div><p class="disc2">${esc(DISCLOSURE)}</p><p class="copy">© ${new Date().getFullYear()} ${BRAND} · ${TAGLINE} · <a href="/rss.xml">RSS</a></p></div></footer></body></html>`;
}
const fmtDate = d => { try { return new Date(d + 'T12:00:00Z').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); } catch { return d; } };
const coverOf = slug => fs.existsSync(`public/social/${slug}/slide-1.jpg`) ? `/social/${slug}/slide-1.jpg` : null;
const tagsHtml = t => t.length ? `<div class="tags">${t.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>` : '';

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + '/posts', { recursive: true });
const posts = fs.existsSync(POSTS) ? fs.readdirSync(POSTS).filter(f => f.endsWith('.md')).map(f => {
  const [fm, body] = parseFM(fs.readFileSync(path.join(POSTS, f), 'utf8'));
  const slug = f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
  const toc = [];
  return { ...fm, slug, date: fm.date || f.slice(0, 10), html: md(body, toc), toc, tags: [].concat(fm.tags || []) };
}).filter(p => p.draft !== 'true').sort((a, b) => b.date.localeCompare(a.date)) : [];

for (const p of posts) {
  const url = `${cfg.url}/posts/${p.slug}`, cover = coverOf(p.slug);
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, datePublished: p.date, author: { '@type': 'Person', name: cfg.author }, description: p.description, ...(cover ? { image: cfg.url + cover } : {}) };
  const toc = p.toc.length >= 3 ? `<nav class="toc"><b>En esta guía</b><ol>${p.toc.map(t=>`<li><a href="#${t.id}">${t.h}</a></li>`).join('')}</ol></nav>` : '';
  const body = `<article><div class="art-head"><div class="art"><div class="crumb"><a href="/">Inicio</a> › ${p.tags[0] ? esc(p.tags[0]) : 'Guías'}</div>
<h1>${esc(p.title)}</h1>${p.description ? `<p class="lead">${esc(p.description)}</p>` : ''}<p class="meta">${fmtDate(p.date)} · Por ${esc(cfg.author)}</p>${tagsHtml(p.tags)}</div></div>
${cover ? `<div class="art-cover"><img src="${cover}" alt="${esc(p.title)}"></div>` : ''}
<div class="art body"><p class="disc">${esc(DISCLOSURE)}</p>${toc}${p.html}<p class="disc">${esc(DISCLOSURE)}</p></div></article>
<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
  fs.writeFileSync(`${OUT}/posts/${p.slug}.html`, page({ title: `${p.title} | ${BRAND}`, description: p.description, canonical: url, body, type: 'article', image: cover ? cfg.url + cover : null }));
}
const list = posts.map(p => { const c = coverOf(p.slug);
  return `<a class="card" href="/posts/${p.slug}">${c ? `<img class="cover" src="${c}" alt="" loading="lazy">` : `<div class="ph"><small>${BRAND}</small><b>${esc(p.title)}</b></div>`}
<div class="card-b">${tagsHtml(p.tags.slice(0,3))}<h3>${esc(p.title)}</h3><p>${esc(p.description || '')}</p><span class="meta">${fmtDate(p.date)}</span><span class="more">Leer guía →</span></div></a>`; }).join('');
const home = `<section class="hero"><div class="wrap"><span class="pill">Guías de compra</span><h1>${TAGLINE.replace('comprar mejor', '<span>comprar mejor</span>')}</h1>
<p>Te ayudamos a elegir qué conviene: tecnología, herramientas y hogar, con precios de Mercado Libre.</p><div class="social">${SOCIAL}</div></div></section>
<section class="sec" id="guias"><div class="wrap"><h2>Últimas guías</h2>${list ? `<div class="grid">${list}</div>` : '<p class="empty">Pronto, nuevas guías.</p>'}</div></section>`;
fs.writeFileSync(`${OUT}/index.html`, page({ title: `${BRAND} | ${TAGLINE}`, description: cfg.description, canonical: cfg.url + '/', body: home }));
fs.writeFileSync(`${OUT}/404.html`, page({ title: 'No encontrado', description: 'Página no encontrada', canonical: cfg.url, body: '<section class="sec"><div class="wrap"><h2>Página no encontrada</h2><p><a class="cta" href="/">Volver al inicio</a></p></div></section>' }));
fs.writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${cfg.url}/</loc></url>\n${posts.map(p => `<url><loc>${cfg.url}/posts/${p.slug}</loc><lastmod>${p.date}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(`${OUT}/rss.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(cfg.title)}</title><link>${cfg.url}</link><description>${esc(cfg.description)}</description><language>es</language>\n${posts.map(p => `<item><title>${esc(p.title)}</title><link>${cfg.url}/posts/${p.slug}</link><guid>${cfg.url}/posts/${p.slug}</guid><pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate><description>${esc(p.description || '')}</description></item>`).join('\n')}\n</channel></rss>\n`);
fs.writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${cfg.url}/sitemap.xml\n`);
fs.writeFileSync(`${OUT}/posts.json`, JSON.stringify(posts.map(({ html, toc, ...p }) => p), null, 1));
console.log(`OK: ${posts.length} posts -> ${OUT}/`);
if (fs.existsSync('public')) fs.cpSync('public', OUT, { recursive: true });
