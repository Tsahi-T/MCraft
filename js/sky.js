// Day/night cycle: sun, moon, stars, drifting clouds, sky+fog colours.
MC.Sky = function (scene, seed) {
  const U = MC.util;

  // --- sun & moon (billboard planes) ---
  function discTexture(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, inner); grad.addColorStop(0.55, inner);
    grad.addColorStop(0.7, outer); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); return t;
  }
  const sun = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshBasicMaterial({ map: discTexture('rgba(255,244,180,1)', 'rgba(255,210,90,0.55)'), transparent: true, depthWrite: false, fog: false })
  );
  const moon = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({ map: discTexture('rgba(230,235,245,1)', 'rgba(180,190,210,0.4)'), transparent: true, depthWrite: false, fog: false })
  );
  sun.renderOrder = -10; moon.renderOrder = -10;
  scene.add(sun); scene.add(moon);

  // --- stars ---
  const starGeo = new THREE.BufferGeometry();
  {
    const n = 550, pos = new Float32Array(n * 3);
    const rng = MC.Noise(seed ^ 0x5747A5);
    for (let i = 0; i < n; i++) {
      const az = rng.rand(i, 1, 0) * Math.PI * 2;
      const el = Math.asin(rng.rand(i, 2, 0) * 0.95);
      const r = 380;
      pos[i * 3] = Math.cos(el) * Math.cos(az) * r;
      pos[i * 3 + 1] = Math.sin(el) * r;
      pos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, transparent: true, opacity: 0, depthWrite: false, fog: false, sizeAttenuation: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- clouds: a tileable quad pattern, recentred by whole periods (seamless) ---
  const CLOUD_Y = 108, CELL = 12, PERIOD = 40; // pattern repeats every 40 cells
  const cloudNoise = MC.Noise(seed ^ 0xC10AD5);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const clouds = (function () {
    const pos = [], idx = [];
    for (let cz = -PERIOD; cz < PERIOD; cz++) for (let cx = -PERIOD; cx < PERIOD; cx++) {
      const n = cloudNoise.perlin2(cx / 8, cz / 8, PERIOD / 8);
      if (n < 0.18) continue;
      const x0 = cx * CELL, z0 = cz * CELL;
      const base = pos.length / 3;
      pos.push(x0, 0, z0, x0 + CELL, 0, z0, x0, 0, z0 + CELL, x0 + CELL, 0, z0 + CELL);
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, cloudMat);
    m.renderOrder = 2;
    scene.add(m);
    return m;
  })();
  let cloudDrift = 0;

  // --- colours ---
  const COL = {
    day: new THREE.Color(0x7ab5f2), night: new THREE.Color(0x060a1c),
    dawn: new THREE.Color(0xe8945a), fogDay: new THREE.Color(0xa7c8ee), fogNight: new THREE.Color(0x0a0f24)
  };
  const skyCol = new THREE.Color(), fogCol = new THREE.Color(), tmp = new THREE.Color();

  // t: time of day 0..1 (0 = sunrise). Returns light level 0..1.
  function update(dt, t, playerPos) {
    const ang = t * Math.PI * 2;               // sun angle: rises east (+x)
    const elev = Math.sin(ang);
    const daylight = U.smoothstep(-0.12, 0.28, elev);

    const R = 340;
    sun.position.set(playerPos.x + Math.cos(ang) * R, playerPos.y + Math.sin(ang) * R, playerPos.z);
    moon.position.set(playerPos.x - Math.cos(ang) * R, playerPos.y - Math.sin(ang) * R, playerPos.z);
    sun.lookAt(playerPos); moon.lookAt(playerPos);

    // sky colour: night -> day with a dawn/dusk tint near the horizon
    skyCol.copy(COL.night).lerp(COL.day, daylight);
    fogCol.copy(COL.fogNight).lerp(COL.fogDay, daylight);
    const dawnAmt = Math.max(0, 1 - Math.abs(elev) * 4) * 0.55;
    if (dawnAmt > 0) {
      tmp.copy(COL.dawn);
      skyCol.lerp(tmp, dawnAmt * 0.5);
      fogCol.lerp(tmp, dawnAmt);
    }
    scene.background = skyCol;
    if (scene.fog) scene.fog.color.copy(fogCol);

    starMat.opacity = U.clamp(1 - daylight * 1.6, 0, 1);
    stars.position.copy(playerPos);

    // clouds drift east; recentre by whole periods so the tiling stays seamless
    cloudDrift += dt * 1.6;
    const PW = PERIOD * CELL;
    const gx = cloudDrift + Math.round((playerPos.x - cloudDrift) / PW) * PW;
    const gz = Math.round(playerPos.z / PW) * PW;
    clouds.position.set(gx, CLOUD_Y, gz);
    cloudMat.opacity = 0.18 + daylight * 0.4;
    cloudMat.color.setScalar(0.35 + daylight * 0.65);

    return daylight;
  }

  return { update };
};
