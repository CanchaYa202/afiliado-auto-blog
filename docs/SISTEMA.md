# Sistema Afiliado Auto

Blog estático de guías de compra en español con enlaces de afiliado de Amazon. Cada push a `main` se despliega automáticamente en Vercel.

## Piezas
| Pieza | Dónde |
|---|---|
| Código y contenido | GitHub `CanchaYa202/afiliado-auto-blog` |
| Sitio publicado | Vercel, proyecto `afiliado-auto-blog` (auto-deploy desde `main`) |
| Cola de temas y log | Supabase, proyecto `afiliado-auto` (ref `hqsbxmzzuklykmnhalbh`), tablas `topic_queue` y `activity_log` |
| Tag de afiliado | `site.config.json` → `amazonTag` |

## Los cuatro agentes
1. **Research (diario).** Busca keywords con intención de compra (\"mejor X\", \"cómo elegir X\", \"X vs Y\") en nichos: herramientas, hogar, tech, salud no médica, finanzas personales básicas. Evita temas saturados. Inserta filas en `topic_queue` con `keyword, niche, intent, score (0-100), status='pending'`. Registra en `activity_log` (agent='research').
2. **Content.** Toma el tema `pending` de mayor `score`, lo pasa a `status='writing'`, escribe un artículo de ~900-1500 palabras en español rioplatense neutro, con CTAs naturales y enlaces `https://www.amazon.com/dp/ASIN` (ASIN verificado) o `https://www.amazon.com/s?k=...` (búsqueda). No inventa precios ni specs.
3. **Publishing.** Commitea `content/posts/YYYY-MM-DD-slug.md` a `main` (GitHub connector `create_or_update_file` o `git push`). Vercel despliega solo. Actualiza la fila: `status='published', post_slug='slug'`. Opcional: publica un post/hilo en X con el link.
4. **Monitoring.** Revisa el último deploy en Vercel, que `/sitemap.xml` y cada post nuevo respondan 200, que los links de Amazon lleven el tag, y los temas trabados en `writing`. Registra resultados y sugerencias en `activity_log` (agent='monitoring').

Flujo: Research → `topic_queue (pending)` → Content → (`writing`) → Publishing → repo `main` → Vercel → (`published`) → Monitoring → `activity_log`.

## Formato de un post
```markdown
---
title: Título con keyword
description: 140-160 caracteres para SEO
date: 2026-10-23
tags: ["hogar", "guía de compra"]
products: ["categoría o producto"]
---
Cuerpo en Markdown (## subtítulos, listas, > recomendaciones, [texto](https://www.amazon.com/dp/ASIN)).
```
Opcional: `draft: true` para no publicarlo.

## Cambiar el tag de Amazon
Editá `site.config.json`, cambiá `"amazonTag": "PENDIENTE-20"` por tu tag real (ej. `tutienda-20`) y hacé commit a `main`. El build (`node build.js`) agrega `?tag=` a **todos** los enlaces de Amazon de todos los posts, así que no hay que tocar los artículos.

## Build local
`node build.js` → genera `dist/` (sin dependencias). Incluye `/`, `/posts/<slug>`, `/sitemap.xml`, `/rss.xml`, `/robots.txt`, `/posts.json`.
