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
