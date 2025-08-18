# vxThails

A lightweight, client‑side tile matching game you can open in a browser. Includes two visual themes: Thai and Dinosaurs. The app runs as a static site (no server required) and ships with prebuilt PNG/SVG assets under `assets/`.

## Features
- Simple, fast in‑browser gameplay (no build step)
- Two tile sets: `thai`, `dinosaur`
- Touch and mouse support, language toggle (Thai/English)
- Optional tools to generate or regenerate tile art

## Prerequisites
- Any modern browser
- For the optional tools in `tools/`:
  - Node.js 18+ (for native `fetch` and ESM `.mjs`)
  - For PNG resizing (optional):
    - macOS `sips`, or
    - ImageMagick (`magick` or `convert`)

## Run locally
You can open `index.html` directly, or serve the folder with a simple static server (recommended for consistent paths):

- Python 3
  ```bash
  python3 -m http.server 8000
  # then open http://localhost:8000/
  ```

- Node (using `npx serve`)
  ```bash
  npx serve .
  # then open the URL it prints
  ```

## Project structure
- `index.html` – App shell and UI
- `styles.css` – Presentation
- `main.js` – Game logic, rendering, input, i18n
- `assets/` – Tile and background art
  - `assets/tiles_png/` – PNG tiles used by the game
    - `assets/tiles_png/thai/` – Thai set PNGs
    - `assets/tiles_png/dinosaur/` – Dinosaur set PNGs
  - `assets/tiles/` – SVG placeholders (by theme)
    - `assets/tiles/thai/` – Thai set SVGs
    - `assets/tiles/dinosaur/` – Dinosaur set SVGs
  - `assets/backgrounds_png/` – Backgrounds per theme
- `tools/` – Asset generation utilities (Node.js)

## Generating assets (optional)
You can regenerate or extend the art using the scripts in `tools/`. These are optional; the repository already includes assets.

### Placeholder SVGs
Creates stylized placeholder SVGs for all known tile keys, useful if a PNG is missing.

```bash
node tools/generate_placeholder_svgs.mjs [--force] [--palette=color|mono]
```
- Output: `assets/tiles/<set>/<key>.svg`

### Themed PNG tiles via OpenAI Images API
Generates glossy PNG icons for either tile set. Requires an API key.

```bash
OPENAI_API_KEY=sk-... node tools/generate_thai_tiles.mjs \
  [--set=thai|dinosaur] [--palette=color|mono] [--allow-official-symbols] \
  [--size=1024x1024] [--concurrency=2] [--force] [--no-resize] \
  [--sheet-cols=N --sheet-rows=N --sheet-name=name]
```
- Output: `assets/tiles_png/<set>/<key>.png`
- Backgrounds: `assets/backgrounds_png/<set>.png`
- Resizing: uses `sips` on macOS, or ImageMagick if available; disable with `--no-resize`.

Notes:
- Node.js 18+ is required for native `fetch`.
- The prompts include guardrails to avoid official national symbols when generating Thai‑themed art.

## Gameplay tips
- Match identical tiles with at most two turns in the connecting path.
- Use “Shuffle” or “Hint” if stuck.
- Switch tile set and language from the in‑game menu.

## License
This project is licensed under the GNU General Public License v3.0. See `LICENSE` for details.
