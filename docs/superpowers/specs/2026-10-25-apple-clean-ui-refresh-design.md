# Refresh visual "Apple clean" — piloto Dashboard

**Fecha:** 2026-10-25
**Alcance:** solo visual (CSS/Tailwind/JSX de presentación). Cero cambios de lógica, fetch, cálculos o comportamiento funcional.

## Contexto

La app (Next.js + Tailwind, sistema de theming vía variables CSS en `globals.css` para light/dark/dracula) tiene hoy una estética de "dashboard SaaS genérico": pills de filtro con fondos sólidos muy saturados (azul/morado/verde), sombras marcadas en las cards, labels en mayúsculas bold con tracking ancho, KPI cards con borde-acento de color grueso a la izquierda + chip de ícono con fondo de color sólido.

El pedido es acercar la estética a algo más "Apple developer / limpio": bordes hairline en vez de sombra como separador principal, acentos de color usados con moderación, tipografía más liviana, menos ruido visual. Sin referencia visual exacta — criterio del implementador, con dos decisiones ya tomadas por el usuario:

- Arrancar por **una página piloto** (Dashboard, `/`) antes de propagar al resto.
- Mantener el **azul de marca actual**, pero usado con más moderación (fondos sólidos saturados → fondos sutiles + texto/ícono en color).

## Qué cambia

### 1. Tokens base — `src/app/globals.css`

- `--card-shadow`: de una sombra visible (`0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)` en light) a una casi imperceptible (`0 1px 2px rgba(0,0,0,0.04)`), replicado también en `.dark` y `.dracula` con su equivalente. El borde hairline (`var(--border)`, ya existe) pasa a ser el separador visual principal de las cards, no la sombra.
- `font-family` del `body`: reordenar para priorizar `-apple-system, BlinkMacSystemFont` antes de `Inter` (Inter queda de fallback, no se quita — sigue siendo la fuente en sistemas no-Apple).
- No se agregan variables nuevas de color de acento: se reutiliza `--active-bg` / `--active-text` (ya existen, ya están pensadas para esto) en los componentes que hoy usan `bg-blue-600`/`bg-purple-600`/`bg-emerald-600` sólidos.

### 2. `Header` (`src/components/layout/Header.tsx`)

- Título: `font-bold` → `font-semibold`.
- Más padding vertical (`py-3 sm:py-4` → `py-4 sm:py-5`).
- Sin cambios funcionales (el toggle de tema ya es sutil, queda igual).

### 3. `Sidebar` (`src/components/layout/Sidebar.tsx`)

- El bloque de logo (hoy `bg-blue-600` sólido, 36×36, con sombra) se achica y se suaviza: fondo con el azul en una variante más tenue, sin `shadow-md`.
- Los items de nav ya usan `--active-bg`/`--active-text` para el estado activo — se ajusta solo el padding/radio para que coincida con el resto del refresh (sin tocar la lógica de `isActive`/hover ya existente).

### 4. Toolbar de filtros del Dashboard (`src/app/page.tsx`)

Este es el elemento que más desentona hoy. Afecta a los botones: "Rango días", "Comparar", el toggle "Meses/Locales", "Total/Hasta hoy", y los `<select>` de comparar locales A/B.

- Patrón nuevo ("segmented control"): fondo `var(--card)` + borde hairline `var(--border-2)` en estado inactivo; estado activo = fondo `var(--active-bg)` (azul muy sutil) + texto en el color del acento correspondiente (azul/morado/verde, pero como texto, no como fondo sólido) + borde del mismo tono suave. Se elimina el fondo sólido saturado (`bg-blue-600`, `bg-purple-600`, `bg-emerald-600`) en estado activo.
- Los `<select>` de locales A/B pierden el `bg-blue-50`/`bg-purple-50` + texto de color fuerte por el mismo patrón hairline + texto de color.
- El botón "Aplicar" dentro del date picker (acción primaria explícita, no un toggle de filtro) puede mantener fondo azul sólido — es la única acción que amerita ese peso visual.

### 5. `KPICard` (`src/components/kpis/KPICard.tsx`)

Es el componente real que usa el Dashboard (`KPICards.tsx` en `src/components/dashboard/` es legado, no se importa desde ningún lado activo — no se toca).

- Se elimina el borde-acento grueso de 3px a la izquierda (`border-l-[3px] border-l-{color}-500`).
- El chip de ícono (hoy `w-8 h-8 rounded-xl` con fondo de color sólido tipo `bg-blue-50`) se mantiene pero más chico y discreto (ícono con color, fondo apenas perceptible).
- Label: de `uppercase font-bold tracking-widest` a `text-[11px] font-medium` normal-case.
- Sombra: usa el nuevo `--card-shadow` sutil + borde hairline en vez de depender de la sombra para destacarse.

## Qué NO cambia

- Ninguna lógica de negocio, fetch, cálculo, estado o estructura de datos en `page.tsx` ni en ningún componente.
- Ningún comportamiento funcional (filtros, comparación, persistencia en `sessionStorage`, etc.) — solo las clases/estilos de los elementos ya listados.
- No se agregan temas nuevos; `dark` y `dracula` se actualizan en paralelo para los mismos tokens, sin romper su comportamiento actual.
- No se tocan páginas fuera del Dashboard (`/`) en esta pasada. Una vez validado el piloto, se decide si se replica al resto (Ventas, Merma, Producción, Informes, Factor Índice, Insights, Eventos, Productos, Login) en un paso posterior.
- No se reemplaza el sistema de theming por variables CSS existente ni se introduce una librería de componentes nueva.

## Riesgos / validación

- Cambios puramente visuales en componentes compartidos (`Header`, `Sidebar`) se ven en todas las páginas aunque el "piloto" sea el Dashboard — es intencional (son el chrome común) y de bajo riesgo porque no cambia su lógica.
- Verificación: levantar el dev server, mirar el Dashboard en light/dark/dracula, confirmar que los filtros y KPI cards se ven con el nuevo estilo y que nada funcional se rompió (clicks en filtros, date picker, comparación, toggle de tema).
