# Selector de meses múltiples en Ventas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el filtro de "un mes / todos los meses" de la página Ventas por un selector de **meses múltiples** (incluye combinaciones no contiguas, ej. Oct 2025 + Oct 2026 + Oct 2027), propagado a toda la página (KPIs, Tendencia, Top Proveedores, Transacciones, Proyección de Ventas, comparación por período).

**Architecture:** El modelo de estado pasa de dos strings (`mesDesde`/`mesHasta`, rango inclusivo) a un `Set<string>` (`mesesSel`, conjunto arbitrario de claves "YYYY-MM"). `mesDesde`/`mesHasta` se mantienen como **const derivados** (mín/máx del set) para que toda la lógica que ya asumía "un solo mes" (el toggle Total/Hasta-hoy, la Proyección de Ventas, el fetch a `/api/produccion-data`) siga funcionando sin cambios — solo las funciones que **filtran datos por mes** pasan a comprobar pertenencia al Set en vez de un rango.

**Tech Stack:** Next.js, React, TypeScript, TailwindCSS. Sin librerías nuevas.

## Global Constraints

- Archivo principal: `src/app/ventas/page.tsx`. Cambios adicionales en: `src/components/ui/MonthMultiSelect.tsx` (nuevo).
- No se toca `src/components/ui/PeriodSelect.tsx` — lo siguen usando Dashboard, Merma y Factor Índice sin cambios.
- No se toca el backend (`src/app/api/produccion-data/route.ts` ni ninguna otra ruta).
- La comparación por período ("Comparar" de arriba, `compOn`/`compMes`) no cambia de comportamiento.
- "Rango días" (`modoFiltro === 'dia'`) es ortogonal — no se toca.
- El toggle Total/Hasta-hoy y la card "Proyección de Ventas" solo tienen sentido con exactamente 1 mes elegido — se mantiene esa restricción (oculto/con mensaje para 2+ meses), no se generaliza a resolución por-mes.
- Cada task deja el archivo compilando (`npx tsc --noEmit` sin errores nuevos — el repo ya tiene un error preexistente no relacionado, `estree 2`, que no cuenta) y los tests (`npm test`) en verde.

---

## File Structure

- Modify: `src/app/ventas/page.tsx` — modelo de estado, funciones de filtrado, selector de período, label de "Comparar" en Tendencia.
- Create: `src/components/ui/MonthMultiSelect.tsx` — selector de meses múltiples (checklist agrupado por año).

---

### Task 1: Modelo de estado + migración de las funciones de filtrado (capa de datos)

**Files:**
- Modify: `src/app/ventas/page.tsx`

**Interfaces:**
- Produces: `mesesSel: Set<string>` (estado), `mesesSelOrdenados: string[]` (derivado, ordenado ascendente), `mesDesde`/`mesHasta: string` (derivados, mín/máx de `mesesSelOrdenados` — mismos nombres que antes, ahora `const` en vez de `useState`), helpers `mesDefault(meses: string[]): string`, `esContiguo(meses: string[]): boolean`, `formatMesesLabel(mesesOrdenados: string[]): string`.
- Consumes: nada de otros tasks.

Este task NO cambia el selector de período visible (sigue usando `PeriodSelect`, con su `onChange` adaptado al nuevo estado) — ese reemplazo visual es el Task 2. El objetivo acá es que el archivo compile y la página funcione exactamente igual que hoy (con un mes, o con "Todos los meses"), pero con el modelo de datos ya listo para selección arbitraria.

- [ ] **Step 1: Agregar los helpers nuevos, justo después de `keyToLabel`**

En `src/app/ventas/page.tsx`, ubicar:
```tsx
const MESES_LABELS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function keyToLabel(key: string) {
  const [anio, mes] = key.split('-');
  return `${MESES_LABELS[parseInt(mes, 10)]} ${anio}`;
}
type MesSlice = { ventas: number; efectivo: number; tarjeta: number; transf: number };
```
Insertar entre la función `keyToLabel` y el `type MesSlice`:
```tsx
const MESES_LABELS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function keyToLabel(key: string) {
  const [anio, mes] = key.split('-');
  return `${MESES_LABELS[parseInt(mes, 10)]} ${anio}`;
}

// ── Helpers para selección de meses múltiples ────────────────────────────
/** Mes actual si está en la lista, si no el más reciente disponible. */
function mesDefault(meses: string[]): string {
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  return meses.includes(mesActual) ? mesActual : meses[meses.length - 1];
}
/** ¿La lista ordenada de meses "YYYY-MM" es una secuencia consecutiva? */
function esContiguo(meses: string[]): boolean {
  for (let i = 1; i < meses.length; i++) {
    const [y0, m0] = meses[i - 1].split('-').map(Number);
    const [y1, m1] = meses[i].split('-').map(Number);
    if ((y1 * 12 + m1) - (y0 * 12 + m0) !== 1) return false;
  }
  return true;
}
/** Label para un conjunto de meses: 1 mes → el mes; contiguos → rango "A – B";
 *  hasta 4 sueltos → lista separada por comas; más → "N meses". */
function formatMesesLabel(mesesOrdenados: string[]): string {
  if (mesesOrdenados.length === 0) return 'Sin período';
  if (mesesOrdenados.length === 1) return keyToLabel(mesesOrdenados[0]);
  if (esContiguo(mesesOrdenados)) {
    return `${keyToLabel(mesesOrdenados[0])} – ${keyToLabel(mesesOrdenados[mesesOrdenados.length - 1])}`;
  }
  if (mesesOrdenados.length <= 4) return mesesOrdenados.map(keyToLabel).join(', ');
  return `${mesesOrdenados.length} meses`;
}

type MesSlice = { ventas: number; efectivo: number; tarjeta: number; transf: number };
```

