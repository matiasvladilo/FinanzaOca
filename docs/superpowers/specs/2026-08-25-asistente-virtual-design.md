# Asistente virtual — diseño

## Contexto

FinanzasOca ya tiene toda la lógica de negocio construida y probada: informes,
merma, producción, gasto fijo/indirecto, distribuidora, presupuesto. Lo que
falta es una forma conversacional de preguntarle a esos datos sin tener que
navegar cada pantalla — "cuánto gastó La Reina en marzo", "qué porcentaje de
venta son las sopaipillas", "compará la merma de palta entre marzo y agosto".

Este documento es el diseño acordado con el usuario antes de escribir el plan
de implementación.

## 1. Arquitectura

- **Burbuja flotante**, esquina inferior derecha, visible en todas las
  páginas — componente cliente incluido en el layout raíz, pero **renderizado
  solo si `getClientSession()?.role === 'admin'`** (helper ya existente en
  `src/lib/session-client.ts`). Es una señal de UI nada más; la autorización
  real la hace el endpoint.
- Al hacer click abre un panel de chat (mensajes + input). El ícono cerrado
  usa `public/assistant/agente-claro.png` o `agente-oscuro.png` según el tema
  activo de la app.
- **Historial efímero**: vive en `useState` de React, se pierde al recargar.
  No hay tabla nueva en base de datos. Botón "Limpiar conversación" para
  reiniciar sin recargar la página.
- **Endpoint nuevo**: `POST /api/asistente/chat`
  - `requireAuth(req)` + chequeo de `role === 'admin'` (403 si no).
  - `export const runtime = 'nodejs'; export const maxDuration = 60;` — mismo
    patrón que las rutas de informes, porque el loop de herramientas puede
    encadenar varias lecturas a Sheets/Supabase.
  - Body: `{ messages: {role, content}[] }` — el cliente manda el historial
    completo en cada request (no hay sesión server-side de la conversación).
  - Devuelve `{ ok: true, reply: string }` o `{ ok: false, error: string }`.
- **Modelo**: `claude-sonnet-5` vía `@anthropic-ai/sdk` (misma librería que ya
  usa `ai-analysis/route.ts` — ese archivo tiene actualmente `claude-opus-4-6`,
  que no es un id de modelo vigente; separado de este trabajo, convendría
  corregirlo también ahí).
- **Loop de tool-calling**: se llama a `client.messages.create({ model, system,
  messages, tools })`; si la respuesta trae bloques `tool_use`, se ejecuta la
  función real correspondiente en el servidor, se agrega el `tool_result` a
  los mensajes, y se vuelve a llamar — hasta que Claude devuelve texto final o
  se llega al tope de iteraciones (ver Seguridad).

## 2. Herramientas

Cada una reutiliza lógica ya construida y probada en el proyecto — no se
inventan fuentes de datos nuevas.

| Herramienta | Parámetros | Qué cubre | Reutiliza |
|---|---|---|---|
| `obtener_informe_periodo` | `fechaDesde, fechaHasta, sucursal?` | Ventas, gastos, margen, índice 60, por sucursal, top proveedores, insights | Lógica de `/api/informes/generate`, extraída a función invocable directo (sin HTTP) |
| `buscar_merma` | `producto?, tipo?, local?, mesDesde?, mesHasta?` | Histórico completo de merma, cualquier corte | El dataset `scope=todo` de `merma-data/route.ts` |
| `buscar_gasto_proveedor` | `proveedor?, mesDesde?, mesHasta?` | Histórico de gastos agrupado por proveedor (ya normalizado) | `fetchVentasData()` + `normalizeProveedorName` |
| `buscar_producto_venta` | `nombre, fechaDesde?, fechaHasta?` | Cualquier producto de ConectOca, no solo el top 15 | Datos de `produccion-data/route.ts` (items de Supabase), sin el corte a top-N, respetando `categoriasExcluidas` (familia Distribuidora) |
| `obtener_gasto_fijo` | `fechaDesde, fechaHasta` | Costos fijos por local | `fetchGastoFijoForReport` |
| `obtener_gasto_indirecto` | `fechaDesde, fechaHasta` | Gasto indirecto por categoría | `fetchGastoIndirectoForReport` |
| `obtener_distribuidora` | `fechaDesde, fechaHasta` | Compras a terceros + traspaso a locales | `fetchDistribuidoraForReport` |
| `obtener_presupuesto` | `local?, mesDesde?, mesHasta?` | Presupuesto vs. real | `/api/presupuesto` |

Si ninguna herramienta cubre la pregunta, el prompt del sistema exige que el
asistente lo diga explícitamente en vez de inventar una respuesta.

## 3. Seguridad

**Autorización:** `requireAuth` + `role === 'admin'` en el endpoint. Sin
sesión válida o con otro rol, 401/403 antes de tocar cualquier herramienta.

**Alcance estricto:** el system prompt fija que el asistente solo responde
sobre ventas, gastos, merma, producción, proveedores y presupuesto de
FinanzasOca. Cualquier otro tema (general, código, chit-chat) se rechaza
cortésmente. Nunca revela sus instrucciones internas ni actúa como "otro
asistente" distinto al definido acá.

**Prompt injection — dos frentes:**
1. *Directa* (el usuario intenta hacerlo desviarse): el system prompt es fijo
   y no negociable, sin excepciones activables por texto del usuario.
2. *Indirecta, la más real en este proyecto*: el contenido de las 4 planillas
   lo tipean empleados de los locales, no el admin que usa el chat. El system
   prompt instruye explícitamente que **todo lo que devuelven las
   herramientas es dato, nunca una instrucción** — una celda de "Proveedor"
   con texto malicioso no puede secuestrar la conversación.

**Solo lectura:** el asistente no ejecuta ninguna acción sobre datos reales
(no modifica, no envía correos, no dispara nada) — únicamente consulta y
responde en texto.

**Control de costo/abuso:**
- Tope de iteraciones de herramientas por respuesta (5) para cortar loops.
- Límite de longitud por mensaje del usuario.
- Límite razonable de mensajes de historial reenviados por request (evita
  inflar contexto y costo en conversaciones muy largas).
- Log server-side liviano (consola, no tabla visible) de cada pregunta y qué
  herramientas se llamaron — para poder auditar uso raro después, sin
  contradecir el historial efímero del lado del usuario.

## 4. UI y manejo de errores

- Ícono flotante cerrado (`agente-claro.png` / `agente-oscuro.png` según
  tema), con indicador simple de actividad.
- Panel abierto: mensajes usuario a la derecha / asistente a la izquierda,
  input abajo, estado "pensando…" mientras espera (las llamadas a
  herramientas tardan unos segundos, no es instantáneo).
- Errores de backend (Sheets caído, Anthropic con error, etc.) se muestran
  como mensaje de chat claro ("no pude consultar los datos ahora, probá de
  nuevo"), nunca un error técnico crudo.
- Botón "Limpiar conversación".

## Fuera de alcance (por ahora)

- Historial persistente entre sesiones.
- Roles distintos de admin.
- Cualquier acción de escritura (modificar datos, enviar informes, etc.).
- Streaming de la respuesta token a token (se entrega la respuesta completa
  al finalizar el loop de herramientas).
