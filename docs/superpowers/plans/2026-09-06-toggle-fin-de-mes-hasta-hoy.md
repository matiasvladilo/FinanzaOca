# Toggle "Total / Hasta hoy" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un toggle "Total / Hasta hoy" a Dashboard, Ventas y Factor-índice que permite ver los gastos del mes en curso completos (incluyendo facturas con vencimiento futuro ya cargadas) o cortados a la fecha de hoy (comportamiento actual).

**Architecture:** `fetchGastosFacturas` deja de cortar por hoy internamente; cada ruta de API que la usa (o construye su propio array de gastos) calcula **ambas** variantes (`hastaHoy` = comportamiento actual sin cambios de nombre, `finDeMes` = nuevo, mes completo) y las manda en la misma respuesta. El frontend de cada página resuelve, con un solo `useState` local (`'total' | 'hastaHoy'`, persistido en `sessionStorage`), cuál de las dos variantes alimenta los cálculos existentes — sin tocar la lógica de agregación que ya existe en cada página, sólo el dato de entrada.

**Tech Stack:** Next.js App Router (route handlers), TypeScript, React (`useState`/`useMemo`), `sessionStorage`, Vitest.

## Global Constraints

- Los campos ya existentes en las respuestas de `/api/ventas`, `/api/produccion-data`, `/api/distribuidora-data` (`kpi.totalGastos`, `gastosPorMes`, `porSucursal`, `gastosPorMesSucursal`, `topProveedores`, `porMedioPago`, `detalle`, etc.) **no cambian de nombre ni de significado** — siguen siendo la variante "hasta hoy" de siempre, para no romper `/api/informes/generate` ni el asistente, que no se tocan.
- La variante nueva viaja en un campo adicional `finDeMes` con el mismo shape que los campos existentes que agrega.
- `fetchGastosFacturas` (`src/lib/data/gastos.ts`) deja de aplicar el corte por hoy — el corte pasa a vivir en cada call site. Los 2 call sites de reportes (`fetchProduccionForReport`, `fetchDistribuidoraForReport`) deben aplicar el corte explícitamente para no cambiar su comportamiento actual.
- El toggle es **independiente por página** (Dashboard, Ventas, Factor-índice), persistido en `sessionStorage` con una key distinta por página, default `'total'`.
- El toggle sólo se muestra cuando el mes seleccionado en esa página es el mes en curso (usar el nuevo `esMesActualChile` de `date-utils.ts`).
- Merma no se toca — no tiene ningún KPI afectado por este corte.

---

## Mapa de archivos

- **Modificar:** `src/lib/date-utils.ts` — agrega `esMesActualChile(mesKey: string): boolean`.
- **Crear:** `src/lib/date-utils.test.ts` — test de `esMesActualChile`.
- **Modificar:** `src/lib/data/gastos.ts` — `fetchGastosFacturas` deja de cortar por hoy.
- **Modificar:** `src/app/api/ventas/route.ts` — extrae `agregarGastos`, agrega `finDeMes` a la respuesta.
- **Crear:** `src/app/api/ventas/route.test.ts` — test de `agregarGastos`.
- **Modificar:** `src/app/api/produccion-data/route.ts` — GET principal agrega `finDeMes`; `fetchProduccionForReport` aplica el corte explícito.
- **Modificar:** `src/app/api/distribuidora-data/route.ts` — GET principal agrega `finDeMes`.
- **Modificar:** `src/app/api/informes/generate/route.ts` — `fetchDistribuidoraForReport` aplica el corte explícito.
- **Modificar:** `src/app/page.tsx` — toggle + resolución de variante activa (Dashboard).
- **Modificar:** `src/app/ventas/page.tsx` — ídem (Ventas).
- **Modificar:** `src/app/factor-indice/page.tsx` — ídem (Factor-índice) + el corte del gráfico semanal pasa a ser condicional.

---

### Task 1: `esMesActualChile` en date-utils

**Files:**
- Modify: `src/lib/date-utils.ts`
- Test: `src/lib/date-utils.test.ts`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: `esMesActualChile(mesKey: string): boolean` — exportado desde `@/lib/date-utils`, usado por las 3 tareas de frontend (7, 8, 9) para decidir si mostrar el toggle.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/date-utils.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { esMesActualChile } from './date-utils';

describe('esMesActualChile', () => {
  test('devuelve true para el mes y año actuales (hora de Chile)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z')); // mediodía UTC = mañana en Chile
    expect(esMesActualChile('2026-09')).toBe(true);
    vi.useRealTimers();
  });

  test('devuelve false para un mes pasado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    expect(esMesActualChile('2026-08')).toBe(false);
    vi.useRealTimers();
  });

  test('devuelve false para un mes futuro', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    expect(esMesActualChile('2026-10')).toBe(false);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/date-utils.test.ts`
Expected: FAIL — `esMesActualChile` no existe / no es exportado.

- [ ] **Step 3: Implementar**

En `src/lib/date-utils.ts`, justo después de la función `hoyISOChile()` (busca el cierre `}` de esa función — el bloque que termina con `return \`${p.year}-${p.month}-${p.day}\`;\n}`), agregar:

```ts

/**
 * ¿`mesKey` (formato "YYYY-MM") es el mes en curso, en hora de Chile?
 * Se usa para decidir cuándo tiene sentido mostrar el toggle "Total / Hasta
 * hoy": en un mes ya cerrado las dos vistas dan el mismo número.
 */
export function esMesActualChile(mesKey: string): boolean {
  return mesKey === hoyISOChile().slice(0, 7);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/date-utils.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/date-utils.ts src/lib/date-utils.test.ts
git commit -m "date-utils: agregar esMesActualChile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `fetchGastosFacturas` deja de cortar por hoy

**Files:**
- Modify: `src/lib/data/gastos.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `fetchGastosFacturas` (firma sin cambios) ahora devuelve **todas** las facturas del rango `[desde, hasta]`, sin excluir las de fecha futura dentro del mes en curso. Tasks 4, 5 y 6 dependen de este cambio de comportamiento (y dos de ellas deben compensarlo aplicando su propio corte).

- [ ] **Step 1: Ubicar y quitar el corte**

En `src/lib/data/gastos.ts`, dentro de `fetchGastosFacturas`, hay este bloque (con `hoyISO` declarado antes del loop):

```ts
  const filterLocal = local && local !== 'todos' && local !== 'Todos' ? local.toLowerCase() : null;
  const hoyISO = hoyISOChile();
```

y más abajo, dentro del `for`:

```ts
    // Igual que /api/ventas: no contar como "ya gastado" facturas con fecha
    // futura — esta planilla (Producción/Distribuidora) ya trae cargados
    // gastos recurrentes con vencimiento de todo el mes desde el día 1, así
    // que un rango "mes completo" sobre un mes en curso infla el total real
    // (ver el mismo fix en src/app/api/ventas/route.ts).
    if (fp.iso > hoyISO) continue;
```

Reemplazar esas dos porciones: quitar la línea `const hoyISO = hoyISOChile();` (ya no se usa en esta función), y reemplazar el comentario + `if` por un comentario que explique que el corte ahora es responsabilidad de quien llama:

```ts
    // Esta función YA NO corta por "hasta hoy" — antes excluía acá mismo las
    // facturas con vencimiento futuro dentro del mes en curso, pero eso le
    // impedía a los call-sites ofrecer la vista "mes completo" (ver
    // /api/ventas, /api/produccion-data, /api/distribuidora-data). Cada
    // fila ya trae su `fecha` (ISO) — quien llame decide si corta por hoy.
```

(Ese comentario reemplaza únicamente al `if (fp.iso > hoyISO) continue;` y las líneas de comentario que lo preceden — no borres el resto del cuerpo del `for`.)

- [ ] **Step 2: Quitar el import que ya no se usa**

En el bloque de imports al inicio del archivo:
```ts
import { hoyISOChile } from '@/lib/date-utils';
```
Esta línea se elimina — `hoyISOChile` ya no se usa en `gastos.ts`.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `src/lib/data/gastos.ts` (puede haber errores preexistentes en otros archivos del proyecto — no son de esta tarea).

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/gastos.ts
git commit -m "gastos: fetchGastosFacturas deja de cortar por hoy

