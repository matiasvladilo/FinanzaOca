# Factor Índice + Filtro de Sucursal Compartido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar `/factor-indice` (header, filtros, KPI, gráfico, modal) y
reemplazar las tres implementaciones distintas del filtro de sucursal
(Dashboard, Ventas, Factor) por un único componente compartido, siempre
multi-select y sin color, incluyendo el cambio de Dashboard de "una
sucursal" a "una lista de sucursales".

**Architecture:** Next.js 16 App Router, componentes cliente (`'use client'`),
Tailwind v4 con variables CSS de tema (`var(--card)`, `var(--text)`, etc. —
ver `src/app/globals.css`), Recharts para gráficos. Sin framework de tests
configurado en el proyecto (no hay `jest`/`vitest` en `package.json`); la
verificación es `npx tsc --noEmit`, `npx eslint <archivos>`, y verificación
manual en el navegador (screenshots, `read_page`, click en cada control) —
mismo patrón ya usado en el resto del proyecto.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Recharts,
lucide-react (íconos), clsx.

## Global Constraints

- Sin test runner automatizado — cada tarea termina con `tsc --noEmit`
  limpio + verificación manual en `http://localhost:3000` (usar el preview
  ya configurado en `.claude/launch.json`, nombre `dashboard`).
- Estilos: siempre variables CSS de tema (`var(--card)`, `var(--text)`,
  `var(--text-2)`, `var(--text-3)`, `var(--border)`, `var(--border-2)`,
  `var(--hover)`, `var(--active-bg)`, `var(--active-text)`) — nunca colores
  Tailwind fijos (`bg-white`, `text-gray-900`) salvo que el archivo ya los
  use así de antes (ej. algunos inputs de Ventas/Factor siguen con
  `border-gray-200` — no es parte de este trabajo migrarlos).
- El filtro de sucursal compartido (`SucursalFilter`) **nunca** usa color
  por sucursal en el chip — sólo estado activo/inactivo. Los colores que
  cada gráfico ya asigna por sucursal (`SUC_COLORS` en Factor,
  `getSucursalColor` en Dashboard, `LOCAL_COLORS` en Ventas) no cambian.
- `sucursales: string[]` vacío siempre significa "todas" — nunca se guarda
  explícitamente la lista completa como equivalente a "todas".
- Fecha "hoy" para lógica de negocio: `hoyISOChile()` de
  `src/lib/date-utils.ts` (ya existe, no crear otra).
- Commits chicos, uno por tarea, en español, mismo estilo que el historial
  del repo (`git log --oneline`).

---

## Mapa de archivos

**Nuevo:**
- `src/components/ui/SucursalFilter.tsx` — chips de sucursal, multi-select, sin color.
- `src/components/factor-indice/FactorGauge.tsx` — gauge SVG semicircular.
- `src/components/factor-indice/RiskStrip.tsx` — franja de riesgo por sucursal bajo el gráfico.

**Modificados:**
- `src/types/index.ts` — `DashboardFilters.sucursal: string` → `sucursales: string[]`.
- `src/components/layout/Header.tsx` — prop `title`, se elimina el selector de sucursal embebido.
- `src/app/page.tsx` (Dashboard) — filtros, cálculos, uso de `SucursalFilter`.
- `src/app/ventas/page.tsx` — reemplaza su dropdown de locales por `SucursalFilter`.
- `src/app/factor-indice/page.tsx` — header compartido, filtros, KPI, gráfico, modal.

---

### Task 1: `SucursalFilter` — componente + Factor lo adopta

**Files:**
- Create: `src/components/ui/SucursalFilter.tsx`
- Modify: `src/app/factor-indice/page.tsx:440-499` (bloque del dropdown "Sucursal multi-select")

**Interfaces:**
- Produces: `SucursalFilter({ sucursales: string[], selected: string[], onChange: (next: string[]) => void, disabled?: boolean, className?: string })` — componente default export.

- [ ] **Step 1: Crear el componente**

```tsx
// src/components/ui/SucursalFilter.tsx
'use client';

interface SucursalFilterProps {
  /** Opciones disponibles (sin "Todas" — el chip "Todas" es implícito). */
  sucursales: string[];
  /** Vacío = "Todas" (sin filtro). */
  selected: string[];
  onChange: (next: string[]) => void;
  /** Rol restringido a una sola sucursal fija: se muestra sin interacción. */
  disabled?: boolean;
  className?: string;
}

const chipBase =
  'px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors whitespace-nowrap';

export default function SucursalFilter({
  sucursales, selected, onChange, disabled, className,
}: SucursalFilterProps) {
  const todasActiva = selected.length === 0;

  if (disabled) {
    const unica = selected[0] ?? sucursales[0] ?? '';
    return (
      <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
        <span
          className={chipBase}
          style={{ background: 'var(--active-bg)', borderColor: 'var(--active-bg)', color: 'var(--active-text)' }}
        >
          {unica}
        </span>
      </div>
    );
  }

  const toggle = (s: string) => {
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]);
  };

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onChange([])}
        className={chipBase}
        style={todasActiva
          ? { background: 'var(--active-bg)', borderColor: 'var(--active-bg)', color: 'var(--active-text)' }
          : { background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
      >
        Todas
      </button>
      {sucursales.map(s => {
        const activa = selected.includes(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            aria-pressed={activa}
            className={chipBase}
            style={activa
              ? { background: 'var(--active-bg)', borderColor: 'var(--active-bg)', color: 'var(--active-text)' }
              : { background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `SucursalFilter.tsx`.

- [ ] **Step 3: Reemplazar el dropdown de Factor por `SucursalFilter`**

En `src/app/factor-indice/page.tsx`, agregar el import:

```tsx
import SucursalFilter from '@/components/ui/SucursalFilter';
```

Reemplazar todo el bloque (líneas ~440-499, desde `{/* Sucursal multi-select */}` hasta su `</div>` de cierre — incluye el botón, el `ChevronDown`, y el dropdown con "Todos"/checkmarks) por:

```tsx
{/* Sucursal filter */}
<SucursalFilter
  sucursales={allSucs}
  selected={sucSel}
  onChange={setSucSel}
