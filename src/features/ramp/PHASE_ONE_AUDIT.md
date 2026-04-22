# Phase One Audit

## Done

- Vite + React + TypeScript foundation.
- SCSS modules and token variables.
- Ark UI wrapped component layer.
- Single engine-backed ramp.
- Global `L max` / `L min`.
- Canonical stops.
- Intermediate insertion/deletion for the engine ramp.
- Anchor creation with automatic snapping.
- Linear lightness, local smoothing, range chroma, constant hue.
- Stop states for default, anchor, and hidden.
- Basic WCAG contrast data.
- Basic export.

## Partial

- Responsive row/column display is present, but it is still presentation-focused.
- Multi-ramp UI is present, but static/UI-only except for `Crimson-Red`.
- Gamut validation is present in the engine/export path, but not fully surfaced across the card grid.
- Initial ramps now start anchorless; anchors are applied explicitly by the user.

## Remaining

- Make every ramp engine-backed.
- Add a stronger selected-ramp editing model.
- Export all ramps/groups, not only the engine-backed ramp.
- Add more complete validation UI.
- Save and reload config from durable parameters.
- Add stronger Playwright visual verification once browser launch is available in the local environment.