- [ ] **Step 2: Reemplazar el estado `mesDesde`/`mesHasta`/`mesPill` por `mesesSel` + derivados**

Ubicar:
```tsx
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
  const [mesDesde, setMesDesde] = useState('');
  const [mesHasta, setMesHasta] = useState('');
  const [mesPill, setMesPill] = useState('');
```
Reemplazar por:
```tsx
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
  const [mesesSel, setMesesSel] = useState<Set<string>>(new Set());
  const mesesSelOrdenados = [...mesesSel].sort();
  const mesDesde = mesesSelOrdenados[0] ?? '';
  const mesHasta = mesesSelOrdenados[mesesSelOrdenados.length - 1] ?? '';
```

- [ ] **Step 3: Adaptar el default inicial al nuevo estado**

Ubicar (dentro del `.then(([caja, facturas]) => { ... })` del primer `useEffect` de carga):
```tsx
        setMesesDisponibles(meses);
        if (meses.length) {
          // Default: mes actual si está disponible, si no el más reciente
          const hoy = new Date();
          const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
          const seleccionado = meses.includes(mesActual) ? mesActual : meses[meses.length - 1];
          setMesDesde(seleccionado);
          setMesHasta(seleccionado);
          setMesPill(seleccionado);
        }
```
Reemplazar por:
```tsx
        setMesesDisponibles(meses);
        if (meses.length) {
          setMesesSel(new Set([mesDefault(meses)]));
        }
```

- [ ] **Step 4: Agregar el efecto de seguridad para selección vacía**

Justo después de ese mismo `useEffect` (busca el cierre `}, []);` que sigue a `.finally(() => setLoadingSheet(false));`), agregar un efecto nuevo a continuación:
```tsx
  // Si el usuario vacía la selección de meses (botón "Ninguno" del selector),
  // evita que los cálculos se queden sin ningún mes — vuelve al mismo default
  // que al cargar los datos.
  useEffect(() => {
    if (mesesSel.size === 0 && mesesDisponibles.length > 0) {
      setMesesSel(new Set([mesDefault(mesesDisponibles)]));
    }
  }, [mesesSel, mesesDisponibles]);
```

- [ ] **Step 5: `buildMonthChart` — firma y filtro**

Ubicar:
```tsx
    // ── Helper: chart data para un rango de meses ────────────────────────────
    function buildMonthChart(mDesde: string, mHasta: string, localFilter: string | null = null) {
      const includeProduccion = localFilter === null || localFilter === PRODUCCION_LOCAL;
      const locals = localFilter !== null
        ? (localFilter === PRODUCCION_LOCAL ? [] : [localFilter])
        : Object.keys(rawLocalMes);
      const meses = mesesDisponibles.filter(m => (!mDesde || m >= mDesde) && (!mHasta || m <= mHasta));
```
Reemplazar por:
```tsx
    // ── Helper: chart data para un conjunto de meses ──────────────────────────
    function buildMonthChart(mesesFiltro: Set<string>, localFilter: string | null = null) {
      const includeProduccion = localFilter === null || localFilter === PRODUCCION_LOCAL;
      const locals = localFilter !== null
        ? (localFilter === PRODUCCION_LOCAL ? [] : [localFilter])
        : Object.keys(rawLocalMes);
      const meses = mesesDisponibles.filter(m => mesesFiltro.has(m));
```
(El resto del cuerpo de la función, hasta su `return meses.map(...)`, no cambia — solo usa la variable local `meses`.)

- [ ] **Step 6: `buildTopProveedores` — firma y filtro**