/>
```

`allSucs` y `sucSel`/`setSucSel` ya existen en el componente (no hace falta
tocar el resto del estado). El estado `sucOpen`/`setSucOpen` queda sin uso
tras este cambio — eliminar su declaración (`const [sucOpen, setSucOpen] =
useState(false);`) y el import de `Check` de `lucide-react` si queda sin
otros usos en el archivo (verificar con
`grep -n "Check\b" src/app/factor-indice/page.tsx` antes de sacarlo).

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint src/app/factor-indice/page.tsx src/components/ui/SucursalFilter.tsx`
Expected: sin errores nuevos (no debe quedar `sucOpen`/`Check` sin usar).

- [ ] **Step 5: Verificar en el navegador**

Abrir `/factor-indice`. Confirmar: los chips de sucursal aparecen en la
fila de filtros (sin dropdown), clickear una sucursal la activa/desactiva,
"Todas" limpia la selección, el gráfico y el KPI reaccionan igual que antes
(la lógica de filtrado no cambió, sólo el control).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/SucursalFilter.tsx src/app/factor-indice/page.tsx
git commit -m "Factor: reemplazar dropdown de sucursal por SucursalFilter compartido"
```

---

### Task 2: Ventas adopta `SucursalFilter`

**Files:**
- Modify: `src/app/ventas/page.tsx:568-572` (estado), `:602-608` (efecto click-outside), `:1320-1383` (dropdown)

**Interfaces:**
- Consumes: `SucursalFilter` de Task 1.

- [ ] **Step 1: Reemplazar el dropdown**

Agregar el import:

```tsx
import SucursalFilter from '@/components/ui/SucursalFilter';
```

Reemplazar el bloque completo `{/* Locales multi-select (hasta 2 para
comparar) */}` (líneas ~1320-1383, el `<div className="relative"
ref={localRef}>` con su botón + dropdown de letras A/B/C) por:

```tsx
{/* Locales filter */}
<SucursalFilter
  sucursales={localesDisponibles}
  selected={localSel}
  onChange={setLocalSel}
  disabled={!!localRestriccion}
/>
```

`localesDisponibles`, `localSel`/`setLocalSel`, y `localRestriccion` ya
existen en el archivo (línea ~1144-1148) — no requieren cambios.

- [ ] **Step 2: Limpiar estado que queda sin uso**

Eliminar `const [localOpen, setLocalOpen] = useState(false);` (línea 569),
`const localRef = useRef<HTMLDivElement>(null);` (línea 572) si
`localRef`/`localOpen` no se usan en ningún otro lado del archivo
(verificar con `grep -n "localOpen\|localRef" src/app/ventas/page.tsx`), y
el `useEffect` de click-outside que depende de `localOpen`/`localRef`
(líneas ~602-608).

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint src/app/ventas/page.tsx`
Expected: sin errores, sin variables sin usar.

- [ ] **Step 4: Verificar en el navegador**

Abrir `/ventas`. Confirmar: chips visibles sin dropdown, se pueden marcar
2+ locales (el modo comparación multi-local sigue activándose igual que
antes — el gráfico multi-serie y las etiquetas de color por orden de
selección no cambian, sólo el control de arriba).

- [ ] **Step 5: Commit**

```bash
git add src/app/ventas/page.tsx
git commit -m "Ventas: reemplazar dropdown de locales por SucursalFilter compartido"
```

---

### Task 3: Dashboard — `sucursal` (string) → `sucursales` (string[])

Esta es la tarea más grande: cambia el modelo de datos del filtro principal
del Dashboard. Se hace en un solo paso porque `Header.tsx` y `page.tsx`
tienen que quedar consistentes al mismo tiempo (no compila a medio camino).

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/components/layout/Header.tsx` (completo)
- Modify: `src/app/page.tsx` (múltiples secciones, detalladas abajo)

**Interfaces:**
- Produces: `DashboardFilters { fechaInicio, fechaFin, sucursales: string[], vista }`.
- Produces: `Header({ filters, onFiltersChange, title?, sucursalesDisponibles? })` — ya no maneja sucursal, `sucursalesDisponibles` queda sin uso en Header (se puede sacar del prop, ver Step 2).

- [ ] **Step 1: Actualizar el tipo**

En `src/types/index.ts`, reemplazar:

```ts
export interface DashboardFilters {
  fechaInicio: string;
  fechaFin: string;
  sucursal: Sucursal;
  vista: 'overview' | 'granular';
}
```

por:

```ts
export interface DashboardFilters {
  fechaInicio: string;
  fechaFin: string;
  /** Vacío = todas las sucursales (sin filtro). */
  sucursales: Sucursal[];
  vista: 'overview' | 'granular';
}
```

- [ ] **Step 2: Reescribir `Header.tsx`**

Reemplazar el archivo completo:

```tsx
'use client';

import { Sun, Moon, Sparkles } from 'lucide-react';
import type { DashboardFilters } from '@/types';
import { useTheme } from '@/providers/ThemeProvider';

interface HeaderProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  title?: string;
}

const THEME_META = {
  light:   { icon: <Moon   className="w-4 h-4" />, label: 'Modo claro',   next: 'Oscuro'  },
  dark:    { icon: <Sun    className="w-4 h-4" />, label: 'Modo oscuro',  next: 'Dracula' },
  dracula: { icon: <Sparkles className="w-4 h-4" />, label: 'Dracula',   next: 'Claro'   },
} as const;

