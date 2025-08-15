# Repository Guidelines

## Project Structure & Module Organization
- `index.html`: App shell and UI markup.
- `styles.css`: Visual styles for the game and UI.
- `main.js`: Vanilla JS game logic, rendering, input, and i18n.
- `assets/`: Shipped art used by the app (PNGs preferred at runtime; SVG fallbacks).
  - `assets/tiles_png/`, `assets/tiles/`, `assets/backgrounds_png/`.
- `tools/`: Optional Node.js ESM scripts to generate/refresh assets.

## Build, Test, and Development Commands
- Serve locally: `python3 -m http.server 8000` then open `http://localhost:8000/`.
- Node server (optional): `npx serve .`.
- Generate placeholder SVGs: `node tools/generate_placeholder_svgs.mjs [--force] [--palette=color|mono]`.
- Generate themed PNG tiles: `OPENAI_API_KEY=... node tools/generate_thai_tiles.mjs [--set=thai|dinosaur] [...options]`.

## Coding Style & Naming Conventions
- JavaScript: 2‑space indentation, semicolons, `camelCase` for variables/functions, constants in `UPPER_SNAKE` where appropriate.
- Files/paths: lowercase with underscores where established (e.g., `backgrounds_png`).
- Keep frontend code framework‑free and modular within `main.js` (functions over classes, early returns, small helpers).
- No linter is configured—match existing style; keep diffs minimal and focused.

## Testing Guidelines
- No automated test suite; perform manual smoke tests in a modern browser.
- Verify: new game, matching, shuffle/hint, score/level progression, win/lose states, and responsive layout (resize, mobile).
- Check both tile sets (`?tileset=thai|dinosaur`) and language toggle.
- Cross‑browser spot check (Chromium/WebKit/Gecko) when changing DOM/CSS or performance‑sensitive code.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits where possible (e.g., `feat:`, `fix:`, `docs:`). Keep them small and descriptive.
- PRs: include a clear description, linked issue, and before/after screenshots or a short clip for UI changes.
- Include generated assets in PRs if required by the change; note the tool command used. Do not commit API keys or secrets.
- Validate that `index.html` loads with no console errors and assets resolve under a static server.

## Security & Configuration Tips
- Asset tools may require `OPENAI_API_KEY`; provide via environment variable only. Never commit keys.
- The app is a static site—avoid introducing runtime secrets or third‑party trackers.
