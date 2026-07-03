// MCraft bootstrap: renderer, chunk streaming, input, game loop, persistence.
(function () {
  const CFG = MC.CFG, U = MC.util, B = MC.B;
  const { CHUNK, HEIGHT, RENDER_DIST } = CFG;

  if (typeof THREE === 'undefined') return; // CDN failed; message already shown

  // --- seed & persistence -------------------------------------------------
  const params = new URLSearchParams(location.search);
  let seedText = params.get('seed');
  if (!seedText) seedText = localStorage.getItem('cmc_lastseed');
  if (!seedText) seedText = String((Math.random() * 1e9) | 0);
  localStorage.setItem('cmc_lastseed', seedText);
  const seed = U.hashStr(seedText);
  const SAVE_KEY = 'cmc_world_' + seedText;

  let save = null;
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { save = null; }

  // --- core objects ---------------------------------------------------------
  const atlas = MC.buildAtlas();
  const world = MC.World(seed);
  if (save && save.edits) world.importEdits(save.edits);

  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xa7c8ee, RENDER_DIST * 16 * 0.5, RENDER_DIST * 16 * 0.92);
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 600);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const tex = new THREE.CanvasTexture(atlas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;

  const matOp = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true });
  const matCut = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const matTr = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
  const dayMats = [matOp, matCut, matTr];

  const sky = MC.Sky(scene, seed);
  const effects = MC.Effects(scene);
  const player = MC.Player(world);
  const minimap = MC.Minimap(world);
  MC.onChunkReady = ch => minimap.paintChunk(ch);
  MC.onColumnChange = (x, z) => minimap.paintColumn(x, z);

  // --- block highlight box ---------------------------------------------------
  const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })
  );
  highlight.visible = false;
  scene.add(highlight);

  // --- held block (bottom-right "hand") ----------------------------------
  const handMats = new Map();
  function handMaterial(id) {
    let m = handMats.get(id);
    if (!m) {
      const t = MC.tileFor(id, 'side');
      const c = document.createElement('canvas'); c.width = c.height = 16;
      c.getContext('2d').drawImage(atlas, (t % 16) * 16, ((t / 16) | 0) * 16, 16, 16, 0, 0, 16, 16);
      const ht = new THREE.CanvasTexture(c);
      ht.magFilter = THREE.NearestFilter; ht.minFilter = THREE.NearestFilter;
      m = new THREE.MeshBasicMaterial({ map: ht });
      handMats.set(id, m);
    }
    return m;
  }
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), handMaterial(MC.UI.selectedBlock()));
  hand.position.set(-0.55, -0.5, -0.9);
  hand.rotation.set(0.15, Math.PI / 5, 0);
  camera.add(hand);
  let swing = 0;

  // --- chunk streaming -------------------------------------------------------
  const meshes = new Map(); // 'ucx,ucz' -> {wkey, op, cut, tr}
  const RING = [];
  for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++)
    for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++)
      if (dx * dx + dz * dz <= (RENDER_DIST + 0.5) * (RENDER_DIST + 0.5)) RING.push([dx, dz]);
  RING.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));

  function buildMeshAt(ucx, ucz) {
    const wcx = U.wrapChunk(ucx), wcz = U.wrapChunk(ucz);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) world.ensureChunk(wcx + dx, wcz + dz);
    const geos = MC.Mesher.buildChunkGeometry(world, wcx, wcz);
    const entry = { wkey: wcx + ',' + wcz, op: null, cut: null, tr: null };
    for (const [name, mat] of [['op', matOp], ['cut', matCut], ['tr', matTr]]) {
      if (!geos[name]) continue;
      const m = new THREE.Mesh(geos[name], mat);
      m.position.set(ucx * CHUNK, 0, ucz * CHUNK);
      if (name === 'tr') m.renderOrder = 1;
      scene.add(m);
      entry[name] = m;
    }
    meshes.set(ucx + ',' + ucz, entry);
  }
  function disposeMesh(key) {
    const e = meshes.get(key);
    if (!e) return;
    for (const n of ['op', 'cut', 'tr']) {
      if (e[n]) { scene.remove(e[n]); e[n].geometry.dispose(); }
    }
    meshes.delete(key);
  }

  function updateChunks(budgetMs) {
    const t0 = performance.now();
    const pcx = Math.floor(player.pos.x / CHUNK), pcz = Math.floor(player.pos.z / CHUNK);

    // rebuild edited chunks first (cheap: only a few per click).
    // collect keys before rebuilding — buildMeshAt mutates `meshes` mid-iteration
    if (world.dirty.size) {
      const toRebuild = [];
      for (const [key, e] of meshes) if (world.dirty.has(e.wkey)) toRebuild.push(key);
      world.dirty.clear();
      for (const key of toRebuild) {
        const [ucx, ucz] = key.split(',').map(Number);
        disposeMesh(key);
        buildMeshAt(ucx, ucz);
      }
    }

    let built = 0;
    for (const [dx, dz] of RING) {
      if (performance.now() - t0 > budgetMs) break;
      const ucx = pcx + dx, ucz = pcz + dz, key = ucx + ',' + ucz;
      if (meshes.has(key)) continue;
      buildMeshAt(ucx, ucz);
      built++;
    }

    // unload far meshes
    for (const key of meshes.keys()) {
      const [ucx, ucz] = key.split(',').map(Number);
      const dx = ucx - pcx, dz = ucz - pcz;
      if (dx * dx + dz * dz > (RENDER_DIST + 2) * (RENDER_DIST + 2)) disposeMesh(key);
    }
    world.evictFar(pcx, pcz);
    return built;
  }

  // --- spawn ---------------------------------------------------------------
  let timeOfDay = 0.05;
  if (save && save.player) {
    player.pos.fromArray(save.player.pos);
    player.yaw = save.player.yaw; player.pitch = save.player.pitch;
    player.flying = !!save.player.flying;
    timeOfDay = save.time || 0.05;
    if (save.hotbar) { MC.UI.hotbar = save.hotbar; }
  } else {
    const sp = world.findSpawn();
    player.pos.set(sp.x, sp.y, sp.z);
  }

  MC.UI.init(atlas, seedText);
  if (save && save.sel !== undefined) MC.UI.selectSlot(save.sel);
  MC.UI.onHotbarChange = () => { hand.material = handMaterial(MC.UI.selectedBlock()); };

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        player: { pos: player.pos.toArray(), yaw: player.yaw, pitch: player.pitch, flying: player.flying },
        time: timeOfDay,
        hotbar: MC.UI.hotbar,
        sel: MC.UI.selected,
        edits: world.exportEdits()
      }));
    } catch (e) { /* storage full — ignore */ }
  }
  window.addEventListener('beforeunload', persist);

  // --- input -----------------------------------------------------------------
  const keys = new Set();
  let started = false, locked = false;
  let breakHeld = false, placeHeld = false, actionCooldown = 0;

  document.addEventListener('keydown', e => {
    if (e.code === 'F3') { e.preventDefault(); MC.UI.toggleDebug(); return; }
    keys.add(e.code);
    if (!locked) return;
    if (e.code === 'KeyF') {
      player.flying = !player.flying;
      MC.UI.toast(player.flying ? 'טיסה: פעיל (רווח למעלה, C למטה)' : 'טיסה: כבוי');
    }
    if (e.code === 'KeyM') MC.UI.toggleBigMap();
    if (e.code === 'KeyE') MC.UI.togglePalette();
    if (e.code === 'KeyN') { timeOfDay = 0.02; MC.UI.toast('בוקר טוב! ☀️'); }
    if (e.code.startsWith('Digit')) {
      const n = +e.code.slice(5);
      if (n >= 1 && n <= 9) MC.UI.selectSlot(n - 1);
    }
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  document.addEventListener('mousemove', e => {
    if (!locked) return;
    player.yaw -= e.movementX * 0.0024;
    player.pitch -= e.movementY * 0.0024;
    player.pitch = U.clamp(player.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  });
  document.addEventListener('mousedown', e => {
    if (!locked) return;
    if (e.button === 0) { breakHeld = true; doAction(); }
    if (e.button === 2) { placeHeld = true; doAction(); }
    if (e.button === 1) { e.preventDefault(); pickBlock(); }
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 0) breakHeld = false;
    if (e.button === 2) placeHeld = false;
  });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('wheel', e => {
    if (!locked) return;
    MC.UI.selectSlot(MC.UI.selected + (e.deltaY > 0 ? 1 : -1));
  }, { passive: true });

  const eyeV = new THREE.Vector3(), dirV = new THREE.Vector3();
  function targetBlock() {
    return MC.raycast(world, player.eyePos(eyeV), player.lookDir(dirV), CFG.REACH);
  }
  function doAction() {
    if (actionCooldown > 0) return;
    const hit = targetBlock();
    if (breakHeld) {
      if (hit && MC.BLOCKS[hit.id].breakable) {
        // convert the unwrapped ray hit to wrapped coords happens inside setBlock
        world.setBlock(hit.x, hit.y, hit.z, B.AIR);
        effects.burst(hit.x, hit.y, hit.z, hit.id);
        effects.sound.break(MC.BLOCKS[hit.id].hard);
        swing = 1;
        actionCooldown = 0.22;
      }
    } else if (placeHeld) {
      if (hit) {
        const px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2];
        const cur = world.getBlock(px, py, pz);
        const curBl = MC.BLOCKS[cur];
        const id = MC.UI.selectedBlock();
        if ((cur === B.AIR || cur === B.WATER || curBl.kind === 'cross') &&
            !(MC.BLOCKS[id].solid && player.overlapsBlock(px, py, pz))) {
          world.setBlock(px, py, pz, id);
          effects.sound.place();
          swing = 1;
          actionCooldown = 0.22;
        }
      }
    }
  }
  function pickBlock() {
    const hit = targetBlock();
    if (hit && MC.BLOCKS[hit.id].pick) {
      MC.UI.setSlotBlock(MC.UI.selected, hit.id);
      MC.UI.toast('הועתק: ' + MC.BLOCKS[hit.id].name);
    }
  }

  // pointer lock ------------------------------------------------------------
  const playBtn = document.getElementById('play-btn');
  playBtn.addEventListener('click', () => {
    canvas.requestPointerLock();
  });
  document.getElementById('new-world-btn').addEventListener('click', () => {
    const s = String((Math.random() * 1e9) | 0);
    localStorage.setItem('cmc_lastseed', s);
    location.search = '?seed=' + s;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (locked) {
      started = true;
      MC.UI.hideOverlay();
      effects.sound.unlock();
    } else {
      breakHeld = placeHeld = false;
      keys.clear();
      MC.UI.togglePalette(false);
      MC.UI.toggleBigMap(false);
      MC.UI.showOverlay(true);
      persist();
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- game loop -----------------------------------------------------------
  const miniCanvas = document.getElementById('minimap');
  const bigCanvas = document.getElementById('bigmap-canvas');
  const waterOverlay = document.getElementById('water-overlay');
  let last = performance.now();
  let fps = 0, fpsSmooth = 60;
  let saveTimer = 0, uiTimer = 0;
  let loadingDone = false;

  const baseFogNear = RENDER_DIST * 16 * 0.5, baseFogFar = RENDER_DIST * 16 * 0.92;

  let rafPending = false;
  function scheduleFrame() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(t => { rafPending = false; frame(t); });
  }

  function frame(now) {
    scheduleFrame();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    fps = 1 / Math.max(dt, 1e-4);
    fpsSmooth += (fps - fpsSmooth) * 0.05;

    updateChunks(started ? CFG.CHUNK_BUDGET_MS : 60);

    if (!loadingDone) {
      const done = RING.reduce((n, [dx, dz]) => {
        const pcx = Math.floor(player.pos.x / CHUNK), pcz = Math.floor(player.pos.z / CHUNK);
        return n + (meshes.has((pcx + dx) + ',' + (pcz + dz)) ? 1 : 0);
      }, 0);
      MC.UI.setProgress(done / RING.length, `בונה עולם... ${(done / RING.length * 100) | 0}%`);
      // the near chunks are enough to start playing; the rest streams in
      if (done >= RING.length * 0.7) { loadingDone = true; MC.UI.setReady(); }
    }

    if (started) {
      timeOfDay = (timeOfDay + dt / CFG.DAY_LENGTH) % 1;
      if (locked) {
        player.update(dt, keys);
        if (breakHeld || placeHeld) doAction();
      }
      actionCooldown = Math.max(0, actionCooldown - dt);
    }

    // camera follows player
    player.eyePos(camera.position);
    camera.rotation.set(player.pitch, player.yaw, 0);
    const targetFov = player.sprinting && !player.flying ? 82 : 75;
    if (Math.abs(camera.fov - targetFov) > 0.2) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    }

    // day/night
    const daylight = sky.update(dt, timeOfDay, player.pos);
    const lum = 0.18 + 0.82 * daylight;
    for (const m of dayMats) m.color.setScalar(lum);

    // underwater effect
    if (player.headInWater) {
      waterOverlay.style.opacity = '1';
      scene.fog.near = 2; scene.fog.far = 26;
    } else {
      waterOverlay.style.opacity = '0';
      scene.fog.near = baseFogNear; scene.fog.far = baseFogFar;
    }

    // block highlight
    const hit = locked ? targetBlock() : null;
    highlight.visible = !!hit;
    if (hit) highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

    // hand bob + swing
    swing = Math.max(0, swing - dt * 5);
    const moving = keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD');
    const bob = (moving && player.onGround) ? Math.sin(now * 0.012) * 0.02 : 0;
    hand.position.set(-0.55, -0.5 + bob, -0.9);
    hand.rotation.x = 0.15 - Math.sin(swing * Math.PI) * 0.9;

    effects.update(dt);

    // periodic UI updates
    uiTimer -= dt;
    if (uiTimer <= 0) {
      uiTimer = 0.25;
      minimap.drawMini(miniCanvas, player.pos.x, player.pos.z, player.yaw);
      if (!document.getElementById('bigmap').classList.contains('hidden')) {
        minimap.drawBig(bigCanvas, player.pos.x, player.pos.z);
      }
      const wx = U.wrap(Math.floor(player.pos.x)), wz = U.wrap(Math.floor(player.pos.z));
      const bio = world.biomeAt(wx, wz);
      const hours = (timeOfDay * 24 + 6) % 24;
      const hh = String(hours | 0).padStart(2, '0'), mm = String(((hours % 1) * 60) | 0).padStart(2, '0');
      MC.UI.setDebug(
        `FPS: ${fpsSmooth.toFixed(0)}<br>` +
        `XYZ: ${player.pos.x.toFixed(1)} / ${player.pos.y.toFixed(1)} / ${player.pos.z.toFixed(1)}<br>` +
        `עולם (טורוס): ${wx} / ${wz}<br>` +
        `ביום: ${MC.BIO_NAMES[bio]}<br>` +
        `שעה: ${hh}:${mm}<br>` +
        `Seed: ${seedText}<br>` +
        `Meshes: ${meshes.size} · Chunks: ${world.chunks.size}<br>` +
        `שינויים שמורים: ${world.editCount()}<br>` +
        `Draw calls: ${renderer.info.render.calls}`
      );
    }

    saveTimer -= dt;
    if (started && saveTimer <= 0) { saveTimer = CFG.AUTOSAVE_SEC; persist(); }

    renderer.render(scene, camera);
  }
  // dev hook: lets you poke the game from the console (also used by tests)
  window.MCDEV = {
    tick: n => { for (let i = 0; i < (n || 1); i++) frame(performance.now()); },
    world, player, meshes, scene, camera, renderer,
    setTime: t => { timeOfDay = t; },
    started: () => started,
    forceStart: () => { started = true; MC.UI.hideOverlay(); },
    setLocked: v => { locked = v; }
  };

  scheduleFrame();
  // keep ticking (slowly) when the tab is hidden, so loading can finish in background
  setInterval(() => { if (performance.now() - last > 350) frame(performance.now()); }, 350);
})();