Ubicar:
```tsx
    // ── Helper: top proveedores filtrado ─────────────────────────────────────
    function buildTopProveedores(fDesde: string, fHasta: string, mDesde: string, mHasta: string, modo: 'dia' | 'mes', localFilter: string | null = null) {
      if (localFilter === PRODUCCION_LOCAL) return produccionTopProveedores;
      const provMap: Record<string, number> = {};
      const provNombre: Record<string, string> = {};
      for (const r of rawDiasGastos) {
        if (!r.fecha || !r.proveedor) continue;
        if (localFilter !== null && r.sucursal !== localFilter) continue;
        if (modo === 'dia') {
          if (fDesde && r.fecha < fDesde) continue;
          if (fHasta && r.fecha > fHasta) continue;
        } else {
          // Usar mesKey (mes de pago) si disponible; si no, usar YYYY-MM de la fecha de emisión
          const mes = r.mesKey ?? r.fecha.slice(0, 7);
          if (mDesde && mes < mDesde) continue;
          if (mHasta && mes > mHasta) continue;
        }
```
Reemplazar por:
```tsx
    // ── Helper: top proveedores filtrado ─────────────────────────────────────
    function buildTopProveedores(fDesde: string, fHasta: string, meses: Set<string> | null, modo: 'dia' | 'mes', localFilter: string | null = null) {
      if (localFilter === PRODUCCION_LOCAL) return produccionTopProveedores;
      const provMap: Record<string, number> = {};
      const provNombre: Record<string, string> = {};
      for (const r of rawDiasGastos) {
        if (!r.fecha || !r.proveedor) continue;
        if (localFilter !== null && r.sucursal !== localFilter) continue;
        if (modo === 'dia') {
          if (fDesde && r.fecha < fDesde) continue;
          if (fHasta && r.fecha > fHasta) continue;
        } else {
          // Usar mesKey (mes de pago) si disponible; si no, usar YYYY-MM de la fecha de emisión
          const mes = r.mesKey ?? r.fecha.slice(0, 7);
          if (meses && !meses.has(mes)) continue;
        }
```

- [ ] **Step 7: `buildTransacciones` — firma y filtro**

Ubicar:
```tsx
    // ── Helper: transacciones (cierres de caja) filtrado ─────────────────────
    function buildTransacciones(fDesde: string, fHasta: string, mDesde: string, mHasta: string, modo: 'dia' | 'mes', localFilter: string | null = null) {
      let count = 0;
      for (const r of rawDiasCaja) {
        if (!r.fecha) continue;
        if (localFilter !== null && r.local !== localFilter) continue;
        if (modo === 'dia') {
          if (fDesde && r.fecha < fDesde) continue;
          if (fHasta && r.fecha > fHasta) continue;
        } else {
          const mes = r.fecha.slice(0, 7);
          if (mDesde && mes < mDesde) continue;
          if (mHasta && mes > mHasta) continue;
        }
        count++;
      }
      return count;
    }
```
Reemplazar por:
```tsx
    // ── Helper: transacciones (cierres de caja) filtrado ─────────────────────
    function buildTransacciones(fDesde: string, fHasta: string, meses: Set<string> | null, modo: 'dia' | 'mes', localFilter: string | null = null) {
      let count = 0;
      for (const r of rawDiasCaja) {
        if (!r.fecha) continue;
        if (localFilter !== null && r.local !== localFilter) continue;
        if (modo === 'dia') {
          if (fDesde && r.fecha < fDesde) continue;
          if (fHasta && r.fecha > fHasta) continue;
        } else {
          const mes = r.fecha.slice(0, 7);
          if (meses && !meses.has(mes)) continue;
        }
        count++;
      }
      return count;
    }
```

- [ ] **Step 8: `buildMultiLocalMonthChart` — firma y filtro**

Ubicar:
```tsx
    function buildMultiLocalMonthChart(mDesde: string, mHasta: string, locals: string[]): MultiChartRow[] {
      const meses = mesesDisponibles.filter(m => (!mDesde || m >= mDesde) && (!mHasta || m <= mHasta));
```
Reemplazar por:
```tsx
    function buildMultiLocalMonthChart(mesesFiltro: Set<string>, locals: string[]): MultiChartRow[] {
      const meses = mesesDisponibles.filter(m => mesesFiltro.has(m));
```

- [ ] **Step 9: Call sites del modo multi-local**

Ubicar:
```tsx
      if (modoFiltro === 'dia') {
        multiChartData = buildMultiLocalDayChart(fechaDesde, fechaHasta, localSel);
      } else {
        multiChartData = buildMultiLocalMonthChart(mesDesde, mesHasta, localSel);
      }
```
Reemplazar por:
```tsx
      if (modoFiltro === 'dia') {
        multiChartData = buildMultiLocalDayChart(fechaDesde, fechaHasta, localSel);
      } else {
        multiChartData = buildMultiLocalMonthChart(mesesSel, localSel);
      }
```

Ubicar (unas líneas más abajo, dentro del mismo bloque multi-local):
```tsx
      const topProveedores = modoFiltro === 'dia'
        ? buildTopProveedores(fechaDesde, fechaHasta, '', '', 'dia', localSel[0])
        : buildTopProveedores('', '', mesDesde, mesHasta, 'mes', localSel[0]);
      const topProveedoresComp = localSel.length === 2
        ? (modoFiltro === 'dia'
          ? buildTopProveedores(fechaDesde, fechaHasta, '', '', 'dia', localSel[1])
          : buildTopProveedores('', '', mesDesde, mesHasta, 'mes', localSel[1]))
        : [];
      const totalTransacciones = modoFiltro === 'dia'
        ? buildTransacciones(fechaDesde, fechaHasta, '', '', 'dia', localSel[0])
        : buildTransacciones('', '', mesDesde, mesHasta, 'mes', localSel[0]);
```
Reemplazar por:
```tsx
      const topProveedores = modoFiltro === 'dia'
        ? buildTopProveedores(fechaDesde, fechaHasta, null, 'dia', localSel[0])
        : buildTopProveedores('', '', mesesSel, 'mes', localSel[0]);
      const topProveedoresComp = localSel.length === 2
        ? (modoFiltro === 'dia'
          ? buildTopProveedores(fechaDesde, fechaHasta, null, 'dia', localSel[1])
          : buildTopProveedores('', '', mesesSel, 'mes', localSel[1]))
        : [];
      const totalTransacciones = modoFiltro === 'dia'
        ? buildTransacciones(fechaDesde, fechaHasta, null, 'dia', localSel[0])
        : buildTransacciones('', '', mesesSel, 'mes', localSel[0]);
```