El corte 'hasta hoy' pasa a ser responsabilidad de cada call site, para
poder ofrecer también la vista 'mes completo'. Los call sites que deben
preservar el comportamiento actual (fetchProduccionForReport, informes)
lo aplican ellos mismos en las próximas tareas.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `/api/ventas` — `agregarGastos` + campo `finDeMes`

**Files:**
- Modify: `src/app/api/ventas/route.ts`
- Test: `src/app/api/ventas/route.test.ts`

**Interfaces:**
- Consumes: nada de tareas de frontend (es la primera de las 3 rutas de API).
- Produces: la respuesta JSON de `GET /api/ventas` gana un campo nuevo `finDeMes: { kpi: { totalGastos, totalIngresos, margen, totalTransacciones }, chartData, gastosPorMes, gastosPorMesSucursal, porSucursal, topProveedores, porMedioPago }` — mismo shape que los campos existentes de nivel superior. Las Tasks 7, 8 y 9 (Dashboard, Ventas, Factor-índice) leen este campo.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/api/ventas/route.test.ts`. `agregarGastos` todavía no existe ni se exporta — este test se escribe primero (TDD) y falla por eso:

```ts
import { describe, expect, test } from 'vitest';
import { agregarGastos, type RegistroFactura } from './route';

function factura(overrides: Partial<RegistroFactura>): RegistroFactura {
  return {
    id: 1, sucursal: 'PV', tipo: 'GASTO', subtipo: '',
    proveedor: 'Proveedor Test', medioPago: 'Transferencia',
    monto: 1000, fecha: '2026-09-01', mes: 9, anio: 2026,
    ...overrides,
  };
}

describe('agregarGastos', () => {
  test('suma totalGastos y totalIngresos sobre el array recibido', () => {
    const gastos = [
      factura({ monto: 1000, tipo: 'GASTO' }),
      factura({ monto: 500, tipo: 'INGRESO' }),
    ];
    const r = agregarGastos(gastos, 2, 2026);
    expect(r.kpi.totalGastos).toBe(1500); // GASTO+INGRESO, ver comentario en route.ts
    expect(r.kpi.totalIngresos).toBe(500);
    expect(r.kpi.totalTransacciones).toBe(2);
  });

  test('hastaHoy excluye fechas futuras y finDeMes las incluye — mismo helper, arrays distintos', () => {
    const hoyISO = '2026-09-15';
    const todas = [
      factura({ monto: 1000, fecha: '2026-09-01', mes: 9, anio: 2026 }),
      factura({ monto: 2000, fecha: '2026-09-28', mes: 9, anio: 2026 }), // futuro respecto a hoyISO
    ];
    const hastaHoy = agregarGastos(todas.filter(r => r.fecha <= hoyISO), todas.length, 2026);
    const finDeMes = agregarGastos(todas, todas.length, 2026);
    expect(hastaHoy.kpi.totalGastos).toBe(1000);
    expect(finDeMes.kpi.totalGastos).toBe(3000);
  });

  test('sin fechas futuras, ambas vistas coinciden (mes cerrado)', () => {
    const hoyISO = '2026-09-30';
    const todas = [
      factura({ monto: 1000, fecha: '2026-08-05', mes: 8, anio: 2026 }),
      factura({ monto: 2000, fecha: '2026-08-20', mes: 8, anio: 2026 }),
    ];
    const hastaHoy = agregarGastos(todas.filter(r => r.fecha <= hoyISO), todas.length, 2026);
    const finDeMes = agregarGastos(todas, todas.length, 2026);
    expect(hastaHoy.kpi.totalGastos).toBe(finDeMes.kpi.totalGastos);
    expect(hastaHoy.gastosPorMes).toEqual(finDeMes.gastosPorMes);
  });

  test('gastosPorMes y porSucursal se calculan sobre el array recibido', () => {
    const gastos = [
      factura({ sucursal: 'PV', monto: 100, mes: 9, anio: 2026 }),
      factura({ sucursal: 'Bilbao', monto: 200, mes: 9, anio: 2026 }),
    ];
    const r = agregarGastos(gastos, 2, 2026);
    expect(r.gastosPorMes['2026-09']).toBe(300);
    expect(r.porSucursal['PV'].gastos).toBe(100);
    expect(r.porSucursal['Bilbao'].gastos).toBe(200);
  });

  test('descarta años futuros de gastosPorMes (mismo guard que hoy)', () => {
    const gastos = [factura({ monto: 999, mes: 1, anio: 2099 })];
    const r = agregarGastos(gastos, 1, 2026);
    expect(r.gastosPorMes['2099-01']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/app/api/ventas/route.test.ts`
Expected: FAIL — `agregarGastos`/`RegistroFactura` no existen o no están exportados desde `./route`.

- [ ] **Step 3: Implementar**

En `src/app/api/ventas/route.ts`:

3a. Extraer el tipo anónimo de `registros` (definido dentro de `fetchLocalVentas`) a una interfaz exportada, justo antes de `async function fetchLocalVentas`:

```ts
export interface RegistroFactura {
  id: number; sucursal: string; tipo: string; subtipo: string;
  proveedor: string; medioPago: string; monto: number;
  fecha: string; mes: number; anio: number;
}
```

Y cambiar la declaración dentro de `fetchLocalVentas` de:
```ts
  const registros: {
    id: number; sucursal: string; tipo: string; subtipo: string;
    proveedor: string; medioPago: string; monto: number;
    fecha: string; mes: number; anio: number;
  }[] = [];
```
a:
```ts
  const registros: RegistroFactura[] = [];
```

3b. Justo antes de `export async function fetchVentasData()`, agregar la función exportada `agregarGastos`:

```ts
export interface GastosAgregados {
  kpi: { totalGastos: number; totalIngresos: number; margen: number; totalTransacciones: number };
  chartData: { fecha: string; ventas: number; gastos: number }[];
  gastosPorMes: Record<string, number>;
  gastosPorMesSucursal: Record<string, Record<string, number>>;
  porSucursal: Record<string, { ventas: number; gastos: number; transacciones: number }>;
  topProveedores: { nombre: string; monto: number }[];
  porMedioPago: Record<string, number>;
}

/**
 * Agrega un array de facturas (ya filtrado por quien llama — "hasta hoy" o
 * "mes completo") en el mismo shape que espera el resto de la app. Se llama
 * dos veces desde `fetchVentasRaw`, una por cada variante, para poder
 * ofrecer el toggle "Total / Hasta hoy" sin duplicar esta lógica.
 */
export function agregarGastos(
  gastos: RegistroFactura[],
  totalTransacciones: number,
  anioActual: number,
): GastosAgregados {
  const ingresos      = gastos.filter(r => r.tipo === 'INGRESO');
  const totalGastos   = gastos.reduce((s, r) => s + r.monto, 0);
  const totalIngresos = ingresos.reduce((s, r) => s + r.monto, 0);

  const porMes: Record<string, { mes: number; anio: number; ventas: number; gastos: number }> = {};
  for (const r of gastos) {
    if (r.anio > anioActual) continue;
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!porMes[key]) porMes[key] = { mes: r.mes, anio: r.anio, ventas: 0, gastos: 0 };
    porMes[key].gastos += r.monto;
  }
  const chartData = Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ fecha: getMesLabel(v.mes, v.anio), ventas: v.ventas, gastos: v.gastos }));
  const gastosPorMes: Record<string, number> = {};
  for (const [key, v] of Object.entries(porMes)) gastosPorMes[key] = v.gastos;

  const porSucursal: Record<string, { ventas: number; gastos: number; transacciones: number }> = {};
  for (const r of gastos) {
    if (!porSucursal[r.sucursal]) porSucursal[r.sucursal] = { ventas: 0, gastos: 0, transacciones: 0 };
    porSucursal[r.sucursal].gastos += r.monto;
    porSucursal[r.sucursal].transacciones++;
  }

  const gastosPorMesSucursal: Record<string, Record<string, number>> = {};
  for (const r of gastos) {
    if (r.anio > anioActual) continue;
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!gastosPorMesSucursal[r.sucursal]) gastosPorMesSucursal[r.sucursal] = {};
    gastosPorMesSucursal[r.sucursal][key] = (gastosPorMesSucursal[r.sucursal][key] ?? 0) + r.monto;
  }

  const porProveedor: Record<string, number> = {};
  const proveedorNombre: Record<string, string> = {};
  for (const r of gastos) {
    const canonico = normalizeProveedorName(r.proveedor);
    const key = canonico.toLowerCase();
    if (!proveedorNombre[key]) proveedorNombre[key] = canonico;
    porProveedor[key] = (porProveedor[key] ?? 0) + r.monto;
  }
  const topProveedores = Object.entries(porProveedor)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([key, monto]) => ({ nombre: proveedorNombre[key], monto }));

  const porMedioPago: Record<string, number> = {};
  for (const r of gastos) {
    porMedioPago[r.medioPago] = (porMedioPago[r.medioPago] ?? 0) + r.monto;
  }

  return {
    kpi: {
      totalGastos,
      totalIngresos,
      margen: totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : 0,
      totalTransacciones,
    },
    chartData,
    gastosPorMes,
    gastosPorMesSucursal,
    porSucursal,
    topProveedores,
    porMedioPago,
  };
}
```

3c. Dentro de `fetchVentasRaw`, reemplazar todo el bloque que va desde
`const HOY_ISO = hoyISOChile();` hasta el `return { ... }` final (líneas
153-254 del archivo actual) por:

```ts
  const HOY_ISO = hoyISOChile();
  const ANIO_ACTUAL = new Date().getFullYear();

  // `gastosCrudo`: TODAS las filas, sin filtrar — la usa registrosDiariosGastos
  // (informes/asistente cortan por su propio rango de fechas explícito) y
  // ahora también la variante "mes completo" del toggle.
  //
  // `gastosHastaHoy`: excluye facturas con FECHA EMITIDA futura — proveedores
  // como el arriendo o servicios ya quedan cargados en la planilla con su
  // fecha de vencimiento del mes completo desde el día 1, aunque falten
  // semanas para que "pasen". Sin este corte, el mes en curso suma sus
  // gastos completos contra sólo los días de venta que ya ocurrieron (la
  // caja no tiene "ventas futuras"), e infla el Factor Índice / Margen Neto
  // de forma irreal (ej. 376% en vez de ~97% el día 4 de un mes de 30). Es
  // el comportamiento default de siempre — sigue siendo lo que exponen los
  // campos planos de la respuesta.
  const gastosCrudo    = registros;
  const gastosHastaHoy = registros.filter(r => r.fecha <= HOY_ISO);

  const hastaHoy = agregarGastos(gastosHastaHoy, registros.length, ANIO_ACTUAL);
  const finDeMes = agregarGastos(gastosCrudo, registros.length, ANIO_ACTUAL);

  const registrosDiariosGastos = gastosCrudo
    .filter(r => r.fecha)
    .map(r => ({
      fecha: r.fecha,
      mesKey: `${r.anio}-${String(r.mes).padStart(2, '0')}`,
      sucursal: r.sucursal,
      monto: r.monto,
      proveedor: r.proveedor,
      subtipo: r.subtipo,
    }));

  return {
    kpi: hastaHoy.kpi,
    chartData: hastaHoy.chartData,
    gastosPorMes: hastaHoy.gastosPorMes,
    gastosPorMesSucursal: hastaHoy.gastosPorMesSucursal,
    porSucursal: hastaHoy.porSucursal,
    topProveedores: hastaHoy.topProveedores,
    porMedioPago: hastaHoy.porMedioPago,
    registrosDiariosGastos,
    facturasSinFecha,
    ultimosRegistros: registros.slice(-10).reverse(),
    finDeMes,
  };
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/app/api/ventas/route.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Verificar tipos y que el resto de la suite sigue pasando**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