export default function Header({ title = 'Data Analytics Desk' }: HeaderProps) {
  const { theme, cycle } = useTheme();
  const meta = THEME_META[theme];

  return (
    <header className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b sticky top-0 z-30 transition-colors"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}>

      <h1 className="text-[14px] sm:text-[18px] font-bold tracking-tight shrink-0" style={{ color: 'var(--text)' }}>
        {title}
      </h1>

      <div className="flex items-center gap-1 sm:gap-3">
        {/* Theme toggle — cycles light → dark → dracula */}
        <button onClick={cycle}
          title={`Cambiar a ${meta.next}`}
          className="w-9 h-9 flex items-center justify-center rounded-full border transition-all hover:border-[var(--active-text)] hover:text-[var(--active-text)]"
          style={{ background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-3)' }}>
          {meta.icon}
        </button>
      </div>
    </header>
  );
}
```

Nota: `filters`/`onFiltersChange` quedan en la interfaz pero sin uso interno
— se dejan porque el resto del layout puede necesitar pasarlos en el
futuro y no vale la pena tocar todos los call-sites de `<Header
filters={...} onFiltersChange={...} />` en esta tarea. Si el linter marca
`filters`/`onFiltersChange` como no usados dentro del componente (no
debería, son props declaradas pero no destructuradas — sólo se
desestructura `title`), no hace falta ninguna acción.

- [ ] **Step 3: Actualizar `defaultFilters` y el efecto de restricción de rol**

En `src/app/page.tsx`, línea 38:

```ts
const defaultFilters: DashboardFilters = { fechaInicio: '', fechaFin: '', sucursales: [], vista: 'overview' };
```

Agregar estado nuevo cerca de los otros `useState` (junto a
`selectedSucursales` en línea 56):

```ts
const [isLocalRole, setIsLocalRole] = useState(false);
```

Reemplazar el efecto de restricción de rol (líneas 72-78):

```tsx
// Aplicar restricción de local si el rol es 'local'
useEffect(() => {
  const localRestriccion = getLocalRestriction();
  if (localRestriccion) {
    setIsLocalRole(true);
    setFilters(f => ({ ...f, sucursales: [localRestriccion] }));
  }
}, []);
```

- [ ] **Step 4: Actualizar el resto de referencias a `filters.sucursal`**

En `src/app/page.tsx`:

**Línea 130** (`if (filters.sucursal !== 'Todas') { return; }`) →

```tsx
if (filters.sucursales.length > 0) {
  return;
}
```

**Línea 180** (dependencia del `useEffect` de producción/distribuidora) →

```tsx
}, [filters.sucursales, modoFiltro, mesFiltro, fechaDesde, fechaHasta]);
```

**`computed` useMemo (líneas 193-300)** — reemplazar el cuerpo completo por:

```tsx
const computed = useMemo(() => {
  if (!ccData?.ok) return null;
  const { porLocal, porLocalMes, chartData, mesesDisponibles } = ccData;
  const gastosPorMes = vData?.gastosPorMes ?? {};

  const registrosDiarios = vData?.registrosDiariosGastos ?? [];
  const gastosPorSucursal: Record<string, { gastos: number }> = {};
  if (mesFiltro && registrosDiarios.length > 0) {
    const hoyISO = hoyISOChile();
    for (const r of registrosDiarios) {
      if (!r.fecha || r.fecha.slice(0, 7) !== mesFiltro || r.fecha > hoyISO) continue;
      if (!gastosPorSucursal[r.sucursal]) gastosPorSucursal[r.sucursal] = { gastos: 0 };
      gastosPorSucursal[r.sucursal].gastos += r.monto;
    }
  } else {
    for (const [suc, d] of Object.entries(vData?.porSucursal ?? {})) {
      gastosPorSucursal[suc] = { gastos: d.gastos };
    }
  }

  const sucursales = filters.sucursales;
  const filtroActivo = sucursales.length > 0;
  const hasMes = !!mesFiltro;

  let ventasPorLocal: Record<string, number> = {};
  for (const local of Object.keys(porLocal)) {
    ventasPorLocal[local] = hasMes
      ? (porLocalMes[local]?.[mesFiltro]?.ventas ?? 0)
      : porLocal[local].ventas;
  }
  if (filtroActivo) {
    ventasPorLocal = Object.fromEntries(sucursales.map(s => [s, ventasPorLocal[s] ?? 0]));
  } else if (produccionSummary && (produccionSummary.ventas > 0 || produccionSummary.gastos > 0)) {
    ventasPorLocal['Producción'] = produccionSummary.ventas;
    gastosPorSucursal['Producción'] = { gastos: produccionSummary.gastos };
  }

  // Distribuidora entra como línea de gasto propia, sin ventas: las suyas se
  // cargan en ConectOca y ya están dentro de Producción.
  if (!filtroActivo && distribuidoraGastos > 0) {
    gastosPorSucursal['Distribuidora'] = { gastos: distribuidoraGastos };
  }

  const totalVentas = Object.values(ventasPorLocal).reduce((s, v) => s + v, 0);

  const gastosPorMesSucursal = vData?.gastosPorMesSucursal ?? {};
  let totalGastos = 0;
  if (!filtroActivo) {
    totalGastos = hasMes ? (gastosPorMes[mesFiltro] ?? 0) : (vData?.kpi?.totalGastos ?? 0);
  } else if (hasMes) {
    totalGastos = sucursales.reduce((s, suc) => s + (gastosPorMesSucursal[suc]?.[mesFiltro] ?? 0), 0);
  } else {
    totalGastos = sucursales.reduce((s, suc) => s + (vData?.porSucursal?.[suc]?.gastos ?? 0), 0);
  }
  if (!filtroActivo) totalGastos += (produccionSummary?.gastos ?? 0) + distribuidoraGastos;

  const margen = totalVentas > 0 ? ((totalVentas - totalGastos) / totalVentas) * 100 : null;

  const distribucion = Object.entries(ventasPorLocal)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([nombre, valor], i) => ({
      nombre, valor,
      porcentaje: totalVentas > 0 ? Math.round((valor / totalVentas) * 100) : 0,
      color: getSucursalColor(nombre, i),
    }));

  const realChartData = mesesDisponibles.map((key, i) => {
    const mes = parseInt(key.split('-')[1], 10);
    const ventas = !filtroActivo
      ? (chartData[i]?.ventas ?? 0)
      : sucursales.reduce((s, suc) => s + (porLocalMes[suc]?.[key]?.ventas ?? 0), 0);
    const gastos = !filtroActivo
      ? (gastosPorMes[key] ?? 0)
      : sucursales.reduce((s, suc) => s + (gastosPorMesSucursal[suc]?.[key] ?? 0), 0);
    return { dia: MESES_SHORT[mes] + ' ' + key.split('-')[0], ventas, gastos };
  });

  let medioPagoMontos = {
    efectivo: ccData.kpi?.totalEfectivo ?? 0,
    tarjeta:  ccData.kpi?.totalTarjeta  ?? 0,
    transf:   ccData.kpi?.totalTransf   ?? 0,
  };
  if (filtroActivo) {
    let ef = 0, tar = 0, tr = 0;
    for (const suc of sucursales) {
      const s = hasMes ? porLocalMes[suc]?.[mesFiltro] : porLocal[suc];
      if (s) { ef += s.efectivo; tar += s.tarjeta; tr += s.transf; }
    }
    medioPagoMontos = { efectivo: ef, tarjeta: tar, transf: tr };
  } else if (hasMes) {
    let ef = 0, tar = 0, tr = 0;
    for (const local of Object.keys(porLocal)) {
      const s = porLocalMes[local]?.[mesFiltro];
      if (s) { ef += s.efectivo; tar += s.tarjeta; tr += s.transf; }
    }
    medioPagoMontos = { efectivo: ef, tarjeta: tar, transf: tr };
  }

  return {
    totalVentas, totalGastos, margen, distribucion, realChartData,
    topSucursal: distribucion[0] ?? null,
    medioPago: medioPagoMontos,
    gastosPorSucursal,
  };
}, [ccData, vData, filters.sucursales, mesFiltro, produccionSummary, distribuidoraGastos]);
```

**`computedDateRange` useMemo (líneas 303-357)** — reemplazar las líneas que
usan `sucursal`:

```tsx
const sucursales = filters.sucursales;
const filtroActivo = sucursales.length > 0;
const dias     = (ccData as any).registrosDiarios ?? [];
const gastosDias = vData?.registrosDiariosGastos ?? [];

