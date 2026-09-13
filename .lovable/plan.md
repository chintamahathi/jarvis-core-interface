# J.A.R.V.I.S. HUD Frontend

## Build
- Replace the placeholder with a full-screen, 16:9-first J.A.R.V.I.S. interface matching the supplied reference composition.
- Create reusable HUD panels for location, system telemetry, activity, clock/weather, logs, settings, and about views.
- Build an animated layered core with orbital rings, scan effects, particles, state-specific motion, and an interactive microphone cycle.
- Add compact responsive layouts for 1440×900, 1366×768, and 1024×768 without panel overlap.

## Visual system
- Define a restrained near-black/navy palette with electric teal accents, thin borders, technical typography, subtle glow, grid, hex, scanline, and frame details.
- Use Space Grotesk and JetBrains Mono, loaded in the document head.
- Respect reduced-motion preferences.

## Technical details
- Keep all data and state in the browser with React and TypeScript; no network, storage, authentication, or server work.
- Use the existing TanStack route and shared UI primitives, with semantic styling tokens in the global stylesheet.
- Add route-specific metadata and verify the compiled preview plus desktop/tablet viewport rendering.
