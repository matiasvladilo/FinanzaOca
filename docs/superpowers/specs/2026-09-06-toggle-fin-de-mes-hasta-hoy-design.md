# Toggle "Total / Hasta hoy" para gastos del mes en curso — diseño

## Contexto

El negocio se imputa por fecha de vencimiento ([[feedback-fecha-vencimiento]]),
así que las planillas de Producción/Distribuidora (y los 4 locales, en su
propio formato) ya traen cargados gastos recurrentes (arriendo, servicios)
con su fecha de vencimiento del mes completo desde el día 1, aunque falten
semanas para que esos días efectivamente lleguen. Un fix reciente (commits
`60be0c0`, y el mismo patrón en `fetchGastosFacturas`) excluyó esas facturas
"con fecha futura dentro del mes en curso" del total de gastos, porque sin
el corte el Factor Índice se inflaba de forma irreal (376% el día 4 de un
mes de 30, en vez de ~97%).

Ese corte ("hasta hoy") hoy es el **único** comportamiento disponible, sin
opción de ver el mes completo. El usuario quiere poder elegir: por default
ver el **mes completo** (`Total`, incluye los vencimientos ya cargados
aunque su fecha sea futura dentro del mes en curso), con un botón para
cambiar a **`Hasta hoy`** (el corte actual, solo lo que ya venció).

Este spec cubre solo el toggle "Total / Hasta hoy". El pedido de volver el
filtro de sucursales a un dropdown (mencionado en la misma conversación) es
un tema aparte, para otro spec.

## Alcance

**Páginas con el toggle** (las únicas que muestran un KPI de gastos del mes
en curso afectado por este corte):
- Dashboard (`src/app/page.tsx`)
- Ventas (`src/app/ventas/page.tsx`)
- Factor-índice (`src/app/factor-indice/page.tsx`)

Merma **no** entra: su "hasta hoy" (línea 381 de `merma/page.tsx`) es un
cálculo cliente-side para un gráfico semanal de merma, no depende de
`fetchGastosFacturas` ni de los gastos de `/api/ventas` — no hay nada que
tocar ahí.

**Endpoints que necesitan exponer la variante "mes completo"** (`finDeMes`):
- `/api/ventas` (`src/app/api/ventas/route.ts`) — headline de Dashboard,
  Ventas y Factor-índice.
- `/api/produccion-data` (`src/app/api/produccion-data/route.ts`) — solo
  relevante para Dashboard y Ventas cuando su vista incluye Producción
  (ninguna sucursal específica de las 4 filtrada, o al menos una de
  ellas contribuye al agregado "Todas").
- `/api/distribuidora-data` (`src/app/api/distribuidora-data/route.ts`) —
  mismo caso que Producción.

Factor-índice **no** usa `produccion-data` ni `distribuidora-data` (se
confirmó por grep) — su toggle solo necesita la variante `finDeMes` de
`/api/ventas`.

**Fuera de alcance:**
- `/api/informes/generate` y las herramientas del asistente que llaman a
  `fetchGastosFacturas`/`/api/ventas` — siguen viendo el comportamiento
  actual (`hasta hoy`) sin cambios; no se les agrega ningún toggle ni se
  cambia el default de los campos que ya consumen.
- El filtro de sucursales (`SucursalFilter` → dropdown) — spec aparte.
- Merma — no aplica, según lo explicado arriba.

## Diseño

### 1. `fetchGastosFacturas` deja de cortar por hoy

En `src/lib/data/gastos.ts`, la línea:
```ts
if (fp.iso > hoyISO) continue;
```
se elimina. La función pasa a devolver **todas** las facturas dentro de
`[desde, hasta]`, sin importar si su fecha de vencimiento ya pasó o no.
Cada fila ya trae su `fecha` (ISO), así que quien llame a la función decide
si corta por hoy o no. El comentario que explica el porqué del corte se
mueve a los call-sites (donde ahora vive la decisión).

### 2. `/api/ventas` expone `finDeMes` al lado de los campos actuales

Hoy la ruta arma un único array `gastos` (`registros.filter(r => r.fecha
<= HOY_ISO)`, línea 167) y de ahí derivan `totalGastos`, `totalIngresos`,
`porMes`/`gastosPorMes`, `porSucursal`, `gastosPorMesSucursal`. Ese array y
todo lo que deriva de él **no cambian de nombre ni de comportamiento** — se
renombran internamente a claridad (`gastosHastaHoy`) pero el JSON de
respuesta sigue teniendo `totalGastos`, `porSucursal`, etc. con el mismo
significado de siempre (informes/asistente no se enteran del cambio).