Run: `npm test`
Expected: todos los tests pasan (los 23 preexistentes + los nuevos de esta tarea + Task 1).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/ventas/route.ts src/app/api/ventas/route.test.ts
git commit -m "api/ventas: extraer agregarGastos, agregar campo finDeMes

Los campos existentes (kpi, gastosPorMes, porSucursal, etc.) no cambian de
comportamiento — siguen siendo la vista 'hasta hoy'. Se agrega finDeMes con
el mismo shape para la vista 'mes completo'.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `/api/produccion-data` — `finDeMes` + preservar informes

**Files:**
- Modify: `src/app/api/produccion-data/route.ts`

**Interfaces:**
- Consumes: el nuevo comportamiento de `fetchGastosFacturas` (Task 2, ya no corta por hoy).
- Produces: la respuesta JSON de `GET /api/produccion-data` gana un campo
  `finDeMes: { kpi: { totalCostos: number; rentabilidad: number }, gastosPorMes: { key: string; mes: string; monto: number }[] }`.
  La Task 7 (Dashboard) y Task 8 (Ventas) leen este campo cuando el toggle
  está en `'total'`.

- [ ] **Step 1: Import de `hoyISOChile`**

En el bloque de imports de `src/app/api/produccion-data/route.ts`, agregar:
```ts
import { limitesUtcDelRango, ultimoDiaDelMes, hoyISOChile } from '@/lib/date-utils';
```
(reemplaza la línea de import existente de `date-utils`, que ya trae `limitesUtcDelRango, ultimoDiaDelMes` — sólo se agrega `hoyISOChile`.)

- [ ] **Step 2: Separar `gastos` en `gastosHastaHoy`/`gastosFinDeMes` en el GET principal**

Ubicar, dentro del handler `GET` principal (no en `fetchProduccionForReport`, que es una función distinta más abajo en el archivo), la línea:
```ts
    const [gastos, mermaData, ventasData, controlPan] = await Promise.all([
      fetchGastos(local, desde, hasta),
      fetchMerma(local, desde, hasta),
      fetchVentasSupabase(desdeISO, hastaISO),
      fetchControlPan(desde, hasta),
    ]);
```
Justo después, agregar:
```ts
    const HOY_ISO = hoyISOChile();
    const gastosFinDeMes = gastos;
    const gastosHastaHoy = gastos.filter(r => r.fecha <= HOY_ISO);
```
A partir de acá, **todo el código existente que usaba la variable `gastos`
sigue usándola sin cambios** (`totalCostos`, `rentabilidad`, `gastosMesMap`
→ `gastosPorMes`, `localesSet`, `topProveedoresProd`) — pero hay que
redirigir esos usos a `gastosHastaHoy` en vez de `gastos`, porque `gastos`
ahora (tras el Task 2) ya no viene cortado por hoy. Reemplazar, en las
líneas donde aparecen (usar grep para ubicarlas exactas: `grep -n "for (const r of gastos)\|gastos.reduce" src/app/api/produccion-data/route.ts`):

- `const totalCostos     = gastos.reduce((s, r) => s + r.monto, 0);` → `const totalCostos     = gastosHastaHoy.reduce((s, r) => s + r.monto, 0);`
- `for (const r of gastos) {` (dentro del bloque "Gastos por mes (Facturas)") → `for (const r of gastosHastaHoy) {`
- `for (const r of gastos)    if (r.local) localesSet.add(r.local);` → `for (const r of gastosHastaHoy)    if (r.local) localesSet.add(r.local);`
- `const topProveedoresProd = topProveedores(gastos);` → `const topProveedoresProd = topProveedores(gastosHastaHoy);`

- [ ] **Step 3: Calcular la variante `finDeMes` y agregarla a la respuesta**

Justo antes del `return NextResponse.json({ ... })` del GET principal,
agregar el cálculo de la variante "mes completo" (mismo patrón que
`gastosMesMap`/`gastosPorMes`, pero sobre `gastosFinDeMes`, y sólo lo
mínimo que consumen Dashboard/Ventas — `kpi.totalCostos`, `rentabilidad`,
`gastosPorMes`):

