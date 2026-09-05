# Factor Índice (rediseño) + filtro de sucursal compartido — diseño

## Contexto

Este documento junta dos trabajos relacionados que surgieron en la misma
conversación:

1. **Rediseño visual de "Factor Índice Overview"** (`/factor-indice`): la
   tarjeta principal (número gigante + barra de progreso 0-100%) y el
   gráfico semanal (línea con puntos verde/rojo, lee como scatter) no
   convencían, y la página es poco responsiva en mobile.
2. **Estandarizar el filtro de sucursal**, hoy implementado tres veces
   distinto en el proyecto:
   - Dashboard (`Header.tsx`): dropdown de selección única.
   - Ventas (`ventas/page.tsx`): dropdown multi-select con cuadraditos de
     letra (A/B/C) para identificar el orden de comparación.
   - Factor (`factor-indice/page.tsx`): dropdown multi-select con checkmarks
     y puntos de color por sucursal.

   El usuario pidió explícitamente que el filtro **no sea excluyente en
   ningún lado** (hoy en Dashboard sólo se puede elegir una sucursal a la
   vez) y que el control visual sea **sin color** (ni puntos ni letras,
   sólo texto con estado activo/inactivo).

Nota aparte (ya resuelto, no es parte de este spec): durante esta misma
conversación se encontró y corrigió un bug de datos real — `/api/ventas`
sumaba facturas con fecha emitida futura dentro del mes en curso a los
totales "hasta hoy", inflando el Factor Índice (376% en vez de ~97%) y el
Margen Neto del Dashboard. Ese fix ya está aplicado en
`src/app/api/ventas/route.ts`, `src/lib/date-utils.ts` (nuevo
`hoyISOChile()`), `src/app/factor-indice/page.tsx` y `src/app/page.tsx`, y
no requiere más trabajo de este spec.

## Alcance

- **A. Rediseño de Factor Índice** — visual únicamente, sin tocar los
  cálculos (ya corregidos).
- **B. Componente `SucursalFilter` compartido**, siempre multi-select, sin
  color, migrado a las 3 páginas que filtran por sucursal: Dashboard,
  Ventas, Factor. Esto incluye cambiar el modelo de datos del Dashboard de
  "una sucursal" a "una lista de sucursales" (0 seleccionadas = todas, 2+
  seleccionadas = se suman — mismo criterio que ya usa Factor hoy).

**Fuera de alcance:**
- Auditar si Producción/Distribuidora (otros endpoints, datos de Supabase)
  tienen el mismo problema de fechas futuras que se corrigió en
  `/api/ventas` — quedó marcado como pendiente aparte, no se toca acá.
- El mecanismo de "click en el treemap para comparar sucursales en el
  gráfico" del Dashboard (estado `selectedSucursales`, independiente del
  filtro principal) — sigue funcionando igual, no se unifica con el nuevo
  filtro. Son dos cosas distintas: el filtro principal decide qué datos
  entran a los KPIs; el click-to-compare del treemap es una comparación
  visual ad-hoc sólo dentro del gráfico.
- Rediseño de Ventas más allá de reemplazar su selector de sucursal por el
  componente compartido — el resto de esa página no cambia.

## A. Rediseño de Factor Índice

### A1. Header

Factor tiene hoy su propio `<header>` (título + campana sin funcionalidad +
botón de tema), duplicado del `Header.tsx` compartido del Dashboard.

- `Header.tsx` gana un prop `title?: string` (hoy dice
  "Data Analytics Desk"/"Analytics" fijo) para poder decir "Factor Índice".
- `Header.tsx` **deja de incluir el selector de sucursal** (ver sección B —
  pasa a vivir en la fila de filtros de cada página, no en el header).
- Factor usa `Header.tsx` en vez de su header propio. Se elimina el botón de
  campana (no tenía `onClick`, era decorativo) — la franja de alertas de la
  página ya cumple esa función, de forma funcional.

### A2. Fila de filtros

