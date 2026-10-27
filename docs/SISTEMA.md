# Sistema Afiliado Auto

Blog estático de guías de compra en español con enlaces de afiliado de **Mercado Libre Argentina** (programa principal) y Amazon como opcional. Cada push a `main` se despliega automáticamente en Vercel.

## Piezas
| Pieza | Dónde |
|---|---|
| Código y contenido | GitHub `CanchaYa202/afiliado-auto-blog` |
| Sitio publicado | Vercel, proyecto `afiliado-auto-blog` (auto-deploy desde `main`) |
| Cola de temas y log | Supabase, proyecto `afiliado-auto` (ref `hqsbxmzzuklykmnhalbh`), tablas `topic_queue` y `activity_log` |
| Afiliados | `site.config.json` → `mercadolibre` (principal) y `amazonTag` (opcional); `data/ml-links.json` (links del portal) |

## Los cuatro agentes
1. **Research (diario).** Busca keywords con intención de compra (\"mejor X\", \"cómo elegir X\", \"X vs Y\") en nichos: herramientas, hogar, tech, salud no médica, finanzas personales básicas. Evita temas saturados. Inserta filas en `topic_queue` con `keyword, niche, intent, score (0-100), status='pending'`. Registra en `activity_log` (agent='research').
2. **Content.** Toma el tema `pending` de mayor `score`, lo pasa a `status='writing'`, escribe un artículo de ~900-1500 palabras en español rioplatense neutro, con una sección `## Productos recomendados` que usa SOLO links oficiales `https://meli.la/...` de productos individuales (o listas de afiliados) generados en el generador de ML; nunca links de búsqueda/listado ni `matt_tool` manual. Si no hay links oficiales para el tema, se pide a Nicolas que los genere. No inventa precios ni specs.
3. **Publishing.** Commitea `content/posts/YYYY-MM-DD-slug.md` a `main` (GitHub connector `create_or_update_file` o `git push`). Vercel despliega solo. Actualiza la fila: `status='published', post_slug='slug'`. Opcional: publica un post/hilo en X con el link.
4. **Monitoring.** Revisa el último deploy en Vercel, que `/sitemap.xml` y cada post nuevo respondan 200, que los links de Mercado Libre sean `meli.la` oficiales registrados en `data/ml-links.json` (sin links `listado.` ni `matt_tool`), y los temas trabados en `writing`. Registra resultados y sugerencias en `activity_log` (agent='monitoring').

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
Cuerpo en Markdown (## subtítulos, listas, > recomendaciones, [texto](https://meli.la/XXXXXXX) — solo links oficiales del generador).
```
Opcional: `draft: true` para no publicarlo.

## Afiliados: cómo funciona

**Divulgación** (en cada post y en el pie): "Este sitio puede recibir una comisión por compras realizadas a través de algunos enlaces, sin costo extra para vos."

### Mercado Libre Afiliados (principal)
Reglas oficiales (Buenas prácticas y Términos del programa):
- **Solo generan comisión los links a productos individuales** (nuevos, vendedor con reputación verde o superior) **o a listas de afiliados públicas**. Los links a búsquedas (`listado.mercadolibre.com.ar/...`), categorías, home o carrito **no generan ganancia**: no se usan.
- Los links se generan **solo con el generador oficial** (Central de Afiliados y Creadores, Barra de afiliados o Generador de links) y dan URLs `meli.la/...`. **No se agregan ni modifican parámetros** (nada de `matt_tool` manual) ni se usan acortadores de terceros.
- **Ventana de atribución: 24 h corridas** desde el clic; la compra debe completarse en ese plazo.
- Prohibido: comprar con tus propios links, compartir en grupos privados o sitios no declarados, y anuncios pagos (Google Ads, etc.) hacia ML.

Cómo se usa en el blog: cada post termina con una sección `## Productos recomendados` con una lista de 1–3 productos `- [Nombre](https://meli.la/XXXX) — Precio al momento de publicar (DD/MM/AAAA): $X`. El build la convierte en tarjetas con botón amarillo "Ver precio en Mercado Libre →". Los links se registran en `data/ml-links.json` (por slug). `useParamFallback` está en `false` y el build no agrega parámetros. Si un tema no tiene links oficiales generados, el post no lleva links a ML (no usar búsquedas).

### Amazon (opcional)
`amazonTag` en `site.config.json`. Mientras empiece con `PENDIENTE`, los links de Amazon quedan sin tag; con un tag real se agrega `?tag=` a todos.

## Build local
`node build.js` → genera `dist/` (sin dependencias). Incluye `/`, `/posts/<slug>`, `/sitemap.xml`, `/rss.xml`, `/robots.txt`, `/posts.json`.
