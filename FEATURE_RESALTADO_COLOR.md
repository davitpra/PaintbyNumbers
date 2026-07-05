# Feature: resaltar secciones por color

Guía de implementación de la función que permite **resaltar en la imagen resultado todas las secciones de un número/color** al hacer click sobre su swatch en la paleta.

## Resumen

Cuando el usuario hace click en un color de la paleta (`ColorPalettePane`), la imagen resultado del comparador (`ImageCompareSlider`) se transforma así:

- Las secciones del **color seleccionado** se ven a su **color real al 100%**.
- El **resto de colores** se desvanece a un **fantasma al 10%** (cada zona conserva su propio matiz, no es un velo gris uniforme).
- No se dibuja ningún contorno.

Volver a hacer click en el mismo color quita el resaltado. Solo se afecta el lado **Result** del slider; el lado **Original** queda intacto.

## Flujo de datos

Todo lo necesario ya lo produce el pipeline de procesado y lo expone `useProcessing`:

- `processing.processResultRef.current` → `ProcessResult { facetResult, colorsByIndex }`
  (definido en `lib/pbn/guiprocessmanager.ts`).
- `processing.palette` → `RGB[]` = `colorsByIndex` (la misma lista que se pinta como swatches).
- `FacetResult` (`lib/pbn/facetmanagement.ts`):
  - `facetMap.get(x, y)` → **id de facet** del píxel `(x, y)`.
  - `facets[id].color` → **índice de paleta** de ese facet = **índice del swatch** (0-based).
  - `width`, `height` → resolución fuente (antes de aplicar `sizeMultiplier`).

Clave: el índice `i` del swatch en `ColorPalettePane` es exactamente `facet.color`. Con eso basta para saber qué píxeles pertenecen al color elegido.

## Archivos y cambios

### 1. `lib/pbn/highlight.ts` (nuevo)

Helper puro que genera la máscara PNG (a resolución fuente) que se superpone a la imagen resultado.

```ts
import { RGB } from "./common";
import { FacetResult } from "./facetmanagement";

// Opacidad que se conserva de los colores NO seleccionados (compuesta sobre
// blanco). Todo lo que no es el color elegido se atenúa a un fantasma al 10%.
const FADE_OPACITY = 0.1;

export function buildHighlightMaskDataUrl(
  facetResult: FacetResult,
  colorIndex: number,
  palette: RGB[],
): string {
  const { width, height, facetMap, facets } = facetResult;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  let i = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const facet = facets[facetMap.get(x, y)];
      if (!facet || facet.color !== colorIndex) {
        // no seleccionado → su propio color de paleta atenuado al 10% sobre blanco
        const c = facet ? palette[facet.color] : [255, 255, 255];
        data[i] = fade(c[0]);
        data[i + 1] = fade(c[1]);
        data[i + 2] = fade(c[2]);
        data[i + 3] = 255;
      }
      // sección seleccionada → transparente (alpha queda en 0), se ve el color real
      i += 4;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

// Compone un canal sobre blanco a FADE_OPACITY.
function fade(channel: number): number {
  return Math.round(255 * (1 - FADE_OPACITY) + channel * FADE_OPACITY);
}
```

### 2. `components/pbn/ColorPalettePane.tsx`

Cada swatch pasa a ser un `<button>` clickable con estado de selección.

- Props nuevas: `selectedColor: number | null` y `onSelectColor: (index: number) => void`.
- Cada swatch: `onClick={() => onSelectColor(i)}`, `aria-pressed={isSelected}`.
- Clases condicionales: `colorSelected` para el elegido, `colorDimmed` para el resto cuando hay selección activa.
- Hint: `<p className={styles.paletteHint}>Click a color to highlight its sections in the preview.</p>`.

