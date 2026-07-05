# Feature: resaltar secciones por color

Guía de implementación de la función que permite **resaltar en la imagen resultado todas las secciones de un número/color** al hacer click sobre su swatch en la paleta.

## Resumen

Cuando el usuario hace click en un color de la paleta (`ColorPalettePane`), sobre la imagen resultado del comparador (`ImageCompareSlider`) se superpone un overlay que resalta ese color:

- Las secciones del **color seleccionado** se pintan a su **color real al 100%**, con su **contorno** y su **número** redibujados encima para que sigan siendo legibles sobre el relleno opaco.
- El **resto de la imagen queda intacto** (sus rellenos pálidos, bordes y números se ven igual que antes del click): esos facets simplemente no forman parte del overlay, así que la base se ve a través.

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

### 1. `lib/pbn/highlight.ts`

Genera un **overlay SVG** (a resolución fuente, mismo `viewBox` que la salida procesada) que contiene **solo** los facets del color elegido. Reutiliza los helpers `buildFacetPathData` y `buildFacetLabel` de `guiprocessmanager.ts` para que el contorno y el número coincidan exactamente con los de la imagen base.

```ts
import { RGB } from "./common";
import { FacetResult } from "./facetmanagement";
import { buildFacetLabel, buildFacetPathData } from "./guiprocessmanager";

const XMLNS = "http://www.w3.org/2000/svg";

export interface HighlightOverlayOptions {
  showBorders: boolean;
  showLabels: boolean;
  fontSize: number;
  fontColor: string;
}

export function buildHighlightOverlayDataUrl(
  facetResult: FacetResult,
  colorIndex: number,
  palette: RGB[],
  opts: HighlightOverlayOptions,
): string {
  const { width, height, facets } = facetResult;
  const svg = document.createElementNS(XMLNS, "svg");
  svg.setAttribute("width", width + "");
  svg.setAttribute("height", height + "");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  for (const f of facets) {
    if (f == null || f.color !== colorIndex) continue;
    const data = buildFacetPathData(f);
    if (data == null) continue;

    const c = palette[f.color];

    // relleno sólido al 100% → el resaltado
    const fillPath = document.createElementNS(XMLNS, "path");
    fillPath.setAttribute("d", data);
    fillPath.style.stroke = "none";
    fillPath.style.fill = `rgb(${c[0]},${c[1]},${c[2]})`;
    svg.appendChild(fillPath);

    // el relleno taparía el borde de la base → redibujarlo
    if (opts.showBorders) {
      const strokePath = document.createElementNS(XMLNS, "path");
      strokePath.setAttribute("d", data);
      strokePath.style.fill = "none";
      strokePath.style.strokeWidth = "0.33px";
      strokePath.style.stroke = "#000";
      svg.appendChild(strokePath);
    }

    // número legible sobre el color pleno
    if (opts.showLabels) {
      svg.appendChild(buildFacetLabel(f, opts.fontSize, opts.fontColor));
    }
  }

  const serialized = new XMLSerializer().serializeToString(svg);
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);
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

Levanta el estado de selección y deriva el overlay.

```tsx
const [selectedColor, setSelectedColor] = useState<number | null>(null);

// Reconstruye el overlay al cambiar el color, la paleta o las render options.
// Depende de palette para recalcular contra el facetResult nuevo tras reprocesar,
// y de los toggles para que el borde/número del overlay los sigan.
const highlightSrc = useMemo(() => {
  const result = processing.processResultRef.current;
  if (selectedColor === null || !result) return undefined;
  return buildHighlightOverlayDataUrl(
    result.facetResult,
    selectedColor,
    result.colorsByIndex,
    {
      showBorders: renderOptions.showBorders,
      showLabels: renderOptions.showLabels,
      fontSize: renderOptions.labelFontSize,
      fontColor: renderOptions.labelFontColor,
    },
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  selectedColor,
  processing.palette,
  renderOptions.showBorders,
  renderOptions.showLabels,
  renderOptions.labelFontSize,
  renderOptions.labelFontColor,
]);
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

- **Solo se añade lo seleccionado**: el overlay contiene únicamente los facets del color elegido; todo lo demás se deja fuera (transparente), así la imagen base se ve intacta con sus números. No hay que atenuar el resto.
- **Redibujar borde y número**: el relleno del overlay es opaco y taparía el contorno/número de la base en esas secciones, por eso se vuelven a dibujar dentro del propio overlay (siguiendo los toggles `showBorders`/`showLabels`).
- **Reutilizar helpers**: `buildFacetPathData` y `buildFacetLabel` viven en `guiprocessmanager.ts` y los comparten `createSVG` y el overlay, de modo que la geometría y el tamaño de los números coinciden exactamente.
- **Resolución/alineación**: el SVG usa el mismo `width × height` y `viewBox` que la salida procesada y se escala vía CSS (`width:100%`), así queda alineado aunque cambien las render options.
- **Orden en el DOM del slider**: `highlightImg` debe ir entre `baseImg` y `overlayImg` para no cubrir el lado Original.
- **Coste**: `buildHighlightOverlayDataUrl` recorre los facets una vez y serializa un SVG (sin rasterizar), memoizado por click. Suficientemente rápido.

## Cómo probar

1. `npm run dev` (si el puerto 3000 está ocupado, Next levanta en 3001).
2. Cargar una imagen y **Process image** con pocos colores (p. ej. 6) para ver secciones grandes.
3. Click en un swatch: sus secciones quedan a todo color (con contorno y número) y el resto de la imagen no cambia; el swatch muestra el anillo de selección y los demás se atenúan.
4. Click de nuevo en el mismo swatch → se quita el resaltado. Click en otro → cambia.
5. Arrastrar el divisor: el lado Original nunca se ve afectado; el resaltado se mantiene alineado.
6. Reprocesar (o cambiar settings + Process) → la selección se limpia y no queda overlay obsoleto.
