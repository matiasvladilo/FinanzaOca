# Refresh visual "Apple clean" (piloto Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refrescar la estética visual del Dashboard (y del chrome compartido Header/Sidebar) hacia un look más "Apple clean": bordes hairline en vez de sombra como separador, acentos de color usados con moderación (fondo tinte sutil + texto en color, no fondo sólido saturado), tipografía más liviana.

**Architecture:** Cambios puramente visuales (clases Tailwind + variables CSS en `globals.css`). Cero cambios de lógica, fetch, estado o estructura de datos. Se trabaja sobre la rama `rediseño` (ya creada desde `master`).

**Tech Stack:** Next.js, React, TailwindCSS, variables CSS custom (`src/app/globals.css`) para temas light/dark/dracula.

## Global Constraints

- Rama de trabajo: `rediseño` (no tocar `master`).
- Cero cambios de lógica, fetch, cálculos, estado o comportamiento funcional — solo clases/estilos.
- Los tres temas (light, dark, dracula) deben seguir funcionando correctamente después de cada cambio.
- No se agregan dependencias nuevas ni librerías de componentes.
- Alcance de páginas: solo Dashboard (`/`) + componentes compartidos (`Header`, `Sidebar`, `KPICard`). No tocar otras páginas en este plan.
- `KPICards.tsx` en `src/components/dashboard/` es legado y no se usa desde ningún lugar activo — no se toca.

---

## File Structure

- Modify: `src/app/globals.css` — tokens de sombra, font-family, y overrides de dracula para los nuevos acentos sutiles (purple/emerald) del toolbar de filtros.
- Modify: `src/components/layout/Header.tsx` — peso de título y padding vertical.
- Modify: `src/components/layout/Sidebar.tsx` — logo más chico/sutil, padding/radio de los items de nav.
- Modify: `src/components/kpis/KPICard.tsx` — quitar borde-acento grueso, label normal-case, chip de ícono más chico.
- Modify: `src/app/page.tsx` — toolbar de filtros (botones "Rango días", "Comparar", toggle Meses/Locales, selects de locales A/B, toggle Total/Hasta hoy) pasa de pills sólidas a estilo "segmented control".

No se crean archivos nuevos.

---

### Task 1: Tokens base en `globals.css`

**Files:**
- Modify: `src/app/globals.css:27` (bloque `:root`), `:51` (bloque `.dark`), `:75` (bloque `.dracula`), `:84` (`body`)

**Interfaces:**
- Produces: `--card-shadow` más sutil en los 3 temas (consumida ya por `KPICard` vía `style={{ boxShadow: 'var(--card-shadow)' }}` — Task 4 no necesita cambiar esa línea).
- Produces: `font-family` del `body` priorizando `-apple-system`.

- [ ] **Step 1: Cambiar `--card-shadow` en `:root` (light)**

En `src/app/globals.css` línea 27, reemplazar:
```css
  --card-shadow:    0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.05);
```
por:
```css
  --card-shadow:    0 1px 2px 0 rgba(0,0,0,0.04);
```

- [ ] **Step 2: Cambiar `--card-shadow` en `.dark`**

Línea 51, reemplazar:
```css
  --card-shadow:    0 4px 6px -1px rgba(0,0,0,0.25), 0 2px 4px -2px rgba(0,0,0,0.15);
```
por:
```css
  --card-shadow:    0 1px 3px 0 rgba(0,0,0,0.3);
```

- [ ] **Step 3: Cambiar `--card-shadow` en `.dracula`**

Línea 75, reemplazar:
```css
  --card-shadow:    0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -2px rgba(0,0,0,0.2);
```
por:
```css
  --card-shadow:    0 1px 3px 0 rgba(0,0,0,0.3);
```

- [ ] **Step 4: Priorizar `-apple-system` en el `font-family`**

Línea 84, reemplazar:
```css
  font-family: Inter, system-ui, -apple-system, sans-serif;
```
por:
```css
  font-family: -apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif;
```

- [ ] **Step 5: Agregar overrides de dracula para los acentos sutiles del toolbar (purple/emerald)**

Al final del archivo (después del bloque de overrides de dracula para blue, líneas 146-155), agregar:
```css
/* Dracula: acentos secundarios del toolbar de filtros (Comparar / Total·Hasta hoy) */
.dracula .bg-purple-50      { background-color: rgba(189,147,249,0.18); }
.dracula .text-purple-600   { color: #bd93f9; }
.dracula .hover\:text-purple-600:hover   { color: #bd93f9; }
.dracula .hover\:border-purple-400:hover { border-color: #bd93f9; }

.dracula .bg-emerald-50      { background-color: rgba(80,250,123,0.18); }
.dracula .text-emerald-600   { color: #50fa7b; }
.dracula .hover\:text-emerald-600:hover   { color: #50fa7b; }
.dracula .hover\:border-emerald-400:hover { border-color: #50fa7b; }
```

