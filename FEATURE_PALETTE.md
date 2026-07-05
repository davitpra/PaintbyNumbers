# Feature: Paleta sugerida + cuentagotas ("Pick from photo")

Guía de implementación de la función que **sugiere una paleta a partir de la
fotografía** y permite al usuario **elegir sus propios colores** — pinchando los
swatches sugeridos o usando un cuentagotas (eyedropper) sobre la foto. Los
colores elegidos se **fijan** (pin) dentro de la paleta final del paint-by-number.

## Resumen

La feature tiene tres piezas:

1. **Colores sugeridos**: al cargar una imagen se extraen sus ~12 colores
   dominantes (k-means en espacio Lab sobre una copia reducida) y se muestran
   como swatches clicables.
2. **Cuentagotas**: un modal muestra la foto a resolución nativa; al mover el
   ratón hay una lupa (loupe) magnificada con crosshair y, al hacer click, se
   muestrea el color (media 3×3) y se añade a "tus colores".
3. **Fijado en el pipeline**: los colores elegidos se inyectan como **centroides
   fijos** del k-means de reducción de color, así que aparecen sí o sí en la
   paleta final. Dos modos:
   - **`exact` ("Only my colors")**: la paleta *es* la lista del usuario. Tantos
     clusters como colores elegidos, todos fijos, sin candidatos automáticos.
   - **`complement` ("My colors + auto")**: los colores del usuario se garantizan
     y el resto de la paleta se completa automáticamente hasta `nrOfClusters`.

Si el usuario no elige nada, todo funciona exactamente como antes.

## Flujo de datos

```
useImageInput ──imageSrc(dataURL)──▶ InputOptionsPane ──▶ PalettePicker
                                                              │
                    extractDominantColors(imageSrc) ◀─────────┘  (colores sugeridos)
                    sampleColorAt(canvas, x, y)     ◀─────────┘  (cuentagotas)
                                                              │
useInputOptions  ◀── togglePickedColor/addPickedColor ────────┘
   pickedColors: RGB[]      ← estado
   paletteMode: "exact"|"complement"
        │
        └── buildSettings() ──▶ Settings.kMeansPinnedColors / kMeansNrOfClusters / kMeansFixedColors
                                     │
                    ColorReducer.applyKMeansClustering(...)  (construye fixedCentroids)
                                     │
                    KMeans(vectors, k, random, fixedCentroids)  (los primeros k son inamovibles)
```

Idea clave: **un centroide "fijo" participa en la asignación de puntos pero
nunca se mueve durante `step()`**. Eso obliga a que su color exacto sobreviva en
la paleta resultante.

## Archivos y cambios

### 1. `lib/pbn/palettePicker.ts` (nuevo)

Dos helpers puros de main-thread, sin dependencias de React.

- **`extractDominantColors(src, count = 12): Promise<RGB[]>`**
  - Carga la imagen y la reduce a máx. `SAMPLE_MAX_SIDE = 96` px por lado (los
    colores dominantes no necesitan resolución completa → extracción instantánea).
  - Descarta píxeles casi transparentes (`alpha < 128`).
  - Agrupa por color con bits reducidos (`& 0xf8`) ponderando por frecuencia.
  - Corre el **mismo k-means ponderado en Lab** que el pipeline principal, con
    semilla fija (`EXTRACT_SEED = 1`) → la sugerencia es **estable** para una
    misma imagen.
  - Ordena los clusters por peso total de píxeles (más prominente primero).

- **`sampleColorAt(canvas, x, y): RGB`**
  - Muestrea promediando un vecindario 3×3 para no depender de un píxel con ruido.
  - Coordenadas en el espacio de píxeles del canvas, clampadas a sus límites.

Depende de utilidades que ya tienes que portar si no existen: `KMeans`/`Vector`
(`lib/pbn/lib/clustering.ts`), `rgb2lab`/`lab2rgb` (`lib/pbn/lib/colorconversion.ts`),
`Random` (`lib/pbn/random.ts`), tipo `RGB` (`lib/pbn/common.ts`).

### 2. `components/pbn/PalettePicker.tsx` (nuevo)

Componente de UI. Recibe `{ opts: InputOptions, imageSrc: string | null }`.

- **Sugeridos**: `useEffect` sobre `imageSrc` llama `extractDominantColors` y
  guarda `suggested` en estado local. Usa un flag `cancelled` en el cleanup para
  evitar setState tras desmontar / cambio rápido de imagen.
- **`Swatch`**: chip de color reutilizable, con check `✓` si está activo y botón
  `×` opcional para quitar.
