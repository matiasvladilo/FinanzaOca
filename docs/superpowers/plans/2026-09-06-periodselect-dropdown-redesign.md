# PeriodSelect Dropdown Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el panel desplegable de `PeriodSelect` para que respete el tema (claro/oscuro/dracula) en vez de usar colores hardcodeados, agregarle pulido visual, y usar un acento violeta en el selector "vs" del modo comparación en 4 páginas.

**Architecture:** Todo el cambio vive en un componente compartido (`src/components/ui/PeriodSelect.tsx`) más 4 call-sites de una sola línea cada uno (agregar el prop `accentColor="violet"`). No hay lógica nueva de estado ni de datos — es un cambio de estilos con un mapa de tokens de color por variante.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS v4 (`@variant dark`), variables CSS del tema en `src/app/globals.css`, `clsx`, `lucide-react` (íconos `ChevronDown`, `Check`).

## Global Constraints

- El componente debe seguir funcionando igual en los usos que NO pasan `accentColor` (comportamiento y color azul actuales, sin regresión visual).
- Los colores del panel deben leerse desde las variables CSS del tema (`var(--card)`, `var(--border-2)`, `var(--hover)`, `var(--text-2)`, `var(--text-3)`, `var(--card-shadow)`) — nunca clases Tailwind de gris/blanco hardcodeadas para el panel.
- No tocar `ComparisonPanel.tsx` ni los `<select>` nativos de locales — fuera de alcance según el spec.
- No cambiar la lógica de apertura/cierre, click-afuera, ni las props existentes (`value`, `options`, `onChange`, `label`, `allLabel`, `size`, `dark`).

---

## Mapa de archivos

- **Modificar:** `src/components/ui/PeriodSelect.tsx` — agrega `accentColor`, mapa `ACCENT`, restylea el panel desplegable.
- **Modificar:** `src/app/page.tsx` (línea ~630, `PeriodSelect` del modo comparación) — agrega `accentColor="violet"`.
- **Modificar:** `src/app/ventas/page.tsx` (línea ~1242, `PeriodSelect` del modo comparación) — agrega `accentColor="violet"`.
- **Modificar:** `src/app/merma/page.tsx` (línea ~546, `PeriodSelect` del modo comparación) — agrega `accentColor="violet"`.
- **Modificar:** `src/app/factor-indice/page.tsx` (línea ~436, `PeriodSelect` del modo comparación) — agrega `accentColor="violet"`.

No hay archivos de test dedicados a este componente hoy (`grep -r PeriodSelect src/**/*.test.tsx` no devuelve nada) y el spec marca explícitamente que no amerita test unitario nuevo — la verificación es visual en el preview del navegador.

---

### Task 1: Restylear `PeriodSelect` — mapa de acento + panel theming + pulido visual

**Files:**
- Modify: `src/components/ui/PeriodSelect.tsx`

**Interfaces:**
- Consumes: nada de tareas anteriores (es la primera tarea).
- Produces: `PeriodSelectProps.accentColor?: 'blue' | 'violet'` (default `'blue'`). Las 4 tareas siguientes pasan este prop a sus respectivos `<PeriodSelect>`.

- [ ] **Step 1: Leer el archivo actual completo para tener el contexto exacto de líneas antes de editar**

Ya se leyó en esta conversación; el contenido actual es:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

export interface PeriodOption {
  label: string;
  value: string;
}

interface PeriodSelectProps {
  value: string;
  options: PeriodOption[];
  onChange: (value: string) => void;
  label?: string;
  /** Texto a mostrar cuando ningún valor está seleccionado (value === '') */
  allLabel?: string;
  /** 'sm' para barra de filtros oscura en mobile */
  size?: 'sm' | 'md';
  /** Variante oscura para fondo oscuro */
  dark?: boolean;
}

