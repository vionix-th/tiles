#!/usr/bin/env node
/**
 * Generate Thai-themed glossy PNG tile icons via OpenAI Images API (gpt-image-1).
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node tools/generate_thai_tiles.mjs \
 *     [--set=thai|dinosaur] [--palette=color|mono] [--allow-official-symbols] \
 *     [--size=1024x1024] [--concurrency=2] [--force] [--no-resize] \
 *     [--sheet-cols=N --sheet-rows=N --sheet-name=name]
 *
 * Output:
 *   assets/tiles_png/<key>.png
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile as _execFile } from 'child_process';
import { promisify } from 'util';
const execFile = promisify(_execFile);

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable.');
  process.exit(1);
}

const OUT_DIR = path.resolve(process.cwd(), 'assets/tiles_png');
const BG_DIR = path.resolve(process.cwd(), 'assets/backgrounds_png');

const SET = (process.argv.find(a=>a.startsWith('--set=')) || '--set=thai').split('=')[1];
// Keep this list in sync with TILE_SETS in main.js
const TILE_SPECS = (SET === 'dinosaur') ? [
  // Original 12
  { key: 'trex', label: 'T-Rex head' },
  { key: 'stegosaurus', label: 'stegosaurus silhouette' },
  { key: 'triceratops', label: 'triceratops head' },
  { key: 'pterodactyl', label: 'pterodactyl flying' },
  { key: 'brachiosaurus', label: 'brachiosaurus silhouette' },
  { key: 'raptor', label: 'velociraptor head' },
  { key: 'ankylosaurus', label: 'ankylosaurus silhouette' },
  { key: 'parasaurolophus', label: 'parasaurolophus silhouette' },
  { key: 'spinosaurus', label: 'spinosaurus head' },
  { key: 'dilophosaurus', label: 'dilophosaurus head' },
  { key: 'egg', label: 'dinosaur egg' },
  { key: 'footprint', label: 'dinosaur footprint' },
  // New 12
  { key: 'allosaurus', label: 'allosaurus head' },
  { key: 'carnotaurus', label: 'carnotaurus head with horns' },
  { key: 'giganotosaurus', label: 'giganotosaurus head' },
  { key: 'pachycephalosaurus', label: 'pachycephalosaurus silhouette with dome head' },
  { key: 'ceratosaurus', label: 'ceratosaurus head with nasal horn' },
  { key: 'iguanodon', label: 'iguanodon silhouette with thumb spike' },
  { key: 'protoceratops', label: 'protoceratops head' },
  { key: 'therizinosaurus', label: 'therizinosaurus silhouette with long claws' },
  { key: 'mosasaurus', label: 'mosasaurus head (marine reptile)' },
  { key: 'archaeopteryx', label: 'archaeopteryx feathered silhouette' },
  { key: 'apatosaurus', label: 'apatosaurus long-neck silhouette' },
  { key: 'coelophysis', label: 'coelophysis slender silhouette' },
] : [
  // Original 12
  { key: 'elephant', label: 'Thai elephant' },
  { key: 'tuktuk', label: 'Bangkok tuk-tuk' },
  { key: 'boat', label: 'Thai longtail boat' },
  { key: 'lotus', label: 'lotus flower' },
  { key: 'chili', label: 'bird’s eye chili' },
  { key: 'mango', label: 'ripe mango' },
  { key: 'coconut', label: 'coconut half' },
  { key: 'durian', label: 'durian fruit' },
  { key: 'palm', label: 'palm tree' },
  { key: 'buddha', label: 'golden Buddha statue silhouette, respectful, simple' },
  { key: 'rooster', label: 'Thai fighting rooster (gamecock), proud stance, side profile' },
  // New 12 (match keys in main.js)
  { key: 'temple', label: 'Thai temple silhouette (wat)' },
  { key: 'khonmask', label: 'Thai khon mask silhouette' },
  { key: 'umbrella', label: 'Thai paper umbrella (Bo Sang style)' },
  { key: 'orchid', label: 'orchid flower' },
  { key: 'thaitea', label: 'Thai iced tea in glass' },
  { key: 'bananaleaf', label: 'banana leaf' },
  { key: 'sala', label: 'open Thai pavilion (sala) silhouette' },
  { key: 'krathong', label: 'Loi Krathong floating basket' },
  { key: 'naga', label: 'Thai serpent (naga) head silhouette' },
  { key: 'drum', label: 'traditional Thai drum silhouette' },
  { key: 'ricebowl', label: 'rice bowl with chopsticks' },
  { key: 'padthai', label: 'Pad Thai noodles with shrimp and peanuts' },
  { key: 'tomyum', label: 'Tom Yum soup bowl with herbs' },
  { key: 'somtam', label: 'Som Tam (green papaya) salad' },
  { key: 'mangostickyrice', label: 'Mango sticky rice dessert' },
  { key: 'padkrapao', label: 'Pad Krapao (Thai basil stir-fry)' },
];

const BASE_PROMPT = ({ label }) => {
  const PALETTE = getOpt('palette', 'color'); // 'color' | 'mono'
  const ALLOW_OFFICIAL_SYMBOLS = argv.includes('--allow-official-symbols');
  const palettePhrase = PALETTE === 'mono' ? 'monochrome (single-color)' : 'full-color';
  const compliance = (SET === 'thai' && !ALLOW_OFFICIAL_SYMBOLS)
    ? 'Do not depict any official Thai government emblems, seals, royal insignia, or other national symbols; use generic culturally-inspired motifs only.'
    : '';
  // Light sanitization of sensitive labels when generating Thai assets
  let safeLabel = label;
  if (SET === 'thai' && !ALLOW_OFFICIAL_SYMBOLS) {
    safeLabel = safeLabel
      .replace(/\b(emblem|seal|royal|monarch(y)?|king|queen|coat of arms|crest)\b/gi, 'motif');
  }
  return `A clean, glossy ${palettePhrase} vector-style icon of ${safeLabel}, simple bold shapes, high contrast, centered, no text, no border, crisp edges, suitable as a game tile pictogram. Flat art with subtle shading. ${compliance} Transparent background.`;
};

// CLI options
const argv = process.argv.slice(2);
const getOpt = (name, def) => {
  const pref = `--${name}=`;
  const a = argv.find(x => x.startsWith(pref));
  return a ? a.slice(pref.length) : def;
};
const SIZE = getOpt('size', '1024x1024'); // Supported: 1024x1024, 1024x1536, 1536x1024, auto
const CONCURRENCY = parseInt(getOpt('concurrency', '2'), 10) || 2;
const MAXPX = parseInt(getOpt('maxpx', '256'), 10) || 256; // Downscale max dimension
const NO_RESIZE = argv.includes('--no-resize');
const FORCE = argv.includes('--force');
// Spritesheet options
const SHEET_COLS = parseInt(getOpt('sheet-cols', '0'), 10) || 0;
const SHEET_ROWS = parseInt(getOpt('sheet-rows', '0'), 10) || 0;
const SHEET_NAME = getOpt('sheet-name', `${SET}_sheet_${SHEET_COLS}x${SHEET_ROWS}`);

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}
async function ensureBgDir() { await fs.mkdir(BG_DIR, { recursive: true }); }

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function callImagesAPI(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function generateOne(spec) {
  const outPath = path.join(OUT_DIR, `${spec.key}.png`);
  if (!FORCE && await exists(outPath)) {
    console.log('• skip (exists)', spec.key);
    return outPath;
  }
  const body = {
    model: 'gpt-image-1',
    prompt: BASE_PROMPT(spec),
    size: SIZE,
    background: 'transparent',
  };
  // Try modern endpoint first, then legacy generations endpoint to avoid 404s
  let res = await callImagesAPI('https://api.openai.com/v1/images', body);
  if (res.status === 404) {
    res = await callImagesAPI('https://api.openai.com/v1/images/generations', body);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error for ${spec.key}: ${res.status} ${res.statusText} - ${text}`);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image data for ${spec.key}`);
  const buf = Buffer.from(b64, 'base64');
  await fs.writeFile(outPath, buf);
  if (!NO_RESIZE) {
    await downscalePng(outPath, MAXPX).catch(err => {
      console.warn(`! Resize failed for ${spec.key}: ${err.message}`);
    });
  }
  return outPath;
}

async function withLimit(iterable, limit, worker) {
  const ret = [];
  const executing = new Set();
  for (const item of iterable) {
    const p = Promise.resolve().then(() => worker(item));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.allSettled(ret);
}

async function main() {
  await ensureOutDir();
  await ensureBgDir();
  console.log(`Set: ${SET}`);
  if (SHEET_COLS && SHEET_ROWS) {
    // Spritesheet mode: generate one sheet image containing N icons
    const sheetOut = path.join(OUT_DIR, `${SHEET_NAME}.png`);
    if (!FORCE && await exists(sheetOut)) {
      console.log('• sheet skip (exists)', path.relative(process.cwd(), sheetOut));
    } else {
      console.log(`Generating spritesheet ${SHEET_COLS}x${SHEET_ROWS} → ${path.relative(process.cwd(), sheetOut)}`);
      await generateSheet({ cols: SHEET_COLS, rows: SHEET_ROWS, outPath: sheetOut });
      if (!NO_RESIZE) await downscalePng(sheetOut, 2048).catch(()=>{});
    }
  } else {
    console.log(`Generating ${TILE_SPECS.length} tiles to ${OUT_DIR} (size=${SIZE}, concurrency=${CONCURRENCY}, maxpx=${NO_RESIZE ? 'none' : MAXPX}, palette=${getOpt('palette', 'color')}, official_symbols=${argv.includes('--allow-official-symbols') ? 'allowed' : 'disallowed'}) ...`);
    const results = await withLimit(TILE_SPECS, CONCURRENCY, async (spec) => {
      const file = await generateOne(spec);
      console.log('✓', spec.key, '→', path.relative(process.cwd(), file));
    });
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length) {
      console.error(`Failed: ${failures.length}`);
      failures.forEach(f => console.error(f.reason?.message || f.reason));
      process.exitCode = 2;
    } else {
      console.log('All tiles generated.');
    }
  }
  // Background
  const bgName = SET;
  const bgPath = path.join(BG_DIR, `${bgName}.png`);
  if (!FORCE && await exists(bgPath)) {
    console.log('• background skip (exists)', bgName);
  } else {
    console.log('Generating background to', path.relative(process.cwd(), bgPath));
    await generateBackground(bgName, bgPath);
    if (!NO_RESIZE) await downscalePng(bgPath, 1600).catch(()=>{});
  }
}

main().catch(err => { console.error(err); process.exit(1); });

async function which(cmd) {
  try {
    const r = await execFile(process.platform === 'win32' ? 'where' : 'which', [cmd]);
    return r.stdout.trim();
  } catch {
    return null;
  }
}

async function downscalePng(file, maxpx) {
  // Prefer macOS sips, fallback to ImageMagick
  const sipsPath = await which('sips');
  if (sipsPath) {
    await execFile('sips', ['-Z', String(maxpx), file]);
    return;
  }
  const magickPath = await which('magick');
  if (magickPath) {
    await execFile('magick', [file, '-resize', `${maxpx}x${maxpx}`, file]);
    return;
  }
  const convertPath = await which('convert');
  if (convertPath) {
    await execFile('convert', [file, '-resize', `${maxpx}x${maxpx}`, file]);
    return;
  }
  throw new Error('No resizer found (sips or ImageMagick). Use --no-resize or install one.');
}

async function generateBackground(name, outPath) {
  const prompt = (SET === 'dinosaur')
    ? 'A playful, soft-focus prehistoric jungle background, flat illustration, warm colors, depth, no text.'
    : `A tasteful Thai-inspired abstract background with soft shapes and gradients, ${getOpt('palette', 'color') === 'mono' ? 'monochrome palette' : 'warm night colors'}, subtle, no text. Do not depict any official Thai government emblems, royal insignia, or other national symbols.`;
  const body = { model: 'gpt-image-1', prompt, size: '1024x1024', background: 'transparent' };
  let res = await callImagesAPI('https://api.openai.com/v1/images', body);
  if (res.status === 404) res = await callImagesAPI('https://api.openai.com/v1/images/generations', body);
  if (!res.ok) throw new Error(`OpenAI background error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error('No background image data');
  const buf = Buffer.from(b64, 'base64');
  await fs.writeFile(outPath, buf);
}

async function generateSheet({ cols, rows, outPath }) {
  const total = cols * rows;
  const labelList = TILE_SPECS.slice(0, total).map(s => s.label);
  const orderText = labelList.length === total ? `Row-major order, left-to-right then top-to-bottom:
${labelList.map((l, i) => `${i+1}. ${l}`).join('\n')}` : '';
  const prompt = (SET === 'dinosaur')
    ? `Create a ${cols} by ${rows} grid of ${total} glossy vector-style dinosaur-themed game icons on a fully transparent background. Each icon must be centered in its own square cell; do not cross cell boundaries. Keep consistent style, bold shapes, subtle shading, no text or labels. ${orderText}`
    : `Create a ${cols} by ${rows} grid of ${total} glossy vector-style Thai-themed game icons on a fully transparent background. Each icon must be centered in its own square cell; do not cross cell boundaries. Keep consistent style, bold shapes, subtle shading, no text or labels. ${getOpt('palette', 'color') === 'mono' ? 'Use a monochrome palette.' : 'Use full color.'} Do not depict any official Thai government emblems, royal insignia, or other national symbols. ${orderText}`;
  const body = { model: 'gpt-image-1', prompt, size: '1024x1024', background: 'transparent' };
  let res = await callImagesAPI('https://api.openai.com/v1/images', body);
  if (res.status === 404) res = await callImagesAPI('https://api.openai.com/v1/images/generations', body);
  if (!res.ok) throw new Error(`OpenAI sheet error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error('No sheet image data');
  const buf = Buffer.from(b64, 'base64');
  await fs.writeFile(outPath, buf);
}
