// Exploration map. A persistent canvas of the whole (wrapped) world is painted
// chunk-by-chunk as terrain generates — the map literally builds itself as you explore.
MC.Minimap = function (world) {
  const CFG = MC.CFG, U = MC.util, B = MC.B;
  const WB = CFG.WORLD_BLOCKS, CHUNK = CFG.CHUNK;

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = WB; mapCanvas.height = WB;
  const mctx = mapCanvas.getContext('2d');
  mctx.fillStyle = '#07070e';
  mctx.fillRect(0, 0, WB, WB);

  function columnColor(ch, lx, lz) {
    const top = ch.lightH[lz * CHUNK + lx] - 1;
    if (top < 0) return '#000000';
    let id = ch.data[(top * CHUNK + lz) * CHUNK + lx];
    if (id === B.WATER || id === B.ICE) {
      // deeper water = darker blue
      let d = 0, y = top;
      while (y > 0 && ch.data[(y * CHUNK + lz) * CHUNK + lx] === B.WATER) { d++; y--; }
      const f = Math.max(0.35, 1 - d * 0.08);
      const [r, g, b] = MC.BLOCK_COLORS[id];
      return `rgb(${r * f | 0},${g * f | 0},${(b * f) | 0})`;
    }
    const [r, g, b] = MC.BLOCK_COLORS[id] || [120, 120, 120];
    const f = 0.55 + 0.45 * Math.min(1, top / 72); // height shading
    return `rgb(${r * f | 0},${g * f | 0},${b * f | 0})`;
  }

  function paintChunk(ch) {
    for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
      mctx.fillStyle = columnColor(ch, lx, lz);
      mctx.fillRect(ch.cx * CHUNK + lx, ch.cz * CHUNK + lz, 1, 1);
    }
  }
  function paintColumn(wx, wz) {
    const ch = world.chunkAt(wx >> 4, wz >> 4);
    if (!ch) return;
    mctx.fillStyle = columnColor(ch, wx & 15, wz & 15);
    mctx.fillRect(wx, wz, 1, 1);
  }

  // draw the little round-the-player map (with torus wrap-around)
  function drawMini(canvas, px, pz, yaw) {
    const ctx = canvas.getContext('2d');
    const S = canvas.width, VIEW = 160; // blocks shown
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#07070e';
    ctx.fillRect(0, 0, S, S);

    const cx = U.wrap(Math.floor(px)), cz = U.wrap(Math.floor(pz));
    let sx = U.mod(cx - VIEW / 2, WB), sz = U.mod(cz - VIEW / 2, WB);
    // the window may cross the map edge — draw up to 4 slices
    const w1 = Math.min(VIEW, WB - sx), w2 = VIEW - w1;
    const h1 = Math.min(VIEW, WB - sz), h2 = VIEW - h1;
    const k = S / VIEW;
    ctx.drawImage(mapCanvas, sx, sz, w1, h1, 0, 0, w1 * k, h1 * k);
    if (w2 > 0) ctx.drawImage(mapCanvas, 0, sz, w2, h1, w1 * k, 0, w2 * k, h1 * k);
    if (h2 > 0) ctx.drawImage(mapCanvas, sx, 0, w1, h2, 0, h1 * k, w1 * k, h2 * k);
    if (w2 > 0 && h2 > 0) ctx.drawImage(mapCanvas, 0, 0, w2, h2, w1 * k, h1 * k, w2 * k, h2 * k);

    // player arrow
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const ang = Math.atan2(fwdZ, fwdX);
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // full world map overlay
  function drawBig(canvas, px, pz) {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.72 | 0;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mapCanvas, 0, 0, WB, WB, 0, 0, size, size);
    const mx = U.wrap(Math.floor(px)) / WB * size, mz = U.wrap(Math.floor(pz)) / WB * size;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.arc(mx, mz, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  return { paintChunk, paintColumn, drawMini, drawBig };
};
