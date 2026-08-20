# Productos dentro de Producción

**Fecha:** 2026-08-20
**Estado:** aprobado, pendiente de plan de implementación

## Problema

Para responder "¿cuánto se vendió de tal producto en tal período?" hoy hay que
descargar el Excel de ConectOca y analizarlo a mano. Ninguna pantalla de
FinanzaOca contesta esa pregunta.

Al mismo tiempo, **Productos y Producción leen exactamente los mismos datos** —
las tablas `orders`, `order_items`, `categories` y `products` de ConectOca,
filtradas por el mismo `business_id` — a través de dos endpoints distintos:

| dato | `/api/supabase-analytics` (Productos) | `/api/produccion-data` (Producción) |
|---|---|---|
| Top productos | sí | sí |
| Áreas / categorías | sí | sí |
| Ventas mensuales ConectOca | sí | sí |
| Total pedidos | sí | sí |
| Unidades, ticket, unid./pedido | sí | no |
| Gastos, merma, rentabilidad, Control Pan | no | sí |

Esa duplicación ya causó un bug real: PostgREST corta las respuestas en 1000
filas y `.limit(50000)` no levanta ese techo. `produccion-data` paginaba;
`supabase-analytics` no, así que la página de Productos mostraba datos
truncados al 15 de abril de 2026 mientras Producción estaba bien. Dos copias de
la misma lógica que se desincronizan.

## Objetivo

Una sola pantalla donde se pueda buscar un producto y ver cuánto se vendió de él
en el período elegido, sin bajar ningún Excel. Y una sola fuente de datos de
ConectOca en el código.

## No incluido

- Comparar varios productos entre sí en un mismo gráfico.
- Márgenes o costos por producto: ConectOca no tiene el costo unitario.
- Cortes por sucursal: `orders` no tiene columna de sucursal.

## Diseño

### 1. Navegación

Se elimina **Productos** del sidebar. Producción pasa a tener dos solapas:

- **Resumen** — lo que ya existe: ventas, costos, merma, rentabilidad, áreas de
  producción, merma por tipo, Control Pan, top proveedores.
- **Productos** — lo nuevo.

La solapa activa vive en la URL (`?tab=productos`) para poder compartir el link.
`/productos` queda como redirect permanente a `/produccion?tab=productos`.

El selector de período y el de local son únicos, arriba de las solapas. Producción
ya soporta los dos modos que hacen falta — "Por mes" y "Por fecha" con rango libre
de días — y `produccion-data` ya acepta `mesDesde`/`mesHasta` y
`fechaDesde`/`fechaHasta`. No hay que construir nada de eso.

### 2. Backend: una sola fuente

Se elimina `src/app/api/supabase-analytics/route.ts` y su entrada en el
allowlist de `src/middleware.ts`. Sus únicos consumidores son la página de
Productos, que desaparece.

`produccion-data` queda como única fuente de ConectOca y suma al payload:

- `kpi.totalUnidades` — suma de `quantity` de todos los ítems del período.
- `productos` — la lista **completa** (217 productos hoy), no el top 15:
  `{ nombre, categoria, unidades, ingresos }`.
- `productosPorDia` — serie diaria por producto, sólo celdas con datos:
  `{ [nombre]: { [YYYY-MM-DD]: { unidades, ingresos } } }`.

Para lo último hay que arrastrar la fecha del pedido a cada ítem al aplanarlos:
hoy se pierde en el `allItems.push(...nested)` de `produccion-data`, que descarta
el `created_at` del pedido padre.

`Bebidas` sigue excluida, como ya lo hace el endpoint.

**Volumen medido sobre los datos reales (2026-02 a 2026-08):** 19.005 ítems, 217
productos distintos, 179 días con venta, 7.825 pares (producto, día) no vacíos.
La serie diaria completa pesa ~245 KB; acotada a un mes, ~35 KB. Como el endpoint
ya filtra por el período elegido, el caso normal es el de 35 KB.

### 3. La solapa Productos

Ordenada alrededor de la pregunta "cuánto se vendió de X":

- **Buscador como elemento principal** de la pantalla, no un adorno del header.
  Filtra por nombre ignorando mayúsculas y tildes.