const ventasPorLocal: Record<string, number> = {};
let ef = 0, tar = 0, tr = 0;
for (const r of dias) {
  if (!r.fecha) continue;
  if (fechaDesde && r.fecha < fechaDesde) continue;
  if (fechaHasta && r.fecha > fechaHasta) continue;
  if (filtroActivo && !sucursales.includes(r.local)) continue;
  ventasPorLocal[r.local] = (ventasPorLocal[r.local] ?? 0) + r.ventas;
  ef += r.efectivo ?? 0; tar += r.tarjeta ?? 0; tr += r.transf ?? 0;
}
const gastosPorSucursal: Record<string, { gastos: number }> = {};
let totalGastos = 0;
for (const r of gastosDias) {
  if (!r.fecha) continue;
  if (fechaDesde && r.fecha < fechaDesde) continue;
  if (fechaHasta && r.fecha > fechaHasta) continue;
  if (filtroActivo && !sucursales.includes(r.sucursal)) continue;
  totalGastos += r.monto;
  if (r.sucursal) {
    if (!gastosPorSucursal[r.sucursal]) gastosPorSucursal[r.sucursal] = { gastos: 0 };
    gastosPorSucursal[r.sucursal].gastos += r.monto;
  }
}
if (!filtroActivo && produccionSummary && (produccionSummary.ventas > 0 || produccionSummary.gastos > 0)) {
  ventasPorLocal['Producción'] = produccionSummary.ventas;
  gastosPorSucursal['Producción'] = { gastos: produccionSummary.gastos };
  totalGastos += produccionSummary.gastos;
}
if (!filtroActivo && distribuidoraGastos > 0) {
  gastosPorSucursal['Distribuidora'] = { gastos: distribuidoraGastos };
  totalGastos += distribuidoraGastos;
}
```

(el resto del bloque —`totalVentas`, `margen`, `distribucion`, el
`return`— no cambia). Y su dependencia final:

```tsx
}, [ccData, vData, fechaDesde, fechaHasta, modoFiltro, filters.sucursales, computed, produccionSummary, distribuidoraGastos]);
```

**`computedComp` useMemo (líneas 363-380)** — reemplazar:

```tsx
const computedComp = useMemo(() => {
  if (!compOn || compareType !== 'mes' || !mesComp || !ccData?.ok) return null;
  const { porLocal, porLocalMes } = ccData;
  const gastosPorMes = vData?.gastosPorMes ?? {};
  const gastosPorMesSucursal = vData?.gastosPorMesSucursal ?? {};
  const sucursales = filters.sucursales;
  const filtroActivo = sucursales.length > 0;

  let totalVentas = 0;
  for (const local of Object.keys(porLocal)) {
    if (filtroActivo && !sucursales.includes(local)) continue;
    totalVentas += porLocalMes[local]?.[mesComp]?.ventas ?? 0;
  }
  const totalGastos = !filtroActivo
    ? (gastosPorMes[mesComp] ?? 0)
    : sucursales.reduce((s, suc) => s + (gastosPorMesSucursal[suc]?.[mesComp] ?? 0), 0);

  return { totalVentas, totalGastos };
}, [ccData, vData, mesComp, compOn, compareType, filters.sucursales]);
```

(`computedCompLocal`, líneas 383-400, no cambia — usa `localA`/`localB`,
no `filters.sucursal`.)

- [ ] **Step 5: Actualizar `sucursalesDisponibles` y agregar `SucursalFilter` a la fila de filtros**

`sucursalesDisponibles` (línea ~457-460) hoy incluye `'Todas'` como primer
elemento (lo necesitaba el dropdown viejo). El nuevo componente no lo
necesita:

```tsx
const sucursalesDisponibles = useMemo(() => {
  if (!ccData?.porLocal) return [];
  return sortSucursales(Object.keys(ccData.porLocal));
}, [ccData]);
```

Las dos referencias que hacían `sucursalesDisponibles.filter(s => s !==
'Todas')` (líneas ~602 y ~609, en los `<select>` de comparación por local)
pasan a usar `sucursalesDisponibles` directo, sin el `.filter(...)`.

`<Header ... />` (línea ~475-479) pasa a:

```tsx
<Header
  filters={filters}
  onFiltersChange={setFilters}
  title="Data Analytics Desk"
/>
```

Y en la fila de filtros (`{/* ── Filtros ── */}`, después del botón "Rango
días" y antes de `{/* Separador */}` — ver línea ~592-593 en el archivo
original), agregar:

```tsx
<SucursalFilter
  sucursales={sucursalesDisponibles}
  selected={filters.sucursales}
  onChange={sucursales => setFilters(f => ({ ...f, sucursales }))}
  disabled={isLocalRole}