```tsx
{palette.map((c, i) => {
  const isSelected = selectedColor === i;
  return (
    <button
      key={i}
      type="button"
      className={`${styles.color} ${isSelected ? styles.colorSelected : ""} ${
        hasSelection && !isSelected ? styles.colorDimmed : ""
      }`}
      style={{ backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})` }}
      title={`#${i} · rgb(${c[0]}, ${c[1]}, ${c[2]})`}
      aria-pressed={isSelected}
      onClick={() => onSelectColor(i)}
    >
      {i + 1}
    </button>
  );
})}
```

### 3. `components/ImageCompareSlider.tsx` (+ `ImageCompareSlider.module.css`)

- Prop nueva opcional: `highlightSrc?: string`.
- Se renderiza como `<img className={styles.highlightImg}>` **entre** `baseImg` (procesada) y `overlayImg` (original). Ese orden en el DOM es importante: como la original está recortada al lado izquierdo del divisor y queda apilada encima, tapa la máscara en su lado → el resaltado solo se ve en el lado Result.

```tsx
{/* orden: baseImg → highlightImg → overlayImg → guard → labels → handle */}
{highlightSrc && (
  <img className={styles.highlightImg} src={highlightSrc} alt="" draggable={false} />
)}
```

CSS (mismo patrón que `.overlayImg`):

```css
.highlightImg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
  -webkit-user-drag: none;
}
```

### 4. `components/PaintByNumbers.tsx`

Levanta el estado de selección y deriva la máscara.

```tsx
const [selectedColor, setSelectedColor] = useState<number | null>(null);

// Reconstruye la máscara al cambiar el color o la paleta. Depende de palette
// para recalcular contra el facetResult nuevo tras reprocesar.
const highlightSrc = useMemo(() => {
  const result = processing.processResultRef.current;
  if (selectedColor === null || !result) return undefined;
  return buildHighlightMaskDataUrl(
    result.facetResult,
    selectedColor,
    result.colorsByIndex,
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedColor, processing.palette]);
```

- En `onProcessStart` se resetea la selección para no arrastrar un color de una paleta vieja:

```tsx
const onProcessStart = useCallback(() => {
  setRecipes(null);
  setSelectedColor(null); // suelta el resaltado ligado a la paleta que se va a reemplazar
}, [setRecipes]);
```

- Se pasan las props a ambos componentes:

```tsx
<ImageCompareSlider /* ... */ highlightSrc={highlightSrc} />

<ColorPalettePane
  /* ... */
  selectedColor={selectedColor}
  onSelectColor={(i) => setSelectedColor((prev) => (prev === i ? null : i))}
/>
```

El `onSelectColor` implementa el toggle: click en el mismo swatch deselecciona.

### 5. `components/PaintByNumbers.module.css`

Estilos de los swatches ahora que son botones:

- `.color`: `cursor: pointer`, reset de botón (`border`, `padding`, `font-family: inherit`), transición.
- `.colorSelected`: anillo de selección (`outline` + leve `transform: scale`).
- `.colorDimmed`: `opacity: 0.45` para los no seleccionados cuando hay selección.
- `.paletteHint`: texto de ayuda pequeño y atenuado.

## Detalles clave / gotchas

- **"Bajar la opacidad" con un overlay**: el overlay va _encima_ de la imagen, así que no puede reducir la opacidad de lo de abajo. El equivalente exacto es pintar píxeles **opacos** con el color de paleta compuesto al 10% sobre blanco (`fade()`), y dejar **transparentes** solo las secciones seleccionadas.
- **Resolución de la máscara**: se genera a `facetResult.width × height` (resolución fuente) y se escala vía CSS (`width:100%`). Es independiente de `sizeMultiplier`, así que sigue alineada aunque cambien las render options.
- **Orden en el DOM del slider**: `highlightImg` debe ir entre `baseImg` y `overlayImg` para no oscurecer el lado Original.
- **Coste**: `buildHighlightMaskDataUrl` es O(w×h), se ejecuta una sola vez por click (memoizado). Suficientemente rápido.

## Cómo probar

1. `npm run dev` (si el puerto 3000 está ocupado, Next levanta en 3001).
2. Cargar una imagen y **Process image** con pocos colores (p. ej. 6) para ver secciones grandes.
3. Click en un swatch: sus secciones quedan a todo color y el resto en fantasma al 10%; el swatch muestra el anillo de selección y los demás se atenúan.
4. Click de nuevo en el mismo swatch → se quita el resaltado. Click en otro → cambia.
5. Arrastrar el divisor: el lado Original nunca se atenúa; el resaltado se mantiene alineado.
6. Reprocesar (o cambiar settings + Process) → la selección se limpia y no queda overlay obsoleto.
