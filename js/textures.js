// Procedural 16x16-per-tile texture atlas, drawn on a canvas — no image assets.
MC.buildAtlas = function () {
  const TS = 16, COLS = 16;
  const canvas = document.createElement('canvas');
  canvas.width = TS * COLS; canvas.height = TS * COLS;
  const ctx = canvas.getContext('2d');

  // deterministic rng so the atlas looks the same every load
  let rngState = 987654321;
  const rnd = () => {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 4294967296;
  };
  const pick = arr => arr[(rnd() * arr.length) | 0];

  function at(tile) { return [(tile % COLS) * TS, ((tile / COLS) | 0) * TS]; }
  function px(ox, oy, x, y, c) { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1); }
  function fill(ox, oy, c) { ctx.fillStyle = c; ctx.fillRect(ox, oy, TS, TS); }
  function speckle(tile, palette) {
    const [ox, oy] = at(tile);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) px(ox, oy, x, y, pick(palette));
    return [ox, oy];
  }
  function clearTile(tile) { const [ox, oy] = at(tile); ctx.clearRect(ox, oy, TS, TS); return [ox, oy]; }

  const T = MC.T;

  // --- ground ---
  speckle(T.GRASS_TOP, ['#7cbd47', '#6aab3c', '#8fce56', '#5f9e34', '#74b542']);
  speckle(T.DIRT, ['#8a5a3b', '#7a4f34', '#96653f', '#6f4730', '#835538']);
  { // grass side: dirt with a jagged green fringe
    const [ox, oy] = speckle(T.GRASS_SIDE, ['#8a5a3b', '#7a4f34', '#96653f', '#6f4730']);
    for (let x = 0; x < TS; x++) {
      const depth = 2 + (rnd() < 0.5 ? 1 : 0) + (rnd() < 0.25 ? 1 : 0);
      for (let y = 0; y < depth; y++) px(ox, oy, x, y, pick(['#7cbd47', '#6aab3c', '#8fce56']));
    }
  }
  { // snowy grass side
    const [ox, oy] = speckle(T.GRASS_SIDE_SNOW, ['#8a5a3b', '#7a4f34', '#96653f', '#6f4730']);
    for (let x = 0; x < TS; x++) {
      const depth = 2 + (rnd() < 0.5 ? 1 : 0);
      for (let y = 0; y < depth; y++) px(ox, oy, x, y, pick(['#f4f8fb', '#e9eff5', '#ffffff']));
    }
  }
  speckle(T.STONE, ['#8e8e8e', '#7d7d7d', '#999999', '#858585', '#909090']);
  { // cobble: dark grout + stone lumps
    const [ox, oy] = speckle(T.COBBLE, ['#4f4f4f', '#585858', '#464646']);
    for (let i = 0; i < 7; i++) {
      const sx = (rnd() * 13) | 0, sy = (rnd() * 13) | 0;
      const w = 3 + ((rnd() * 3) | 0), h = 3 + ((rnd() * 3) | 0);
      const base = pick(['#8b8b8b', '#7e7e7e', '#969696']);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (sx + x >= TS || sy + y >= TS) continue;
        const edge = x === 0 || y === h - 1;
        px(ox, oy, sx + x, sy + y, edge ? '#5e5e5e' : (y === 0 ? '#a5a5a5' : base));
      }
    }
  }
  speckle(T.BEDROCK, ['#333333', '#222222', '#454545', '#111111', '#565656']);
  speckle(T.SAND, ['#e7dca8', '#dbcf9a', '#efe6b8', '#d1c48e', '#e2d5a2']);
  speckle(T.GRAVEL, ['#7f7a75', '#6e6862', '#8d8781', '#5f5a55', '#9a948d', '#767066']);
  speckle(T.SNOW, ['#f4f8fb', '#e9eff5', '#ffffff', '#eef4f9']);

  // --- wood ---
  { // oak log side: vertical bark strips
    const [ox, oy] = at(T.LOG_SIDE);
    for (let x = 0; x < TS; x++) {
      const col = pick(['#6b4f2a', '#5d4423', '#75582f', '#654a27']);
      for (let y = 0; y < TS; y++) px(ox, oy, x, y, rnd() < 0.12 ? '#4a3419' : col);
    }
  }
  { // spruce log side: darker
    const [ox, oy] = at(T.LOG_SPRUCE);
    for (let x = 0; x < TS; x++) {
      const col = pick(['#4a3620', '#3f2e1b', '#544025', '#452f1c']);
      for (let y = 0; y < TS; y++) px(ox, oy, x, y, rnd() < 0.12 ? '#2e2012' : col);
    }
  }
  { // log top: rings
    const [ox, oy] = at(T.LOG_TOP);
    const rings = ['#c29d62', '#9e7c46', '#b8935a', '#8f6f3e', '#a98650', '#815f33', '#6b4f2a', '#5d4423'];
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) | 0;
      px(ox, oy, x, y, rnd() < 0.1 ? '#8f6f3e' : rings[Math.min(d, 7)]);
    }
  }
  { // planks
    const [ox, oy] = speckle(T.PLANKS, ['#b08d55', '#a5824c', '#ba9660', '#9d7a45']);
    for (const y of [3, 7, 11, 15]) for (let x = 0; x < TS; x++) px(ox, oy, x, y, '#7a5c33');
    for (const [sx, sy] of [[4, 0], [12, 4], [7, 8], [2, 12]])
      for (let y = sy; y < sy + 3 && y < TS; y++) px(ox, oy, sx, y, '#7a5c33');
  }

  // --- foliage ---
  function leaves(tile, palette, holes) {
    const [ox, oy] = speckle(tile, palette);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++)
      if (rnd() < holes) ctx.clearRect(ox + x, oy + y, 1, 1);
  }
  leaves(T.LEAVES, ['#3e7a1e', '#356b19', '#468c24', '#2f5f16', '#40801f'], 0.13);
  leaves(T.LEAVES_SPRUCE, ['#2d5936', '#26492d', '#356843', '#20402a'], 0.10);
  { // cactus side
    const [ox, oy] = speckle(T.CACTUS_SIDE, ['#5b8f3a', '#4f7f31', '#639a41']);
    for (const x of [2, 6, 10, 14]) for (let y = 0; y < TS; y++) px(ox, oy, x, y, '#3c6b24');
    for (let i = 0; i < 8; i++) px(ox, oy, (rnd() * 16) | 0, (rnd() * 16) | 0, '#cfe3a8');
  }
  { // cactus top
    const [ox, oy] = speckle(T.CACTUS_TOP, ['#5b8f3a', '#4f7f31']);
    ctx.fillStyle = '#7fb35a'; ctx.fillRect(ox + 4, oy + 4, 8, 8);
    ctx.fillStyle = '#3c6b24'; ctx.fillRect(ox + 6, oy + 6, 4, 4);
  }
  { // red poppy (cross)
    const [ox, oy] = clearTile(T.FLOWER_RED);
    for (let y = 8; y < 16; y++) px(ox, oy, 7, y, '#3d7a24');
    px(ox, oy, 6, 10, '#4c9130'); px(ox, oy, 8, 11, '#4c9130');
    for (let y = 3; y < 8; y++) for (let x = 5; x < 10; x++)
      if (!((x === 5 || x === 9) && (y === 3 || y === 7))) px(ox, oy, x, y, pick(['#c33431', '#b02c29', '#d64541']));
    px(ox, oy, 7, 5, '#5a1413');
  }
  { // dandelion (cross)
    const [ox, oy] = clearTile(T.FLOWER_YELLOW);
    for (let y = 9; y < 16; y++) px(ox, oy, 8, y, '#3d7a24');
    px(ox, oy, 7, 12, '#4c9130');
    for (let y = 4; y < 9; y++) for (let x = 6; x < 11; x++)
      if (!((x === 6 || x === 10) && (y === 4 || y === 8))) px(ox, oy, x, y, pick(['#e5c832', '#f0d84a', '#d4b722']));
    px(ox, oy, 8, 6, '#a8891c');
  }
  { // tall grass (cross)
    const [ox, oy] = clearTile(T.TALLGRASS);
    for (let i = 0; i < 9; i++) {
      let x = 2 + ((rnd() * 12) | 0);
      const h = 6 + ((rnd() * 8) | 0);
      const c = pick(['#5f9e34', '#6fae40', '#528c2c']);
      for (let y = 15; y > 15 - h; y--) {
        px(ox, oy, x, y, c);
        if (rnd() < 0.3) x += rnd() < 0.5 ? 1 : -1;
        x = Math.max(0, Math.min(15, x));
      }
    }
  }
  { // dead bush (cross)
    const [ox, oy] = clearTile(T.DEADBUSH);
    for (let y = 8; y < 16; y++) px(ox, oy, 8, y, '#8a6a3e');
    const branches = [[-1, -1], [1, -1], [-2, -2], [2, -2], [-1, -3], [1, -3]];
    for (const [bx] of branches) {
      let x = 8, y = 11;
      for (let s = 0; s < 5; s++) { x += bx > 0 ? (rnd() < 0.7 ? 1 : 0) : (rnd() < 0.7 ? -1 : 0); y--; if (x < 0 || x > 15 || y < 1) break; px(ox, oy, x, y, '#7d5f36'); }
    }
  }

  // --- liquids / transparents ---
  { // water
    const [ox, oy] = at(T.WATER);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const light = rnd() < 0.12;
      ctx.fillStyle = light ? 'rgba(90,140,235,0.82)' : pick(['rgba(42,84,196,0.80)', 'rgba(36,74,180,0.80)', 'rgba(50,95,210,0.80)']);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
  { // glass
    const [ox, oy] = clearTile(T.GLASS);
    ctx.fillStyle = 'rgba(220,240,248,0.9)';
    ctx.fillRect(ox, oy, TS, 1); ctx.fillRect(ox, oy + 15, TS, 1);
    ctx.fillRect(ox, oy, 1, TS); ctx.fillRect(ox + 15, oy, 1, TS);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 5; i++) { px(ox, oy, 3 + i, 8 - i, 'rgba(255,255,255,0.55)'); px(ox, oy, 8 + i, 13 - i, 'rgba(255,255,255,0.4)'); }
  }
  { // ice
    const [ox, oy] = at(T.ICE);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      ctx.fillStyle = pick(['rgba(160,200,255,0.88)', 'rgba(145,190,250,0.88)', 'rgba(175,212,255,0.88)']);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
    for (let i = 0; i < 6; i++) px(ox, oy, 2 + i * 2, 3 + i, 'rgba(235,245,255,0.95)');
    for (let i = 0; i < 5; i++) px(ox, oy, 11 - i, 9 + i, 'rgba(235,245,255,0.9)');
  }

  // --- ores ---
  function ore(tile, colors) {
    const [ox, oy] = speckle(tile, ['#8e8e8e', '#7d7d7d', '#999999', '#858585']);
    for (let i = 0; i < 5; i++) {
      const sx = 1 + ((rnd() * 12) | 0), sy = 1 + ((rnd() * 12) | 0);
      px(ox, oy, sx, sy, colors[0]); px(ox, oy, sx + 1, sy, colors[1]);
      px(ox, oy, sx, sy + 1, colors[1]); if (rnd() < 0.6) px(ox, oy, sx + 1, sy + 1, colors[0]);
    }
  }
  ore(T.COAL, ['#2f2f2f', '#1d1d1d']);
  ore(T.IRON, ['#d8b090', '#c09070']);
  ore(T.GOLD, ['#f5d949', '#d9b92e']);
  ore(T.DIAMOND, ['#68e0dc', '#3fc4c9']);

  // --- building ---
  { // brick
    const [ox, oy] = at(T.BRICK);
    fill(ox, oy, '#9a9a9a');
    for (let row = 0; row < 4; row++) {
      const yy = row * 4, off = (row % 2) * 4;
      for (let bcol = -1; bcol < 3; bcol++) {
        const xx = bcol * 8 + off;
        const base = pick(['#9e4a3a', '#944435', '#a85040']);
        for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) {
          const rx = xx + x, ry = yy + y;
          if (rx < 0 || rx > 15 || ry > 15) continue;
          px(ox, oy, rx, ry, y === 0 ? '#b45a48' : base);
        }
      }
    }
  }
  { // glowstone
    const [ox, oy] = speckle(T.GLOW, ['#7a5b2e', '#8a6832', '#6b4f26']);
    for (let i = 0; i < 12; i++) {
      const sx = (rnd() * 14) | 0, sy = (rnd() * 14) | 0;
      px(ox, oy, sx, sy, '#ffd977'); px(ox, oy, sx + 1, sy, '#f7b733');
      px(ox, oy, sx, sy + 1, '#f7b733'); px(ox, oy, sx + 1, sy + 1, '#ffe9a8');
    }
  }
  { // sandstone
    const [ox, oy] = speckle(T.SANDSTONE_SIDE, ['#e2d5a2', '#d8ca96', '#e9dfae']);
    for (const y of [0, 5, 10, 15]) for (let x = 0; x < TS; x++) if (rnd() < 0.8) px(ox, oy, x, y, '#c4b478');
    speckle(T.SANDSTONE_TOP, ['#e9dfae', '#e2d5a2', '#efe6b8']);
  }

  // --- air base materials ---
  { // asphalt: dark speckled tarmac with occasional black pits
    const [ox, oy] = speckle(T.ASPHALT, ['#3a3a3d', '#333336', '#404043', '#2c2c2f', '#363639']);
    for (let i = 0; i < 10; i++) px(ox, oy, (rnd() * 16) | 0, (rnd() * 16) | 0, '#1c1c1e');
  }
  { // concrete: light precast panels with faint seam lines
    const [ox, oy] = speckle(T.CONCRETE, ['#b9b9b2', '#c4c4bd', '#aeaea7', '#c9c9c2', '#bcbcb5']);
    for (const y of [0, 7, 14]) for (let x = 0; x < TS; x++) if (rnd() < 0.75) px(ox, oy, x, y, '#96968f');
    px(ox, oy, 7, 0, '#96968f'); for (let y = 0; y < TS; y++) if (rnd() < 0.7) px(ox, oy, 7, y, '#a3a39c');
  }
  { // corrugated metal: alternating vertical light/dark ribs
    const [ox, oy] = at(T.METAL);
    for (let x = 0; x < TS; x++) {
      const rib = x % 4;
      const base = rib === 0 ? '#8d949c' : rib === 1 ? '#c3cad2' : rib === 2 ? '#a7aeb6' : '#797f86';
      for (let y = 0; y < TS; y++) px(ox, oy, x, y, rnd() < 0.08 ? '#5c6167' : base);
    }
  }
  { // stripe: painted line marking block (white with light wear)
    const [ox, oy] = speckle(T.STRIPE, ['#e9e9e2', '#f2f2ec', '#dcdcd5']);
    for (let i = 0; i < 6; i++) px(ox, oy, (rnd() * 16) | 0, (rnd() * 16) | 0, '#c8c8c0');
  }
  { // beacon: warning light, red/orange glow like glowstone's palette
    const [ox, oy] = speckle(T.BEACON, ['#7a2412', '#8a2c16', '#6b1c0e']);
    for (let i = 0; i < 12; i++) {
      const sx = (rnd() * 14) | 0, sy = (rnd() * 14) | 0;
      px(ox, oy, sx, sy, '#ff5a33'); px(ox, oy, sx + 1, sy, '#ff8f3d');
      px(ox, oy, sx, sy + 1, '#ff8f3d'); px(ox, oy, sx + 1, sy + 1, '#ffd08a');
    }
  }

  // --- average colour per block (particles, minimap) ---
  MC.BLOCK_COLORS = [];
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  function avgTile(tile) {
    const [ox, oy] = at(tile);
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const i = ((oy + y) * canvas.width + ox + x) * 4;
      if (img[i + 3] < 40) continue;
      r += img[i]; g += img[i + 1]; b += img[i + 2]; n++;
    }
    if (!n) return [128, 128, 128];
    return [r / n | 0, g / n | 0, b / n | 0];
  }
  for (let id = 0; id < MC.BLOCKS.length; id++) {
    const bl = MC.BLOCKS[id];
    if (!bl || !bl.tiles) { MC.BLOCK_COLORS[id] = [0, 0, 0]; continue; }
    MC.BLOCK_COLORS[id] = avgTile(bl.tiles.top !== undefined ? bl.tiles.top : bl.tiles.all);
  }

  // uv rect for a tile, with a small inset against bleeding.
  // CanvasTexture has flipY=true, so v=0 is the bottom of the canvas.
  MC.tileUV = function (tile) {
    const tx = tile % COLS, ty = (tile / COLS) | 0;
    const inset = 0.6 / (TS * COLS);
    return [
      tx / COLS + inset,           // u0
      1 - (ty + 1) / COLS + inset, // v0 (bottom)
      (tx + 1) / COLS - inset,     // u1
      1 - ty / COLS - inset        // v1 (top)
    ];
  };

  return canvas;
};