Se agrega un segundo cálculo sobre `gastosCrudo` (el array sin filtrar que
ya existe hoy, usado solo para `registrosDiariosGastos`) filtrado apenas
por año actual (mismo guard que ya tiene `porMes`), produciendo el mismo
shape de agregados. Para no duplicar la lógica de agregación dos veces,
se extrae un helper local:

```ts
function agregarGastos(gastos: RegistroVenta[]) {
  const ingresos      = gastos.filter(r => r.tipo === 'INGRESO');
  const totalGastos   = gastos.reduce((s, r) => s + r.monto, 0);
  const totalIngresos = ingresos.reduce((s, r) => s + r.monto, 0);
  // ...porMes, porSucursal, gastosPorMesSucursal, igual que hoy
  return { totalGastos, totalIngresos, gastosPorMes, porSucursal, gastosPorMesSucursal };
}
```

y se llama dos veces: `agregarGastos(gastosHastaHoy)` (resultado va en los
campos planos de siempre) y `agregarGastos(gastosFinDeMes)` (resultado va
en el nuevo objeto `finDeMes: {...}` del JSON de respuesta).

### 3. `/api/produccion-data` y `/api/distribuidora-data` — mismo patrón

Estas rutas usan `gastos` (ahora sin cortar, por el cambio del punto 1) en
varios cálculos encadenados: `totalCostos`, `rentabilidad`, `gastosPorMes`,
`topProveedores`, el set de locales. Se aplica el mismo patrón: separar
`gastosHastaHoy = gastos.filter(r => r.fecha <= hoyISO)` y
`gastosFinDeMes = gastos`, extraer un helper con toda la sección "KPIs que
dependen de gastos" y llamarlo dos veces, agregando el resultado de
`finDeMes` en un campo nuevo del JSON de respuesta (mismo nombre `finDeMes`
que en `/api/ventas`, mismo criterio). Es más trabajo que en `/api/ventas`
porque hay más cálculos encadenados sobre `gastos`, pero el patrón —
extraer un helper, llamarlo dos veces — es el mismo.

### 4. Frontend: un pill por página, visible solo en el mes en curso

En cada una de las 3 páginas, un solo botón (no dos) al lado del selector
de mes:
- Texto **"Total"** cuando está en modo mes completo (default).
- Texto **"Hasta hoy"** cuando está en modo hasta-hoy.
- Click alterna entre los dos modos y cambia su propio texto.
- Solo se renderiza cuando el mes seleccionado (`mesFiltro` / equivalente
  de cada página) es el mes en curso — en un mes cerrado las dos vistas
  dan el mismo número, así que no tiene sentido mostrar el control.
- Estado (`'total' | 'hastaHoy'`, default `'total'`) en un `useState`
  persistido en `sessionStorage` con una key por página (mismo patrón que
  `dash_compareType`), **independiente entre páginas** — cada una recuerda
  su propia preferencia.

Cuando el modo es `'total'`, la página lee `finDeMes.*` de las respuestas
de `/api/ventas` (y de `/api/produccion-data`/`/api/distribuidora-data` en
Dashboard y Ventas); cuando es `'hastaHoy'`, lee los campos planos de
siempre. Todos los números derivados (Margen %, Factor Índice, deltas vs.
comparación) se recalculan a partir de la fuente elegida — no hay caché
cruzado entre modos más allá de lo que ya cachea `withCacheSWR` a nivel de
fetch (ambas variantes viajan en la misma respuesta, así que no hay
re-fetch al tocar el toggle).

## Testing

- Sin tests nuevos de UI (es un botón que cambia qué campo del mismo
  payload se lee).
- Vale la pena un test unitario acotado para el helper `agregarGastos` de
  `/api/ventas` (o su equivalente en produccion-data/distribuidora-data):
  dado un array de facturas con fechas mixtas (algunas futuras dentro del
  mes en curso), confirmar que `hastaHoy` las excluye y `finDeMes` las
  incluye, y que ambos coinciden cuando no hay fechas futuras (mes
  cerrado) — esto es lógica de negocio real, no solo estilos, y es
  exactamente el tipo de bug (376% de Factor Índice) que ya pasó una vez.
- Verificación manual: en el mes en curso, confirmar que "Total" en cada
  una de las 3 páginas es ≥ "Hasta hoy" (nunca al revés, salvo el caso raro
  de una factura con vencimiento ya pasado que se cargó después), y que en
  un mes cerrado el toggle no aparece.
