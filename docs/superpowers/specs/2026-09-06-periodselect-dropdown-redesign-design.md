# Rediseño del menú desplegable de `PeriodSelect` — diseño

## Contexto

El usuario pidió rediseñar "el área de comparación": al activar el toggle
"Comparar" (Dashboard, Ventas, Merma, Factor-índice) y hacer clic en el
selector de período (ej. "VS Agosto 2026"), se abre un menú lateral chico
con colores poco atractivos.

Ese selector es el componente compartido
[`PeriodSelect`](../../../src/components/ui/PeriodSelect.tsx), usado tanto
para el filtro de período normal (mes actual) como para el "vs" del modo
comparación, en 4 páginas + `ExploradorMerma`.

El botón disparador (`trigger`) ya sigue el tema de la app (clases
Tailwind con overrides `.dark`/`.dracula` en `globals.css`). El problema
está en el panel desplegable (líneas 79-108 del componente): usa colores
Tailwind hardcodeados sin equivalente oscuro —
`bg-white`, `border-gray-200`, `text-gray-500/700`, y el ítem seleccionado
en `bg-blue-50 text-blue-600` (celeste pastel). En modo oscuro/dracula no
hay ninguna regla en `globals.css` que remapee `bg-blue-50` ni
`text-blue-600`, así que ese ítem queda como un recuadro celeste clarito
flotando sobre fondo oscuro — de ahí la sensación de "poco atractivo".

## Alcance

- Rediseñar únicamente el **panel desplegable** de `PeriodSelect` (la
  lista que aparece al hacer clic), theming + pulido visual.
- Agregar un prop opcional `accentColor` a `PeriodSelect` para pintar
  trigger + dropdown con un color distinto al azul por defecto.
- Usar `accentColor="violet"` en el selector "vs" del modo comparación en
  las 4 páginas que lo tienen (Dashboard, Ventas, Merma, Factor-índice),
  para conectarlo visualmente con el lado B (violeta) de la tarjeta
  `ComparisonPanel` que aparece debajo.
- El resto de los usos de `PeriodSelect` (filtro de período normal, los 4
  selects de `ExploradorMerma`) no pasan `accentColor` y siguen en azul
  (comportamiento actual, sin cambio visual de color, solo de theming).

**Fuera de alcance:**
- `ComparisonPanel` (la tarjeta de resultados con las barras) — el
  usuario confirmó que esa parte no es la que quiere cambiar.
- Los `<select>` nativos usados para elegir locales en modo comparación
  (`page.tsx` líneas 639-651, `ventas/page.tsx` línea 1339,
  `merma/page.tsx` línea 635) — son `<select>` HTML nativos; el
  navegador controla el estilo de su lista desplegable y no se puede
  restylear de forma consistente entre navegadores/SO. Quedan igual.
- Comportamiento/lógica de selección, teclado, cierre al hacer click
  afuera, etc. — no cambia, solo estilos.

## Diseño

### 1. Nuevo prop `accentColor`

```ts
interface PeriodSelectProps {
  // ...existing props
  /** Color de acento del trigger y del dropdown. Default: 'blue'. */
  accentColor?: 'blue' | 'violet';
}
```

Un mapa interno `ACCENT[accentColor]` centraliza los tokens de color por
variante (texto/fondo del trigger activo, tinte de selección en el
dropdown, color del check). Mantiene el default `'blue'` para no romper
ningún uso existente que no pase el prop.

### 2. Trigger

Sin cambios de layout. Solo generaliza el color "activo" (hoy
`bg-blue-600 border-blue-600`) para leer del mapa `ACCENT` según
`accentColor`, en vez de tener `blue` hardcodeado.

### 3. Panel desplegable — theming

Reemplazar clases hardcodeadas por variables del tema, igual que el resto
de tarjetas de la app:

| Antes (hardcodeado)              | Después                                  |
|-----------------------------------|-------------------------------------------|
| `bg-white`                        | `background: var(--card)`                 |
| `border-gray-200`                 | `border-color: var(--border-2)`           |
| `shadow-xl`                       | `box-shadow: var(--card-shadow)` + `shadow-lg` |
| `text-gray-500` / `text-gray-700` | `color: var(--text-2)` (no seleccionado)  |
| `hover:bg-gray-50`                | `background: var(--hover)` on hover       |
| `bg-blue-50 text-blue-600` (seleccionado) | tinte translúcido del acento (ver abajo) |

### 4. Panel desplegable — pulido visual

- **Selección con tinte translúcido**: en vez de un fondo pastel plano,
  usar `background: rgba(<accent-rgb>, 0.12)` y texto en el color sólido
  del acento (`text-blue-600` / `text-violet-600` según variante) — se ve
  bien tanto en tema claro como oscuro porque no depende de un fondo claro
  fijo.
- **Sombra más premium**: `shadow-lg` en vez de `shadow-xl` plano, ya que
  `--card-shadow` ya está calibrada distinto para claro/oscuro/dracula.
- **Animación de entrada**: fade + slide de 4px al abrir (CSS
  `transition` + estado montado, ~120ms), para que no aparezca de golpe.
- **Check de color coherente**: el ícono `Check` del ítem seleccionado usa
  el color sólido del acento en vez de `text-blue-500` fijo.

### 5. Uso en los 4 selectores "vs"

En `page.tsx`, `ventas/page.tsx`, `merma/page.tsx` y
`factor-indice/page.tsx`, el `<PeriodSelect>` que arma el "vs" del modo
comparación agrega `accentColor="violet"`. El resto de los usos
(`ExploradorMerma`, filtro de período normal) no se tocan más que por el
fix de theming que ya reciben todos por ser el mismo componente.

## Testing

- Verificación visual manual en el preview (modo claro y oscuro) del
  Dashboard: abrir "Comparar" → "Meses" → abrir el dropdown "vs" y
  confirmar que el panel respeta el tema y el ítem seleccionado se ve
  bien en violeta.
- Repetir el chequeo visual rápido en Ventas, Merma y Factor-índice.
- No hay lógica nueva que amerite test unitario — es un cambio de
  estilos y un prop de color.
