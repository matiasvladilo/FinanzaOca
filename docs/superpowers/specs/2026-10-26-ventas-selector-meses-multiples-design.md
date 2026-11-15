# Selector de meses múltiples en Ventas

**Fecha:** 2026-10-26
**Archivo principal:** `src/app/ventas/page.tsx` (1833 líneas)

## Contexto

El selector de "Período" de la página Ventas (`PeriodSelect` en `src/components/ui/PeriodSelect.tsx`, usado en `ventas/page.tsx:1305-1321`) solo permite elegir **un mes** o, vía su `allLabel="Todos los meses"`, el rango completo mín↔máx de `mesesDisponibles`. No hay forma de elegir un subconjunto específico — ej. "los últimos 3 meses", o (el caso que motivó este pedido) "Octubre 2025 + Octubre 2026 + Octubre 2027" para comparar el mismo mes a través de los años, algo que la app todavía no tiene pero va a necesitar a medida que acumule más de un año de datos.

Esto nació de un pedido sobre el gráfico "Tendencia": con el filtro en un solo mes, las vistas de Línea/Área del toggle Área/Línea/Barras (`tipoGrafico`, `ventas/page.tsx:1599-1613`) quedan con un único punto en el eje X — una línea no tiene nada que conectar con un solo punto. No es un bug del gráfico (con un rango de varios meses, línea y área se ven bien, con gradiente y todo — ver `ventas/page.tsx:368-398`): el problema real es que hoy no se puede elegir un conjunto de meses no contiguos ni acotado a algo distinto de "todos".

## Qué cambia

### 1. Modelo de estado: de rango a conjunto

Reemplaza `mesDesde: string` / `mesHasta: string` (`ventas/page.tsx:589-590`) por:

```ts
const [mesesSel, setMesesSel] = useState<Set<string>>(new Set());
```

- **Default al cargar datos** (reemplaza `ventas/page.tsx:655-662`): igual que hoy — el mes actual si está disponible, si no el más reciente. `setMesesSel(new Set([seleccionado]))`.
- **`mesPill`** (`ventas/page.tsx:591`) se elimina — ya no hay un "valor único" de período que mostrar en una pill; el nuevo control de UI (punto 3) muestra su propio label derivado de `mesesSel`.
- Se agrega un helper derivado (no se persiste, se recalcula):
  ```ts
  const mesesSelOrdenados = useMemo(() => [...mesesSel].sort(), [mesesSel]);
  ```
  Las claves "YYYY-MM" ordenan cronológicamente como string — confirmado que ningún lugar del archivo asume contigüidad para el orden de visualización (helper `keyToLabel`, `ventas/page.tsx:426-429`, ya incluye el año: "Oct 2025" vs "Oct 2026", así que conviven sin ambigüedad en el mismo gráfico/lista).

### 2. Dónde se usa `mesDesde`/`mesHasta` hoy y cómo migra cada caso

**Swap mecánico — rango a conjunto** (`m >= mesDesde && m <= mesHasta` → `mesesSel.has(m)`):
- `buildMonthChart` (`:826`) — builder central del gráfico de Tendencia (single-local).
- `buildMultiLocalMonthChart` (`:924`) — mismo patrón para 2+ locales.
- `buildTopProveedores`, rama mes (`:893-894`).
- `buildTransacciones`, rama mes (`:914-915`).
- `mesesFiltrados` (`:1081`), que alimenta `porLocalFiltrado` (`:1082-1117`) — KPIs principales (Ventas Totales, Gastos Totales, Margen Neto, Índice 60).
- `gastosSinPanaderia` / Índice P (`:1180-1181`).
- `proveedorDetalle` (modal de proveedor, `:1140-1141`) — su propio sort por mes (`:1151`, `localeCompare` sobre "YYYY-MM") ya ordena bien sin asumir contigüidad.

**Caso especial — llamada a `/api/produccion-data`** (`:672-729`, envía `mesDesde`/`mesHasta` como query params, `:680-681`): la ruta (`src/app/api/produccion-data/route.ts:41-47`) solo acepta un rango contiguo (lo convierte a un instante UTC desde/hasta vía `limitesUtcDelRango`), no una lista de meses. **No se toca el backend.** En su lugar: el fetch pide el tramo `min(mesesSelOrdenados)` – `max(mesesSelOrdenados)` (sobre-pide si hay huecos entre meses elegidos) y el resultado se filtra en el cliente contra `mesesSel`, igual que ya se filtra todo lo demás en memoria. Excepción: `topProveedoresProd` (el ranking de Top Proveedores de Producción) llega ya agregado sin desglose por mes, así que no se puede filtrar en el cliente — con una selección no contigua se oculta en vez de mostrarse contaminado (ver `buildTopProveedores` en `ventas/page.tsx`).

**Casos de un solo mes — necesitan una regla explícita, no un swap mecánico:**

- **`modoGastos` ("Total" / "Hasta hoy") y su gate de visibilidad** (`:741-745`, duplicado en `:1244-1249`, gate de UI en `:1426`): hoy el check es `mesDesde !== mesHasta` para decidir si hay "un rango" (fuerza `'hastaHoy'`). Con el nuevo modelo, el toggle y su resolución se mantienen funcionando exactamente igual que hoy, pero gateados por `mesesSel.size === 1` en vez de `mesDesde !== mesHasta`. **No se generaliza a resolución por-mes** (eso sería un rediseño de la lógica de datos compartida, fuera de alcance) — con 2+ meses elegidos, el toggle queda oculto y el modo efectivo es `'hastaHoy'` para todos (mismo comportamiento que hoy tiene un rango).
- **`proyeccionData` / card "Proyección de Ventas"** (`:1241-1284`, usa `const mes = mesDesde` en `:1250`): es inherentemente de un solo mes (días transcurridos × ritmo diario). Con `mesesSel.size !== 1`, la card no calcula una proyección — muestra un mensaje tipo "Elegí un solo mes para ver la proyección" en vez de inventar un número agregado. Con `size === 1`, usa ese único mes exactamente como hoy.