/>
```

con el import correspondiente:

```tsx
import SucursalFilter from '@/components/ui/SucursalFilter';
```

- [ ] **Step 6: Última referencia — `accentColor` del gráfico**

Línea ~736:

```tsx
accentColor={filters.sucursales.length === 1 ? getSucursalConfig(filters.sucursales[0]).color : '#2563EB'}
```

- [ ] **Step 7: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint src/app/page.tsx src/components/layout/Header.tsx src/types/index.ts`
Expected: cero errores. Si aparece algún otro archivo que todavía use
`filters.sucursal` (singular) fuera de los ya tocados, corregirlo del mismo
modo antes de seguir (buscar con
`grep -rn "filters\.sucursal\b" src --include="*.tsx"`).

- [ ] **Step 8: Verificar en el navegador**

Abrir `/`. Confirmar: sin selector de sucursal en el header (arriba a la
derecha sólo queda el toggle de tema); en la fila de filtros aparecen los
chips de sucursal; elegir 0 sucursales muestra los totales de siempre
("Todas"); elegir 1 sucursal filtra igual que antes; elegir 2 muestra la
**suma** de ambas en los 4 KPIs y en el gráfico principal. Cambiar de mes,
activar "Comparar", y el filtro de rango de días siguen funcionando. Sin
errores en consola.

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/components/layout/Header.tsx src/app/page.tsx
git commit -m "Dashboard: filtro de sucursal deja de ser excluyente (sucursal -> sucursales[])"
```

---

### Task 4: Factor adopta el `Header` compartido

**Files:**
- Modify: `src/app/factor-indice/page.tsx:1-45` (imports/helpers), `:174-210` (estado), `:389-411` (header propio)

**Interfaces:**
- Consumes: `Header({ filters, onFiltersChange, title })` de Task 3.

- [ ] **Step 1: Agregar el import y sacar lo que ya no hace falta**

Agregar:

```tsx
import Header from '@/components/layout/Header';
```

Sacar de los imports existentes: `Bell` (ya no se usa, el botón de campana
desaparece), `Sun, Moon, Sparkles` (el theme toggle ahora lo maneja
`Header`, ya no el propio archivo) de la línea de imports de
`lucide-react`. Sacar el import `useTheme` (línea 18) si no se usa en
ningún otro lado del archivo (`grep -n "useTheme\|themeMeta\|theme," src/app/factor-indice/page.tsx`
para confirmar).

Sacar la constante `THEME_META` (líneas 41-45) — ese objeto vivía acá
duplicado del que ya tiene `Header.tsx`.

- [ ] **Step 2: Sacar el estado y la lógica de tema del componente**

Eliminar dentro de `FactorIndicePage`:

```tsx
const { theme, cycle } = useTheme();
const themeMeta = THEME_META[theme];
```

(quedaban en las primeras líneas del componente, justo después de la
declaración de la función).

`Header.tsx` necesita `filters`/`onFiltersChange` en su firma aunque no
los use internamente (ver Task 3 Step 2) — Factor le puede pasar un objeto
mínimo, ya que esta página no comparte el tipo `DashboardFilters` del
Dashboard:

```tsx
const headerFiltersStub = { fechaInicio: '', fechaFin: '', sucursales: [], vista: 'overview' as const };
```

Declarar esa constante fuera del componente (junto a otras constantes
top-level del archivo, cerca de `SUC_COLORS`).

- [ ] **Step 3: Reemplazar el header propio**

Reemplazar todo el bloque (líneas ~389-410, desde `{/* ── Header ── */}`
hasta el `</header>` de cierre) por:

```tsx
<Header
  filters={headerFiltersStub}
  onFiltersChange={() => {}}
  title="Factor Índice"
/>
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint src/app/factor-indice/page.tsx`
Expected: cero errores, cero imports sin usar.

- [ ] **Step 5: Verificar en el navegador**

Abrir `/factor-indice`. Confirmar: título "Factor Índice" en el header
compartido, el botón de tema (círculo arriba a la derecha) cicla
claro→oscuro→dracula igual que en el Dashboard, no queda ícono de campana.

- [ ] **Step 6: Commit**

```bash
git add src/app/factor-indice/page.tsx
git commit -m "Factor: usar el Header compartido en vez de uno propio"
```

---

### Task 5: Filtros de Factor — mover Semana/Día al gráfico, Comparar sutil

**Files:**
- Modify: `src/app/factor-indice/page.tsx` (fila de filtros ~412-543, header del gráfico ~740-772)

**Interfaces:**
- Produces: el estado `modo`/`setModo` (ya existente) ahora se lee/escribe desde el header del gráfico, no desde la fila de filtros superior.

- [ ] **Step 1: Sacar el toggle Semana/Día de la fila de filtros**

Eliminar de la fila de filtros el bloque:

```tsx
{/* Modo toggle */}
<div className="flex items-center rounded-full p-1 gap-1" style={{ background: 'var(--hover)' }}>
  {(['semana', 'dia'] as Modo[]).map(m => ( ... ))}