```ts
    // ── Variante "mes completo" para el toggle Total/Hasta hoy ─────────────
    const totalCostosFinDeMes  = gastosFinDeMes.reduce((s, r) => s + r.monto, 0);
    const rentabilidadFinDeMes = totalVentas > 0
      ? Math.round(((totalVentas - totalCostosFinDeMes - totalMerma) / totalVentas) * 100)
      : 0;
    const gastosMesMapFinDeMes: Record<string, { mes: number; anio: number; monto: number }> = {};
    for (const r of gastosFinDeMes) {
      if (!r.mes || !r.anio) continue;
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      if (!gastosMesMapFinDeMes[key]) gastosMesMapFinDeMes[key] = { mes: r.mes, anio: r.anio, monto: 0 };
      gastosMesMapFinDeMes[key].monto += r.monto;
    }
    const gastosPorMesFinDeMes = Object.entries(gastosMesMapFinDeMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, mes: getMesLabel(v.mes, v.anio), monto: v.monto }));
    const finDeMes = {
      kpi: { totalCostos: totalCostosFinDeMes, rentabilidad: rentabilidadFinDeMes },
      gastosPorMes: gastosPorMesFinDeMes,
    };
```

Y agregar `finDeMes,` como propiedad nueva dentro del objeto que arma
`return NextResponse.json({ ok: true, kpi: { ... }, ventasPorMes, gastosPorMes, mermasPorMes, topProductos, productos, productosPorDia: porDia, porArea, porTipoMerma, topProveedoresProd, controlPan, locales, mesDesde, mesHasta, finDeMes, });` — nada más del objeto de respuesta cambia.

- [ ] **Step 4: Preservar el comportamiento de `fetchProduccionForReport` (informes)**

Esta función es distinta al GET principal (está más abajo en el mismo
archivo, bajo el comentario `// ── Función completa para inyectar
Producción en el informe ──`) y **no** debe ganar el toggle — su único
consumidor es el informe por correo/PDF, que sigue viendo "hasta hoy"
siempre. Como `fetchGastosFacturas` ya no corta por hoy (Task 2), hay que
agregar el corte acá explícitamente para no cambiar su comportamiento.

Ubicar:
```ts
    const totalGastos     = gastosRes.status === 'fulfilled'
      ? gastosRes.value.reduce((s, r) => s + r.monto, 0)
      : 0;
```
y reemplazarlo por:
```ts
    // fetchGastosFacturas ya no corta por hoy (ver gastos.ts) — este reporte
    // no tiene toggle, así que preserva el comportamiento de siempre acá.
    const HOY_ISO_REPORTE = hoyISOChile();
    const totalGastos     = gastosRes.status === 'fulfilled'
      ? gastosRes.value.filter(r => r.fecha <= HOY_ISO_REPORTE).reduce((s, r) => s + r.monto, 0)
      : 0;
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `src/app/api/produccion-data/route.ts`.

- [ ] **Step 6: Verificación manual del shape de respuesta**

No hay test automatizado para esta ruta (requiere Supabase + Google Sheets
en vivo). Verificar manualmente con el server corriendo:

Run: `curl -s "http://localhost:3000/api/produccion-data?mesDesde=2026-09&mesHasta=2026-09" -H "Cookie: <cookie de sesión válida>" | python3 -m json.tool | head -40`
Expected: la respuesta incluye `finDeMes.kpi.totalCostos` y
`finDeMes.gastosPorMes`, y `finDeMes.kpi.totalCostos >= kpi.totalCostos`
(el mes completo nunca es menor que hasta-hoy).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/produccion-data/route.ts
git commit -m "api/produccion-data: agregar finDeMes, preservar informes

El GET principal calcula ambas variantes (hastaHoy sigue siendo el
comportamiento default de los campos existentes). fetchProduccionForReport
(usado por el informe por correo) aplica su propio corte por hoy ahora que
fetchGastosFacturas ya no lo hace internamente — mismo comportamiento de
siempre para ese consumidor.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `/api/distribuidora-data` — `finDeMes`

**Files:**
- Modify: `src/app/api/distribuidora-data/route.ts`

**Interfaces:**
- Consumes: el nuevo comportamiento de `fetchGastosFacturas` (Task 2).
- Produces: la respuesta JSON de `GET /api/distribuidora-data` gana un
  campo `finDeMes: { kpi: { totalGastos: number; totalFacturas: number }, gastosPorMes: { key: string; mes: string; monto: number }[], topProveedores: { nombre: string; monto: number }[], detalle: { fecha: string; proveedor: string; monto: number }[] }`.
  La Task 7 (Dashboard) lee `finDeMes.kpi.totalGastos`. Ventas no usa esta
  ruta (confirmado por grep en el spec).

- [ ] **Step 1: Import de `hoyISOChile`**

Agregar al bloque de imports:
```ts
import { hoyISOChile } from '@/lib/date-utils';
```

- [ ] **Step 2: Extraer un helper y llamarlo dos veces**

Reemplazar todo el bloque que va desde
```ts
    const gastos = await withCacheSWR(cacheKey, () =>
      fetchGastosFacturas(config.id, 'todos', desde, hasta),
    );

    // ── KPI ───────────────────────────────────────────────────────────────────
    const totalGastos = gastos.reduce((s, r) => s + r.monto, 0);
    const totalFacturas = gastos.length;

    // ── Gastos por mes ────────────────────────────────────────────────────────
    const mesMap: Record<string, { mes: number; anio: number; monto: number }> = {};
    for (const r of gastos) {
      if (!r.mes || !r.anio) continue;
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      if (!mesMap[key]) mesMap[key] = { mes: r.mes, anio: r.anio, monto: 0 };
      mesMap[key].monto += r.monto;
    }
    const gastosPorMes = Object.entries(mesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, mes: getMesLabel(v.mes, v.anio), monto: v.monto }));

    // ── Detalle de facturas (más recientes primero) ──────────────────────────
    const detalle = [...gastos]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map(r => ({ fecha: r.fecha, proveedor: r.proveedor, monto: r.monto }));

    return NextResponse.json({
      ok: true,
      kpi: { totalGastos, totalFacturas },
      gastosPorMes,
      topProveedores: topProveedores(gastos),
      detalle,
      mesDesde,
      mesHasta,
    });
```
por:
```ts
    const gastosFinDeMes = await withCacheSWR(cacheKey, () =>
      fetchGastosFacturas(config.id, 'todos', desde, hasta),
    );
    const HOY_ISO = hoyISOChile();
    const gastosHastaHoy = gastosFinDeMes.filter(r => r.fecha <= HOY_ISO);

    function agregar(gastosArr: typeof gastosFinDeMes) {
      const totalGastos = gastosArr.reduce((s, r) => s + r.monto, 0);
      const totalFacturas = gastosArr.length;

      const mesMap: Record<string, { mes: number; anio: number; monto: number }> = {};
      for (const r of gastosArr) {
        if (!r.mes || !r.anio) continue;
        const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
        if (!mesMap[key]) mesMap[key] = { mes: r.mes, anio: r.anio, monto: 0 };
        mesMap[key].monto += r.monto;
      }
      const gastosPorMes = Object.entries(mesMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => ({ key, mes: getMesLabel(v.mes, v.anio), monto: v.monto }));

      const detalle = [...gastosArr]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map(r => ({ fecha: r.fecha, proveedor: r.proveedor, monto: r.monto }));

      return {
        kpi: { totalGastos, totalFacturas },
        gastosPorMes,
        topProveedores: topProveedores(gastosArr),
        detalle,
      };
    }

    const hastaHoy = agregar(gastosHastaHoy);
    const finDeMes = agregar(gastosFinDeMes);

    return NextResponse.json({
      ok: true,
      kpi: hastaHoy.kpi,
      gastosPorMes: hastaHoy.gastosPorMes,
      topProveedores: hastaHoy.topProveedores,
      detalle: hastaHoy.detalle,
      mesDesde,
      mesHasta,
      finDeMes,
    });
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `src/app/api/distribuidora-data/route.ts`.

- [ ] **Step 4: Verificación manual del shape de respuesta**