**Comparación por período ("Comparar" de arriba, `compOn`/`compMes`, `:597-598`, `:1380-1408`, `ComparisonPanel` en `:1524-1567`):** no cambia. Sigue comparando "lo que esté seleccionado" contra un solo mes (`compMes`), independiente de cómo se haya armado `mesesSel`. `isPeriodComp` (`:1073`) sigue llamando `buildMonthChart(compMes, compMes, ...)`, que con el swap mecánico de arriba pasa a `buildMonthChart(new Set([compMes]), ...)` sin cambiar de comportamiento.

**Solo UI — labels que hoy arman "A – B" y ahora deben adaptarse a un conjunto:**
- Header de Tendencia (`:1589-1593`).
- `labelA` que arma `ComparisonPanel` (`:1530-1532`).

Regla de formato (un solo helper, reusado en ambos lugares):
- 0 meses: no debería pasar (siempre hay al menos el default), pero si pasa, placeholder "Sin período".
- 1 mes: `keyToLabel(mes)` — igual que hoy.
- 2+ meses **contiguos** (ej. Ago, Sep, Oct 2026 seguidos): `"{primero} – {último}"`, igual que el label de rango actual.
- 2+ meses **no contiguos**, hasta 4: lista separada por comas, ej. `"Oct 2025, Oct 2026, Oct 2027"`.
- Más de 4 meses no contiguos: `"{N} meses"`.

El contador existente `"{N} meses"` en la leyenda rápida del gráfico (`:1636-1639`) ya es count-based — no necesita cambios.

### 3. Nuevo control de UI: selector de meses múltiples

Nuevo componente `src/components/ui/MonthMultiSelect.tsx`, usado solo en `ventas/page.tsx` (reemplaza el `PeriodSelect` de `:1305-1321` en este archivo únicamente — `PeriodSelect.tsx` no se toca, lo siguen usando Dashboard/Merma/Factor Índice sin cambios).

- Trigger: mismo lenguaje visual que el resto del refresh "Apple clean" (botón con borde hairline, `rounded-lg`, label derivado de la regla de formato del punto 2).
- Panel desplegable: checklist de meses agrupados por año (un encabezado de año por grupo, ej. "2026"), cada mes como un chip/fila tildable. Dos acciones rápidas: "Todos" (selecciona todo `mesesDisponibles`) y "Ninguno" (vacía la selección — si queda vacío, el componente padre vuelve a aplicar el default de un mes para no romder los cálculos; ver nota abajo).
- Nota: `mesesSel` nunca debe quedar vacío en los cálculos reales — si "Ninguno" deja el set vacío, `ventas/page.tsx` reacciona reseleccionando el mes default (mismo que el default inicial) en vez de dejar pasar un set vacío a `buildMonthChart` y compañía.

### 4. Renombre de la otra "Comparar" (de paso, bajo riesgo)

`ventas/page.tsx:1579-1585` — el toggle de métrica del gráfico de Tendencia tiene las opciones `ventas` / `gastos` / `ambos`, con `ambos` mostrando la etiqueta "Comparar". Pasa a mostrar **"Ventas + Gastos"** en vez de "Comparar", para no confundirse con el botón "Comparar" del toolbar de arriba (que compara períodos, no métricas). Sin cambios de lógica — solo el string de la etiqueta.

## Qué NO cambia

- El componente compartido `src/components/ui/PeriodSelect.tsx` (lo siguen usando Dashboard, Merma, Factor Índice tal cual).
- El backend (`/api/produccion-data/route.ts` ni ninguna otra ruta).
- La comparación por período ("Comparar" de arriba) — sigue comparando contra un solo mes.
- "Rango días" (`modoFiltro === 'dia'`, filtro por fecha en vez de por mes) — es ortogonal, no se toca.
- La resolución Total/Hasta-hoy sigue siendo global (no por-mes) — con 2+ meses elegidos, el toggle se oculta y el modo efectivo es `'hastaHoy'`, igual que hoy con un rango.
- Ninguna otra página (`Dashboard`, `Merma`, `Factor Índice`, etc.).

## Riesgos / validación

- El cambio de modelo de estado (`mesDesde`/`mesHasta` → `mesesSel: Set<string>`) toca prácticamente todas las secciones de la página — alto riesgo de romper algún cálculo si un `.filter` queda con la condición vieja. Verificación: comparar los números de las tarjetas KPI (Ventas Totales, Gastos Totales, Margen Neto, Índice 60, Índice P) antes y después del cambio, con un solo mes elegido (debe dar exactamente lo mismo que hoy) y con el rango completo "Todos" (debe dar lo mismo que seleccionar manualmente todos los meses).
- Validar especialmente: Top Proveedores, Transacciones, modal de detalle de proveedor, Proyección de Ventas (con 1 mes y con 2+), el toggle Total/Hasta-hoy (aparece/desaparece correctamente), y el fetch de `/api/produccion-data` con meses no contiguos (ej. Ago 2026 + Oct 2026 sin Sep) — confirmar que Sep no contamina los números aunque se haya sobre-pedido.