- [ ] **Step 6: Verificación visual rápida**

No hay efecto visible todavía sin reiniciar el server de dev (los componentes que consumen estos tokens se tocan en los tasks siguientes). Solo confirmar que el archivo compila: correr `npm run build` no es necesario acá; alcanza con que el dev server (si está corriendo) no tire error de CSS. Si no hay dev server corriendo, no hace falta levantarlo todavía — se verifica integrado en el Task 6.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css
git commit -m "style: suaviza sombras de card y prioriza -apple-system en globals.css"
```

---

### Task 2: `Header.tsx`

**Files:**
- Modify: `src/components/layout/Header.tsx:24-29`

**Interfaces:**
- Consumes: ninguna interfaz nueva (mismo componente, mismas props).
- Produces: ningún cambio de API — solo clases.

- [ ] **Step 1: Aplicar los cambios de peso tipográfico y padding**

En `src/components/layout/Header.tsx`, reemplazar:
```tsx
    <header className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b sticky top-0 z-30 transition-colors"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}>

      <h1 className="text-[14px] sm:text-[18px] font-bold tracking-tight shrink-0" style={{ color: 'var(--text)' }}>
        {title}
      </h1>
```
por:
```tsx
    <header className="flex items-center justify-between px-3 sm:px-6 py-4 sm:py-5 border-b sticky top-0 z-30 transition-colors"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}>

      <h1 className="text-[14px] sm:text-[18px] font-semibold tracking-tight shrink-0" style={{ color: 'var(--text)' }}>
        {title}
      </h1>
```

- [ ] **Step 2: Verificación visual**

Levantar el dev server si no está corriendo (`preview_start` con `{"name": "dashboard"}` en este harness, o `npm run dev` en terminal). Navegar a `/`, tomar screenshot, confirmar que el header se ve con más aire y el título un poco menos pesado que antes. No debería haber errores en consola.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "style: header mas liviano y con mas aire vertical"
```

---

### Task 3: `Sidebar.tsx`

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:66-77` (bloque de logo), `:80-98` (nav items)

**Interfaces:**
- Consumes: `var(--active-bg)`, `var(--active-text)` (ya existen en `globals.css`, sin cambios de Task 1).
- Produces: ningún cambio de API.

- [ ] **Step 1: Achicar y suavizar el bloque de logo**

Reemplazar:
```tsx
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
```
por:
```tsx
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--active-bg)' }}>
              <BarChart3 className="w-4 h-4" style={{ color: 'var(--active-text)' }} />
            </div>
```

- [ ] **Step 2: Ajustar padding/radio de los items de nav**

Reemplazar:
```tsx
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150"
```
por:
```tsx
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150"
```

- [ ] **Step 3: Verificación visual**

Con el dev server corriendo, navegar a `/`, tomar screenshot del sidebar (desktop width ≥768px). Confirmar: logo más chico y con fondo azul sutil (no sólido), items de nav con el mismo comportamiento de hover/activo que antes (clickear un item y confirmar que sigue marcando como activo).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "style: sidebar con logo mas discreto y nav mas compacto"
```

---

### Task 4: `KPICard.tsx`

**Files:**
- Modify: `src/components/kpis/KPICard.tsx` (todo el archivo — es chico, 76 líneas)

