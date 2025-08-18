#!/usr/bin/env node
/**
 * Generate simple placeholder SVGs for any missing tile keys.
 *
 * Creates stylized, colored polygons on glossy rounded-rect tiles
 * so the game has a non-broken fallback for all keys.
 *
 * Usage:
 *   node tools/generate_placeholder_svgs.mjs [--force] [--palette=color|mono]
 */

import fs from 'fs/promises';
import path from 'path';

const FORCE = process.argv.includes('--force');
const OUT_DIR = path.resolve(process.cwd(), 'assets/tiles');
const PALETTE = (process.argv.find(a => a.startsWith('--palette=')) || '--palette=color').split('=')[1];

// Keep keys in sync with main.js TILE_SETS
const TILE_KEYS = {
  thai: [
    'elephant','tuktuk','boat','lotus','chili','mango','coconut','durian','palm','buddha','rooster',
    'temple','khonmask','umbrella','orchid','thaitea','bananaleaf','sala','krathong','naga','drum','ricebowl',
    'padthai','tomyum','somtam','mangostickyrice','padkrapao'
  ],
  dinosaur: [
    'trex','stegosaurus','triceratops','pterodactyl','brachiosaurus','raptor','ankylosaurus','parasaurolophus','spinosaurus','dilophosaurus','egg','footprint',
    'allosaurus','carnotaurus','giganotosaurus','pachycephalosaurus','ceratosaurus','iguanodon','protoceratops','therizinosaurus','mosasaurus','archaeopteryx','apatosaurus','coelophysis'
  ]
};

// No restricted-keys metadata; sensitive terms removed from codebase.

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function polygonPoints(cx, cy, r, sides, rotDeg = -90) {
  const pts = [];
  const rot = rotDeg * Math.PI / 180;
  for (let i=0;i<sides;i++) {
    const a = rot + i * 2*Math.PI / sides;
    pts.push([cx + r*Math.cos(a), cy + r*Math.sin(a)]);
  }
  return pts.map(p => p.map(n => Math.round(n*10)/10).join(',')).join(' ');
}

function svgForKey(key) {
  const h = hashStr(key);
  const hue = h % 360;
  const sat = PALETTE === 'mono' ? 0 : 65 + (h % 20); // 0 for mono; else 65-84
  const light = 52; // base lightness
  const c1 = `hsl(${hue}, ${sat}%, ${light + 10}%)`;
  const c2 = `hsl(${hue}, ${sat}%, ${light - 8}%)`;
  const accentSat = PALETTE === 'mono' ? 0 : Math.min(95, sat + 10);
  const accent = `hsl(${(hue+20)%360}, ${accentSat}%, ${Math.max(30, light-18)}%)`;
  const sides = 3 + (h % 5); // 3..7
  const points = polygonPoints(128, 128, 70, sides);
  const id = 'g' + (h % 0xFFFFFF).toString(16).padStart(6,'0');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title>${key}</title>
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect x="20" y="20" width="216" height="216" rx="28" ry="28" fill="url(#${id}-bg)" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
  <g filter="url(#${id}-shadow)">
    <polygon points="${points}" fill="${accent}" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
  </g>
  <rect x="20" y="20" width="216" height="216" rx="28" ry="28" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
</svg>`;
}

async function main() {
  // Write placeholders into theme subfolders: assets/tiles/<theme>/<key>.svg
  let created = 0;
  for (const [theme, list] of Object.entries(TILE_KEYS)) {
    const themeDir = path.join(OUT_DIR, theme);
    await fs.mkdir(themeDir, { recursive: true });
    for (const key of list) {
      const out = path.join(themeDir, `${key}.svg`);
      if (!FORCE && await exists(out)) { continue; }
      const svg = svgForKey(key);
      await fs.writeFile(out, svg, 'utf8');
      created++;
    }
  }
  console.log(`SVG placeholders ${FORCE? 'written' : 'created if missing'}: ${created}`);
}

main().catch(err => { console.error(err); process.exit(1); });