- [ ] **Step 10: Call sites del modo día (single-local) — solo cambia el `''` de meses por `null`**

Ubicar:
```tsx
      const totalTransacciones = buildTransacciones(fechaDesde, fechaHasta, '', '', 'dia', dataAFilter);
      const topProveedores = buildTopProveedores(fechaDesde, fechaHasta, '', '', 'dia', dataAFilter);
      const topProveedoresComp = isLocalComp ? buildTopProveedores(fechaDesde, fechaHasta, '', '', 'dia', localSel[1]) : [];
```
Reemplazar por:
```tsx
      const totalTransacciones = buildTransacciones(fechaDesde, fechaHasta, null, 'dia', dataAFilter);
      const topProveedores = buildTopProveedores(fechaDesde, fechaHasta, null, 'dia', dataAFilter);
      const topProveedoresComp = isLocalComp ? buildTopProveedores(fechaDesde, fechaHasta, null, 'dia', localSel[1]) : [];
```

- [ ] **Step 11: Call sites del modo mes (single-local, incl. comparación por período)**

Ubicar:
```tsx
    // ── Modo mes ─────────────────────────────────────────────────────────────
    const dataA = buildMonthChart(mesDesde, mesHasta, dataAFilter);
    let chartData: ChartRow[] = dataA;
    let totalVentasComp = 0, totalGastosComp = 0;
    if (isLocalComp) {
      const dataB = buildMonthChart(mesDesde, mesHasta, localSel[1]);
      totalVentasComp = dataB.reduce((s, r) => s + r.ventas, 0);
      totalGastosComp = dataB.reduce((s, r) => s + r.gastos, 0);
      chartData = mergeWithComp(dataA, dataB);
    } else if (isPeriodComp) {
      const dataB = buildMonthChart(compMes, compMes, localFilter);
```
Reemplazar por:
```tsx
    // ── Modo mes ─────────────────────────────────────────────────────────────
    const dataA = buildMonthChart(mesesSel, dataAFilter);
    let chartData: ChartRow[] = dataA;
    let totalVentasComp = 0, totalGastosComp = 0;
    if (isLocalComp) {
      const dataB = buildMonthChart(mesesSel, localSel[1]);
      totalVentasComp = dataB.reduce((s, r) => s + r.ventas, 0);
      totalGastosComp = dataB.reduce((s, r) => s + r.gastos, 0);
      chartData = mergeWithComp(dataA, dataB);
    } else if (isPeriodComp) {
      const dataB = buildMonthChart(new Set([compMes]), localFilter);
```

- [ ] **Step 12: `mesesFiltrados` y el resto del bloque de modo mes**

Ubicar:
```tsx
    const mesesFiltrados = mesesDisponibles.filter(m => (!mesDesde || m >= mesDesde) && (!mesHasta || m <= mesHasta));
```
Reemplazar por:
```tsx
    const mesesFiltrados = mesesDisponibles.filter(m => mesesSel.has(m));
```

Más abajo en el mismo bloque, ubicar:
```tsx
    const totalTransacciones = buildTransacciones('', '', mesDesde, mesHasta, 'mes', dataAFilter);
    const topProveedores = buildTopProveedores('', '', mesDesde, mesHasta, 'mes', dataAFilter);
    const topProveedoresComp = isLocalComp ? buildTopProveedores('', '', mesDesde, mesHasta, 'mes', localSel[1]) : [];
```
Reemplazar por:
```tsx
    const totalTransacciones = buildTransacciones('', '', mesesSel, 'mes', dataAFilter);
    const topProveedores = buildTopProveedores('', '', mesesSel, 'mes', dataAFilter);
    const topProveedoresComp = isLocalComp ? buildTopProveedores('', '', mesesSel, 'mes', localSel[1]) : [];
```

Y el array de dependencias del `useMemo` de `filteredData` (busca `}, [rawLocalMes, modoGastos,` — es el cierre de todo este `useMemo`):
```tsx
  }, [rawLocalMes, modoGastos, rawGastosMesHastaHoy, rawGastosMesFinDeMes, rawGastosMesSucursalHastaHoy, rawGastosMesSucursalFinDeMes, rawDiasCaja, rawDiasGastos, produccionMesHastaHoy, produccionMesFinDeMes, produccionTopProveedores, localSel,
      mesDesde, mesHasta, mesesDisponibles, fechaDesde, fechaHasta, modoFiltro,
      compOn, compMes]);
```
Reemplazar por:
```tsx
  }, [rawLocalMes, modoGastos, rawGastosMesHastaHoy, rawGastosMesFinDeMes, rawGastosMesSucursalHastaHoy, rawGastosMesSucursalFinDeMes, rawDiasCaja, rawDiasGastos, produccionMesHastaHoy, produccionMesFinDeMes, produccionTopProveedores, localSel,
      mesesSel, mesesDisponibles, fechaDesde, fechaHasta, modoFiltro,
      compOn, compMes]);
```

