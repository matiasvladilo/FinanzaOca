---
name: la-oca-style
description: Guía de marca visual "La Oca" para este proyecto — paleta de colores, uso del wordmark, y reglas de estilo corporate (header navy + contenido claro + acentos mostaza/naranja). Usar antes de cualquier cambio visual/CSS/componente de UI en este repo.
---

# Estilo "La Oca"

Guía de marca de FinanzasOca. Definida en `docs/superpowers/specs/2026-11-14-la-oca-corporate-style-design.md` a partir del logo oficial "La Oca" (cabeza de pato/ganso mostaza, pico naranja, fondo/contorno navy) y de una referencia de estilo "corporate" — header sólido de marca + contenido claro + acento de marca puntual — inspirada en LATAM Airlines.

## Paleta de marca

| Token CSS | Hex | Uso |
|---|---|---|
| `--brand-navy` | `#053b84` | Header de la app, texto de acento sobre fondo claro, botones sólidos |
| `--brand-navy-soft` | `#4d77b8` | Bordes/rings/texto de acento en peso intermedio |
| `--brand-navy-dark` | `#03285c` | Estados hover/focus de elementos navy sólidos |
| `--brand-mustard` | `#f9c404` | Acento primario puntual: chips activos, fondo pálido de estado activo (`--active-bg`) |
| `--brand-orange` | `#e28b29` | Acento secundario puntual |

Todas definidas en `src/app/globals.css`, bloque `:root`.

## Principio de layout

**Header navy sólido + contenido claro + acento mostaza/naranja puntual — nunca mostaza/naranja como fondo de áreas grandes.** El sidebar y el contenido de página se mantienen blancos/grises claros (`--bg`, `--card`, `--sidebar-bg`). El mostaza/naranja se usa solo en chips, botones, barras de gráfico, estados activos — igual que LATAM usa su rojo de marca solo en CTAs puntuales, nunca como fondo general.

## Wordmark

`public/brand/la-oca-wordmark.png` — PNG transparente, recorte del wordmark oficial del logo (1536×364px, relación de aspecto ≈ 4.22:1). Se usa en `src/components/layout/Header.tsx` vía `next/image`. Al redimensionar, escalar solo por altura (`h-* w-auto`) para no distorsionar la proporción.

## Clases Tailwind de azul → marca

Gran parte de la UI existente usa `bg-blue-600`/`text-blue-600`/etc. de Tailwind como su acento de marca (botones, chips activos, KPI cards, chat del asistente). En vez de tocar cada componente uno por uno, `src/app/globals.css` tiene un bloque de overrides globales (sin prefijo de clase de tema) que pisa esas clases exactas por los tokens de arriba. Si agregás un componente nuevo: seguí usando las clases Tailwind `bg-blue-*`/`text-blue-*`/`border-blue-*`/`ring-blue-*` normales (base, `hover:`, `focus:`, `focus-visible:`) — el override las recolorea automáticamente a la paleta La Oca. Solo usar `var(--brand-navy)`/`var(--brand-mustard)`/`var(--brand-orange)` a mano para casos que no entren en ese patrón (ej. SVGs inline, gráficos).

## Qué NO hacer

- No reintroducir un sistema de temas light/dark/dracula sin discutirlo antes — se eliminó deliberadamente (spec del 2026-11-14) a favor de un único look fijo.
- No usar `--brand-mustard`/`--brand-orange` como color de fondo de áreas grandes (sidebar, contenido, cards) — son acentos puntuales, no fondos.
- No usar mostaza como color de texto sobre fondo claro — el contraste es insuficiente. Para texto de acento sobre fondo claro usar `--brand-navy`/`--active-text`.
