# Rediseño "La Oca Corporate" — header navy + acentos de marca, fin del theming light/dark/dracula

**Fecha:** 2026-11-14
**Alcance:** visual (CSS/Tailwind/JSX de presentación) + eliminación del sistema de temas + nuevo asset de marca + nueva skill de proyecto con la guía de estilo.

## Contexto

Logo "La Oca": cabeza de pato/ganso mostaza (`#f9c404` aprox.), pico naranja (`#e28b29` aprox.), fondo/contorno navy (`#053b84` aprox.), wordmark cursivo "La Oca" en mostaza con contorno navy.

Hoy la app tiene 3 temas (`light`/`dark`/`dracula`) vía clases en `<html>` y variables CSS en `src/app/globals.css`, ciclados con un botón en `src/components/layout/Header.tsx`, persistidos en `localStorage["theme"]`, gestionados por `src/providers/ThemeProvider.tsx`, con un script anti-flash inline en `src/app/layout.tsx`.

Un refresh "Apple clean" (`docs/superpowers/specs/2026-10-25-apple-clean-ui-refresh-design.md`) ya suavizó sombras/bordes/segmented controls manteniendo el azul de marca y el sistema de 3 temas. Ese refresh se conserva como base estructural (hairline borders, sombra sutil, segmented controls); este diseño construye encima, pero revierte explícitamente la decisión de aquel spec de mantener 3 temas: pasa a un único look fijo.

Referencia de estilo pedida por el usuario: LATAM Airlines — header superior navy sólido de ancho completo con su wordmark arriba a la izquierda, contenido blanco debajo, color de marca usado solo en acentos puntuales (CTAs, estados activos), nunca como fondo general.

## Qué cambia

### 1. Eliminación del sistema de temas

- Se borra `src/providers/ThemeProvider.tsx` y su uso/wrap en `src/app/layout.tsx`.
- Se borra el botón de ciclado de tema y el objeto `THEME_META` en `src/components/layout/Header.tsx`.
- Se borra el script anti-flash inline en `src/app/layout.tsx`.
- Se borran los bloques `.dark` y `.dracula` (variables + overrides Tailwind puntuales) de `src/app/globals.css`.
- Deja de usarse `localStorage["theme"]`. No se migra ni se limpia la key ya guardada en el navegador de usuarios existentes — queda inerte, leerla sin usarla no rompe nada.

### 2. Paleta de marca — `src/app/globals.css`, bloque `:root`

Se mantienen sin cambios las variables neutras ya definidas por el refresh Apple-clean: `--bg`, `--card`, `--border`, `--border-2`, `--text`, `--text-2`, `--text-3`, `--divider`, `--skeleton`, `--chart-grid`, `--chart-axis`, `--card-shadow`.

Se agregan/cambian:

- `--header-bg: #053b84` (navy — hoy es blanco)
- `--header-text: #ffffff` (nuevo)
- `--active-bg: #fff7e0` (antes celeste `#eff6ff`)
- `--active-text: #053b84` (antes azul `#2563eb`)
- `--brand-mustard: #f9c404` (nuevo, acento primario: chips, botones, barras de gráfico)
- `--brand-orange: #e28b29` (nuevo, acento secundario)

`--sidebar-bg` y `--sidebar-border` no cambian (el sidebar se mantiene blanco, decisión ya tomada con el usuario).

### 3. Override global de clases Tailwind "duras" en azul

El refresh Apple-clean y versiones previas dejaron varias `bg-blue-600`, `text-blue-600`, `bg-blue-50`, etc. como clases directas (no vía variables) en componentes de filtros/KPIs/gráficos. En vez de reabrir cada componente, se agrega un bloque de overrides sin prefijo de clase de tema (ya no hace falta `.dark`/`.dracula`, solo queda un tema) que pisa esas utilidades puntuales para usar `--brand-mustard`/`--brand-orange`/`--active-text` en su lugar — mismo mecanismo que ya usaban `.dark`/`.dracula`, pero aplicado siempre. Cubre los selectores que hoy ya tienen un override en `.dark`/`.dracula` (aprox. líneas 105-224 de `globals.css`); no se audita la base de código entera buscando clases azules nuevas fuera de esa lista ya conocida.

### 4. `Header` — `src/components/layout/Header.tsx`

- Fondo: `var(--header-bg)` (navy), en vez de blanco.
- A la izquierda: wordmark "La Oca" (`public/brand/la-oca-wordmark.png`) vía `next/image`, en lugar del texto "Data Analytics Desk".
- Texto/íconos restantes del header pasan a blanco (`var(--header-text)`) para contraste.
- El avatar del asistente (`agente-claro.png`) se mantiene igual — ya tiene aro navy, combina con el fondo nuevo.
- Se elimina el botón de ciclado de tema (ver punto 1); no se agrega ningún control en su lugar.

### 5. Asset nuevo

`public/brand/la-oca-wordmark.png`: PNG con fondo transparente, recorte del wordmark del logo oficial que el usuario compartió en el chat. Ya generado y verificado durante el brainstorming en `scratchpad/oca-icon/oca-text-transparent.png`; se copia tal cual al proyecto.

### 6. Skill de proyecto — guía de estilo "La Oca"

Se crea una skill de proyecto (`.claude/skills/<nombre>/SKILL.md`, siguiendo el proceso de `skill-creator`) que documenta:

- Paleta de marca (hex de navy/mustard/naranja, origen: logo oficial).
- Principio "header navy + contenido claro + acento mostaza/naranja puntual, nunca como fondo general" (tomado de la referencia LATAM).
- Ubicación y uso del wordmark/asset de marca.
- Qué NO hacer: no reintroducir un sistema de temas light/dark/dracula sin discutirlo antes; no usar el acento mostaza como color de fondo grande (solo en chips/botones/estados activos).

Queda disponible para que trabajos de UI futuros en este proyecto se auto-apliquen el estilo sin tener que re-explicarlo en cada conversación.

## Qué NO cambia

- Sidebar y contenido de página siguen con fondo blanco/gris claro (sin navy); sin cambios de layout/espaciado del refresh Apple-clean (hairline borders, sombras sutiles, segmented controls siguen igual, solo cambia el color de acento que usan).
- Ninguna lógica de negocio, fetch, cálculo o comportamiento funcional.
- No se tocan tipografía, tamaños de fuente, ni el espaciado general más allá de lo ya vigente.
- No se migra/limpia la key `localStorage["theme"]` existente en navegadores de usuarios ya logueados.

## Riesgos / validación

- Cambiar `--header-bg` a navy afecta a todas las páginas (el Header es compartido) — es intencional.
- Falta verificar, al implementar, que el contraste del avatar del asistente y de cualquier texto/ícono adicional del header siga siendo legible sobre navy.
- Verificación: levantar el dev server, recorrer Dashboard/Ventas/Merma/Producción/Informes, confirmar que el header se ve navy con el wordmark en todas, que ya no aparece el botón de tema, y que los acentos mostaza/naranja reemplazaron al azul en los elementos ya mapeados por el refresh Apple-clean (filtros, KPI cards, gráfico).
