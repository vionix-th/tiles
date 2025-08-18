# vxThails

A lightweight, client‑side tile matching game. Two visual themes are included (Thai and Dinosaurs). The app runs as a static site (no server required) and ships with prebuilt PNG/SVG assets under `assets/`.

## Features
- Simple, fast in‑browser gameplay (no build step)
- Two tile sets: `thai`, `dinosaur`
- Touch and mouse support, language toggle (Thai/English)
- Optional tools to generate or refresh tile art

## Quick Start
Open `index.html` directly, or serve the folder with a static server (recommended):

- Python 3
  ```bash
  python3 -m http.server 8000
  # open http://localhost:8000/
  ```

- Node (using `npx serve`)
  ```bash
  npx serve .
  # open the URL it prints
  ```

URL options:
- `?tileset=thai|dinosaur` — choose the tile set.

## Project Structure
- `index.html` — App shell and UI markup
- `styles.css` — Visual styles
- `main.js` — Game logic, rendering, input, and i18n
- `assets/` — Shipped art used by the app
  - `assets/tiles_png/` — PNG tiles used by the game
    - `assets/tiles_png/thai/`
    - `assets/tiles_png/dinosaur/`
  - `assets/tiles/` — SVG placeholders (by theme)
    - `assets/tiles/thai/`
    - `assets/tiles/dinosaur/`
  - `assets/backgrounds_png/` — Backgrounds per theme
- `tools/` — Optional Node.js ESM scripts to generate/refresh assets

## Asset Generation (Optional)
You can regenerate or extend the art using the scripts in `tools/`. The repository already includes assets.

Placeholder SVGs
```bash
node tools/generate_placeholder_svgs.mjs [--force] [--palette=color|mono]
```
Output: `assets/tiles/<set>/<key>.svg`

Themed PNG tiles (OpenAI Images API)
```bash
OPENAI_API_KEY=... node tools/generate_thai_tiles.mjs \
  [--set=thai|dinosaur] [--palette=color|mono] [--allow-official-symbols] \
  [--size=1024x1024] [--concurrency=2] [--force] [--no-resize] \
  [--sheet-cols=N --sheet-rows=N --sheet-name=name]
```
Output: `assets/tiles_png/<set>/<key>.png`
Backgrounds: `assets/backgrounds_png/<set>.png`
Resizing: uses `sips` on macOS, or ImageMagick if available; disable with `--no-resize`.

Notes
- Node.js 18+ is required for native `fetch` and ESM `.mjs`.
- Do not commit secrets. Provide `OPENAI_API_KEY` via environment variable only.

## Development
- JavaScript style: 2‑space indentation, semicolons, `camelCase` for variables/functions, constants in `UPPER_SNAKE` when appropriate.
- Keep frontend code framework‑free and modular within `main.js` (functions over classes, early returns, small helpers).
- Match existing style; keep diffs minimal and focused.

## Testing
Manual smoke tests in a modern browser:
- Start a new game; verify matching, shuffle/hint, score/level progression, win/lose states.
- Resize window and test on mobile; confirm responsive layout.
- Verify both tile sets via `?tileset=thai|dinosaur` and the language toggle.
- Cross‑browser spot check (Chromium/WebKit/Gecko) when changing DOM/CSS or performance‑sensitive code.

## Commit & PR Guidelines
- Commits: Prefer Conventional Commits (e.g., `feat:`, `fix:`, `docs:`). Keep them small and descriptive.
- PRs: Include a clear description, linked issue, and before/after screenshots or a short clip for UI changes.
- Include generated assets in PRs if required by the change; note the tool command used.
- Validate that `index.html` loads with no console errors and assets resolve under a static server.

## Security & Configuration
- Asset tools may require `OPENAI_API_KEY`; provide via environment variable only. Never commit keys.
- The app is a static site — avoid introducing runtime secrets or third‑party trackers.

## Gameplay Tips
- Match identical tiles with at most two turns in the connecting path.
- Use “Shuffle” or “Hint” if stuck.
- Switch tile set and language from the in‑game menu.

## License
- Code: GPL‑3.0‑or‑later — see `LICENSE`.
- Images (`assets/tiles*`, `assets/backgrounds_png`): CC BY‑SA 4.0 — see `assets/LICENSE`.
- Sounds: third‑party and licensed separately — see `CREDITS.md`.

© Vionix Consulting