- [ ] **Step 13: `proveedorDetalle` (modal de detalle de proveedor)**

Ubicar:
```tsx
      if (modoFiltro === 'mes') {
        if (mesDesde && mes < mesDesde) continue;
        if (mesHasta && mes > mesHasta) continue;
      } else {
        if (fechaDesde && r.fecha < fechaDesde) continue;
        if (fechaHasta && r.fecha > fechaHasta) continue;
      }
      porMes[mes] = (porMes[mes] ?? 0) + r.monto;
```
Reemplazar por:
```tsx
      if (modoFiltro === 'mes') {
        if (!mesesSel.has(mes)) continue;
      } else {
        if (fechaDesde && r.fecha < fechaDesde) continue;
        if (fechaHasta && r.fecha > fechaHasta) continue;
      }
      porMes[mes] = (porMes[mes] ?? 0) + r.monto;
```
Y su array de dependencias:
```tsx
  }, [proveedorModal, rawDiasGastos, mesDesde, mesHasta, fechaDesde, fechaHasta, modoFiltro]);
```
Reemplazar por:
```tsx
  }, [proveedorModal, rawDiasGastos, mesesSel, fechaDesde, fechaHasta, modoFiltro]);
```

- [ ] **Step 14: `gastosSinPanaderia` (Índice P)**

Ubicar:
```tsx
      if (modoFiltro === 'dia') {
        if (fechaDesde && r.fecha < fechaDesde) continue;
        if (fechaHasta && r.fecha > fechaHasta) continue;
      } else {
        const mes = r.fecha.slice(0, 7);
        if (mesDesde && mes < mesDesde) continue;
        if (mesHasta && mes > mesHasta) continue;
      }
      sum += r.monto;
    }
    return sum;
  }, [rawDiasGastos, localSel, modoFiltro, fechaDesde, fechaHasta, mesDesde, mesHasta]);
```
Reemplazar por:
```tsx
      if (modoFiltro === 'dia') {
        if (fechaDesde && r.fecha < fechaDesde) continue;
        if (fechaHasta && r.fecha > fechaHasta) continue;
      } else {
        const mes = r.fecha.slice(0, 7);
        if (!mesesSel.has(mes)) continue;
      }
      sum += r.monto;
    }
    return sum;
  }, [rawDiasGastos, localSel, modoFiltro, fechaDesde, fechaHasta, mesesSel]);
```

- [ ] **Step 15: `proyeccionData` — gate de "solo un mes" + dependencias**

Ubicar:
```tsx
  // ── Proyección de ventas ───────────────────────────────────
  const proyeccionData = useMemo(() => {
    if (!mesDesde) return [];
```
Reemplazar por:
```tsx
  // ── Proyección de ventas ───────────────────────────────────
  const proyeccionData = useMemo(() => {
    if (mesesSel.size !== 1) return [];
```
(El resto del cuerpo de este `useMemo`, que sigue usando `mes = mesDesde`, no cambia — con el guard de arriba, `mesDesde` siempre va a ser ese único mes elegido.)

Y su array de dependencias:
```tsx
  }, [rawDiasCaja, rawLocalMes, produccionMesHastaHoy, produccionMesFinDeMes, modoGastos, modoFiltro, mesDesde, mesHasta, localSel, localesDisponibles]);
```
Reemplazar por:
```tsx
  }, [rawDiasCaja, rawLocalMes, produccionMesHastaHoy, produccionMesFinDeMes, modoGastos, modoFiltro, mesesSel, localSel, localesDisponibles]);
```

- [ ] **Step 16: Mensaje claro cuando la Proyección no aplica (2+ meses elegidos)**

Ubicar (card "Proyección de Ventas"):
```tsx
            {proyeccionData.length === 0 ? (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Sin datos para proyectar</p>
              </div>
            ) : (
```
Reemplazar por:
```tsx
            {proyeccionData.length === 0 ? (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                  {mesesSel.size !== 1 ? 'Elegí un solo mes para ver la proyección' : 'Sin datos para proyectar'}
                </p>
              </div>
            ) : (
```

- [ ] **Step 17: Labels — panel de comparación y header de Tendencia**

Ubicar (prop `labelA` del `ComparisonPanel`):
```tsx
            labelA={
              isLocalComp
                ? localSel[0]
                : modoFiltro === 'dia' && (fechaDesde || fechaHasta)
                  ? `${fechaDesde || '…'} → ${fechaHasta || '…'}`
                  : mesDesde
                    ? (mesDesde === mesHasta ? keyToLabel(mesDesde) : `${keyToLabel(mesDesde)} – ${keyToLabel(mesHasta)}`)
                    : 'Período A'
            }
```
Reemplazar por:
```tsx
            labelA={
              isLocalComp
                ? localSel[0]
                : modoFiltro === 'dia' && (fechaDesde || fechaHasta)
                  ? `${fechaDesde || '…'} → ${fechaHasta || '…'}`
                  : formatMesesLabel(mesesSelOrdenados)
            }
```