- Tres bloques: "Your colors" (los fijados, con quitar / "Clear all"),
  "Suggested from photo" (toggle on/off) y botón "Pick from photo" (abre modal).
- **Selector de modo** (solo visible si hay colores elegidos): segmented control
  entre `exact` y `complement` → `opts.setPaletteMode`.
- **`EyedropperModal`** (en el mismo archivo):
  - Dibuja la imagen a **resolución natural** en un `<canvas>`; el CSS lo escala
    para mostrarlo, pero el muestreo sigue siendo pixel-exacto.
  - `toCanvasXY` convierte el evento de ratón a coordenadas de píxel del canvas.
  - `onMove` actualiza el color bajo el cursor y pinta la **lupa** (`LOUPE_SIZE=120`,
    región fuente `LOUPE_SRC=15`, `imageSmoothingEnabled=false`, crosshair sobre
    el píxel central).
  - `onClick` → `sampleColorAt` → `onPick`. `Escape` cierra el modal.
  - Muestra también los swatches sugeridos y "tus colores" dentro del modal.

### 3. `components/pbn/useInputOptions.ts` (estado)

Añade el estado y los handlers de la paleta del usuario:

```ts
export type PaletteMode = "exact" | "complement";

const [pickedColors, setPickedColors] = useState<RGB[]>([]);
const [paletteMode, setPaletteMode] = useState<PaletteMode>("complement");

// comparados con igualdad exacta de RGB
togglePickedColor(rgb)  // añade o quita
addPickedColor(rgb)     // añade si no está (usado por el cuentagotas)
removePickedColor(rgb)  // quita
clearPickedColors()     // vacía
```

Y en **`buildSettings()`** es donde se conecta con el pipeline:

```ts
// los colores del usuario se fijan SIEMPRE
settings.kMeansPinnedColors = pickedColors;

if (pickedColors.length > 0 && paletteMode === "exact") {
  // la paleta ES la lista del usuario: tantos clusters como colores, todos fijos
  settings.kMeansNrOfClusters = pickedColors.length;
  settings.kMeansFixedColors = [];               // sin negro/blanco automáticos
} else {
  // complement (o sin elección): garantiza sitio para los pinned + los auto
  settings.kMeansNrOfClusters = Math.max(nrOfClusters, pickedColors.length);
  settings.kMeansFixedColors = [[0,0,0], [255,255,255]];
}
```

### 4. `lib/pbn/settings.ts`

Dos campos nuevos en `Settings`:

```ts
// Colores que SIEMPRE deben aparecer (negro/blanco). Solo se añaden si la
// imagen realmente los contiene (presence check). Se añaden como clusters
// fijos extra (no snapean toda la paleta como kMeansColorRestrictions).
public kMeansFixedColors: RGB[] = [];

// Colores elegidos por el usuario (eyedropper / sugeridos). Como los anteriores
// pero se añaden INCONDICIONALMENTE (sin presence check).
public kMeansPinnedColors: RGB[] = [];
```

> Diferencia importante frente a `kMeansColorRestrictions`: las *restrictions*
> snapean cada centroide al color permitido más cercano (fuerza toda la paleta a
> un set). Los *pinned/fixed* solo **añaden** clusters fijos; el resto de la
> imagen se clusteriza con normalidad.

### 5. `lib/pbn/lib/clustering.ts` (KMeans con centroides fijos)

El `KMeans` acepta un 4º parámetro `fixedCentroids`:

```ts
constructor(points, k, random, fixedCentroids: Vector[] = []) {
  this.nrOfFixedCentroids = Math.min(fixedCentroids.length, k);
  this.initCentroids(fixedCentroids.slice(0, this.nrOfFixedCentroids));
}
```

- En `initCentroids` los fijos se siembran **primero**; el resto se rellena con
  k-means++ (probabilidad ∝ `weight · D²`) usando el `Random` sembrado.
- En `step()` el bucle de reajuste **empieza en `nrOfFixedCentroids`**, así que
  los centroides fijos participan en la asignación pero nunca se mueven:

```ts
for (let k = this.nrOfFixedCentroids; k < this.pointsPerCategory.length; k++) { ... }
```

### 6. `lib/pbn/colorreductionmanagement.ts` (construir los fijos)

Dentro de `applyKMeansClustering`, tras vectorizar los colores, se construyen los
`fixedCentroids` en el espacio de color activo:

```ts
const addPinnedColor = (rgb) => { /* dedup por "r,g,b" + convertir a colorSpace */ };

// 1) colores del usuario: incondicionales, con prioridad
for (const rgb of settings.kMeansPinnedColors) addPinnedColor(rgb);

// 2) candidatos automáticos (negro/blanco): solo si están presentes
for (const rgb of settings.kMeansFixedColors) {
  if (!ColorReducer.isColorPresent(rgb, pointsByColor, totalPixels)) continue;
  addPinnedColor(rgb);
}

const kmeans = new KMeans(vectors, settings.kMeansNrOfClusters, random, fixedCentroids);
```

- **`isColorPresent(target, pointsByColor, totalPixels)`**: un color "está
  presente" si al menos `FIXED_COLOR_PRESENCE_MIN_FRACTION` (0.1%) de los píxeles
  cae dentro de `FIXED_COLOR_PRESENCE_MAX_DELTAE` (ΔE Lab = 20) del target. Evita
  meter negro/blanco puro cuando la imagen no los tiene.
- El dedup (`seenPinned`) garantiza que un mismo color no se fije dos veces y que
  el elegido por el usuario gane al candidato automático.

### 7. `components/pbn/InputOptionsPane.tsx` (cableado)

- Renderiza `<PalettePicker opts={opts} imageSrc={imageSrc} />`.
- Bloquea el campo "Number of colors" cuando estás en modo `exact`
  (`colorCountLocked = pickedColors.length > 0 && paletteMode === "exact"`),
  porque en ese modo el tamaño de la paleta lo fija la lista del usuario.
- `imageSrc` viene de arriba: `PaintByNumbers.tsx` pasa `input.imageSrc`
  (el dataURL de `useImageInput`).

## Portar a tu otro PBN — checklist

Asumiendo que tu otro proyecto también deriva del mismo motor k-means (StucturedArt /
kMeans en Lab), el orden recomendado es:

1. **Motor (obligatorio primero)**: añade `fixedCentroids` a `KMeans`
   (constructor + `nrOfFixedCentroids` + arranque del bucle en `step()`).
2. **Settings**: añade `kMeansFixedColors` y `kMeansPinnedColors`.
3. **Reducción de color**: construye `fixedCentroids` en `applyKMeansClustering`
   y añade `isColorPresent`. Convierte cada RGB al colorSpace activo.
4. **Helpers**: copia `lib/pbn/palettePicker.ts` (ajusta imports de `KMeans`,
   `rgb2lab/lab2rgb`, `Random`, `RGB`).
5. **Estado**: añade `pickedColors` + `paletteMode` + handlers a tu hook de
   opciones, y el bloque de `buildSettings`.
6. **UI**: copia `PalettePicker.tsx` (incluye el modal) y móntalo pasándole
   `imageSrc` (dataURL de la imagen original **antes** de resize/recorte).
7. **Estilos**: porta las clases usadas (`paletteSwatch*`, `paletteRow`,
   `eyedropper*`, `loupe*`, `segmented/segment*`, `modal*`) desde
   `PaintByNumbers.module.css`.

## Puntos delicados (gotchas)

- **El canvas del cuentagotas debe estar a resolución natural.** Si lo escalas en
  el DOM, `toCanvasXY` reescala el evento con `canvas.width/height` reales; no
  muestrees sobre el elemento `<img>` mostrado.
- **`imageSrc` debe ser la imagen original**, no la ya reducida por el pipeline,
  o el usuario picará colores que no coinciden con lo que ve.
- **Semilla fija en la extracción** (`EXTRACT_SEED`) → sugerencias estables. Si la
  quitas, la paleta sugerida "baila" en cada render.
- **Igualdad de color exacta**: `pickedColors` se compara por RGB idéntico. Un
  mismo tono muestreado con +1 de ruido cuenta como distinto (por eso el
  cuentagotas promedia 3×3 y los sugeridos vienen bit-reducidos).
- **`exact` vs `complement`**: en `exact` se vacían los `kMeansFixedColors`, así
  que negro/blanco automáticos NO se añaden; la paleta es exactamente la del
  usuario. Recuerda bloquear el campo "número de colores" en ese modo.
- **CORS**: `img.crossOrigin = "anonymous"` es necesario para poder leer
  `getImageData` sin ensuciar el canvas si algún día la fuente no es un dataURL.
- **Dedup + prioridad**: si el usuario fija exactamente negro/blanco, el
  `seenPinned` evita el duplicado y su versión (incondicional) gana al candidato
  automático.

## Ver también

- `FEATURE_RESALTADO_COLOR.md` — resaltado de secciones por color desde la paleta
  (feature hermana que consume la paleta ya construida).