- **Ficha del producto**: al elegirlo, el número grande son las unidades y los
  ingresos **de ese producto en el período seleccionado**, más su área y el precio
  unitario promedio. Debajo, un gráfico de evolución que se agrupa **por día en
  modo "Por fecha" y por mes en modo "Por mes"**.
- **KPIs propios de la solapa**, en su propia fila (la de Resumen ya usa 5 y
  sumarle 3 la volvería ilegible):
  - Unidades vendidas — suma de `quantity` del período
  - Ticket promedio — ingresos ÷ pedidos
  - Unidades por pedido — unidades ÷ pedidos
  - Producto más vendido — **por unidades**, no por ingresos, para que sea
    coherente con el orden por defecto de la tabla
- **Tabla completa** de los 217 productos, ordenada por unidades de mayor a menor
  por defecto y reordenable por ingresos, con columna Área, filtro por área y % de
  participación sobre el total de unidades del período.
- **Export a CSV** de la tabla completa y de la ficha de un producto. Sin esto no
  reemplaza al Excel del todo.

Las **áreas de producción se quedan en Resumen**, donde ya están junto a Merma. En
Productos no se repiten: la tabla trae la columna Área y permite filtrar por ella.

### 4. Flujo de datos

```
ConectOca (Supabase)
  orders + order_items + categories + products
        │
        └─ /api/produccion-data  (paginado, ORDER BY created_at, id)
                 │
                 ├─ Resumen   → kpi, ventasPorMes, gastosPorMes, mermasPorMes,
                 │              porArea, porTipoMerma, controlPan, topProveedoresProd
                 └─ Productos → kpi.totalUnidades, productos, productosPorDia
```

Un solo fetch alimenta las dos solapas. Cambiar de solapa no dispara una consulta
nueva.

### 5. Manejo de errores

- Producción ya muestra un bloque de error si el endpoint falla; las dos solapas
  lo comparten.
- Si `productos` viene vacío para el período elegido, la solapa muestra un estado
  vacío explicando que no hay pedidos en ese rango, no una tabla en blanco.
- Si el usuario busca algo que no existe, la ficha muestra "sin ventas de X en
  este período" en vez de cero sin contexto — la diferencia importa: puede ser un
  producto que no se vendió, o un nombre mal escrito.

### 6. Riesgos

- **Meses disponibles.** Hoy cada página tiene su propio `?soloMeses=1`. Al unificar
  manda el de Producción. Ahora que los dos paginan deberían coincidir, pero hay que
  confirmarlo antes de borrar el endpoint viejo.
- **La llamada trae de más.** Producción lee además planillas (gastos, merma,
  Control Pan) que la solapa Productos no necesita. Ya pasa hoy; no lo empeora, pero
  si la carga se vuelve lenta el siguiente paso es partir el endpoint por solapa.
- **Nombres de producto como clave.** `productosPorDia` se indexa por
  `product_name`, igual que el `topProductos` actual. Si un producto se renombra en
  ConectOca, su historial se parte en dos. Es el comportamiento que ya tiene la app;
  cambiarlo a `product_id` es una mejora aparte.

## Criterio de éxito

Escribir "marraqueta" en la solapa Productos con el período del 1 al 20 de agosto
de 2026 lista los tres productos que contienen esa palabra, y el llamado
**"Marraqueta"** muestra **1.384,4 unidades · $2.076.600** — sin haber descargado
ningún archivo.

Ese número está verificado contra ConectOca consultando el mismo rango en hora de
Chile. Dos advertencias sobre cómo medirlo, aprendidas por haberlo hecho mal la
primera vez:

- **No agrupar por coincidencia de texto.** "Marraqueta", "Aliado Marraqueta" y
  "Marraqueta integral" son productos distintos. Un `/marraqueta/i` los suma y da
  1.821,4 u, que no es lo que la ficha debe mostrar.
- **Contar con los mismos límites que usa la app.** Con días UTC el mismo producto
  da 1.405,4 u; la diferencia son los pedidos de la noche del 31 de julio y del 20
  de agosto en Chile. Ver `limitesUtcDelRango` en `src/lib/date-utils.ts`.

Y el dato es vivo: si entran pedidos nuevos, el número sube. Para re-verificar hay
que comparar contra una consulta hecha en el mismo momento, no contra este valor.
