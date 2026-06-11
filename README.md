# Paint by numbers generator
Generate paint by number images (vectorized with SVG) from any input image.

*** This project was a proof of concept for fun back in the day. The web app has since been migrated to Next.js + React; feel free to fork and make your own changes. ***

## Demo

Try it out [here](https://drake7707.github.io/paintbynumbersgenerator/index.html)

## Screenshots

![Screenshot](https://i.imgur.com/6uHm78x.png])

![Screenshot](https://i.imgur.com/cY9ieAy.png)


## Example output

![ExampleOutput](https://i.imgur.com/2Zuo13d.png)

![ExampleOutput2](https://i.imgur.com/SxWhOc7.png)

## Running locally (Next.js)

The web app has been migrated to [Next.js](https://nextjs.org/) (App Router + TypeScript). React replaces the old jQuery/Materialize UI, while the image-processing algorithms are reused unchanged under `lib/pbn/`.

```
npm install      # restore packages
npm run dev      # start the dev server on http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

### Project structure

 - `app/` — Next.js App Router (`layout.tsx`, `page.tsx`, `globals.css`)
 - `components/PaintByNumbers.tsx` — the React UI (input, options, progress, output)
 - `lib/pbn/` — the framework-agnostic processing pipeline (color reduction, facet building/reduction, border tracing/segmentation, label placement, SVG/PNG export)

The processing runs entirely client-side in the browser (it relies on `<canvas>`), so the page is a client component.

### Settings

The same options exposed in the original tool are available in the Options tab:

 - **Number of colors** — the number of colors to quantize the image to (k-means clusters).
 - **Cluster precision** — the threshold delta distance of the k-means clustering to reach before stopping. A bigger value speeds up clustering but may yield suboptimal clusters.
 - **Random seed** — the seed for choosing the initial centroids, so the same input gives the same result.
 - **Clustering color space** — RGB, HSL or Lab.
 - **Restrict clustering colors** — limit the palette to specific `r,g,b` values (one per line, `//` to comment), useful if you only have a few paint colors on hand.
 - **Narrow pixel cleanup runs** — removes single-pixel-wide strips that produce border segments too narrow to be useful, repeated over a few iterations.
 - **Remove facets smaller than (pixels)** — drops tiny facets; lower values give more detail but are harder to paint.
 - **Maximum number of facets** — keeps removing the smallest facets until the limit is reached.
 - **Small facet removal order** — largest-to-smallest preserves shapes better (smaller facets act as anchors) but is slower.
 - **Times to halve border segment complexity** — Haar-wavelet reduction smooths the quadratic curves at a loss of detail; start/end points of each segment are always retained.
 - **Resize image larger than** — resizes oversized input to fit the given dimensions while keeping its ratio.