export function PeriodSelect({
  value,
  options,
  onChange,
  label,
  allLabel = 'Todos',
  size = 'md',
  dark = false,
}: PeriodSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? allLabel;
  const isFiltered = value !== '';

  return (
    <div className="relative" ref={ref}>
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        suppressHydrationWarning
        className={clsx(
          'flex items-center gap-1 border rounded-xl font-medium transition-all select-none',
          size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-[12px]',
          isFiltered
            ? 'bg-blue-600 border-blue-600 text-white'
            : dark
              ? 'bg-slate-700 border-slate-600 text-slate-200 hover:border-blue-400 hover:text-blue-400'
              : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600',
        )}
      >
        {label && (
          <span suppressHydrationWarning className={clsx('text-[10px] font-bold uppercase tracking-widest', isFiltered ? 'opacity-80' : 'opacity-60')}>
            {label}
          </span>
        )}
        <span className="font-semibold">{displayLabel}</span>
        <ChevronDown
          suppressHydrationWarning
          className={clsx('w-3.5 h-3.5 transition-transform', open && 'rotate-180', isFiltered ? 'opacity-80' : 'opacity-50')}
        />
      </button>

      {/* ── Dropdown list ─────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 min-w-[180px] py-1">
          {/* Opción "Todos" siempre al inicio */}
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={clsx(
              'w-full text-left px-4 py-2.5 text-[12px] transition-colors flex items-center justify-between gap-3',
              value === '' ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-500 hover:bg-gray-50',
            )}
          >
            {allLabel}
            {value === '' && <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
          </button>

          {options.filter(o => o.value !== '').map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={clsx(
                'w-full text-left px-4 py-2.5 text-[12px] transition-colors flex items-center justify-between gap-3',
                value === opt.value ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              {opt.label}
              {value === opt.value && <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar el archivo completo con la versión rediseñada**

Reemplazar todo el contenido de `src/components/ui/PeriodSelect.tsx` por:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

export interface PeriodOption {
  label: string;
  value: string;
}

type AccentColor = 'blue' | 'violet';

/** Tokens de color por variante de acento. rgb se usa para el tinte
 *  translúcido de selección (funciona igual en claro/oscuro/dracula
 *  porque no depende de un fondo pastel fijo). */
const ACCENT: Record<AccentColor, {
  triggerActive: string;
  hoverBorder: string;
  hoverText: string;
  solidText: string;
  rgb: string;
}> = {
  blue: {
    triggerActive: 'bg-blue-600 border-blue-600 text-white',
    hoverBorder: 'hover:border-blue-400',
    hoverText: 'hover:text-blue-600',
    solidText: 'text-blue-600',
    rgb: '37, 99, 235', // blue-600
  },
  violet: {
    triggerActive: 'bg-violet-600 border-violet-600 text-white',
    hoverBorder: 'hover:border-violet-400',
    hoverText: 'hover:text-violet-600',
    solidText: 'text-violet-600',
    rgb: '124, 58, 237', // violet-600
  },
};

interface PeriodSelectProps {
  value: string;
  options: PeriodOption[];
  onChange: (value: string) => void;
  label?: string;
  /** Texto a mostrar cuando ningún valor está seleccionado (value === '') */
  allLabel?: string;
  /** 'sm' para barra de filtros oscura en mobile */
  size?: 'sm' | 'md';
  /** Variante oscura para fondo oscuro */
  dark?: boolean;
  /** Color de acento del trigger y del dropdown. Default: 'blue'. */
  accentColor?: AccentColor;
}

export function PeriodSelect({
  value,
  options,
  onChange,
  label,
  allLabel = 'Todos',
  size = 'md',
  dark = false,
  accentColor = 'blue',
}: PeriodSelectProps) {
  const [open, setOpen] = useState(false);
  // Controla la animación de entrada: el panel se monta con opacidad 0 /
  // levemente desplazado, y en el siguiente frame anima a su estado final.
  const [entered, setEntered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const accent = ACCENT[accentColor];

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  // Dispara el frame de "entrada" apenas se monta el panel.
  useEffect(() => {
    if (!open) { setEntered(false); return; }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? allLabel;
  const isFiltered = value !== '';

  return (
    <div className="relative" ref={ref}>
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        suppressHydrationWarning
        className={clsx(
          'flex items-center gap-1 border rounded-xl font-medium transition-all select-none',
          size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-[12px]',
          isFiltered
            ? accent.triggerActive
            : dark
              ? clsx('bg-slate-700 border-slate-600 text-slate-200', accent.hoverBorder, accent.hoverText)
              : clsx('bg-white border-gray-200 text-gray-600', accent.hoverBorder, accent.hoverText),
        )}
      >
        {label && (
          <span suppressHydrationWarning className={clsx('text-[10px] font-bold uppercase tracking-widest', isFiltered ? 'opacity-80' : 'opacity-60')}>
            {label}
          </span>
        )}
        <span className="font-semibold">{displayLabel}</span>
        <ChevronDown
          suppressHydrationWarning
          className={clsx('w-3.5 h-3.5 transition-transform', open && 'rotate-180', isFiltered ? 'opacity-80' : 'opacity-50')}
        />
      </button>

      {/* ── Dropdown list ─────────────────────────────────────────────────── */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 rounded-xl shadow-lg overflow-hidden z-50 min-w-[180px] py-1 transition-all duration-150 ease-out"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border-2)',
            boxShadow: 'var(--card-shadow), 0 8px 24px -8px rgba(0,0,0,0.18)',
            opacity: entered ? 1 : 0,
            transform: entered ? 'translateY(0)' : 'translateY(-4px)',
          }}
        >
          {/* Opción "Todos" siempre al inicio */}
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={clsx(
              'w-full text-left px-4 py-2.5 text-[12px] transition-colors flex items-center justify-between gap-3',
              value === '' ? clsx('font-semibold', accent.solidText) : '',
            )}
            style={value === ''
              ? { background: `rgba(${accent.rgb}, 0.12)` }
              : { color: 'var(--text-2)' }}
            onMouseEnter={e => { if (value !== '') e.currentTarget.style.background = 'var(--hover)'; }}
            onMouseLeave={e => { if (value !== '') e.currentTarget.style.background = 'transparent'; }}
          >
            {allLabel}
            {value === '' && <Check className={clsx('w-3.5 h-3.5 flex-shrink-0', accent.solidText)} />}
          </button>

          {options.filter(o => o.value !== '').map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={clsx(
                'w-full text-left px-4 py-2.5 text-[12px] transition-colors flex items-center justify-between gap-3',
                value === opt.value ? clsx('font-semibold', accent.solidText) : '',
              )}
              style={value === opt.value
                ? { background: `rgba(${accent.rgb}, 0.12)` }
                : { color: 'var(--text)' }}
              onMouseEnter={e => { if (value !== opt.value) e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
              {value === opt.value && <Check className={clsx('w-3.5 h-3.5 flex-shrink-0', accent.solidText)} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Notas de la implementación:
- El hover se maneja con `onMouseEnter`/`onMouseLeave` en vez de `hover:` de Tailwind porque el color de fondo depende de una variable CSS (`var(--hover)`), no de una clase estática — Tailwind no genera `hover:bg-[var(--hover)]` de forma fiable junto con el estilo inline condicional que ya se necesita para el estado seleccionado. Es el mismo patrón (`style` inline) que ya usa `ComparisonPanel.tsx` en este mismo proyecto.
- El texto de los ítems no seleccionados usa `var(--text-2)` (opción "Todos") y `var(--text)` (resto de opciones) para replicar la jerarquía visual que ya tenían (`text-gray-500` vs `text-gray-700`).

- [ ] **Step 3: Chequear tipos y lint**

Run: `cd /Users/matiasvladilo/Desktop/MASTER/FinanzaOca && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `PeriodSelect.tsx`.

Run: `npm run lint -- --file src/components/ui/PeriodSelect.tsx` (o `npx eslint src/components/ui/PeriodSelect.tsx` si el script no soporta `--file`)
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
cd /Users/matiasvladilo/Desktop/MASTER/FinanzaOca
git add src/components/ui/PeriodSelect.tsx
git commit -m "PeriodSelect: theming del dropdown + accentColor

El panel desplegable usaba colores Tailwind hardcodeados (bg-white,
text-gray-*, bg-blue-50 en el ítem seleccionado) sin equivalente en modo
oscuro/dracula. Ahora lee las variables CSS del tema (--card, --border-2,
--hover, --text, --text-2, --card-shadow) y agrega selección con tinte
translúcido, sombra y animación de entrada. Nuevo prop opcional
accentColor ('blue' | 'violet', default 'blue') para variantes de color.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Usar acento violeta en el selector "vs" del Dashboard

**Files:**
- Modify: `src/app/page.tsx:630-636`

**Interfaces:**
- Consumes: `PeriodSelectProps.accentColor` producido en Task 1.
- Produces: nada (call-site hoja, no lo consume ninguna tarea posterior).

- [ ] **Step 1: Ubicar el `PeriodSelect` del modo comparación**

Es este bloque (dentro de `{compareType === 'mes' ? (...) : (...)}`):

```tsx
              {compareType === 'mes' ? (
                <PeriodSelect
                  label="vs"
                  value={mesComp}
                  options={(ccData?.mesesDisponibles ?? []).slice().sort().map(key => ({ label: mesLabel(key), value: key }))}
                  onChange={setMesComp}
                  allLabel="Seleccionar mes"
                />
              ) : (
```

- [ ] **Step 2: Agregar `accentColor="violet"`**

```tsx
              {compareType === 'mes' ? (
                <PeriodSelect
                  label="vs"
                  value={mesComp}
                  options={(ccData?.mesesDisponibles ?? []).slice().sort().map(key => ({ label: mesLabel(key), value: key }))}
                  onChange={setMesComp}
                  allLabel="Seleccionar mes"
                  accentColor="violet"
                />
              ) : (
```

- [ ] **Step 3: Verificar que no hay otro `PeriodSelect` en el archivo afectado por error**

Run: `grep -n "PeriodSelect" src/app/page.tsx`
Expected: dos matches de uso (línea ~519, el filtro de período normal — sin `accentColor`, sigue azul; línea ~630, el de comparación — ahora con `accentColor="violet"`).

- [ ] **Step 4: Commit**

```bash
cd /Users/matiasvladilo/Desktop/MASTER/FinanzaOca
git add src/app/page.tsx
git commit -m "Dashboard: selector 'vs' de comparación en violeta

Conecta visualmente con el lado B (violeta) de la tarjeta de comparación
que aparece debajo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Usar acento violeta en el selector "vs" de Ventas

**Files:**
- Modify: `src/app/ventas/page.tsx:1242` (aprox.)

**Interfaces:**
- Consumes: `PeriodSelectProps.accentColor` producido en Task 1.
- Produces: nada.

- [ ] **Step 1: Ubicar el `PeriodSelect` del modo comparación**

Run: `grep -n "PeriodSelect" src/app/ventas/page.tsx` para confirmar la línea exacta en el estado actual del archivo (puede haber corrido +/- unas líneas desde que se escribió este plan).

- [ ] **Step 2: Agregar `accentColor="violet"` al `PeriodSelect` que está dentro de la sección "Comparar por período"**

Esa sección arranca en el comentario `{/* Comparar por período (solo cuando no hay comparación de locales) */}` (línea ~1317). Dentro de ese bloque, agregar `accentColor="violet"` como prop del `<PeriodSelect>` correspondiente, igual que en la Task 2.

- [ ] **Step 3: Verificar con grep que sigue habiendo un único `PeriodSelect` en ese bloque de comparación**

Run: `sed -n '1310,1350p' src/app/ventas/page.tsx`
Expected: el `<PeriodSelect ... accentColor="violet" />` visible dentro del bloque de comparación por período.

- [ ] **Step 4: Commit**

```bash
cd /Users/matiasvladilo/Desktop/MASTER/FinanzaOca
git add src/app/ventas/page.tsx
git commit -m "Ventas: selector 'vs' de comparación en violeta

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Usar acento violeta en el selector "vs" de Merma

**Files:**
- Modify: `src/app/merma/page.tsx:546` (aprox.)

**Interfaces:**
- Consumes: `PeriodSelectProps.accentColor` producido en Task 1.
- Produces: nada.

- [ ] **Step 1: Ubicar el `PeriodSelect` del modo comparación**

Run: `grep -n "PeriodSelect" src/app/merma/page.tsx`
Expected: dos matches — uno para el filtro de período normal (línea ~532, sin cambio) y uno para el selector de mes de comparación (línea ~546, dentro del bloque que empieza en el comentario `{/* Selector de mes de comparación */}`, línea ~633).

- [ ] **Step 2: Agregar `accentColor="violet"` al segundo `PeriodSelect`**

- [ ] **Step 3: Confirmar con grep/sed que el primer `PeriodSelect` (filtro normal) no recibió el prop por error**

Run: `sed -n '525,560p' src/app/merma/page.tsx`
Expected: el `PeriodSelect` del filtro normal sin `accentColor`; el de comparación con `accentColor="violet"`.

- [ ] **Step 4: Commit**

```bash
cd /Users/matiasvladilo/Desktop/MASTER/FinanzaOca
git add src/app/merma/page.tsx
git commit -m "Merma: selector 'vs' de comparación en violeta

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Usar acento violeta en el selector "vs" de Factor-índice

**Files:**
- Modify: `src/app/factor-indice/page.tsx:436` (aprox.)

**Interfaces:**
- Consumes: `PeriodSelectProps.accentColor` producido en Task 1.
- Produces: nada.

- [ ] **Step 1: Ubicar los dos `PeriodSelect` del archivo**

Run: `grep -n "PeriodSelect" src/app/factor-indice/page.tsx`
Expected: línea ~397 (selector de mes principal — sin cambio) y línea ~436 (selector "vs" de comparación, dentro del bloque cuyo botón dice `Comparar`, línea ~431).

- [ ] **Step 2: Agregar `accentColor="violet"` al `PeriodSelect` de la línea ~436**

- [ ] **Step 3: Confirmar con sed que el cambio quedó en el selector correcto**

Run: `sed -n '425,445p' src/app/factor-indice/page.tsx`
Expected: el `PeriodSelect` de comparación con `accentColor="violet"`; el de la línea ~397 sin tocar.

- [ ] **Step 4: Commit**

```bash
cd /Users/matiasvladilo/Desktop/MASTER/FinanzaOca
git add src/app/factor-indice/page.tsx
git commit -m "Factor-índice: selector 'vs' de comparación en violeta

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Verificación visual manual en el preview

**Files:** ninguno (solo verificación, sin cambios de código).

**Interfaces:**
- Consumes: el componente y los 4 call-sites de las tareas anteriores.
- Produces: confirmación de que el rediseño se ve bien antes de dar el trabajo por terminado.

- [ ] **Step 1: Levantar el preview**

Usar la herramienta de preview del navegador con la configuración `dashboard` de `.claude/launch.json` (`npm run dev`).

- [ ] **Step 2: Iniciar sesión con las credenciales que provea el usuario**

Si la app pide login y no hay sesión guardada, pedirle al usuario que inicie sesión él mismo en el navegador (no ingresar credenciales en su nombre) o que indique una ruta pública para probar.

- [ ] **Step 3: Dashboard — modo claro**

Ir a `/`, activar "Comparar" → "Meses", abrir el dropdown "vs" (`PeriodSelect`), y confirmar visualmente:
- El panel usa fondo blanco de tarjeta (no un blanco distinto/roto) y borde sutil gris claro.
- El mes actualmente elegido se ve resaltado con un tinte violeta claro y texto violeta, con el ícono de check también violeta.
- Al pasar el mouse por las demás opciones, aparece un fondo gris clarito de hover.
- Al abrir, el panel entra con una transición suave (no aparece de golpe).

- [ ] **Step 4: Dashboard — modo oscuro**

Cambiar el tema a oscuro (selector de tema de la app, o agregando la clase `.dark` al `<html>` si no hay toggle visible) y repetir el Step 3. Confirmar que:
- El panel usa el fondo oscuro de tarjeta (`--card` oscuro), no blanco.
- El tinte de selección violeta se sigue viendo bien (no se pierde contra el fondo oscuro).
- El texto de las opciones no seleccionadas es legible (gris claro sobre fondo oscuro, no gris oscuro invisible).

- [ ] **Step 5: Repetir el chequeo rápido (solo modo claro, ya que el theming se prueba una vez a fondo en el Dashboard) en Ventas, Merma y Factor-índice**

Activar "Comparar" en cada página y abrir el dropdown "vs" correspondiente. Confirmar que el acento violeta y el theming se ven igual de bien que en el Dashboard.

- [ ] **Step 6: Confirmar que los usos SIN `accentColor` siguen en azul, sin regresión**

En cualquiera de las páginas, abrir el filtro de período normal (el que no es de comparación) y confirmar que sigue viéndose azul, igual que antes del cambio.

- [ ] **Step 7: Screenshot final**

Tomar una captura del dropdown abierto en modo comparación (Dashboard, modo oscuro) para dejar evidencia visual del resultado.

---

## Self-Review

**Cobertura del spec:**
- §1 "Nuevo prop `accentColor`" → Task 1.
- §2 "Trigger" (generalizar color activo) → Task 1, Step 2.
- §3 "Panel desplegable — theming" → Task 1, Step 2 (tabla de reemplazos aplicada íntegra).
- §4 "Panel desplegable — pulido visual" (tinte translúcido, sombra, animación, check de color) → Task 1, Step 2.
- §5 "Uso en los 4 selectores 'vs'" → Tasks 2-5.
- "Testing" (verificación visual manual claro/oscuro en las 4 páginas) → Task 6.
- "Fuera de alcance" (`ComparisonPanel`, `<select>` nativos de locales, comportamiento/lógica) → no se tocan en ninguna tarea, confirmado.

**Placeholders:** ninguno — todos los steps de código traen el snippet completo o el comando exacto a correr.

**Consistencia de tipos:** `accentColor?: AccentColor` (`'blue' | 'violet'`) se define una sola vez en Task 1 y se consume igual (`accentColor="violet"`) en Tasks 2-5; no hay variantes de nombre.