Run: `curl -s "http://localhost:3000/api/distribuidora-data?mesDesde=2026-09&mesHasta=2026-09" -H "Cookie: <cookie de sesión válida>" | python3 -m json.tool | head -30`
Expected: la respuesta incluye `finDeMes.kpi.totalGastos`, y
`finDeMes.kpi.totalGastos >= kpi.totalGastos`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/distribuidora-data/route.ts
git commit -m "api/distribuidora-data: agregar finDeMes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `/api/informes/generate` — preservar `fetchDistribuidoraForReport`

**Files:**
- Modify: `src/app/api/informes/generate/route.ts`

**Interfaces:**
- Consumes: el nuevo comportamiento de `fetchGastosFacturas` (Task 2).
- Produces: nada (call-site hoja, sin consumidores dentro de este plan).

- [ ] **Step 1: Import de `hoyISOChile`**

En el bloque de imports de `src/app/api/informes/generate/route.ts`,
agregar `hoyISOChile` a la lista que ya se importa desde `@/lib/date-utils`:
```ts
import { toLocalDate, filterByDateRange, toLocalISODate, ultimoDiaDelMes, hoyISOChile } from '@/lib/date-utils';
```

- [ ] **Step 2: Aplicar el corte explícito en `fetchDistribuidoraForReport`**

Ubicar:
```ts
  const gastos = await fetchGastosFacturas(config.id, 'todos', desde, hasta);
  return {
    gastoExterno: gastos.reduce((s, r) => s + r.monto, 0),
    facturas: gastos.length,
    topProveedores: topProveedores(gastos, 5),
  };
```
y reemplazarlo por:
```ts
  // fetchGastosFacturas ya no corta por hoy (ver gastos.ts) — este reporte
  // no tiene toggle, así que preserva el comportamiento de siempre acá.
  const HOY_ISO = hoyISOChile();
  const gastos = (await fetchGastosFacturas(config.id, 'todos', desde, hasta))
    .filter(r => r.fecha <= HOY_ISO);
  return {
    gastoExterno: gastos.reduce((s, r) => s + r.monto, 0),
    facturas: gastos.length,
    topProveedores: topProveedores(gastos, 5),
  };
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `src/app/api/informes/generate/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/informes/generate/route.ts
git commit -m "informes: preservar corte hasta-hoy en fetchDistribuidoraForReport

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Dashboard — toggle "Total / Hasta hoy"

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `finDeMes` de `/api/ventas` (Task 3), `/api/produccion-data`
  (Task 4) y `/api/distribuidora-data` (Task 5); `esMesActualChile` de
  `date-utils` (Task 1).
- Produces: nada (hoja).

- [ ] **Step 1: Import de `esMesActualChile`**

En `src/app/page.tsx`, la línea:
```ts
import { hoyISOChile } from '@/lib/date-utils';
```
pasa a:
```ts
import { hoyISOChile, esMesActualChile } from '@/lib/date-utils';
```

- [ ] **Step 2: Estado del toggle**

Junto a los demás `useState` del componente (cerca de `const [compOn, setCompOn] = useState(false);`), agregar:
```ts
  const [modoGastos, setModoGastos] = useState<'total' | 'hastaHoy'>('total');
```

En el `useEffect` de restauración desde `sessionStorage` (el que hace
`setCompOn(ssGet('dash_compOn', 'false') === 'true');` y similares),
agregar:
```ts
    setModoGastos(ssGet('dash_modoGastos', 'total') as 'total' | 'hastaHoy');
```

Y junto a los `useEffect` de persistencia (el que hace
`useEffect(() => { try { sessionStorage.setItem('dash_compOn', ...`),
agregar uno análogo:
```ts
  useEffect(() => { try { sessionStorage.setItem('dash_modoGastos', modoGastos); } catch {} }, [modoGastos]);
```

- [ ] **Step 3: Guardar ambas variantes de produccionSummary/distribuidoraGastos**

Cambiar el tipo `ProductionSummary` (cerca del top del archivo) de:
```ts
type ProductionSummary = { ventas: number; gastos: number };
```
a:
```ts
type ProductionSummary = { ventas: number; gastosHastaHoy: number; gastosFinDeMes: number };
```

En el `useEffect` que hace el fetch a `/api/produccion-data`/`/api/distribuidora-data` (el que arma `params` con `mesDesde`/`mesHasta` y llama `setProduccionSummary`/`setDistribuidoraGastos`), cambiar:
```ts
        setProduccionSummary({
          ventas: d.kpi?.totalVentas ?? 0,
          gastos: d.kpi?.totalCostos ?? 0,
        });
```
a:
```ts
        setProduccionSummary({
          ventas: d.kpi?.totalVentas ?? 0,
          gastosHastaHoy: d.kpi?.totalCostos ?? 0,
          gastosFinDeMes: d.finDeMes?.kpi?.totalCostos ?? (d.kpi?.totalCostos ?? 0),
        });
```
y cambiar el estado `distribuidoraGastos` (hoy `useState<number>(0)`) a
guardar ambas variantes:
```ts
  const [distribuidoraGastos, setDistribuidoraGastos] = useState<{ hastaHoy: number; finDeMes: number }>({ hastaHoy: 0, finDeMes: 0 });
```
y su asignación:
```ts
        setDistribuidoraGastos(d?.ok
          ? { hastaHoy: d.kpi?.totalGastos ?? 0, finDeMes: d.finDeMes?.kpi?.totalGastos ?? (d.kpi?.totalGastos ?? 0) }
          : { hastaHoy: 0, finDeMes: 0 });
```
y el `catch` correspondiente:
```ts
      .catch(() => {
        if (!cancelled) setDistribuidoraGastos({ hastaHoy: 0, finDeMes: 0 });
      });
```

- [ ] **Step 4: Resolver la variante activa antes de `computed`**

Justo antes de la definición de `const computed = useMemo(...)`, agregar:
```ts
  // ── Variante activa de gastos (Total / Hasta hoy) ────────────────────────
  // Los memos de abajo (computed, computedDateRange) no cambian: sólo se les
  // redirige el dato de entrada según el toggle.
  const gastosPorMesActivo         = modoGastos === 'total' ? (vData?.finDeMes?.gastosPorMes ?? {})         : (vData?.gastosPorMes ?? {});
  const porSucursalActivo          = modoGastos === 'total' ? (vData?.finDeMes?.porSucursal ?? {})          : (vData?.porSucursal ?? {});
  const gastosPorMesSucursalActivo = modoGastos === 'total' ? (vData?.finDeMes?.gastosPorMesSucursal ?? {}) : (vData?.gastosPorMesSucursal ?? {});
  const totalGastosVentasActivo    = modoGastos === 'total' ? (vData?.finDeMes?.kpi?.totalGastos ?? 0)      : (vData?.kpi?.totalGastos ?? 0);
  const produccionGastosActivo     = modoGastos === 'total' ? (produccionSummary?.gastosFinDeMes ?? 0)      : (produccionSummary?.gastosHastaHoy ?? 0);
  const distribuidoraGastosActivo  = modoGastos === 'total' ? distribuidoraGastos.finDeMes                  : distribuidoraGastos.hastaHoy;
```

- [ ] **Step 5: Redirigir `computed` a las variables activas**

Dentro del `useMemo` de `computed`, reemplazar cada lectura directa de
`vData`/`produccionSummary`/`distribuidoraGastos` (gastos) por su
equivalente "activo":

- `const gastosPorMes = vData?.gastosPorMes ?? {};` → `const gastosPorMes = gastosPorMesActivo;`
- Dentro del bloque `if (mesFiltro && registrosDiarios.length > 0) { ... }`: la línea `if (!r.fecha || r.fecha.slice(0, 7) !== mesFiltro || r.fecha > hoyISO) continue;` pasa a saltear el corte por hoy cuando el modo es `'total'`:
  ```ts
      const hoyISO = hoyISOChile();
      for (const r of registrosDiarios) {
        if (!r.fecha || r.fecha.slice(0, 7) !== mesFiltro) continue;
        if (modoGastos === 'hastaHoy' && r.fecha > hoyISO) continue;
        if (!gastosPorSucursal[r.sucursal]) gastosPorSucursal[r.sucursal] = { gastos: 0 };
        gastosPorSucursal[r.sucursal].gastos += r.monto;
      }
  ```