**Interfaces:**
- Consumes: `var(--card-shadow)` (ya actualizado en Task 1).
- Produces: misma interfaz pública (`KPICardProps`) — `label`, `value`, `sub`, `delta`, `deltaPositive`, `icon`, `accent`. No cambia para los consumidores (`src/app/page.tsx` sigue llamando `<KPICard label=... value=... ... accent="blue" />` sin modificaciones.

- [ ] **Step 1: Eliminar el mapa `ACCENT_BORDER` (ya no se usa)**

Borrar el bloque:
```tsx
const ACCENT_BORDER: Record<string, string> = {
  blue:  'border-l-blue-500',
  red:   'border-l-red-500',
  green: 'border-l-emerald-500',
  gray:  'border-l-gray-400',
};
```

- [ ] **Step 2: Quitar el borde-acento grueso y achicar el chip de ícono**

Reemplazar:
```tsx
    <div className={'bg-white dark:bg-gray-900 rounded-2xl p-4 lg:p-5 flex flex-col gap-3 border-l-[3px] border border-gray-100 dark:border-gray-800 ' + ACCENT_BORDER[accent]}
      style={{ boxShadow: 'var(--card-shadow)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">
          {label}
        </span>
        <div className={'w-8 h-8 rounded-xl flex items-center justify-center ' + ACCENT_BG[accent]}>
          <span className={ACCENT_ICON[accent]}>{icon}</span>
        </div>
      </div>
```
por:
```tsx
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 lg:p-5 flex flex-col gap-3 border border-gray-100 dark:border-gray-800"
      style={{ boxShadow: 'var(--card-shadow)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
          {label}
        </span>
        <div className={'w-7 h-7 rounded-lg flex items-center justify-center ' + ACCENT_BG[accent]}>
          <span className={ACCENT_ICON[accent]}>{icon}</span>
        </div>
      </div>
```

- [ ] **Step 3: Verificación visual**

Con el dev server corriendo, navegar a `/`, esperar a que carguen las 4 KPI cards. Confirmar: sin franja de color a la izquierda, label en minúscula/mixta (no todo mayúsculas), chip de ícono más chico. Confirmar en dark y dracula que los colores siguen siendo legibles (toggle de tema en el Header).

- [ ] **Step 4: Commit**

```bash
git add src/components/kpis/KPICard.tsx
git commit -m "style: KPICard sin borde-acento grueso, label mas liviano"
```

---

### Task 5: Toolbar de filtros en `page.tsx`

**Files:**
- Modify: `src/app/page.tsx:620-763` (toolbar de filtros del Dashboard)

**Interfaces:**
- Consumes: `.dracula .bg-purple-50`, `.dracula .text-purple-600`, `.dracula .bg-emerald-50`, `.dracula .text-emerald-600` y sus variantes `hover:` (agregadas en Task 1, Step 5). Clases Tailwind nativas `dark:bg-{color}-950 dark:text-{color}-400` para el tema dark (sin overrides adicionales necesarios).
- Produces: ningún cambio de estado/handlers — mismos `onClick`, mismas variables de estado (`modoFiltro`, `compOn`, `compareType`, `modoGastos`, etc.), solo cambian las clases de presentación.

- [ ] **Step 1: Botón "Rango días" (líneas ~620-637)**

Reemplazar:
```tsx
            <button
              onClick={() => setDateOpen(o => !o)}
              className={clsx(
                'flex items-center gap-1.5 border rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all',
                modoFiltro === 'dia'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600',
              )}
            >
```
por:
```tsx
            <button
              onClick={() => setDateOpen(o => !o)}
              className={clsx(
                'flex items-center gap-1.5 border rounded-lg px-3.5 py-2 text-[12px] font-medium transition-all',
                modoFiltro === 'dia'
                  ? 'bg-blue-50 dark:bg-blue-950 border-transparent text-blue-600 dark:text-blue-400'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600',
              )}
            >
```

- [ ] **Step 2: Botón "Comparar" (líneas ~693-702)**

Reemplazar:
```tsx
            className={clsx(
              'flex items-center gap-1.5 border rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all',
              compOn
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-purple-400 hover:text-purple-600',
            )}
```
por:
```tsx
            className={clsx(
              'flex items-center gap-1.5 border rounded-lg px-3.5 py-2 text-[12px] font-medium transition-all',
              compOn
                ? 'bg-purple-50 dark:bg-purple-950 border-transparent text-purple-600 dark:text-purple-400'
                : 'bg-white border-gray-200 text-gray-600 hover:border-purple-400 hover:text-purple-600',
            )}
```

- [ ] **Step 3: Toggle Meses/Locales (líneas ~708-718)**

Reemplazar:
```tsx
              <div className="flex items-center rounded-xl overflow-hidden border border-gray-200">
                {(['mes', 'local'] as const).map(t => (
                  <button key={t} onClick={() => setCompareType(t)}
                    className={clsx(
                      'px-3 py-2 text-[11px] font-semibold transition-all',
                      compareType === t ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
                    )}>
                    {t === 'mes' ? 'Meses' : 'Locales'}
                  </button>
                ))}
              </div>
```
por:
```tsx
              <div className="flex items-center rounded-lg overflow-hidden border border-gray-200">
                {(['mes', 'local'] as const).map(t => (
                  <button key={t} onClick={() => setCompareType(t)}
                    className={clsx(
                      'px-3 py-2 text-[11px] font-semibold transition-all',
                      compareType === t
                        ? 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400'
                        : 'bg-white text-gray-500 hover:bg-gray-50',
                    )}>
                    {t === 'mes' ? 'Meses' : 'Locales'}
                  </button>
                ))}
              </div>
```

- [ ] **Step 4: Selects de locales A/B (líneas ~730-742)**

Reemplazar:
```tsx
                  <select value={localA} onChange={e => setLocalA(e.target.value)}
                    className="border border-blue-300 bg-blue-50 rounded-xl px-3 py-2 text-[12px] font-semibold text-blue-700 outline-none">
                    {sucursalesDisponibles.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className="text-gray-400 text-[11px] font-bold">vs</span>
                  <select value={localB} onChange={e => setLocalB(e.target.value)}
                    className="border border-purple-300 bg-purple-50 rounded-xl px-3 py-2 text-[12px] font-semibold text-purple-700 outline-none">
                    {sucursalesDisponibles.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
```
por:
```tsx
                  <select value={localA} onChange={e => setLocalA(e.target.value)}
                    className="border border-transparent bg-blue-50 dark:bg-blue-950 rounded-lg px-3 py-2 text-[12px] font-medium text-blue-600 dark:text-blue-400 outline-none">
                    {sucursalesDisponibles.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className="text-gray-400 text-[11px] font-bold">vs</span>
                  <select value={localB} onChange={e => setLocalB(e.target.value)}
                    className="border border-transparent bg-purple-50 dark:bg-purple-950 rounded-lg px-3 py-2 text-[12px] font-medium text-purple-600 dark:text-purple-400 outline-none">
                    {sucursalesDisponibles.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
```

- [ ] **Step 5: Toggle Total/Hasta hoy (líneas ~751-763)**

Reemplazar:
```tsx
            <button
              onClick={() => setModoGastos(m => m === 'total' ? 'hastaHoy' : 'total')}
              className={clsx(
                'flex items-center gap-1 border rounded-xl px-3 py-2 text-[11px] font-semibold transition-all',
                modoGastos === 'total'
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-600',
              )}
            >
```
por:
```tsx
            <button
              onClick={() => setModoGastos(m => m === 'total' ? 'hastaHoy' : 'total')}
              className={clsx(
                'flex items-center gap-1 border rounded-lg px-3 py-2 text-[11px] font-semibold transition-all',
                modoGastos === 'total'
                  ? 'bg-emerald-50 dark:bg-emerald-950 border-transparent text-emerald-600 dark:text-emerald-400'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-600',
              )}
            >
```

- [ ] **Step 6: Verificación visual + funcional**

Con el dev server corriendo, navegar a `/`:
- Clickear "Rango días": confirmar que abre el date picker y el botón pasa a fondo azul sutil (no sólido). Clickear "Aplicar": confirmar que sigue funcionando igual que antes (el botón "Aplicar" dentro del panel se deja sin cambios, sigue sólido).
- Clickear "Comparar": confirmar que aparece el panel de comparación y el botón pasa a fondo morado sutil. Probar el toggle "Meses"/"Locales" y los selects A/B.
- Si hay un mes en curso filtrado, confirmar que el toggle "Total/Hasta hoy" sigue alternando y el botón activo se ve en verde sutil.
- Repetir el chequeo visual en dark y dracula (toggle de tema en el Header).

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "style: toolbar de filtros del Dashboard pasa a estilo segmented control"
```

---

### Task 6: Verificación final integrada

**Files:** ninguno (solo verificación, sin cambios de código).

- [ ] **Step 1: Chequeo visual completo en los 3 temas**

Con el dev server corriendo, navegar a `/` y para cada tema (light, dark, dracula vía el botón de toggle del Header):
- Tomar un screenshot de la página completa (Header + Sidebar + toolbar + KPI cards + gráfico + resumen).
- Confirmar que no hay texto illegible (bajo contraste) ni elementos que se vean "rotos" (bordes faltantes, colores que no cambian con el tema).
- Confirmar en `read_console_messages` que no hay errores nuevos en consola.

- [ ] **Step 2: Chequeo funcional rápido**

Confirmar que lo que ya funcionaba sigue funcionando sin errores: cambiar el período, aplicar un rango de días, activar/desactivar "Comparar", cambiar de sucursal en el filtro, cerrar sesión desde el Sidebar (sin completar el logout si no es necesario, solo confirmar que el botón sigue ahí y clickeable).

- [ ] **Step 3: Confirmar estado de la rama**

```bash
git log --oneline master..rediseño
git status
```
Confirmar que todos los commits de los Tasks 1-5 están en la rama `rediseño` y que no quedan cambios sin commitear relacionados a este refresh.
