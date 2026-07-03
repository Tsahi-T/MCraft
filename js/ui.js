// HUD: hotbar with isometric block icons, block palette, debug panel, toasts, overlay.
MC.UI = (function () {
  const ui = {
    hotbar: MC.DEFAULT_HOTBAR.slice(),
    selected: 0,
    onHotbarChange: null
  };

  let atlas = null;

  // isometric block icon drawn from atlas tiles
  function drawBlockIcon(canvas, id) {
    const ctx = canvas.getContext('2d');
    const S = canvas.width;
    ctx.clearRect(0, 0, S, S);
    ctx.imageSmoothingEnabled = false;
    const bl = MC.BLOCKS[id];
    if (!bl || !bl.tiles) return;

    const tileXY = t => [(t % 16) * 16, ((t / 16) | 0) * 16];

    if (bl.kind === 'cross' || bl.kind === 'fluid') {
      const [sx, sy] = tileXY(MC.tileFor(id, 'side'));
      ctx.drawImage(atlas, sx, sy, 16, 16, S * 0.1, S * 0.1, S * 0.8, S * 0.8);
      return;
    }

    const W = S * 0.94, cx = S / 2, topH = W * 0.25, faceH = W * 0.5;
    const ox = (S - W) / 2, oy = S * 0.02;
    const [tx, ty] = tileXY(MC.tileFor(id, 'top'));
    const [sx, sy] = tileXY(MC.tileFor(id, 'side'));

    function face(m, tileX, tileY, dark) {
      ctx.save();
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.drawImage(atlas, tileX, tileY, 16, 16, 0, 0, 1, 1);
      if (dark) { ctx.fillStyle = `rgba(0,0,20,${dark})`; ctx.fillRect(0, 0, 1, 1); }
      ctx.restore();
    }
    // top: A=(cx,oy) -> B=(ox+W, oy+topH), D=(ox, oy+topH)
    face([W / 2, topH, -W / 2, topH, cx, oy], tx, ty, 0);
    // left: D -> C=(cx, oy+2*topH), down faceH
    face([W / 2, topH, 0, faceH, ox, oy + topH], sx, sy, 0.22);
    // right: C -> B, down faceH
    face([W / 2, -topH, 0, faceH, cx, oy + 2 * topH], sx, sy, 0.42);
  }

  function buildHotbar() {
    const bar = document.getElementById('hotbar');
    bar.innerHTML = '';
    ui.hotbar.forEach((id, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === ui.selected ? ' selected' : '');
      const cv = document.createElement('canvas');
      cv.width = cv.height = 40;
      drawBlockIcon(cv, id);
      slot.appendChild(cv);
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = i + 1;
      slot.appendChild(num);
      slot.addEventListener('click', () => ui.selectSlot(i));
      bar.appendChild(slot);
    });
  }

  ui.selectSlot = function (i) {
    ui.selected = MC.util.mod(i, 9);
    document.querySelectorAll('#hotbar .slot').forEach((s, j) =>
      s.classList.toggle('selected', j === ui.selected));
    ui.toast(MC.BLOCKS[ui.hotbar[ui.selected]].name);
    if (ui.onHotbarChange) ui.onHotbarChange();
  };
  ui.selectedBlock = () => ui.hotbar[ui.selected];
  ui.setSlotBlock = function (i, id) {
    ui.hotbar[i] = id;
    buildHotbar();
    if (ui.onHotbarChange) ui.onHotbarChange();
  };

  function buildPalette() {
    const grid = document.getElementById('palette-grid');
    grid.innerHTML = '';
    for (const id of MC.PICKABLE) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.title = MC.BLOCKS[id].name;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 44;
      drawBlockIcon(cv, id);
      cell.appendChild(cv);
      const label = document.createElement('div');
      label.className = 'cell-name';
      label.textContent = MC.BLOCKS[id].name;
      cell.appendChild(label);
      cell.addEventListener('click', () => {
        ui.setSlotBlock(ui.selected, id);
        ui.toast(`${MC.BLOCKS[id].name} ← חריץ ${ui.selected + 1}`);
      });
      grid.appendChild(cell);
    }
  }

  ui.togglePalette = function (force) {
    const el = document.getElementById('palette');
    const show = force !== undefined ? force : el.classList.contains('hidden');
    el.classList.toggle('hidden', !show);
    return show;
  };
  ui.toggleBigMap = function (force) {
    const el = document.getElementById('bigmap');
    const show = force !== undefined ? force : el.classList.contains('hidden');
    el.classList.toggle('hidden', !show);
    return show;
  };
  ui.toggleDebug = function () {
    document.getElementById('debug').classList.toggle('hidden');
  };
  ui.setDebug = function (html) {
    const el = document.getElementById('debug');
    if (!el.classList.contains('hidden')) el.innerHTML = html;
  };

  let toastTimer = null;
  ui.toast = function (msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
  };

  // start / pause overlay
  ui.setProgress = function (f, label) {
    document.getElementById('loading-fill').style.width = (f * 100).toFixed(0) + '%';
    if (label) document.getElementById('loading-text').textContent = label;
  };
  ui.setReady = function () {
    const btn = document.getElementById('play-btn');
    btn.disabled = false;
    btn.textContent = 'לחץ כדי לשחק';
    document.getElementById('loading-row').style.opacity = '0.35';
    document.getElementById('loading-text').textContent = 'העולם מוכן!';
  };
  ui.showOverlay = function (paused) {
    const ov = document.getElementById('overlay');
    ov.classList.remove('hidden');
    if (paused) {
      document.getElementById('play-btn').textContent = 'המשך משחק';
      document.getElementById('loading-row').style.display = 'none';
    }
  };
  ui.hideOverlay = function () {
    document.getElementById('overlay').classList.add('hidden');
  };

  ui.init = function (atlasCanvas, seedText) {
    atlas = atlasCanvas;
    document.getElementById('seed-label').textContent = seedText;
    buildHotbar();
    buildPalette();
  };

  ui.drawBlockIcon = drawBlockIcon;
  return ui;
})();
