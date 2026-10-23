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
2. **Content.** Toma el tema `pending` de mayor `score`, lo pasa a `status='writing'`, escribe un artículo de ~900-1500 palabras en español rioplatense neutro, con CTAs naturales y enlaces de Mercado Libre: búsqueda `https://listado.mercadolibre.com.ar/palabras-con-guiones` o página de producto real `https://articulo.mercadolibre.com.ar/MLA-...` / `https://www.mercadolibre.com.ar/.../p/MLA...` (verificada). No inventa precios ni specs.
3. **Publishing.** Commitea `content/posts/YYYY-MM-DD-slug.md` a `main` (GitHub connector `create_or_update_file` o `git push`). Vercel despliega solo. Actualiza la fila: `status='published', post_slug='slug'`. Opcional: publica un post/hilo en X con el link.
4. **Monitoring.** Revisa el último deploy en Vercel, que `/sitemap.xml` y cada post nuevo respondan 200, que los links de Mercado Libre estén mapeados en `data/ml-links.json` (o lleven `matt_tool`), y los temas trabados en `writing`. Registra resultados y sugerencias en `activity_log` (agent='monitoring').

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
Cuerpo en Markdown (## subtítulos, listas, > recomendaciones, [texto](https://listado.mercadolibre.com.ar/taladro-inalambrico)).
```
Opcional: `draft: true` para no publicarlo.

## Afiliados: cómo funciona

**Divulgación** (en cada post y en el pie): "Este sitio puede recibir una comisión por compras realizadas a través de algunos enlaces, sin costo extra para vos."

### Mercado Libre Afiliados (principal)
El link oficial se genera en la **Central de Afiliados y Creadores** (o la Barra de Afiliados → Compartir). Queda atribuida la compra de ese producto, u otro de la misma categoría, dentro de las 24 h posteriores al clic. Los links generados llevan tu identificación (`matt_tool`, y `matt_word` como etiqueta) o son links `mercadolibre.com/sec/...`. **No uses acortadores de terceros (bit.ly, etc.) ni modifiques los links del portal**: las reglas del programa lo prohíben.

El build aplica, en este orden:
1. **`data/ml-links.json` (recomendado, oficial):** mapa `"url original del post" → "link generado en el portal"`. Ejemplo:
   ```json
   { "https://listado.mercadolibre.com.ar/taladro-percutor-inalambrico-20v": "https://mercadolibre.com/sec/XXXXXXX" }
   ```
2. **Fallback por parámetro:** si `mercadolibre.mlAffiliateId` no es `PENDIENTE` y `useParamFallback` es `true`, agrega `?matt_tool=<ID>&matt_word=<mattWord>` a los links de ML que no estén en el mapa. Es el formato que muestran los links del portal, pero no es una API documentada; si el portal te da links `/sec/`, preferí el mapa y poné `useParamFallback: false`.

Para configurarlo: generá un link de cualquier producto en el portal, copiá el valor de `matt_tool` (y `matt_word` si querés) a `site.config.json`, y/o pegá los links por post en `data/ml-links.json`. Commit a `main` y listo.

### Amazon (opcional)
`amazonTag` en `site.config.json`. Mientras empiece con `PENDIENTE`, los links de Amazon quedan sin tag; con un tag real se agrega `?tag=` a todos.

## Build local
`node build.js` → genera `dist/` (sin dependencias). Incluye `/`, `/posts/<slug>`, `/sitemap.xml`, `/rss.xml`, `/robots.txt`, `/posts.json`.