Ubicar (header de la card "Tendencia"):
```tsx
              {/* Rango activo */}
              {mesDesde && mesHasta && (
                <span className="text-[11px] text-gray-500 bg-gray-100 rounded-xl px-3 py-1.5 font-medium">
                  {keyToLabel(mesDesde)}{mesDesde !== mesHasta ? ` – ${keyToLabel(mesHasta)}` : ''}
                </span>
              )}
```
Reemplazar por:
```tsx
              {/* Rango activo */}
              {mesesSelOrdenados.length > 0 && (
                <span className="text-[11px] text-gray-500 bg-gray-100 rounded-xl px-3 py-1.5 font-medium">
                  {formatMesesLabel(mesesSelOrdenados)}
                </span>
              )}
```

- [ ] **Step 18: Adaptar temporalmente el `PeriodSelect` del toolbar (sigue siendo de un solo valor — el Task 2 lo reemplaza por el selector múltiple)**

Ubicar:
```tsx
          {/* Período mes */}
          <PeriodSelect
            label="Período"
            value={mesPill}
            options={mesesDisponibles.map(m => ({ label: keyToLabel(m), value: m }))}
            onChange={v => {
              setMesPill(v);
              if (v) {
                setMesDesde(v); setMesHasta(v);
              } else if (mesesDisponibles.length) {
                setMesDesde(mesesDisponibles[0]);
                setMesHasta(mesesDisponibles[mesesDisponibles.length - 1]);
              }
              setModoFiltro('mes');
              setFechaDesde(''); setFechaHasta('');
            }}
            allLabel="Todos los meses"
          />
```
Reemplazar por:
```tsx
          {/* Período mes — UI de un solo valor temporal; el Task 2 la reemplaza por MonthMultiSelect */}
          <PeriodSelect
            label="Período"
            value={mesesSelOrdenados.length === 1 ? mesesSelOrdenados[0] : ''}
            options={mesesDisponibles.map(m => ({ label: keyToLabel(m), value: m }))}
            onChange={v => {
              setMesesSel(v ? new Set([v]) : new Set(mesesDisponibles));
              setModoFiltro('mes');
              setFechaDesde(''); setFechaHasta('');
            }}
            allLabel="Todos los meses"
          />
```

- [ ] **Step 19: Quitar las referencias a `mesPill` que quedan (filtro por rango de días)**

Ubicar (dos inputs de fecha, dentro del panel "Rango días"):
```tsx
                    <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setModoFiltro('dia'); setMesPill(''); }}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
```
Reemplazar por:
```tsx
                    <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setModoFiltro('dia'); }}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
```
Ubicar:
```tsx
                    <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setModoFiltro('dia'); setMesPill(''); }}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
```
Reemplazar por:
```tsx
                    <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setModoFiltro('dia'); }}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
```

- [ ] **Step 20: Verificar que no quedó ninguna referencia suelta**

```bash
grep -n "mesPill\|setMesDesde\|setMesHasta" src/app/ventas/page.tsx
```
Expected: sin resultados (las tres cosas dejaron de existir). Si aparece algo, es una referencia que quedó sin migrar — corregirla antes de seguir.

- [ ] **Step 21: Typecheck y tests**

```bash
npx tsc --noEmit
npm test
```
Expected: ningún error nuevo (el único error esperable es el preexistente `estree 2`, no relacionado). Tests en verde.

- [ ] **Step 22: Verificación visual mínima**

Con el dev server corriendo, abrir `/ventas`:
- Confirmar que carga con el mes actual seleccionado (mismo comportamiento que antes del cambio) y los KPIs muestran números razonables (no ceros, no errores en consola).
- Elegir "Todos los meses" en el selector de Período (sigue siendo el `PeriodSelect` de un solo valor en este task) y confirmar que los KPIs cambian a los totales acumulados, sin errores en consola.
- Abrir el modal de detalle de un proveedor (desde Top Proveedores) y confirmar que sigue mostrando datos.

- [ ] **Step 23: Commit**

```bash
git add src/app/ventas/page.tsx
git commit -m "feat: migra el filtro de periodo de Ventas a un Set de meses (capa de datos)"
```

---

### Task 2: Selector de meses múltiples (UI nueva) + reemplazo del `PeriodSelect`

**Files:**
- Create: `src/components/ui/MonthMultiSelect.tsx`
- Modify: `src/app/ventas/page.tsx` (import + bloque del Step 18 de Task 1)

**Interfaces:**
- Consumes: `mesesSel: Set<string>`, `setMesesSel`, `mesesDisponibles: string[]` (de Task 1, ya existen).
- Produces: componente `MonthMultiSelect` con props `{ mesesDisponibles: string[]; selected: Set<string>; onChange: (next: Set<string>) => void; label?: string }`.