Orden final: **[Mes ▾]** → si "Comparar" está activo, **[vs mes ▾]** al
lado → separador → **[toggle Comparar]** (sutil, mismo lenguaje que el
resto — no un botón sólido morado) → **[SucursalFilter]** (sección B) →
**[Exportar]**.

"Por Semana / Por Día" **se saca de esta fila** y se muda al header de la
tarjeta del gráfico (sección A4) — sólo afecta a ese gráfico, no a toda la
página, igual que ya hicimos con el toggle barras/línea del Dashboard.

### A3. KPI — de tarjeta "hero" a tile de gauge

Se reemplaza la tarjeta grande (número 376.6% + barra 0-100%) por una fila
pareja de 3 tiles del mismo tamaño (mismo patrón que `KPICard` del
Dashboard):

1. **Factor Índice** — un medidor semicircular (gauge SVG) chico: arco de
   0% a un máximo dinámico (ej. `Math.max(120, factorGlobal * 1.2)`,
   redondeado), con una marca en el punto correspondiente a 60% (el
   umbral), el valor actual como relleno del arco, el número dentro/debajo,
   y el badge OPTIMIZADO/EN RIESGO chico debajo del número.
2. **Ventas Brutas** — mismo formato que hoy, sin la barra de progreso
   (que hoy siempre está al 100%, no informa nada).
3. **Gastos Operacionales** — ídem, sin la barra proporcional actual.

El texto explicativo "(Gastos/Ventas) × 100 · objetivo <60%" pasa a ser el
`sub` chico del tile del gauge, como el resto de los KPICard.

### A4. Header del gráfico — nuevas responsabilidades

El header de la tarjeta "Índice 60 por Semana/Día" pasa a tener:

- Título + subtítulo (igual que hoy).
- Toggle **Semana/Día** (texto compacto, como está hoy — no hace falta
  volverlo ícono, ya es corto y claro).
- Botón **Ver Detalle** (se muda acá desde la tarjeta hero — abre el mismo
  modal de siempre).
- Se elimina la leyenda estática "● Eficiente ≤60% / ● Riesgo >60%" — deja
  de tener sentido una vez que los puntos del gráfico dejan de ser
  semáforo (ver A5); la franja de riesgo (también A5) la reemplaza con más
  detalle.
- El control de zoom (rueda del mouse) y su botón "Restablecer zoom" quedan
  igual. El texto "Usá la rueda del mouse..." se oculta en mobile
  (`hidden sm:block`) — no aplica sin mouse.

### A5. Gráfico — línea limpia + franja de riesgo

- Los puntos de la línea dejan de ser verdes/rojos: pasan a ser del color
  de cada sucursal (mismo `getSucColor`), chicos y neutros — mismo lenguaje
  visual que `DailyPerformanceChart` del Dashboard (`dot={{r:4, fill:
  color}}`, `activeDot={{r:7}}`).
- El `ReferenceLine` en 60% se mantiene (sigue siendo información real y
  útil).
- **Nueva franja debajo del gráfico**: una fila por cada sucursal visible,
  con un segmento chico (div, no SVG) por cada período (semana/día) del eje
  X, coloreado verde si el índice de esa sucursal en ese período fue ≤60%,
  rojo si fue >60%, gris si no hay dato. Alineación por `flex: 1` en vez de
  intentar calcar píxel a píxel el eje X de Recharts (los períodos son
  categorías de ancho parejo, así que una fila flex con `N` divs de igual
  ancho ya queda alineada). A la izquierda de cada fila, el nombre de la
  sucursal (sin punto de color adicional — ya lo dice el texto, y evita
  otra fuente de color en la misma pantalla).
- El `CustomTooltip` hoy está hardcodeado en negro/vidrio sin importar el
  tema — se lleva al mismo patrón que el tooltip de `DailyPerformanceChart`
  (fondo `var(--card)`/blanco según tema, no una superposición oscura fija).

### A6. Modal de detalle

Se mantiene como modal (confirmado). Único cambio: la grilla interna que
hoy fuerza `repeat(min(sucursales,4), 1fr)` pasa a
`grid-cols-2 sm:grid-cols-4` — 2 columnas en mobile, hasta 4 en desktop.