</div>
```

(no se borra el estado `modo`/`setModo` — se sigue usando, sólo cambia
dónde se renderiza el control).

- [ ] **Step 2: Hacer sutil el toggle "Comparar"**

Reemplazar el botón de Comparar (con clases `bg-purple-600
border-purple-600 text-white` cuando está activo) por el mismo lenguaje
visual que ya usan los chips de `SucursalFilter`:

```tsx
<button
  onClick={() => {
    const next = !compOn;
    setCompOn(next);
    if (next && !compMes2) {
      const sorted = [...mesesDisp].sort();
      const idx = mesSeleccionado ? sorted.indexOf(mesSeleccionado) : sorted.length - 1;
      setCompMes2(idx > 0 ? sorted[idx - 1] : sorted[0] ?? '');
    }
  }}
  className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-medium border transition-all"
  style={compOn
    ? { background: 'var(--active-bg)', borderColor: 'var(--active-bg)', color: 'var(--active-text)' }
    : { background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
>
  <GitCompare className="w-3.5 h-3.5 opacity-80" />
  <span className="font-semibold text-[11px]">Comparar</span>
</button>
```

- [ ] **Step 3: Agregar el toggle Semana/Día al header del gráfico**

En el header de la tarjeta del gráfico (línea ~742, dentro del `<div
className="flex items-start justify-between mb-4">`), agregar el control
junto al título, antes del grupo de la derecha (zoom/leyenda):

```tsx
<div>
  <h3 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>
    Índice 60 por {modo === 'semana' ? 'Semana' : 'Día'}
  </h3>
  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
    (Gastos / Ventas) × 100 · punto verde ≤60% · rojo &gt;60% · sólo los 4 locales, sin Producción
  </p>
</div>
<div className="flex items-center gap-3">
  <div className="flex items-center rounded-full p-1 gap-1" style={{ background: 'var(--hover)' }}>
    {(['semana', 'dia'] as Modo[]).map(m => (
      <button key={m} onClick={() => setModo(m)}
        className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
        style={modo === m
          ? { background: 'var(--card)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
          : { color: 'var(--text-3)' }}>
        {m === 'semana' ? 'Por Semana' : 'Por Día'}
      </button>
    ))}
  </div>
  {/* resto del grupo derecho (zoom / Ver Detalle, agregado en Task 6) sigue acá */}
</div>
```

(este paso reubica el JSX que ya existía en la fila de filtros — no crea
lógica nueva, sólo mueve el bloque de botones al nuevo lugar dentro del
`div` de la derecha del header del gráfico, que ya existía con el botón de
"Restablecer zoom" y la leyenda verde/rojo — la leyenda se saca recién en
Task 7).

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint src/app/factor-indice/page.tsx`

- [ ] **Step 5: Verificar en el navegador**

Fila de filtros más corta (Mes, Comparar sutil, chips de sucursal,
Exportar). El toggle Semana/Día ahora vive en el header del gráfico y
sigue funcionando (cambia el agrupamiento de los datos).

- [ ] **Step 6: Commit**

```bash
git add src/app/factor-indice/page.tsx
git commit -m "Factor: mover toggle Semana/Día al gráfico, Comparar más sutil"
```

---

### Task 6: `FactorGauge` + KPI como fila de 3 tiles

**Files:**
- Create: `src/components/factor-indice/FactorGauge.tsx`
- Modify: `src/app/factor-indice/page.tsx:582-677` (tarjeta hero completa)

**Interfaces:**
- Produces: `FactorGauge({ value: number, threshold?: number, optimized: boolean, loading?: boolean })`.
- Consumes en Factor: `factorGlobal`, `isOpt`, `loading`, `totalVentas`, `totalGastos`, `fmt`, `mesSeleccionado`, `sucSel`, `allSucs` (todos ya existen en el componente).

- [ ] **Step 1: Crear `FactorGauge`**

```tsx
// src/components/factor-indice/FactorGauge.tsx
'use client';

interface FactorGaugeProps {
  /** Índice actual (ej. 96.8). null mientras no hay dato. */
  value: number | null;
  threshold?: number;
  optimized: boolean;
  loading?: boolean;
}

const SIZE = 160;
const STROKE = 14;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = CX - STROKE;
const GAUGE_START = -90; // extremo izquierdo del arco (0%)
const GAUGE_END = 90;    // extremo derecho del arco (100% del máximo)

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function angleForPct(pct: number) {
  const clamped = Math.max(0, Math.min(1, pct));
  return GAUGE_START + clamped * (GAUGE_END - GAUGE_START);
}

export default function FactorGauge({ value, threshold = 60, optimized, loading }: FactorGaugeProps) {
  const safeValue = value ?? 0;
  const max = Math.max(threshold * 2, Math.ceil((safeValue * 1.15) / 10) * 10);
  const pct = safeValue / max;
  const thresholdPct = threshold / max;

  const valueAngle = angleForPct(pct);
  const thresholdAngle = angleForPct(thresholdPct);
  const thresholdP1 = polarToCartesian(CX, CY, R - STROKE / 2 - 3, thresholdAngle);
  const thresholdP2 = polarToCartesian(CX, CY, R + STROKE / 2 + 3, thresholdAngle);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE / 2 + STROKE}`} width="100%" style={{ maxWidth: 140, display: 'block', margin: '0 auto' }}
      role="img" aria-label={loading || value === null ? 'Factor Índice cargando' : `Factor Índice ${value}%`}>
      <path d={describeArc(CX, CY, R, GAUGE_START, GAUGE_END)} fill="none"
        stroke="var(--hover)" strokeWidth={STROKE} strokeLinecap="round" />
      {!loading && value !== null && (
        <>
          <path d={describeArc(CX, CY, R, GAUGE_START, valueAngle)} fill="none"
            stroke={optimized ? '#22C55E' : '#EF4444'} strokeWidth={STROKE} strokeLinecap="round" />
          <line x1={thresholdP1.x} y1={thresholdP1.y} x2={thresholdP2.x} y2={thresholdP2.y}
            stroke="var(--text-3)" strokeWidth={2} />
        </>
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Reemplazar la tarjeta hero por la fila de 3 tiles**

Reemplazar todo el bloque `{/* ── Hero: Factor Índice ── */}` (líneas
~582-677, la tarjeta grande con el número 52-64px y la barra 0-100%) por:

```tsx
{/* ── KPIs: Factor Índice (gauge) + Ventas + Gastos ──────────────────── */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
  <div className="rounded-2xl p-4 flex flex-col items-center text-center gap-1"
    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
    <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-3)' }}>
      Factor Índice{mesSeleccionado ? ` · ${mesLabel(mesSeleccionado)}` : ''}
    </p>
    <FactorGauge value={loading ? null : factorGlobal} optimized={isOpt} loading={loading} />
    <p className="text-[24px] font-black leading-none -mt-2"
      style={{ color: loading ? 'var(--text-3)' : isOpt ? 'var(--text)' : '#EF4444' }}>
      {loading ? '…' : factorGlobal !== null ? `${factorGlobal}%` : '—'}
    </p>
    {factorGlobal !== null && !loading && (
      <div className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold',
        isOpt ? 'border-green-400 text-green-600' : 'border-red-400 text-red-600'
      )}>
        {isOpt ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        {isOpt ? 'OPTIMIZADO' : 'EN RIESGO'}
      </div>
    )}
    <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
      (Gastos / Ventas) × 100 · objetivo &lt;60%
      {sucSel.length > 0 && sucSel.length < allSucs.length
        ? <span className="ml-1" style={{ color: 'var(--active-text)' }}>· {sucSel.join(', ')}</span>
        : <span className="ml-1">· sin Producción</span>}
    </p>
  </div>

  <div className="rounded-2xl p-5 flex flex-col justify-center gap-2"
    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
    <span className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>Ventas Brutas</span>
    <span className="text-[24px] font-bold" style={{ color: 'var(--text)' }}>{loading ? '…' : fmt(totalVentas)}</span>
  </div>

  <div className="rounded-2xl p-5 flex flex-col justify-center gap-2"
    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
    <span className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>Gastos Operacionales</span>
    <span className="text-[24px] font-bold" style={{ color: 'var(--text)' }}>{loading ? '…' : fmt(totalGastos)}</span>
  </div>
</div>
```

Con el import correspondiente:

```tsx
import FactorGauge from '@/components/factor-indice/FactorGauge';
```

El botón "Ver Detalle" que vivía en la tarjeta hero (y el estado
`showModal`/`setShowModal` que lo abre) se mueve al header del gráfico —
agregarlo dentro del `div` de la derecha creado en Task 5 Step 3, después
del toggle Semana/Día:

```tsx
<button onClick={() => setShowModal(true)}
  className="py-1.5 px-3 rounded-xl text-[12px] font-semibold transition-all"
  style={{ border: '1.5px solid var(--border-2)', color: 'var(--text-2)' }}
  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--active-text)'; (e.currentTarget as HTMLElement).style.color = 'var(--active-text)'; }}
  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; }}>
  Ver Detalle
</button>
```

El nuevo diseño no incluye el indicador "Bajo umbral/Sobre umbral" (ícono
`TrendingDown`/`TrendingUp` + texto) que tenía la tarjeta hero original —
queda redundante con el badge OPTIMIZADO/EN RIESGO que ya se muestra debajo
del gauge. Sacar `TrendingDown, TrendingUp` del import de `lucide-react` al
principio del archivo (confirmar antes con
`grep -n "TrendingDown\|TrendingUp" src/app/factor-indice/page.tsx` que no
quedan otros usos).

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint src/app/factor-indice/page.tsx src/components/factor-indice/FactorGauge.tsx`

- [ ] **Step 5: Verificar en el navegador**

Confirmar: 3 tiles del mismo tamaño arriba (gauge + Ventas + Gastos), el
gauge dibuja un arco semicircular con el relleno hasta el valor actual y
una marca en el punto del umbral (60% del máximo del arco), color verde si
`isOpt` o rojo si no. "Ver Detalle" ahora está en el header del gráfico y
sigue abriendo el modal. Si el arco se ve invertido o cortado, ajustar
`GAUGE_START`/`GAUGE_END` en `FactorGauge.tsx` (con estos valores debería
verse un semicírculo apuntando hacia arriba, de izquierda a derecha) y
volver a verificar visualmente antes de commitear.

- [ ] **Step 6: Commit**

```bash
git add src/components/factor-indice/FactorGauge.tsx src/app/factor-indice/page.tsx
git commit -m "Factor: KPI hero -> gauge chico en fila de 3 tiles, Ver Detalle al gráfico"
```

---

### Task 7: `RiskStrip` + puntos neutros en el gráfico

**Files:**
- Create: `src/components/factor-indice/RiskStrip.tsx`
- Modify: `src/app/factor-indice/page.tsx` (`CustomDot`, header del gráfico, debajo del `ResponsiveContainer`)

**Interfaces:**
- Produces: `RiskStrip({ data: Record<string, any>[], sucursales: string[], getColorLabel?: never })` — recibe las mismas filas que ya arma `indice50Data`/`visibleChartData` (cada fila tiene `semana: string` y, por sucursal, un número o `undefined`).

- [ ] **Step 1: Crear `RiskStrip`**

```tsx
// src/components/factor-indice/RiskStrip.tsx
'use client';

interface RiskStripProps {
  /** Mismas filas que consume el LineChart: { semana: string, [sucursal]: number | undefined }[] */
  data: Record<string, any>[];
  sucursales: string[];
  threshold?: number;
}

export default function RiskStrip({ data, sucursales, threshold = 60 }: RiskStripProps) {
  if (data.length === 0 || sucursales.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {sucursales.map(suc => (
        <div key={suc} className="flex items-center gap-2">
          <span className="text-[10px] font-medium w-16 flex-shrink-0 truncate" style={{ color: 'var(--text-3)' }}>
            {suc}
          </span>
          <div className="flex-1 flex gap-0.5">
            {data.map(row => {
              const idx = row[suc];
              const bg = idx === undefined ? 'var(--hover)' : idx <= threshold ? '#22C55E' : '#EF4444';
              return (
                <div key={row.semana} className="flex-1 h-2 rounded-sm" style={{ background: bg }}
                  title={`${row.semana}: ${idx !== undefined ? idx + '%' : 'sin dato'}`} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Puntos neutros en el gráfico**

Reemplazar `CustomDot` (líneas ~48-56 de `factor-indice/page.tsx`) — hoy
pinta verde/rojo según `value <= 60`. Pasa a recibir el color de la línea:

```tsx
const CustomDot = (props: any) => {
  const { cx, cy, value, stroke } = props;
  if (cx == null || cy == null || value == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill={stroke} stroke="#fff" strokeWidth={2} />;
};
```

En el `<Line>` del gráfico (líneas ~822-835), el `dot={<CustomDot />}` ya
recibe `stroke` automáticamente de Recharts (es una prop estándar que
Recharts inyecta en los renderers de `dot`/`activeDot` con el color de la
línea) — no hace falta pasar nada adicional ahí.

- [ ] **Step 4: Sacar la leyenda estática, agregar `RiskStrip`**

En el header del gráfico (el `div` de la derecha creado en Task 5),
eliminar el bloque:

```tsx
<div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-3)' }}>
  <span className="flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Eficiente ≤60%
  </span>
  <span className="flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Riesgo &gt;60%
  </span>
</div>
```

Justo después del `</ResponsiveContainer>` (dentro del mismo `div` que lo
contiene, antes de su cierre), agregar:

```tsx
<RiskStrip data={visibleChartData} sucursales={sucursalesVisibles} />
```

Con el import:

```tsx
import RiskStrip from '@/components/factor-indice/RiskStrip';
```

- [ ] **Step 5: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint src/app/factor-indice/page.tsx src/components/factor-indice/RiskStrip.tsx`

- [ ] **Step 6: Verificar en el navegador**

Los puntos de la línea ahora son del color de cada sucursal (no
verde/rojo). Debajo del gráfico aparece una fila compacta por sucursal con
segmentos verdes/rojos alineados a cada semana/día. La leyenda estática de
arriba desapareció.

- [ ] **Step 7: Commit**

```bash
git add src/components/factor-indice/RiskStrip.tsx src/app/factor-indice/page.tsx
git commit -m "Factor: puntos neutros por sucursal + franja de riesgo bajo el gráfico"
```

---

### Task 8: Tooltip del gráfico — theme-aware

**Files:**
- Modify: `src/app/factor-indice/page.tsx:58-124` (`CustomTooltip`)

- [ ] **Step 1: Reemplazar el tooltip hardcodeado**

`CustomTooltip` hoy usa `background: 'rgba(10,14,28,0.92)'` fijo (vidrio
oscuro) sin importar el tema. Reemplazar el `<div style={{...}}>` externo
(las primeras líneas del `return`, antes del `.map`) para usar variables de
tema, manteniendo el resto de la estructura (título, filas por sucursal,
badge RIESGO/OK) igual:

```tsx
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const fmtMoney = (v: number) => v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`;
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      padding: '10px 14px',
      minWidth: 185,
      fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', letterSpacing: '-0.01em' }}>
        {label}
      </p>
      {payload.map((p: any) => {
        const ventas = p.payload[`__ventas_${p.dataKey}`];
        const gastos = p.payload[`__gastos_${p.dataKey}`];
        const isRisk = p.value > 60;
        return (
          <div key={p.dataKey} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: p.color,
                display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{p.dataKey}</span>
              <span style={{
                marginLeft: 'auto',
                fontWeight: 800,
                fontSize: 13,
                color: isRisk ? '#ef4444' : '#22c55e',
                letterSpacing: '-0.02em',
              }}>
                {p.value}%
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700,
                padding: '2px 5px', borderRadius: 20,
                background: isRisk ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                color: isRisk ? '#ef4444' : '#22c55e',
              }}>
                {isRisk ? 'RIESGO' : 'OK'}
              </span>
            </div>
            {ventas != null && (
              <div style={{ paddingLeft: 16, fontSize: 10, color: 'var(--text-3)', display: 'flex', gap: 10 }}>
                <span><span style={{ color: '#3b82f6' }}>V:</span> {fmtMoney(ventas)}</span>
                <span><span style={{ color: '#ef4444' }}>G:</span> {fmtMoney(gastos)}</span>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)' }}>
        Verde ≤60% · Rojo &gt;60%
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Verificar en el navegador**

Pasar el mouse sobre el gráfico en tema claro: tooltip blanco/gris claro
legible. Ciclar a oscuro/dracula con el botón de tema: el tooltip pasa a
fondo oscuro acorde. Antes se veía igual (vidrio negro) en los tres temas.

- [ ] **Step 4: Commit**

```bash
git add src/app/factor-indice/page.tsx
git commit -m "Factor: tooltip del gráfico respeta el tema (antes fijo oscuro)"
```

---

### Task 9: Modal de detalle — grilla responsiva

**Files:**
- Modify: `src/app/factor-indice/page.tsx:867` (línea del `style` con `gridTemplateColumns`)

- [ ] **Step 1: Cambiar la grilla fija por clases responsivas**

Reemplazar:

```tsx
<div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(sucursalesVisibles.length, 4)}, 1fr)` }}>
```

por:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint src/app/factor-indice/page.tsx`

- [ ] **Step 3: Verificar en el navegador**

Con `resize_window` a mobile (375px), abrir "Ver Detalle": 2 columnas
legibles. En desktop: hasta 4 columnas, igual que antes.

- [ ] **Step 4: Commit**

```bash
git add src/app/factor-indice/page.tsx
git commit -m "Factor: modal de detalle con grilla responsiva (2 cols mobile, 4 desktop)"
```

---

### Task 10: Verificación final end-to-end

**Files:** ninguno (sólo verificación).

- [ ] **Step 1: Chequeo estático completo**

Run: `npx tsc --noEmit`
Expected: cero errores.

Run: `npx eslint src/app/page.tsx src/app/ventas/page.tsx src/app/factor-indice/page.tsx src/components/layout/Header.tsx src/components/ui/SucursalFilter.tsx src/components/factor-indice/FactorGauge.tsx src/components/factor-indice/RiskStrip.tsx src/types/index.ts`
Expected: sin errores nuevos (warnings preexistentes del repo, no
relacionados a este trabajo, son aceptables — confirmar que son los mismos
que ya existían antes de este plan).

- [ ] **Step 2: Recorrido manual — Dashboard**

Abrir `/`. Probar: 0/1/2+ sucursales seleccionadas (KPIs suman
correctamente), Comparar por mes, Rango de días, toggle de tema, toggle
barras/línea del gráfico (de un trabajo anterior, no debería haberse roto).

- [ ] **Step 3: Recorrido manual — Ventas**

Abrir `/ventas`. Confirmar que los chips de sucursal seleccionan 1, 2+
locales y el modo comparación multi-local sigue andando.

- [ ] **Step 4: Recorrido manual — Factor Índice**

Abrir `/factor-indice`. Recorrer: header compartido con título correcto,
fila de filtros corta (Mes, Comparar sutil, chips de sucursal, Exportar),
gauge + Ventas + Gastos en una fila pareja, gráfico con puntos por color de
sucursal + franja de riesgo debajo, toggle Semana/Día y "Ver Detalle" en el
header del gráfico, tooltip theme-aware, modal con grilla responsiva,
franja de alertas colapsable sin cambios. Probar en viewport mobile
(`resize_window` 375px) que nada se corta ni desborda horizontalmente.

- [ ] **Step 5: Captura final**

Tomar un screenshot de `/factor-indice` en desktop y uno en mobile (light y
dark si el tiempo lo permite) para dejar registro del resultado.

- [ ] **Step 6: Commit final (si quedó algo suelto)**

```bash
git status
git add -A
git commit -m "Factor + filtro de sucursal: ajustes finales de verificación" --allow-empty
```