- [ ] **Step 1: Crear `src/components/ui/MonthMultiSelect.tsx`**

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface MonthMultiSelectProps {
  /** Meses disponibles, formato "YYYY-MM", en cualquier orden. */
  mesesDisponibles: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  label?: string;
}

const MESES_ABREV = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function esContiguo(meses: string[]): boolean {
  for (let i = 1; i < meses.length; i++) {
    const [y0, m0] = meses[i - 1].split('-').map(Number);
    const [y1, m1] = meses[i].split('-').map(Number);
    if ((y1 * 12 + m1) - (y0 * 12 + m0) !== 1) return false;
  }
  return true;
}

function labelMes(key: string): string {
  const [anio, mes] = key.split('-');
  return `${MESES_ABREV[parseInt(mes, 10)]} ${anio}`;
}

function formatLabel(mesesOrdenados: string[]): string {
  if (mesesOrdenados.length === 0) return 'Sin período';
  if (mesesOrdenados.length === 1) return labelMes(mesesOrdenados[0]);
  if (esContiguo(mesesOrdenados)) {
    return `${labelMes(mesesOrdenados[0])} – ${labelMes(mesesOrdenados[mesesOrdenados.length - 1])}`;
  }
  if (mesesOrdenados.length <= 4) return mesesOrdenados.map(labelMes).join(', ');
  return `${mesesOrdenados.length} meses`;
}

