// Break/place particles + tiny synthesized sounds (no audio assets).
MC.Effects = function (scene) {
  // --- particles ---
  const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  const mats = new Map();
  function matFor(blockId) {
    let m = mats.get(blockId);
    if (!m) {
      const [r, g, b] = MC.BLOCK_COLORS[blockId] || [128, 128, 128];
      m = new THREE.MeshBasicMaterial({ color: new THREE.Color(r / 255, g / 255, b / 255) });
      mats.set(blockId, m);
    }
    return m;
  }
  const active = [], pool = [];

  function burst(x, y, z, blockId, count) {
    count = count || 14;
    for (let i = 0; i < count; i++) {
      if (active.length > 240) break;
      let p = pool.pop();
      if (!p) p = { mesh: new THREE.Mesh(geo, matFor(blockId)) };
      p.mesh.material = matFor(blockId);
      p.mesh.position.set(x + 0.15 + Math.random() * 0.7, y + 0.15 + Math.random() * 0.7, z + 0.15 + Math.random() * 0.7);
      p.vel = new THREE.Vector3((Math.random() - 0.5) * 3.4, Math.random() * 4 + 1.2, (Math.random() - 0.5) * 3.4);
      p.life = 0.5 + Math.random() * 0.35;
      scene.add(p.mesh);
      active.push(p);
    }
  }

  function update(dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      p.life -= dt;
      if (p.life <= 0) { scene.remove(p.mesh); pool.push(p); active.splice(i, 1); continue; }
      p.vel.y -= 15 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const s = Math.min(1, p.life * 3);
      p.mesh.scale.setScalar(s);
    }
  }

  // --- sound ---
  let AC = null;
  function ctx() {
    if (!AC) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) AC = new C();
    }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function noiseBurst(freq, dur, gain) {
    const ac = ctx(); if (!ac) return;
    const len = Math.max(1, (ac.sampleRate * dur) | 0);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    const g = ac.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start();
  }
  function blip(freq, dur, gain) {
    const ac = ctx(); if (!ac) return;
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  }
  const sound = {
    break: hard => noiseBurst(280 + hard * 260, 0.11, 0.16),
    place: () => { blip(170, 0.07, 0.12); noiseBurst(700, 0.04, 0.05); },
    unlock: () => blip(520, 0.1, 0.06)
  };

  return { burst, update, sound };
};

// Voxel raycast (Amanatides & Woo DDA). Returns hit block + face normal.
MC.raycast = function (world, origin, dir, maxDist) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / dir.x), tDeltaY = Math.abs(1 / dir.y), tDeltaZ = Math.abs(1 / dir.z);
  const frac = (v) => v - Math.floor(v);
  let tMaxX = dir.x > 0 ? (1 - frac(origin.x)) * tDeltaX : frac(origin.x) * tDeltaX;
  let tMaxY = dir.y > 0 ? (1 - frac(origin.y)) * tDeltaY : frac(origin.y) * tDeltaY;
  let tMaxZ = dir.z > 0 ? (1 - frac(origin.z)) * tDeltaZ : frac(origin.z) * tDeltaZ;
  let face = [0, 0, 0], t = 0;

  for (let i = 0; i < 256; i++) {
    if (t > maxDist) return null;
    const id = world.getBlock(x, y, z);
    if (id !== MC.B.AIR && id !== MC.B.WATER) {
      return { x, y, z, id, face, dist: t };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0];
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0];
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ];
    }
  }
  return null;
};
