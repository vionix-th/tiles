/* vxThails - Vanilla JS */
(function () {
  const boardEl = document.getElementById('board');
  const timeEl = document.getElementById('time');
  const matchesEl = document.getElementById('matches');
  const remainingEl = document.getElementById('remaining');
  const levelEl = document.getElementById('level');
  const scoreEl = document.getElementById('score');
  const newGameBtn = document.getElementById('newGameBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const hintBtn = document.getElementById('hintBtn');
  const tilesetSelect = document.getElementById('tilesetSelect');
  const langSelect = document.getElementById('langSelect');
  const startLevelInput = document.getElementById('startLevelInput');
  const menuBtn = document.getElementById('menuBtn');
  const menuDialog = document.getElementById('menuDialog');
  const menuCloseBtn = document.getElementById('menuCloseBtn');
  const soundBtn = document.getElementById('soundBtn');
  const toastEl = document.getElementById('toast');
  const fxEl = document.getElementById('fx');
  const pageBgEl = document.getElementById('page-bg');

  // Board scale driven solely by auto-fit

  // Config (dynamic sizing per level)
  let ROWS = 8;        // interior rows (without outer boundary)
  let COLS = 12;       // interior cols (without outer boundary)
  // Tile sets
  const TILE_SETS = {
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
  function getParam(name, def) { const u=new URLSearchParams(location.search); return u.get(name) ?? def; }
  const currentTileSet = (getParam('tileset','thai') in TILE_SETS) ? getParam('tileset','thai') : 'thai';
  const TILE_KEYS = TILE_SETS[currentTileSet];
  // Load tiles from theme-specific subfolders
  const TILE_PNG = Object.fromEntries(TILE_KEYS.map(k => [k, `assets/tiles_png/${currentTileSet}/${k}.png`]));
  const TILE_SVG = Object.fromEntries(TILE_KEYS.map(k => [k, `assets/tiles/${currentTileSet}/${k}.svg`]));
  const TILE_FALLBACK = 'assets/tiles/placeholder.svg';


  // State
  let grid = [];         // (ROWS+2) x (COLS+2) grid including boundary
  let nodes = [];        // DOM cells for interior
  let selected = null;   // {r,c, el, type}
  let matches = 0;
  let remaining = 0;     // number of tiles left
  let startTs = 0;
  let timerHandle = null;
  let level = 1;
  let score = 0;
  let gameOver = false;
  let inTransition = false;

  // Scoring config
  const START_SCORE = 50;
  const SCORE_PER_MATCH = 4;
  const PENALTY_FAIL = 2;
  const PENALTY_SHUFFLE = 5;

  // Performance helpers
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function computeMoveMs() {
    const tiles = ROWS * COLS;
    let ms = 180;
    if (tiles >= 1600) ms = 110; // very large boards
    else if (tiles >= 800) ms = 140; // large boards
    if (prefersReducedMotion()) ms -= 50;
    return Math.max(90, ms);
  }

  // Utils
  const rand = (n) => Math.floor(Math.random()*n);
  const shuffle = (arr) => { for (let i=arr.length-1;i>0;i--){ const j=rand(i+1); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };

  function fmtTime(sec) {
    const m = Math.floor(sec/60), s = sec % 60;
    return `${m}:${s.toString().padStart(2,'0')}`;
  }

  function setBoardDims(r, c) {
    boardEl.style.setProperty('--rows', r);
    boardEl.style.setProperty('--cols', c);
    // Also set on root for inheritance fallback
    document.documentElement.style.setProperty('--rows', r);
    document.documentElement.style.setProperty('--cols', c);
  }

  // Simple SFX (Web Audio)
  const SFX = (() => {
    let ctx = null;
    let enabled = true;
    const saved = localStorage.getItem('sound');
    if (saved === 'off') enabled = false;

    function ensureCtx() {
      if (ctx || !enabled) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      return ctx;
    }
    function now() { return (ctx ? ctx.currentTime : 0); }
    function env(g, t0, a=0.005, d=0.12) {
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(g._level || 0.12, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    }
    function beep(freq=440, dur=0.12, type='sine', level=0.12, detune=0) {
      if (!enabled || !ensureCtx()) return;
      const t0 = now();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq; o.detune.value = detune;
      g._level = level;
      o.connect(g); g.connect(ctx.destination);
      env(g, t0, 0.004, dur);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }
    function sweep(f1, f2, dur=0.24, type='sine', level=0.12) {
      if (!enabled || !ensureCtx()) return;
      const t0 = now();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f1, t0); o.frequency.linearRampToValueAtTime(f2, t0 + dur);
      g._level = level; o.connect(g); g.connect(ctx.destination);
      env(g, t0, 0.006, dur * 0.9);
      o.start(t0); o.stop(t0 + dur + 0.03);
    }
    function chord(freqs=[440,550,660], dur=0.18, type='sine', level=0.09) {
      if (!enabled || !ensureCtx()) return;
      const t0 = now();
      const master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = type; o.frequency.value = f;
        g._level = level; o.connect(g); g.connect(master);
        const d = 0.004 + i*0.006; env(g, t0, d, dur*0.9);
        o.start(t0); o.stop(t0 + dur + 0.04);
      });
    }
    function play(name) {
      if (!enabled) return;
      switch (name) {
        case 'click': beep(700, 0.05, 'triangle', 0.06); break;
        case 'match': beep(660, 0.08, 'triangle', 0.08); setTimeout(()=>beep(880, 0.1, 'sine', 0.08), 70); break;
        case 'fail': sweep(300, 180, 0.16, 'sawtooth', 0.06); break;
        case 'shuffle': sweep(240, 420, 0.12, 'triangle', 0.06); sweep(420, 220, 0.18, 'sine', 0.05); break;
        case 'hint': beep(1200, 0.06, 'sine', 0.07); break;
        case 'victory': chord([523.25, 659.25, 783.99], 0.22, 'triangle', 0.08); setTimeout(()=>chord([659.25, 783.99, 987.77], 0.22, 'triangle', 0.07), 180); break;
        case 'defeat': sweep(320, 120, 0.4, 'sawtooth', 0.05); break;
      }
    }
    function setEnabled(v) {
      enabled = !!v;
      localStorage.setItem('sound', enabled ? 'on' : 'off');
      if (enabled) ensureCtx();
    }
    function toggle() { setEnabled(!enabled); return enabled; }
    return { play, toggle, setEnabled, get enabled(){ return enabled; }, ensureCtx };
  })();

  function sizeForLevel(lvl) {
    // Aspect-aware sizing: choose rows/cols from target area to fit wrapper ratio.
    // Orientation bias: portrait -> rows > cols; landscape -> cols > rows.
    const wrapper = document.getElementById('board-wrapper');
    const rect = wrapper?.getBoundingClientRect();
    const w = rect?.width || window.innerWidth || 1024;
    const h = rect?.height || window.innerHeight || 768;
    const ratio = w / Math.max(1, h);
    // Hysteresis buckets to avoid flapping near 1:1
    const smallPhone = Math.min(w, h) <= 420; // tighter caps on phones
    const longMax = smallPhone ? 10 : 14;
    const shortMax = smallPhone ? 7 : 10; // reduce short side to keep tiles usable
    const bucket = (ratio >= 1.15) ? 'landscape' : (ratio <= 0.85) ? 'portrait' : 'square';
    const caps = bucket === 'landscape'
      ? { minR: 4, minC: 4, maxR: shortMax, maxC: longMax }
      : bucket === 'portrait'
        ? { minR: 4, minC: 4, maxR: longMax, maxC: shortMax }
        : { minR: 4, minC: 4, maxR: 12, maxC: 12 }; // near-square -> balanced

    const steps = Math.max(0, Math.floor(lvl) - 1);
    const targetArea = (4 + steps) * (4 + steps); // preserve progression from 4x4

    // Ideal rows/cols approximating target area under current aspect ratio
    const idealRowsFloat = Math.sqrt(targetArea / ratio);
    let rows = Math.round(idealRowsFloat);
    rows = Math.max(caps.minR, Math.min(caps.maxR, rows));
    let cols = Math.ceil(targetArea / rows);
    cols = Math.max(caps.minC, Math.min(caps.maxC, cols));

    // Enforce orientation bias strictly when possible
    if (bucket === 'portrait' && rows <= cols) {
      rows = Math.min(caps.maxR, Math.max(rows, Math.min(caps.maxR, cols + 1)));
      cols = Math.max(caps.minC, Math.min(caps.maxC, Math.ceil(targetArea / Math.max(rows,1))));
    } else if (bucket === 'landscape' && cols <= rows) {
      cols = Math.min(caps.maxC, Math.max(cols, Math.min(caps.maxC, rows + 1)));
      rows = Math.max(caps.minR, Math.min(caps.maxR, Math.ceil(targetArea / Math.max(cols,1))));
    }

    // If still under target area due to caps, try adjusting the other dimension
    if (rows * cols < targetArea) {
      // try grow rows if possible
      if (rows < caps.maxR) rows = Math.min(caps.maxR, Math.ceil(targetArea / Math.max(cols, 1)));
      // recalc cols to match rows
      cols = Math.max(caps.minC, Math.min(caps.maxC, Math.ceil(targetArea / Math.max(rows, 1))));
    }

    // Enforce sane grid ratio (avoid extremely skinny grids)
    const gridRatio = cols / rows;
    const maxAllowedRatio = 2.4; // allow up to ~6x14 in portrait
    if (gridRatio > maxAllowedRatio && cols > caps.minC) {
      const reduce = Math.min(cols - caps.minC, Math.ceil(cols - 2 * rows));
      cols -= Math.max(0, reduce);
    } else if (gridRatio < 0.5 && rows > caps.minR) {
      const reduce = Math.min(rows - caps.minR, Math.ceil(rows - 2 * cols));
      rows -= Math.max(0, reduce);
    }

    // Final orientation guarantee (best-effort within caps)
    if (bucket === 'portrait' && rows <= cols) {
      if (rows < caps.maxR) rows = Math.min(caps.maxR, cols + 1);
      else if (cols > caps.minC) cols = Math.max(caps.minC, rows - 1);
    } else if (bucket === 'landscape' && cols <= rows) {
      if (cols < caps.maxC) cols = Math.min(caps.maxC, rows + 1);
      else if (rows > caps.minR) rows = Math.max(caps.minR, cols - 1);
    }

    return { rows, cols };
  }

  function adjustTileScale() {
    const wrapper = document.getElementById('board-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const csRoot = getComputedStyle(document.documentElement);
    const defaultGap = parseFloat(csRoot.getPropertyValue('--tile-gap')) || 10;
    const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    // Dimension/input-driven minimums (no UA sniffing)
    const minTile = isCoarse ? 42 : 28; // larger tap targets on coarse pointers
    const maxTile = 120;

    // Reduce gap for larger boards (down to ~2px as boards get huge)
    const maxSide = Math.max(ROWS, COLS);
    const gap = Math.max(1, Math.min(defaultGap, Math.round(defaultGap - (maxSide - 5) / (50 - 5) * 6)));
    document.documentElement.style.setProperty('--tile-gap', gap + 'px');

    const wAvail = rect.width;
    const hAvail = rect.height;

    // Compute ideal tile size that fits without scaling
    const fitTile = Math.floor(Math.min(
      (wAvail - gap * (COLS + 1)) / COLS,
      (hAvail - gap * (ROWS + 1)) / ROWS
    ));

    // Start from clamped size
    let tileSize = Math.max(minTile, Math.min(maxTile, fitTile));
    document.documentElement.style.setProperty('--tile-size', tileSize + 'px');

    // Compute content size at this tile size to check overflow
    const needW = tileSize * COLS + gap * (COLS + 1);
    const needH = tileSize * ROWS + gap * (ROWS + 1);
    let scale = 1;
    if (needW > wAvail || needH > hAvail) {
      // If even the minimum tile overflows, fall back to uniform board scale
      // Keep at least the minimum tile px for legibility; scale board visually to fit
      if (tileSize > minTile) {
        // try smaller tile down to min
        tileSize = minTile;
        document.documentElement.style.setProperty('--tile-size', tileSize + 'px');
      }
      const minNeedW = tileSize * COLS + gap * (COLS + 1);
      const minNeedH = tileSize * ROWS + gap * (ROWS + 1);
      scale = Math.min(wAvail / Math.max(1, minNeedW), hAvail / Math.max(1, minNeedH), 1);
    }
    document.documentElement.style.setProperty('--board-scale', String(scale));

    // Adjust tilt slightly when vertical space is tight to save height
    const targetTilt = (hAvail < 520) ? 22 : (hAvail < 640) ? 26 : 30;
    document.documentElement.style.setProperty('--board-rotate-x', targetTilt + 'deg');
  }

  function makePairs(pairCount) {
    // Choose a random subset of tile types for this game.
    // If we need more pairs than unique keys, cycle through shuffled keys.
    const keysShuffled = shuffle([...TILE_KEYS]);
    const needed = pairCount;
    const types = [];
    while (types.length < needed) {
      const batch = types.length === 0 ? keysShuffled : shuffle([...TILE_KEYS]);
      for (const k of batch) {
        types.push(k);
        if (types.length >= needed) break;
      }
    }
    const pairs = [];
    for (const t of types.slice(0, needed)) pairs.push(t, t);
    return pairs;
  }

  function createGrid() {
    // Allocate grid with boundary zeros
    grid = Array.from({length: ROWS+2}, () => Array.from({length: COLS+2}, () => 0));
    const interiorCount = ROWS * COLS;
    // Fill as many tiles as the raster allows (leave one empty for odd cell counts)
    let pairsTarget = Math.floor(interiorCount / 2);
    const symbols = shuffle(makePairs(pairsTarget));
    remaining = pairsTarget * 2;
    matches = 0;
    updateStats();

    // Choose random interior positions and place symbols; rest remain empty
    const positions = [];
    for (let r=1; r<=ROWS; r++) for (let c=1; c<=COLS; c++) positions.push([r,c]);
    shuffle(positions);
    for (let i=0; i<symbols.length; i++) {
      const [r,c] = positions[i];
      grid[r][c] = symbols[i];
    }
  }

  function renderGrid() {
    boardEl.innerHTML = '';
    setBoardDims(ROWS, COLS);
    nodes = Array.from({length: ROWS}, () => Array.from({length: COLS}, () => null));

    const frag = document.createDocumentFragment();
    for (let r=1; r<=ROWS; r++) {
      for (let c=1; c<=COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (grid[r][c] !== 0) {
          const tile = document.createElement('button');
          tile.type = 'button';
          tile.className = 'tile';
          tile.dataset.type = grid[r][c];
          tile.setAttribute('aria-label', `Tile ${grid[r][c]}`);
          cell.removeAttribute('aria-hidden');
          const img = document.createElement('img');
          img.alt = grid[r][c];
          img.draggable = false;
          img.decoding = 'async';
          img.src = TILE_PNG[grid[r][c]] || TILE_SVG[grid[r][c]] || TILE_FALLBACK;
          img.onerror = () => {
            if (img.src.endsWith('.png') && TILE_SVG[grid[r][c]]) { img.src = TILE_SVG[grid[r][c]]; return; }
            img.src = TILE_FALLBACK; img.onerror = null;
          };
          tile.appendChild(img);
          cell.appendChild(tile);
        } else {
          cell.setAttribute('aria-hidden', 'true');
        }
        nodes[r-1][c-1] = cell;
        frag.appendChild(cell);
      }
    }
    boardEl.appendChild(frag);
    // Recompute tile size once DOM is updated
    adjustTileScale();
  }

  function onTileClickEl(tileEl) {
    if (gameOver || inTransition) return;
    const r = +tileEl.parentElement.dataset.r;
    const c = +tileEl.parentElement.dataset.c;
    const type = grid[r][c];

    if (!type) return;

    if (!selected) {
      selected = { r, c, type, el: tileEl };
      tileEl.classList.add('selected');
      dimNonMatching(type);
      SFX.play('click');
      return;
    }

    // Clicking the same tile deselects
    if (selected.r === r && selected.c === c) {
      clearSelection();
      return;
    }

    if (type !== selected.type) {
      pulse(tileEl, 'danger');
      pulse(selected.el, 'danger');
      animateOnce(tileEl, 'anim-fail', 280);
      animateOnce(selected.el, 'anim-fail', 280);
      SFX.play('fail');
      adjustScore(-PENALTY_FAIL);
      clearSelection();
      return;
    }

    const path = findPath([selected.r, selected.c], [r, c]);
    if (path) {
      animateOnce(tileEl, 'anim-success', 240);
      animateOnce(selected.el, 'anim-success', 240);
      SFX.play('match');
      removeTiles([selected.r, selected.c], [r, c]);
      matches++;
      adjustScore(SCORE_PER_MATCH);
      remaining -= 2;
      updateStats();
      clearSelection();
      // After removal, animate directly to final positions (gravity + compaction in one pass)
      setTimeout(() => {
        inTransition = true;
        animateShiftToFinal().then(() => { inTransition = false; ensureSolvableIfLocked(); checkWin(); });
      }, 340);
    } else {
      // Not connectable within 2 turns
      pulse(tileEl, 'warn');
      pulse(selected.el, 'warn');
      adjustScore(-PENALTY_FAIL);
      clearSelection();
    }
  }

  // Event delegation: single click listener on board
  boardEl.addEventListener('click', (e) => {
    const tileEl = e.target && e.target.closest && e.target.closest('.tile');
    if (!tileEl || !boardEl.contains(tileEl)) return;
    onTileClickEl(tileEl);
  });

  function dimNonMatching(type) {
    document.querySelectorAll('.tile').forEach(el => {
      if (el.dataset.type !== type) el.classList.add('dim');
    });
  }
  function undimAll() { document.querySelectorAll('.tile.dim').forEach(el => el.classList.remove('dim')); }

  function clearSelection() {
    if (selected) selected.el.classList.remove('selected');
    selected = null;
    undimAll();
  }

  function pulse(el, kind) {
    const color = kind === 'danger' ? '#ff6b6b' : kind === 'warn' ? '#ffb84d' : '#6bd6ff';
    el.style.boxShadow = `0 0 0 3px ${color} inset, 0 16px 24px rgba(0,0,0,0.35)`;
    setTimeout(() => { el.style.boxShadow = ''; }, 180);
  }

  function removeTiles(p1, p2) {
    const [r1,c1] = p1, [r2,c2] = p2;
    grid[r1][c1] = 0;
    grid[r2][c2] = 0;
    const n1 = nodes[r1-1][c1-1].querySelector('.tile');
    const n2 = nodes[r2-1][c2-1].querySelector('.tile');
    if (n1) n1.classList.add('matched');
    if (n2) n2.classList.add('matched');
    // remove from DOM shortly after animation
    setTimeout(() => {
      if (n1?.parentElement) { n1.parentElement.innerHTML = ''; n1.parentElement.setAttribute('aria-hidden','true'); }
      if (n2?.parentElement) { n2.parentElement.innerHTML = ''; n2.parentElement.setAttribute('aria-hidden','true'); }
    }, 320);
  }

  // Compute final mapping after gravity and horizontal compaction, then animate in one pass
  function animateShiftToFinal() {
    if (prefersReducedMotion()) {
      applyGravityInPlace();
      applyHorizontalCompactionInPlace();
      renderGrid();
      return Promise.resolve();
    }
    const mapping = computeFinalMapping();
    const moves = mapping.filter(m => m.destR !== m.src.r || m.destC !== m.src.c);
    if (moves.length === 0) return Promise.resolve();
    // Determine step sizes from CSS variables (tile-size + gap)
    const cs = getComputedStyle(document.documentElement);
    const tileSize = parseFloat(cs.getPropertyValue('--tile-size')) || 64;
    const gap = parseFloat(cs.getPropertyValue('--tile-gap')) || 10;
    const stepX = tileSize + gap;
    const stepY = tileSize + gap;
    const MOVE_MS = computeMoveMs();
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        moves.forEach(m => {
          const el = nodes[m.src.r-1]?.[m.src.c-1]?.querySelector('.tile');
          if (!el) return;
          const dx = (m.destC - m.src.c) * stepX;
          const dy = (m.destR - m.src.r) * stepY;
          el.style.transition = `transform ${MOVE_MS}ms ease`;
          el.style.transform = `translate3d(${dx}px, ${dy}px, 10px)`;
          el.style.pointerEvents = 'none';
        });
      });
      setTimeout(() => {
        // Build final grid from mapping
        const newGrid = Array.from({length: ROWS+2}, () => Array.from({length: COLS+2}, () => 0));
        mapping.forEach(m => { newGrid[m.destR][m.destC] = grid[m.src.r][m.src.c]; });
        grid = newGrid;
        renderGrid();
        resolve();
      }, MOVE_MS + 20);
    });
  }

  function computeFinalMapping() {
    // Collect all current tiles
    const items = [];
    for (let r=1; r<=ROWS; r++) for (let c=1; c<=COLS; c++) if (grid[r][c] !== 0) items.push({ r, c });
    // Apply gravity mapping per column (bottom fill)
    const afterGrav = [];
    for (let c=1; c<=COLS; c++) {
      const col = items.filter(it => it.c === c).sort((a,b)=> b.r - a.r);
      let write = ROWS;
      for (const it of col) { afterGrav.push({ src: it, r: write, c }); write--; }
    }
    // Apply horizontal compaction per row (left fill)
    const mapping = [];
    for (let r=1; r<=ROWS; r++) {
      const row = afterGrav.filter(it => it.r === r).sort((a,b)=> a.c - b.c);
      let write = 1;
      for (const it of row) { mapping.push({ src: it.src, destR: r, destC: write }); write++; }
    }
    return mapping;
  }
  function applyGravityInPlace() {
    for (let c = 1; c <= COLS; c++) {
      let write = ROWS;
      for (let r = ROWS; r >= 1; r--) {
        if (grid[r][c] !== 0) {
          if (r !== write) {
            grid[write][c] = grid[r][c];
            grid[r][c] = 0;
          }
          write--;
        }
      }
    }
  }

  function applyHorizontalCompactionInPlace() {
    for (let r = 1; r <= ROWS; r++) {
      let write = 1;
      for (let c = 1; c <= COLS; c++) {
        if (grid[r][c] !== 0) {
          if (c !== write) {
            grid[r][write] = grid[r][c];
            grid[r][c] = 0;
          }
          write++;
        }
      }
    }
  }

  function updateStats() {
    matchesEl.textContent = String(matches);
    remainingEl.textContent = String(remaining);
    levelEl.textContent = String(level);
    scoreEl.textContent = String(score);
  }

  function startTimer() {
    clearInterval(timerHandle);
    startTs = Date.now();
    timeEl.textContent = '0:00';
    timerHandle = setInterval(() => {
      const sec = Math.floor((Date.now()-startTs)/1000);
      timeEl.textContent = fmtTime(sec);
    }, 1000);
  }

  function stopTimer() { clearInterval(timerHandle); timerHandle = null; }

  // Pathfinding helpers
  function isEmpty(r, c, a, b) {
    // cell considered empty if 0 or it's one of endpoints a/b
    const isEndpoint = (r === a[0] && c === a[1]) || (r === b[0] && c === b[1]);
    return isEndpoint || grid[r][c] === 0;
  }

  function isClearRow(r, c1, c2, a, b) {
    const [lo, hi] = c1 <= c2 ? [c1, c2] : [c2, c1];
    for (let c = lo + 1; c < hi; c++) {
      if (!isEmpty(r, c, a, b)) return false;
    }
    return true;
  }

  function isClearCol(c, r1, r2, a, b) {
    const [lo, hi] = r1 <= r2 ? [r1, r2] : [r2, r1];
    for (let r = lo + 1; r < hi; r++) {
      if (!isEmpty(r, c, a, b)) return false;
    }
    return true;
  }

  function findPath(a, b) {
    const [r1,c1] = a, [r2,c2] = b;
    if (grid[r1][c1] === 0 || grid[r2][c2] === 0) return null;
    if (grid[r1][c1] !== grid[r2][c2]) return null;

    // 0-turn (same row/col)
    if (r1 === r2 && isClearRow(r1, c1, c2, a, b)) {
      return [[r1,c1],[r1,c2]];
    }
    if (c1 === c2 && isClearCol(c1, r1, r2, a, b)) {
      return [[r1,c1],[r2,c1]];
    }

    // 1-turn (L shape): pivots at (r1,c2) or (r2,c1)
    if (isEmpty(r1, c2, a, b) && isClearRow(r1, c1, c2, a, b) && isClearCol(c2, r1, r2, a, b)) {
      return [[r1,c1],[r1,c2],[r2,c2]];
    }
    if (isEmpty(r2, c1, a, b) && isClearCol(c1, r1, r2, a, b) && isClearRow(r2, c1, c2, a, b)) {
      return [[r1,c1],[r2,c1],[r2,c2]];
    }

    // 2-turn: scan rows
    for (let r=0; r<ROWS+2; r++) {
      if (!isEmpty(r, c1, a, b) || !isEmpty(r, c2, a, b)) continue;
      if (!isClearCol(c1, r, r1, a, b)) continue;
      if (!isClearRow(r, c1, c2, a, b)) continue;
      if (!isClearCol(c2, r, r2, a, b)) continue;
      return [[r1,c1],[r,c1],[r,c2],[r2,c2]];
    }
    // 2-turn: scan cols
    for (let c=0; c<COLS+2; c++) {
      if (!isEmpty(r1, c, a, b) || !isEmpty(r2, c, a, b)) continue;
      if (!isClearRow(r1, c, c1, a, b)) continue;
      if (!isClearCol(c, r1, r2, a, b)) continue;
      if (!isClearRow(r2, c, c2, a, b)) continue;
      return [[r1,c1],[r1,c],[r2,c],[r2,c2]];
    }
    return null;
  }

  // Connection path drawing removed

  // I18N
  const I18N = {
    th: {
      title: 'vxThails', new_game: 'เริ่มใหม่', shuffle: 'สับไทล์', hint: 'คำใบ้',
      level: 'ด่าน', score: 'คะแนน', time: 'เวลา', matches: 'จับคู่', remaining: 'คงเหลือ',
      start_level: 'ด่านเริ่มต้น',
      menu: 'เมนู', menu_title: 'เมนูเกม',
      tip: 'เคล็ดลับ: เชื่อมไทล์ที่เหมือนกันโดยหักเลี้ยวได้ไม่เกิน 2 ครั้ง',
      tileset_label: 'ชุดไทล์', tileset_thai: 'ไทย', tileset_dino: 'ไดโนเสาร์', language_label: 'ภาษา',
      level_cleared: (n)=>`ผ่านด่าน ${n} แล้ว!`, game_over: 'จบเกม — คะแนนเหลือ 0 เริ่มใหม่เพื่อเล่นอีกครั้ง.',
      auto_shuffle: 'ไม่มีทางเดิน — สับไทล์อัตโนมัติ',
      close: 'ปิด'
    },
    en: {
      title: 'vxThails', new_game: 'New Game', shuffle: 'Shuffle', hint: 'Hint',
      level: 'Level', score: 'Score', time: 'Time', matches: 'Matches', remaining: 'Remaining',
      start_level: 'Start level',
      menu: 'Menu', menu_title: 'Game Menu',
      tip: 'Tip: Connect matching tiles with up to 2 turns.',
      tileset_label: 'Tile set', tileset_thai: 'Thai', tileset_dino: 'Dinosaur', language_label: 'Language',
      level_cleared: (n)=>`Level ${n} cleared!`, game_over: 'Game Over — Score reached 0. New Game to retry.',
      auto_shuffle: 'No moves — auto-shuffled',
      close: 'Close'
    }
  };
  const lang = (getParam('lang','th') === 'en') ? 'en' : 'th';
  function applyI18n() {
    const dict = I18N[lang];
    document.querySelectorAll('[data-i18n]').forEach(node => {
      const key = node.getAttribute('data-i18n');
      if (!key) return;
      const val = dict[key];
      if (typeof val === 'string') node.textContent = val;
    });
    // Attributes and document title
    document.title = dict.title;
    // reset view control removed
    if (tilesetSelect) tilesetSelect.setAttribute('aria-label', dict.tileset_label);
    if (langSelect) langSelect.setAttribute('aria-label', dict.language_label);
    if (soundBtn) {
      soundBtn.title = SFX.enabled ? (lang==='th'?'เปิดเสียง':'Sound on') : (lang==='th'?'ปิดเสียง':'Sound off');
    }
  }

  // Controls
  newGameBtn.addEventListener('click', () => { closeMenu(); init(); });
  shuffleBtn.addEventListener('click', doShuffle);
  hintBtn.addEventListener('click', doHint);
  // reset zoom control removed
  if (soundBtn) {
    const applyIcon = () => {
      soundBtn.textContent = SFX.enabled ? '🔊' : '🔇';
      soundBtn.setAttribute('aria-pressed', String(SFX.enabled));
      soundBtn.title = SFX.enabled ? (lang==='th'?'เปิดเสียง':'Sound on') : (lang==='th'?'ปิดเสียง':'Sound off');
    };
    applyIcon();
    soundBtn.addEventListener('click', () => { SFX.toggle(); applyIcon(); });
    ['pointerdown','keydown','touchstart'].forEach(evt => {
      window.addEventListener(evt, () => { if (SFX.enabled) SFX.ensureCtx(); }, { once: true, passive: true });
    });
  }

  // Menu dialog
  function openMenu() { if (menuDialog) menuDialog.setAttribute('aria-hidden', 'false'); }
  function closeMenu() { if (menuDialog) menuDialog.setAttribute('aria-hidden', 'true'); }
  if (menuBtn) menuBtn.addEventListener('click', openMenu);
  if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenu);
  const menuCloseTextBtn = document.getElementById('menuCloseTextBtn');
  if (menuCloseTextBtn) menuCloseTextBtn.addEventListener('click', closeMenu);
  // backdrop click
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t instanceof HTMLElement && t.classList.contains('dialog-backdrop')) closeMenu();
  });
  // escape key
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  // Dropdowns (reload with updated query)
  if (tilesetSelect) {
    tilesetSelect.value = currentTileSet;
    tilesetSelect.addEventListener('change', () => {
      const params = new URLSearchParams(location.search);
      params.set('tileset', tilesetSelect.value);
      location.search = params.toString();
    });
  }
  if (langSelect) {
    langSelect.value = lang;
    langSelect.addEventListener('change', () => {
      const params = new URLSearchParams(location.search);
      params.set('lang', langSelect.value);
      location.search = params.toString();
    });
  }

  // Mid-game re-evaluation on resize (debounced)
  let _resizeDebounce = null;
  window.addEventListener('resize', () => {
    if (_resizeDebounce) clearTimeout(_resizeDebounce);
    _resizeDebounce = setTimeout(() => { reEvaluateLayout(); }, 200);
  });

  // Zoom gestures removed; rely on auto-fit only

  function doShuffle() {
    if (gameOver || inTransition) return;
    shuffleBoard({ penalize: true, playSound: true });
  }

  function doHint() {
    if (gameOver || inTransition) return;
    const pair = findAnyMatch();
    if (!pair) return;
    SFX.play('hint');
    const [[r1,c1],[r2,c2]] = pair;
    const t1 = nodes[r1-1][c1-1].querySelector('.tile');
    const t2 = nodes[r2-1][c2-1].querySelector('.tile');
    t1?.classList.add('selected');
    t2?.classList.add('selected');
    setTimeout(() => { t1?.classList.remove('selected'); t2?.classList.remove('selected'); }, 500);
  }

  function findAnyMatch() {
    // Scan for any connectable pair by symbol
    const posBySym = new Map();
    for (let r=1;r<=ROWS;r++) {
      for (let c=1;c<=COLS;c++) {
        const sym = grid[r][c];
        if (!sym) continue;
        if (!posBySym.has(sym)) posBySym.set(sym, []);
        posBySym.get(sym).push([r,c]);
      }
    }
    for (const [sym, list] of posBySym) {
      for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++) {
        const a = list[i], b = list[j];
        const path = findPath(a, b);
        if (path) return [a,b];
      }
    }
    return null;
  }

  function checkWin() {
    if (remaining === 0) {
      stopTimer();
      inTransition = true;
      showToast(I18N[lang].level_cleared(level), 'good');
      SFX.play('victory');
      playVictory(() => { inTransition = false; nextLevel(); });
    }
  }

  function shuffleBoard(opts = {}) {
    const penalize = !!opts.penalize;
    const playSound = opts.playSound !== false;
    // collect all symbols currently on board
    const syms = [];
    for (let r=1;r<=ROWS;r++) for (let c=1;c<=COLS;c++) if (grid[r][c]) syms.push(grid[r][c]);
    shuffle(syms);
    let i=0;
    for (let r=1;r<=ROWS;r++) for (let c=1;c<=COLS;c++) if (grid[r][c]) grid[r][c] = syms[i++];
    renderGrid();
    clearSelection();
    if (playSound) SFX.play('shuffle');
    if (penalize) adjustScore(-PENALTY_SHUFFLE);
  }

  function ensureSolvableIfLocked() {
    if (remaining <= 0) return; // nothing to solve
    if (findAnyMatch()) return; // already solvable
    // Try a limited number of shuffles to find a solvable layout.
    let tries = 0;
    let solvable = false;
    while (tries < 25) {
      shuffleBoard({ penalize: false, playSound: tries === 0 });
      tries++;
      if (findAnyMatch()) { solvable = true; break; }
    }
    if (solvable) {
      showToast(I18N[lang].auto_shuffle || (lang==='th'?'ไม่มีทางเดิน — สับไทล์อัตโนมัติ':'No moves — auto-shuffled'), 'info', 900);
    }
  }

  // Manual rotate disabled: board uses fixed tilt only.

  function init() {
    // New Game resets level and score
    const startLv = parseInt(startLevelInput?.value || '1', 10);
    level = Number.isFinite(startLv) && startLv >= 1 ? startLv : 1;
    score = START_SCORE;
    gameOver = false;
    inTransition = false;
    document.body.classList.remove('victory','defeat');
    fxEl && (fxEl.innerHTML = '');
    const s = sizeForLevel(level);
    ROWS = s.rows; COLS = s.cols;
    setBoardDims(ROWS, COLS);
    applyI18n();
    applyBackground(currentTileSet);
    adjustTileScale();
    // fixed tilt; no manual reset
    createGrid();
    renderGrid();
    ensureSolvableIfLocked();
    clearSelection();
    updateStats();
    startTimer();
  }

  // resetView removed (fixed tilt)

  function nextLevel() {
    level += 1;
    const s = sizeForLevel(level);
    ROWS = s.rows; COLS = s.cols;
    setBoardDims(ROWS, COLS);
    // Regenerate icons if desired (kept same size for performance)
    adjustTileScale();
    // fixed tilt; no manual reset
    createGrid();
    renderGrid();
    clearSelection();
    updateStats();
    startTimer();
  }

  // Re-evaluate orientation caps mid-game and adapt board for current level.
  function reEvaluateLayout() {
    const s = sizeForLevel(level);
    const changed = (s.rows !== ROWS) || (s.cols !== COLS);
    ROWS = s.rows; COLS = s.cols;
    setBoardDims(ROWS, COLS);
    adjustTileScale();
    if (changed) {
      // Regenerate current level grid to fit new dimensions; keep level, score, and timer.
      createGrid();
      renderGrid();
      clearSelection();
      updateStats();
      ensureSolvableIfLocked();
    }
  }

  function adjustScore(delta) {
    score += delta;
    if (score < 0) score = 0;
    updateStats();
    if (score === 0) {
      onLose();
    }
  }

  function onLose() {
    if (gameOver) return;
    gameOver = true;
    stopTimer();
    playDefeat();
    SFX.play('defeat');
    showToast(I18N[lang].game_over, 'danger', 2500);
  }

  function showToast(msg, kind = 'info', ms = 1200) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    // Color hint via gradient edge
    const color = kind === 'good' ? 'var(--good)' : kind === 'danger' ? 'var(--danger)' : kind === 'accent';
    toastEl.style.boxShadow = `0 8px 18px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.12), 0 0 0 2px ${color}`;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> { toastEl.classList.remove('show'); }, ms);
  }

  // bootstrap
  // Resize handling to keep tiles fitting wrapper; also observe wrapper size
  window.addEventListener('resize', () => { adjustTileScale(); });
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => adjustTileScale());
    ro.observe(document.getElementById('board-wrapper'));
  }
  init();

  // Animations helpers
  function animateOnce(el, cls, ms) {
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms || 250);
  }

  function playVictory(done) {
    document.body.classList.add('victory');
    // Confetti burst
    spawnConfetti(80, 1400);
    setTimeout(() => {
      document.body.classList.remove('victory');
      done && done();
    }, 1100);
  }

  function playDefeat() {
    document.body.classList.add('defeat');
    // Clear after a short period; keep class until new game for visual feedback
    setTimeout(() => {}, 800);
  }

  function spawnConfetti(count, duration) {
    if (!fxEl) return;
    fxEl.innerHTML = '';
    const colors = ['#ff6b6b','#ffd93d','#6bd6ff','#9f7bff','#57e39f'];
    const tilesCount = ROWS * COLS;
    const reduceMotion = prefersReducedMotion();
    const base = Math.max(20, Math.min(count, Math.floor(count * (600 / Math.max(600, tilesCount)))));
    const scaledCount = reduceMotion ? Math.floor(base * 0.5) : base;
    for (let i=0;i<scaledCount;i++) {
      const d = document.createElement('div');
      d.className = 'confetti';
      const left = Math.random()*100;
      const delay = Math.random()*0.2;
      const dur = reduceMotion ? Math.max(0.8, 0.8 * (duration/1000)) : (duration/1000);
      const time = (0.9 + Math.random()*0.6) * dur;
      const color = colors[i % colors.length];
      d.style.left = left + '%';
      d.style.top = (-10 - Math.random()*20) + 'px';
      d.style.background = color;
      d.style.animationDuration = time + 's';
      d.style.animationDelay = delay + 's';
      fxEl.appendChild(d);
    }
    const endDur = (reduceMotion ? Math.floor(duration * 0.8) : duration) + 400;
    setTimeout(() => { fxEl.innerHTML = ''; }, endDur);
  }

  function applyBackground(theme) {
    const key = theme || 'thai';
    const png = `assets/backgrounds_png/${key}.png`;
    const svg = `assets/backgrounds/${key}.svg`;
    if (!pageBgEl) return;
    pageBgEl.style.backgroundImage = `url('${png}')`;
    const test = new Image();
    test.onerror = () => { pageBgEl.style.backgroundImage = `url('${svg}')`; };
    test.src = png;
  }
})();
