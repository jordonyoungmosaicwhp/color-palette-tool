# OKLCH Palette Tool

Phase-one prototype for a design-system palette generator built with Vite, React, TypeScript, SCSS modules, Ark UI wrappers, and Culori.

## Run

```sh
npm install
npm run dev
```

If `npm install` fails while validating `esbuild`, remove the partial install and retry:

```sh
rm -rf node_modules package-lock.json
npm install
```

This project pins Vite to `6.3.5` and overrides esbuild to `0.25.12` to avoid the `esbuild@0.27.x` native binary failure seen on this machine with Node `22.14.0`. If the same native binary error persists, use Node `20.19.x` through `nvm` and rerun a clean install.

## Scripts

- `npm run dev`: start the Vite dev server.
- `npm run build`: typecheck and build.
- `npm run test`: run pure color engine tests.
- `npm run lint`: run ESLint, including the Ark import boundary.
- `npm run storybook`: open the component audit surface.
- `npm run test:e2e`: run Playwright smoke tests against the built preview server.

## Ramp Calculation Model

Ramp generation now treats `lightness`, `chroma`, and `hue` as separate channels.

### Lightness

- Lightness is always derived from the global range only.
- For any rendered stop index `t` on `0..1000`, lightness is:
  - `l = lMax + (lMin - lMax) * (t / 1000)`
- Hue midpoint position, chroma midpoint position, shape sliders, and custom-stop interpolation do not modify lightness.

### Chroma

- Chroma is evaluated independently from the chroma preset and any custom stops.
- If there are no custom stops, chroma uses the standard three-point Hermite model:
  - `start -> midpoint -> end`
- If custom stops exist, chroma builds an ordered list of interpolation control points:
  - `start`
  - optional unlocked midpoint
  - custom stops
  - `end`
- The rendered stop list stays on the 25-step stop grid. An off-grid midpoint may exist internally as a control point, but it is not emitted as a rendered stop.
- Segment rules:
  - segments touching `start` or `end` use endpoint Hermite shaping
  - interior segments use system-controlled spline interpolation

### Hue

- Hue is evaluated independently from the hue preset and any custom stops.
- Like chroma, hue uses ordered control points:
  - `start`
  - optional unlocked midpoint
  - custom stops
  - `end`
- The rendered stop list stays grid-aligned even when the midpoint position is off-grid internally.
- Hue direction is segmented:
  - `startDirection` controls endpoint-facing spans that touch `start`
  - `endDirection` controls endpoint-facing spans that touch `end`
  - interior hue spans use automatic continuity / shortest-path unwrapping
- This means the left and right halves of the ramp can rotate differently without forcing a single global hue direction.

### Custom Stops And Midpoint

- Custom stops are exact pass-through points for hue and chroma at their derived stop positions.
- With the midpoint locked:
  - one custom stop effectively acts as the midpoint reference
  - two or more custom stops omit the midpoint from interpolation
- With the midpoint unlocked:
  - the midpoint is added as another interior control point
  - its ordering relative to the custom stops determines which segments are endpoint-facing Hermite spans and which are interior spline spans