export default function MonthMultiSelect({ mesesDisponibles, selected, onChange, label = 'Período' }: MonthMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const ordenados = [...selected].sort();

  const porAnio = new Map<string, string[]>();
  for (const m of [...mesesDisponibles].sort()) {
    const anio = m.slice(0, 4);
    if (!porAnio.has(anio)) porAnio.set(anio, []);
    porAnio.get(anio)!.push(m);
  }

  function toggleMes(mes: string) {
    const next = new Set(selected);
    if (next.has(mes)) next.delete(mes); else next.add(mes);
    onChange(next);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 border border-transparent rounded-lg px-3.5 py-2 text-[12px] font-medium transition-all bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
      >
        <span className="text-[10px] font-medium opacity-70">{label}</span>
        <span className="font-semibold">{formatLabel(ordenados)}</span>
        <ChevronDown className={clsx('w-3 h-3 opacity-70 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 rounded-xl z-50 p-3 w-[280px] max-h-[360px] overflow-y-auto"
          style={{ background: 'var(--card)', border: '1px solid var(--border-2)', boxShadow: 'var(--card-shadow), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
          <div className="flex items-center gap-2 mb-3">
            <button type="button" onClick={() => onChange(new Set(mesesDisponibles))}
              className="flex-1 text-[11px] font-medium rounded-lg px-2 py-1.5 border border-gray-200 hover:border-blue-400 hover:text-blue-600 transition-colors" style={{ color: 'var(--text-2)' }}>
              Todos
            </button>
            <button type="button" onClick={() => onChange(new Set())}
              className="flex-1 text-[11px] font-medium rounded-lg px-2 py-1.5 border border-gray-200 hover:border-red-400 hover:text-red-500 transition-colors" style={{ color: 'var(--text-2)' }}>
              Ninguno
            </button>
          </div>

          {[...porAnio.entries()].reverse().map(([anio, meses]) => (
            <div key={anio} className="mb-3 last:mb-0">
              <p className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>{anio}</p>
              <div className="flex flex-wrap gap-1.5">
                {meses.map(m => {
                  const activo = selected.has(m);
                  return (
                    <button key={m} type="button" onClick={() => toggleMes(m)}
                      aria-pressed={activo}
                      className={clsx(
                        'text-[11px] font-medium rounded-lg px-2.5 py-1 border transition-colors',
                        activo
                          ? 'bg-blue-50 dark:bg-blue-950 border-transparent text-blue-600 dark:text-blue-400'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600',
                      )}>
                      {MESES_ABREV[parseInt(m.slice(5, 7), 10)]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar el import de `PeriodSelect` por `MonthMultiSelect` en `ventas/page.tsx`**

Ubicar:
```tsx
import { PeriodSelect } from '@/components/ui/PeriodSelect';
```
Reemplazar por:
```tsx
import MonthMultiSelect from '@/components/ui/MonthMultiSelect';
```
(Confirmar antes con `grep -n "PeriodSelect" src/app/ventas/page.tsx` que la única aparición restante es esta línea de import y el bloque JSX del próximo step — si hay otra, no tocarla y avisar.)

- [ ] **Step 3: Reemplazar el bloque temporal del Task 1 por el selector múltiple**

Ubicar:
```tsx
          {/* Período mes — UI de un solo valor temporal; el Task 2 la reemplaza por MonthMultiSelect */}
          <PeriodSelect
            label="Período"
            value={mesesSelOrdenados.length === 1 ? mesesSelOrdenados[0] : ''}
            options={mesesDisponibles.map(m => ({ label: keyToLabel(m), value: m }))}
            onChange={v => {
              setMesesSel(v ? new Set([v]) : new Set(mesesDisponibles));
              setModoFiltro('mes');
              setFechaDesde(''); setFechaHasta('');
            }}
            allLabel="Todos los meses"
          />
```
Reemplazar por:
```tsx
          {/* Período: meses múltiples (incluye combinaciones no contiguas) */}
          <MonthMultiSelect
            label="Período"
            mesesDisponibles={mesesDisponibles}
            selected={mesesSel}
            onChange={next => {
              setMesesSel(next);
              setModoFiltro('mes');
              setFechaDesde(''); setFechaHasta('');
            }}
          />
```

- [ ] **Step 4: Typecheck y tests**

```bash
npx tsc --noEmit
npm test
```
Expected: sin errores nuevos, tests en verde.

- [ ] **Step 5: Verificación visual**

Con el dev server corriendo, abrir `/ventas` y abrir el nuevo selector de Período:
- Confirmar que aparece agrupado por año, con "Todos"/"Ninguno" arriba.
- Tildar 2 meses no consecutivos (ej. el mes actual y uno de 3 meses atrás) y confirmar que el trigger muestra la lista separada por comas, y que los KPIs/Tendencia reflejan la suma de esos 2 meses (no los meses intermedios).
- Tildar 3 meses consecutivos y confirmar que el trigger muestra "A – B" (formato rango).
- Probar "Ninguno" y confirmar que la selección vuelve sola al mes default en vez de quedar vacía o romper la página.
- Repetir en dark y dracula (toggle de tema).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/MonthMultiSelect.tsx src/app/ventas/page.tsx
git commit -m "feat: selector de meses multiples (UI) en Ventas, reemplaza al PeriodSelect de un solo valor"
```

---

### Task 3: Renombrar "Comparar" en el toggle de métrica de Tendencia

**Files:**
- Modify: `src/app/ventas/page.tsx`

**Interfaces:** ninguna — solo cambia un string de label, cero lógica.

- [ ] **Step 1: Cambiar la etiqueta**

Ubicar:
```tsx
              {/* Métrica */}
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                {(['ventas', 'gastos', 'ambos'] as Metrica[]).map(m => (
                  <button key={m} onClick={() => setMetrica(m)}
                    className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all capitalize',
                      metrica === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                    {m === 'ambos' ? 'Comparar' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
```
Reemplazar por:
```tsx
              {/* Métrica */}
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                {(['ventas', 'gastos', 'ambos'] as Metrica[]).map(m => (
                  <button key={m} onClick={() => setMetrica(m)}
                    className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all capitalize',
                      metrica === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                    {m === 'ambos' ? 'Ventas + Gastos' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
```

- [ ] **Step 2: Verificación visual**

Con el dev server corriendo, abrir `/ventas`, confirmar que el botón ahora dice "Ventas + Gastos" (sin romper el layout del toggle) y que sigue funcionando igual (superpone ambas series en el gráfico de Tendencia).

- [ ] **Step 3: Commit**

```bash
git add src/app/ventas/page.tsx
git commit -m "style: renombra Comparar a 'Ventas + Gastos' en el toggle de metrica de Tendencia"
```

---

### Task 4: Verificación final integrada

**Files:** ninguno (solo verificación, sin cambios de código).

- [ ] **Step 1: Chequeo de regresión numérica (antes/después)**

```bash
git stash
```
Con el stash aplicado (código previo a este plan, en `master` o el commit base), levantar el dev server, anotar los 5 KPIs de `/ventas` (Ventas Total, Gasto Total, Margen Neto, Índice 60, Índice P) para: (a) el mes actual solo, (b) "Todos los meses". Luego:
```bash
git stash pop
```
Repetir la misma lectura en el código nuevo para los mismos dos escenarios (mes actual solo vía el nuevo selector; "Todos" con el botón "Todos" del nuevo selector) y confirmar que los 5 números coinciden exactamente en ambos escenarios.

- [ ] **Step 2: Escenario no contiguo**

Con el dev server corriendo, elegir 2 meses no consecutivos (ej. el mes actual + uno de 3 meses atrás, salteando el resto). Confirmar:
- Los KPIs son la suma de exactamente esos 2 meses (no incluyen los meses salteados) — se puede verificar sumando a mano los valores que dio cada mes por separado en el Step 1.
- El gráfico de Tendencia muestra solo esos 2 puntos (no una línea rellenando los meses intermedios).
- Top Proveedores y Transacciones también reflejan solo esos 2 meses.
- El toggle Total/Hasta-hoy no aparece (porque hay 2 meses elegidos, no 1).
- La card "Proyección de Ventas" muestra el mensaje "Elegí un solo mes para ver la proyección" en vez de un número.

- [ ] **Step 3: Consola y temas**

Revisar `read_console_messages` sin errores durante todo lo anterior. Repetir una pasada visual rápida en dark y dracula.

- [ ] **Step 4: Confirmar estado de la rama**

```bash
git log --oneline <merge-base-con-master>..HEAD
git status
```
Confirmar que todos los commits de los Tasks 1-3 están en la rama y no quedan cambios sin commitear relacionados a este trabajo.