- `for (const [suc, d] of Object.entries(vData?.porSucursal ?? {})) {` → `for (const [suc, d] of Object.entries(porSucursalActivo)) {`
- `} else if (produccionSummary && (produccionSummary.ventas > 0 || produccionSummary.gastos > 0)) {` → `} else if (produccionSummary && (produccionSummary.ventas > 0 || produccionGastosActivo > 0)) {` (y el `gastosPorSucursal['Producción'] = { gastos: produccionSummary.gastos };` que sigue pasa a `{ gastos: produccionGastosActivo };`)
- `if (!filtroActivo && distribuidoraGastos > 0) {` → `if (!filtroActivo && distribuidoraGastosActivo > 0) {` (y `gastosPorSucursal['Distribuidora'] = { gastos: distribuidoraGastos };` → `{ gastos: distribuidoraGastosActivo };`)
- `const gastosPorMesSucursal = vData?.gastosPorMesSucursal ?? {};` → `const gastosPorMesSucursal = gastosPorMesSucursalActivo;`
- `totalGastos = hasMes ? (gastosPorMes[mesFiltro] ?? 0) : (vData?.kpi?.totalGastos ?? 0);` → `totalGastos = hasMes ? (gastosPorMes[mesFiltro] ?? 0) : totalGastosVentasActivo;`
- `totalGastos = sucursales.reduce((s, suc) => s + (vData?.porSucursal?.[suc]?.gastos ?? 0), 0);` → `totalGastos = sucursales.reduce((s, suc) => s + (porSucursalActivo[suc]?.gastos ?? 0), 0);`
- `if (!filtroActivo) totalGastos += (produccionSummary?.gastos ?? 0) + distribuidoraGastos;` → `if (!filtroActivo) totalGastos += produccionGastosActivo + distribuidoraGastosActivo;`

Y actualizar el array de dependencias del `useMemo` de `computed` (hoy
`[ccData, vData, filters.sucursales, mesFiltro, produccionSummary, distribuidoraGastos, totalSucursales]`)
a:
```ts
  }, [ccData, vData, filters.sucursales, mesFiltro, modoGastos, produccionSummary, distribuidoraGastos, totalSucursales]);
```

- [ ] **Step 6: Redirigir `computedDateRange` (mismo criterio)**

Dentro del `useMemo` de `computedDateRange`, las 3 líneas que leen
`produccionSummary.gastos`/`distribuidoraGastos` directo:
```ts
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
pasan a:
```ts
    if (!filtroActivo && produccionSummary && (produccionSummary.ventas > 0 || produccionGastosActivo > 0)) {
      ventasPorLocal['Producción'] = produccionSummary.ventas;
      gastosPorSucursal['Producción'] = { gastos: produccionGastosActivo };
      totalGastos += produccionGastosActivo;
    }
    if (!filtroActivo && distribuidoraGastosActivo > 0) {
      gastosPorSucursal['Distribuidora'] = { gastos: distribuidoraGastosActivo };
      totalGastos += distribuidoraGastosActivo;
    }
```
(el corte por fecha de `gastosDias`, líneas `if (!r.fecha) continue; ... totalGastos += r.monto;`, no se toca — ese bloque usa `vData?.registrosDiariosGastos` directo, sin cortar por hoy, y ese comportamiento no depende de este toggle porque `modoFiltro === 'dia'` es un rango explícito de fechas, no "el mes en curso".)

Actualizar también el array de dependencias de `computedDateRange` (hoy
termina en `..., produccionSummary, distribuidoraGastos, totalSucursales]`)
agregando `modoGastos`:
```ts
  }, [ccData, vData, fechaDesde, fechaHasta, modoFiltro, filters.sucursales, computed, modoGastos, produccionSummary, distribuidoraGastos, totalSucursales]);
```

- [ ] **Step 7: UI del toggle**

En la barra de filtros, justo después del bloque `{/* Tipo de comparación
+ selectores */}` (o en cualquier punto cercano al selector de mes — lo
importante es que quede junto al resto de controles de filtro, antes del
`</div>` que cierra la barra), agregar:

```tsx
          {/* Toggle Total / Hasta hoy — sólo tiene sentido en el mes en curso */}
          {esMesActualChile(mesFiltro) && (
            <button
              onClick={() => setModoGastos(m => m === 'total' ? 'hastaHoy' : 'total')}
              className={clsx(
                'flex items-center gap-1 border rounded-xl px-3 py-2 text-[11px] font-semibold transition-all',
                modoGastos === 'total'
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-600',
              )}
            >
              {modoGastos === 'total' ? 'Total' : 'Hasta hoy'}
            </button>
          )}
```

- [ ] **Step 8: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `src/app/page.tsx`.

- [ ] **Step 9: Verificación manual en el navegador**

Con el servidor corriendo y sesión iniciada: abrir el Dashboard en el mes
en curso, confirmar que aparece el botón "Total"/"Hasta hoy", que
clickearlo cambia los KPIs (Ventas Totales no cambia, Gastos y Margen sí),
y que en un mes cerrado el botón no aparece. Confirmar que "Total" es
siempre ≥ "Hasta hoy" en gastos.

- [ ] **Step 10: Commit**

```bash
git add src/app/page.tsx
git commit -m "Dashboard: toggle Total / Hasta hoy para gastos del mes en curso

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Ventas — toggle "Total / Hasta hoy"

**Files:**
- Modify: `src/app/ventas/page.tsx`

**Interfaces:**
- Consumes: `finDeMes` de `/api/ventas` (Task 3) y `/api/produccion-data`
  (Task 4); `esMesActualChile` (Task 1).
- Produces: nada (hoja).

- [ ] **Step 1: Import de `esMesActualChile`**

Agregar `esMesActualChile` al import existente de `@/lib/date-utils` en
`src/app/ventas/page.tsx` (si el archivo no importa nada de `date-utils`
hoy, agregar la línea `import { esMesActualChile } from '@/lib/date-utils';`
junto a los demás imports de `@/lib/...`).

- [ ] **Step 2: Estado del toggle, persistido**

Junto a los demás `useState` de filtros (cerca de `const [mesPill, setMesPill] = useState('');`), agregar:
```ts
  const [modoGastos, setModoGastos] = useState<'total' | 'hastaHoy'>('total');
```
Si este archivo ya restaura/persiste otros filtros vía `sessionStorage`
con un helper (`ssGet`/similar) igual al de `page.tsx`, seguir el mismo
patrón con la key `'ventas_modoGastos'`; si no tiene ese mecanismo, agregar
un `useEffect` de restauración al montar y otro de persistencia, igual que
en la Task 7 (mismo helper `ssGet` si ya existe en este archivo, o copiado
localmente si no).

- [ ] **Step 3: Guardar ambas variantes al recibir la respuesta de `/api/ventas`**

Cambiar los `useState` que hoy guardan sólo la vista "hasta hoy":
```ts
  const [rawGastosMes, setRawGastosMes] = useState<Record<string, number>>({});
  const [rawGastosMesSucursal, setRawGastosMesSucursal] = useState<Record<string, Record<string, number>>>({});
```
a:
```ts
  const [rawGastosMesHastaHoy, setRawGastosMesHastaHoy] = useState<Record<string, number>>({});
  const [rawGastosMesFinDeMes, setRawGastosMesFinDeMes] = useState<Record<string, number>>({});
  const [rawGastosMesSucursalHastaHoy, setRawGastosMesSucursalHastaHoy] = useState<Record<string, Record<string, number>>>({});
  const [rawGastosMesSucursalFinDeMes, setRawGastosMesSucursalFinDeMes] = useState<Record<string, Record<string, number>>>({});
```