### A7. Alertas

Sin cambios — la franja colapsable ya funciona bien y es responsiva.

## B. `SucursalFilter` — componente compartido

### B1. Componente nuevo: `src/components/ui/SucursalFilter.tsx`

```
interface SucursalFilterProps {
  sucursales: string[];       // opciones disponibles
  selected: string[];         // vacío = "Todas"
  onChange: (next: string[]) => void;
  disabled?: boolean;         // rol "local" restringido a una sucursal fija
}
```

- Chips inline, siempre visibles (sin dropdown que abrir), sin color: pill
  con texto, estado activo = relleno (`var(--active-bg)`/`var(--active-text)`,
  mismo estilo que ya usan otros toggles simples de la app), inactivo =
  contorno (`var(--border-2)`, `var(--text-2)`).
- Primer chip fijo: **"Todas"** — activo cuando `selected.length === 0`;
  clickearlo limpia la selección (`onChange([])`).
- Un chip por sucursal — click togglea esa sucursal dentro/fuera de
  `selected` (`onChange` con el array actualizado). Sin límite de cuántas
  se pueden elegir a la vez.
- Cuando `disabled` (rol local), se renderiza como el chip estático actual
  (sin interacción) mostrando sólo la sucursal permitida — mismo
  comportamiento que hoy tienen Header.tsx y Factor para ese rol.
- El color que cada sucursal tenga en su gráfico correspondiente (fijo por
  nombre en Factor/Dashboard, por orden de selección en Ventas) es asunto
  de cada gráfico — el chip del filtro no lo replica.

### B2. Migración Dashboard

- `DashboardFilters` (en `src/types/index.ts`): el campo `sucursal: string`
  pasa a `sucursales: string[]` (`[]` = todas). Actualizar
  `defaultFilters` en `page.tsx` acorde.
- `Header.tsx`: se elimina toda la sección de selector de sucursal (chip
  fijo de rol local incluido) — pasa a vivir en la fila de filtros de
  `page.tsx`, junto a Período/Rango días/Comparar, usando `SucursalFilter`.
- `page.tsx`: todo cálculo que hoy compara `filters.sucursal !== 'Todas'` /
  `=== 'Todas'` (KPIs, `gastosPorSucursal`, `accentColor` del gráfico,
  `computedComp` —comparación por mes—, restricción de rol local) pasa a
  sumar sobre `filters.sucursales` cuando no está vacío, e ir "sin filtro"
  (todas sumadas) cuando está vacío — mismo patrón que ya usa Factor con
  `sucSel`/`allSucs` hoy. Con 2+ sucursales elegidas, el `accentColor` del
  gráfico principal vuelve al azul por defecto (no hay "una" sucursal cuyo
  color usar) — el gráfico sigue mostrando Ventas/Gastos combinados, no
  pasa a modo multi-serie (eso sigue siendo exclusivo del click-to-compare
  del treemap, sin tocar). `computedCompLocal` (comparación local A vs B)
  usa su propio par de selects (`localA`/`localB`), independiente de este
  filtro — no requiere cambios.
- `getLocalRestriction()`: en vez de fijar `filters.sucursal`, fija
  `filters.sucursales: [restriccion]` y pasa `disabled` a `SucursalFilter`.

### B3. Migración Ventas

- Reemplaza su dropdown + cuadraditos de letra por `SucursalFilter`.
- La lógica de comparación (colores de línea por orden de selección,
  etiquetas "vs") no cambia — sólo cambia el control que alimenta
  `localSel`.

### B4. Migración Factor

- Reemplaza su dropdown + checkmarks por `SucursalFilter`, alimentando el
  `sucSel` que ya existe.

## Testing / verificación

- Verificación manual en el navegador (Playwright/browser tool), como se
  viene haciendo en esta conversación: capturas antes/después, click en
  cada toggle, chequeo de consola sin errores, `tsc --noEmit` limpio.
- No hay tests automatizados existentes para estas páginas — no se agregan
  en este trabajo (fuera de patrón del proyecto).
