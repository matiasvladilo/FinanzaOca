---
name: la-oca-style
description: Guía de marca visual "La Oca" para este proyecto — paleta de colores, uso del wordmark, y reglas de estilo corporate (header navy + contenido claro + acentos mostaza/naranja). Usar antes de cualquier cambio visual/CSS/componente de UI en este repo.
---

# Estilo "La Oca"

Guía de marca de FinanzasOca. Definida en `docs/superpowers/specs/2026-11-14-la-oca-corporate-style-design.md` a partir del logo oficial "La Oca" (cabeza de pato/ganso mostaza, pico naranja, fondo/contorno navy) y de una referencia de estilo "corporate" — header sólido de marca + contenido claro + acento de marca puntual — inspirada en LATAM Airlines.

## Paleta de marca

| Token CSS | Hex | Uso |
|---|---|---|
| `--brand-navy` | `#053b84` | Header de la app, texto de acento sobre fondo claro, botones y rellenos activos sólidos |
| `--brand-navy-soft` | `#4d77b8` | Bordes/rings/texto de acento en peso intermedio |
| `--brand-navy-dark` | `#03285c` | Estados hover/focus de elementos navy sólidos |
| `--brand-mustard` | `#f9c404` | Definido pero **todavía sin uso** en la UI |
| `--brand-orange` | `#e28b29` | Definido pero **todavía sin uso** en la UI |

Todas definidas en `src/app/globals.css`, bloque `:root`. Además `--active-bg` es un tinte mostaza pálido con valor literal `#fff7e0` (no se deriva de `--brand-mustard`).

Estado actual: los botones y rellenos activos sólidos son **navy**, no mostaza. Los gráficos (Recharts) siguen usando hex azules literales; no usan la paleta de marca todavía.

## Principio de layout

**Header navy sólido + contenido claro + acento mostaza/naranja puntual — nunca mostaza/naranja como fondo de áreas grandes.** El sidebar y el contenido de página se mantienen blancos/grises claros (`--bg`, `--card`, `--sidebar-bg`). Cuando se adopten, el mostaza/naranja deben usarse solo en chips, barras de gráfico o estados puntuales (hoy aún no se usan) — igual que LATAM usa su rojo de marca solo en CTAs puntuales, nunca como fondo general.

## Wordmark

`public/brand/la-oca-wordmark.png` — PNG transparente, recorte del wordmark oficial del logo (1536×364px, relación de aspecto ≈ 4.22:1). Se usa en `src/components/layout/Header.tsx` vía `next/image`. Al redimensionar, escalar solo por altura (`h-* w-auto`) para no distorsionar la proporción.

## Clases Tailwind de azul → marca

Gran parte de la UI existente usa `bg-blue-600`/`text-blue-600`/etc. de Tailwind como acento. `src/app/globals.css` tiene un bloque de overrides globales (sin capa) que pisa **solo estas clases exactas** por los tokens de marca:

- `bg-blue-50/100/300/500/600/700`
- `text-blue-200/300/400/500/600/700/800`
- `border-blue-200/400/600`
- `ring-blue-200/300/400/500/700`
- `hover:bg-blue-300/700`, `hover:border-blue-400`, `hover:text-blue-300/400/600/800`
- `focus:border-blue-400`, `focus-visible:border-blue-400`, `focus-visible:ring-blue-400/500`

**NO se recolorean**: tonos no listados, modificadores de opacidad (ej. `bg-blue-500/15`), gradientes, `fill`/`stroke` y hex literales. Para esos casos usar `var(--brand-navy)` etc. a mano.

## Contraste sobre superficies oscuras

Todo lo que se apoya sobre `--header-bg` (navy) o una superficie oscura (ej. `bg-slate-900`) usa `--header-text` / `text-white` / `text-white/NN` para texto e iconos. Las pills "activas" sobre navy o superficies oscuras usan relleno claro (`bg-white`) con texto navy o `text-slate-900`, para que no desaparezcan navy sobre navy.

## Qué NO hacer

- No reintroducir un sistema de temas light/dark/dracula sin discutirlo antes — se eliminó deliberadamente (spec del 2026-11-14) a favor de un único look fijo.
- No usar `--brand-mustard`/`--brand-orange` como color de fondo de áreas grandes (sidebar, contenido, cards) — son acentos puntuales, no fondos.
- No usar mostaza como color de texto sobre fondo claro — el contraste es insuficiente. Para texto de acento sobre fondo claro usar `--brand-navy`/`--active-text`.