En el `useEffect` que hace `fetch('/api/ventas')` (busca
`const gastosPorMes: Record<string, number> = facturas.ok ? (facturas.gastosPorMes ?? {}) : {};`),
cambiar:
```ts
        const gastosPorMes: Record<string, number> = facturas.ok ? (facturas.gastosPorMes ?? {}) : {};
        if (facturas.ok) {
          setRawGastosMes(gastosPorMes);
          setRawDiasGastos(facturas.registrosDiariosGastos ?? []);
          setRawGastosMesSucursal(facturas.gastosPorMesSucursal ?? {});
          setFacturasSinFecha(facturas.facturasSinFecha ?? []);
        }
```
a:
```ts
        const gastosPorMes: Record<string, number> = facturas.ok ? (facturas.gastosPorMes ?? {}) : {};
        if (facturas.ok) {
          setRawGastosMesHastaHoy(gastosPorMes);
          setRawGastosMesFinDeMes(facturas.finDeMes?.gastosPorMes ?? gastosPorMes);
          setRawDiasGastos(facturas.registrosDiariosGastos ?? []);
          setRawGastosMesSucursalHastaHoy(facturas.gastosPorMesSucursal ?? {});
          setRawGastosMesSucursalFinDeMes(facturas.finDeMes?.gastosPorMesSucursal ?? (facturas.gastosPorMesSucursal ?? {}));
          setFacturasSinFecha(facturas.facturasSinFecha ?? []);
        }
```
(la línea `const setFactura = new Set<string>(facturas.ok ? Object.keys(gastosPorMes) : []);`, un poco más abajo en el mismo `.then`, sigue leyendo `gastosPorMes` — esa variable local sigue existiendo igual, no se toca.)

- [ ] **Step 4: Guardar ambas variantes de `produccionMes`**

Cambiar:
```ts
  const [produccionMes, setProduccionMes] = useState<Record<string, ProductionMonth>>({});
```
a:
```ts
  const [produccionMesHastaHoy, setProduccionMesHastaHoy] = useState<Record<string, ProductionMonth>>({});
  const [produccionMesFinDeMes, setProduccionMesFinDeMes] = useState<Record<string, ProductionMonth>>({});
```

En el `useEffect` que hace `fetch('/api/produccion-data?...')` y arma
`next: Record<string, ProductionMonth>` a partir de `d.ventasPorMes`/
`d.gastosPorMes`/`d.kpi`, después de construir `next` (justo antes de
`setProduccionMes(next);`), construir también la variante `finDeMes`:

```ts
        const nextFinDeMes: Record<string, ProductionMonth> = {};
        for (const item of d.ventasPorMes ?? []) {
          nextFinDeMes[item.key] = { ...(nextFinDeMes[item.key] ?? { ventas: 0, gastos: 0 }), ventas: item.ventas ?? 0 };
        }
        for (const item of d.finDeMes?.gastosPorMes ?? d.gastosPorMes ?? []) {
          nextFinDeMes[item.key] = { ...(nextFinDeMes[item.key] ?? { ventas: 0, gastos: 0 }), gastos: item.monto ?? 0 };
        }
        if (Object.keys(nextFinDeMes).length === 0 && d.kpi) {
          const fallbackKey = modoFiltro === 'dia' ? fechaDesde.slice(0, 7) : mesDesde;
          nextFinDeMes[fallbackKey] = { ventas: d.kpi.totalVentas ?? 0, gastos: d.finDeMes?.kpi?.totalCostos ?? (d.kpi.totalCostos ?? 0) };
        }
        setProduccionMesHastaHoy(next);
        setProduccionMesFinDeMes(nextFinDeMes);
```
(reemplaza la línea `setProduccionMes(next);` existente por las dos líneas
`setProduccionMesHastaHoy(next);`/`setProduccionMesFinDeMes(nextFinDeMes);`
de arriba; el resto del `.then` — incluido `setProduccionTopProveedores`
y el `.catch` — no cambia, salvo que el `.catch`/rama `!d?.ok` que hoy hace
`setProduccionMes({});` pase a hacer
`setProduccionMesHastaHoy({}); setProduccionMesFinDeMes({});`.)

- [ ] **Step 5: Resolver la variante activa antes de `filteredData`**

Justo antes de `const filteredData = useMemo(() => {`, agregar:
```ts
  // ── Variante activa de gastos (Total / Hasta hoy) ────────────────────────
  // El resto de la página (filteredData de abajo) no cambia: se le
  // redirige el dato de entrada según el toggle, con los mismos nombres
  // que ya consumía (rawGastosMes, rawGastosMesSucursal, produccionMes).
  const rawGastosMes = modoGastos === 'total' ? rawGastosMesFinDeMes : rawGastosMesHastaHoy;
  const rawGastosMesSucursal = modoGastos === 'total' ? rawGastosMesSucursalFinDeMes : rawGastosMesSucursalHastaHoy;
  const produccionMes = modoGastos === 'total' ? produccionMesFinDeMes : produccionMesHastaHoy;
```

- [ ] **Step 6: Actualizar el array de dependencias de `filteredData`**

El `useMemo` de `filteredData` termina con un array de dependencias que
hoy incluye `rawGastosMes, rawGastosMesSucursal, ..., produccionMes, ...`
(ver `grep -n "}, \[rawLocalMes" src/app/ventas/page.tsx` para la línea
exacta). Como `rawGastosMes`/`rawGastosMesSucursal`/`produccionMes` pasan a
ser consts derivadas (Step 5) en vez de estado directo, reemplazar esos 3
nombres en el array de dependencias por sus fuentes reales más
`modoGastos`:

Antes:
```ts
  }, [rawLocalMes, rawGastosMes, rawGastosMesSucursal, rawDiasCaja, rawDiasGastos, produccionMes, produccionTopProveedores, localSel, /* ...resto sin cambios... */]);
```
Después:
```ts
  }, [rawLocalMes, modoGastos, rawGastosMesHastaHoy, rawGastosMesFinDeMes, rawGastosMesSucursalHastaHoy, rawGastosMesSucursalFinDeMes, rawDiasCaja, rawDiasGastos, produccionMesHastaHoy, produccionMesFinDeMes, produccionTopProveedores, localSel, /* ...resto sin cambios... */]);
```
(sólo se reemplazan esos 3 nombres puntuales en el array — el resto de las
dependencias que ya tenía ese `useMemo` queda igual, en el mismo orden.)

- [ ] **Step 7: UI del toggle**

Cerca del selector de mes/período de la barra de filtros de Ventas (buscar
el botón "Comparar" — `grep -n "GitCompare" src/app/ventas/page.tsx` para
ubicar esa barra), agregar, en un punto donde `mesDesde`/`mesHasta` ya
estén definidos:

```tsx
        {/* Toggle Total / Hasta hoy — sólo tiene sentido en el mes en curso */}
        {mesDesde === mesHasta && esMesActualChile(mesDesde) && (
          <button
            onClick={() => setModoGastos(m => m === 'total' ? 'hastaHoy' : 'total')}
            className={clsx(
              'flex items-center gap-1 border rounded-xl px-3 py-2 text-[11px] font-semibold transition-all',
              modoGastos === 'total'
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-600',
            )}
          >
            {modoGastos === 'total' ? 'Total' : 'Hasta hoy'}
          </button>
        )}
```

(la condición `mesDesde === mesHasta` evita mostrar el toggle cuando el
usuario eligió un RANGO de meses, no un solo mes — en ese caso "mes en
curso" no aplica limpiamente porque el rango puede incluir varios meses.)

- [ ] **Step 8: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `src/app/ventas/page.tsx`.

- [ ] **Step 9: Verificación manual en el navegador**

Con sesión iniciada, ir a Ventas, mes en curso: confirmar que aparece el
toggle, que cambia los gastos/margen mostrados, y que en un rango de meses
o un mes cerrado no aparece.

- [ ] **Step 10: Commit**

```bash
git add src/app/ventas/page.tsx
git commit -m "Ventas: toggle Total / Hasta hoy para gastos del mes en curso

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Factor-índice — toggle "Total / Hasta hoy"

**Files:**
- Modify: `src/app/factor-indice/page.tsx`

**Interfaces:**
- Consumes: `finDeMes` de `/api/ventas` (Task 3); `esMesActualChile` (Task 1).
- Produces: nada (hoja).

- [ ] **Step 1: Import de `esMesActualChile`**

En `src/app/factor-indice/page.tsx`:
```ts
import { hoyISOChile } from '@/lib/date-utils';
```
pasa a:
```ts
import { hoyISOChile, esMesActualChile } from '@/lib/date-utils';
```

- [ ] **Step 2: Estado del toggle, persistido**

Junto a los demás `useState` de filtros de esta página, agregar:
```ts
  const [modoGastos, setModoGastos] = useState<'total' | 'hastaHoy'>('total');
```
Seguir el mismo mecanismo de persistencia en `sessionStorage` que ya use
esta página para sus otros filtros (buscar `sessionStorage` en el archivo
para identificar el patrón exacto), con la key `'factor_modoGastos'`.

- [ ] **Step 3: El corte del gráfico semanal (`indice50Data`) pasa a ser condicional**

Dentro del `useMemo` que arma `indice50Data` (empieza en
`const { indice50Data, allSucs } = useMemo(() => {`), la línea:
```ts
    const hoyISO = hoyISOChile();
    const diasGastos: any[] = (ventasData?.registrosDiariosGastos ?? []).filter((r: any) => r.fecha <= hoyISO);
```
pasa a:
```ts
    const hoyISO = hoyISOChile();
    const diasGastosRaw: any[] = ventasData?.registrosDiariosGastos ?? [];
    const diasGastos: any[] = modoGastos === 'total'
      ? diasGastosRaw
      : diasGastosRaw.filter((r: any) => r.fecha <= hoyISO);
```
Y agregar `modoGastos` al array de dependencias de ese `useMemo` (hoy
termina en `}, [cierreCajaData, ventasData, mesSeleccionado, modo, localRestriccion]);`):
```ts
  }, [cierreCajaData, ventasData, mesSeleccionado, modo, modoGastos, localRestriccion]);
```

- [ ] **Step 4: El factor global (`factorGlobal`/`totalGastos`) lee `finDeMes` cuando corresponde**

Dentro del `useMemo` que arma `{ factorGlobal, totalVentas, totalGastos }`
(empieza en `const { factorGlobal, totalVentas, totalGastos } = useMemo(() => {`),
reemplazar:
```ts
    // Usar gastosPorMesSucursal del server (usa col 'mes' del sheet — más preciso que filtrar por fecha.iso)
    const gastosMesSuc: Record<string, Record<string, number>> = ventasData?.gastosPorMesSucursal ?? {};
    let tg = 0;
    if (todasSucs) {
      tg = ventasData?.gastosPorMes?.[mesSeleccionado] ?? 0;
    } else {
      for (const suc of sucSel) tg += gastosMesSuc[suc]?.[mesSeleccionado] ?? 0;
    }
```
por:
```ts
    // Usar gastosPorMesSucursal del server (usa col 'mes' del sheet — más preciso que filtrar por fecha.iso)
    const gastosPorMesActivo = modoGastos === 'total' ? (ventasData?.finDeMes?.gastosPorMes ?? {}) : (ventasData?.gastosPorMes ?? {});
    const gastosMesSuc: Record<string, Record<string, number>> = modoGastos === 'total'
      ? (ventasData?.finDeMes?.gastosPorMesSucursal ?? {})
      : (ventasData?.gastosPorMesSucursal ?? {});
    let tg = 0;
    if (todasSucs) {
      tg = gastosPorMesActivo[mesSeleccionado] ?? 0;
    } else {
      for (const suc of sucSel) tg += gastosMesSuc[suc]?.[mesSeleccionado] ?? 0;
    }
```
y agregar `modoGastos` al array de dependencias (hoy
`}, [cierreCajaData, ventasData, mesSeleccionado, sucSel, allSucs]);`):
```ts
  }, [cierreCajaData, ventasData, mesSeleccionado, sucSel, allSucs, modoGastos]);
```

(El bloque `compFactorData`, que calcula lo mismo para `compMes2` —el mes
de comparación—, se deja **sin cambios**: por diseño el toggle sólo afecta
la lectura del mes que se está viendo ahora mismo, y `compMes2` casi
siempre es un mes ya cerrado donde ambas vistas coinciden. Si en algún
momento se quisiera extender, seguiría exactamente el mismo patrón de
arriba.)

- [ ] **Step 5: UI del toggle**

Cerca del botón "Comparar" de esta página (buscar `GitCompare` —
`grep -n "GitCompare" src/app/factor-indice/page.tsx`), agregar, en un
punto donde `mesSeleccionado` ya esté definido:

```tsx
        {/* Toggle Total / Hasta hoy — sólo tiene sentido en el mes en curso */}
        {esMesActualChile(mesSeleccionado) && (
          <button
            onClick={() => setModoGastos(m => m === 'total' ? 'hastaHoy' : 'total')}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-medium border transition-all"
            style={modoGastos === 'total'
              ? { background: '#059669', borderColor: '#059669', color: '#fff' }
              : { background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
          >
            {modoGastos === 'total' ? 'Total' : 'Hasta hoy'}
          </button>
        )}
```

(este archivo ya usa `style` inline con variables del tema para el botón
"Comparar" vecino — ver el patrón en el mismo bloque — por eso el toggle
sigue ese mismo estilo en vez de clases Tailwind planas.)

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `src/app/factor-indice/page.tsx`.

- [ ] **Step 7: Verificación manual en el navegador**

Con sesión iniciada, ir a Factor-índice, mes en curso: confirmar que
aparece el toggle, que cambia el Factor Índice / gastos mostrados y el
gráfico semanal, y que en un mes cerrado no aparece.

- [ ] **Step 8: Commit**

```bash
git add src/app/factor-indice/page.tsx
git commit -m "Factor-índice: toggle Total / Hasta hoy para gastos del mes en curso

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Cobertura del spec:**
- §1 `fetchGastosFacturas` deja de cortar por hoy → Task 2.
- §2 `/api/ventas` expone `finDeMes` → Task 3.
- §3 `/api/produccion-data`/`/api/distribuidora-data` → Tasks 4, 5.
- Preservar comportamiento de informes/asistente (fuera de alcance) →
  Task 4 Step 4 (`fetchProduccionForReport`) y Task 6
  (`fetchDistribuidoraForReport`) — encontrado durante la exploración de
  código de esta sesión de planning, no estaba explícito como tarea
  separada en el spec pero es una consecuencia directa de la Task 2 que el
  spec sí exige preservar ("Fuera de alcance: informes/asistente... sin
  cambios").
- §4 Frontend: un pill por página, visible sólo en mes en curso,
  sessionStorage independiente → Tasks 7, 8, 9.
- Testing: helper de agregación con test unitario → Task 3. Verificación
  manual → Steps finales de Tasks 4, 5, 7, 8, 9.

**Placeholders:** ninguno — todos los steps de código traen el snippet
completo o el comando exacto.

**Consistencia de tipos:** `'total' | 'hastaHoy'` se usa igual en las 3
páginas (Tasks 7, 8, 9). `finDeMes` tiene el mismo nombre de campo en los
3 endpoints (Tasks 3, 4, 5). `GastosAgregados`/`RegistroFactura` se
definen una vez en Task 3 y no se reusan fuera de `api/ventas/route.ts`
(produccion-data/distribuidora-data usan sus propios tipos locales
inferidos, ya existentes en esos archivos — no hace falta unificarlos).

**Nota para quien ejecute el plan:** las Tasks 7, 8 y 9 tocan archivos
grandes (page.tsx: 815 líneas, ventas/page.tsx: 1755 líneas,
factor-indice/page.tsx: 782 líneas). Cada Step da el texto exacto a buscar
y su reemplazo, pero el implementador debe confirmar con
`grep -n` que el texto a reemplazar aparece **una sola vez** en el archivo
antes de aplicar el cambio — si aparece más de una vez, usar más contexto
alrededor (líneas antes/después) para no tocar la ocurrencia equivocada.
