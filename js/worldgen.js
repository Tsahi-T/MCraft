// Procedural terrain generator. Fully deterministic per seed, and periodic —
// the same chunk data comes out for wrapped coordinates, so the torus is seamless.
MC.BIO = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, SNOWY: 5, MOUNTAIN: 6 };
MC.BIO_NAMES = ['אוקיינוס', 'חוף', 'מישורים', 'יער', 'מדבר', 'טונדרה מושלגת', 'הרים'];

MC.WorldGen = function (seed) {
  const CFG = MC.CFG, U = MC.util, B = MC.B, BIO = MC.BIO;
  const { CHUNK, HEIGHT, SEA } = CFG;
  const WB = CFG.WORLD_BLOCKS;

  const mk = salt => MC.Noise((Math.imul(seed, 2654435761) ^ salt) >>> 0);
  const nCont  = mk(0xA511E9B3);
  const nHill  = mk(0x63D83595);
  const nMount = mk(0x9E3779B9);
  const nTemp  = mk(0x85EBCA6B);
  const nMoist = mk(0xC2B2AE35);
  const nCave1 = mk(0x27D4EB2F);
  const nCave2 = mk(0x165667B1);
  const nCave3 = mk(0xFD7046C5);
  const nMisc  = mk(0xB55A4F09);
  const R = nMisc.rand;

  function climate(x, z) {
    const t = nTemp.fbm2(x / 512, z / 512, 3, WB / 512) * 0.5 + 0.5;
    const m = nMoist.fbm2(x / 512, z / 512, 3, WB / 512) * 0.5 + 0.5;
    return [t, m];
  }
  function mountainF(x, z) {
    const r = 1 - Math.abs(nMount.fbm2(x / 256, z / 256, 4, WB / 256));
    return U.smoothstep(0.72, 0.94, r);
  }
  function heightAt(x, z) {
    x = U.wrap(x); z = U.wrap(z);
    const cont = nCont.fbm2(x / 256, z / 256, 4, WB / 256);
    const hill = nHill.fbm2(x / 64, z / 64, 3, WB / 64);
    let h = 35 + cont * 11 + hill * 5;
    if (cont < -0.32) h -= (-0.32 - cont) * 34;                    // deep oceans
    h += mountainF(x, z) * (26 + hill * 10 + Math.max(0, cont) * 10); // mountain ranges
    return U.clamp(Math.round(h), 3, HEIGHT - 8);
  }
  function biomeAt(x, z, h, mf) {
    x = U.wrap(x); z = U.wrap(z);
    if (h === undefined) h = heightAt(x, z);
    if (mf === undefined) mf = mountainF(x, z);
    if (mf > 0.5 && h > SEA + 8) return BIO.MOUNTAIN;
    if (h < SEA - 1) return BIO.OCEAN;
    if (h <= SEA + 1) return BIO.BEACH;
    const [t, m] = climate(x, z);
    if (t < 0.32) return BIO.SNOWY;
    if (t > 0.62 && m < 0.42) return BIO.DESERT;
    if (m > 0.54) return BIO.FOREST;
    return BIO.PLAINS;
  }
  function caveAt(x, y, z) {
    const n1 = nCave1.value3(x / 16, y / 12, z / 16, WB / 16);
    const n2 = nCave2.value3(x / 16, y / 12, z / 16, WB / 16);
    if (n1 * n1 + n2 * n2 < 0.018) return true; // spaghetti tunnels
    if (y < 28 && nCave3.value3(x / 32, y / 18, z / 32, WB / 32) > 0.66) return true; // caverns
    return false;
  }

  // trees ------------------------------------------------------------------
  function treeDensity(b, h) {
    switch (b) {
      case BIO.FOREST: return 0.11;
      case BIO.PLAINS: return 0.006;
      case BIO.SNOWY: return 0.03;
      case BIO.MOUNTAIN: return h < 58 ? 0.006 : 0;
      default: return 0;
    }
  }
  const treeRand = (x, z) => R(x, 7777, z);

  function stampOak(put, bx, bz, baseY, wx, wz) {
    const th = 4 + ((R(wx, 1, wz) * 3) | 0);
    for (let dy = th - 3; dy <= th; dy++) {
      const rad = dy >= th - 1 ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad) {
          if (rad === 1 && dy === th) continue;
          if (R(wx + dx, baseY + dy, wz + dz) < 0.45) continue;
        }
        put(bx + dx, baseY + dy, bz + dz, B.LEAVES, false);
      }
    }
    for (let k = 0; k < th; k++) put(bx, baseY + k, bz, B.LOG, true);
    put(bx, baseY - 1, bz, B.DIRT, true);
  }
  function stampSpruce(put, bx, bz, baseY, wx, wz) {
    const th = 6 + ((R(wx, 2, wz) * 3) | 0);
    for (let dy = 2; dy <= th; dy++) {
      const rad = dy >= th - 1 ? 1 : (((th - dy) & 1) ? 1 : 2);
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad === 2) continue;
        put(bx + dx, baseY + dy, bz + dz, B.SPRUCE_LEAVES, false);
      }
    }
    put(bx, baseY + th + 1, bz, B.SPRUCE_LEAVES, false);
    for (let k = 0; k < th; k++) put(bx, baseY + k, bz, B.SPRUCE_LOG, true);
    put(bx, baseY - 1, bz, B.DIRT, true);
  }

  // chunk generation ---------------------------------------------------------
  // cx, cz are wrapped chunk coordinates. Returns a Uint8Array of blocks.
  function genChunk(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const idx = (x, y, z) => (y * CHUNK + z) * CHUNK + x;

    // pre-compute heights/biomes for the chunk plus a border (trees reach in)
    const N = 26, OFF = 5;
    const HH = new Int16Array(N * N), BB = new Uint8Array(N * N);
    for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) {
      const wx = U.wrap(cx * CHUNK + gx - OFF), wz = U.wrap(cz * CHUNK + gz - OFF);
      const mf = mountainF(wx, wz);
      const h = heightAt(wx, wz);
      HH[gz * N + gx] = h;
      BB[gz * N + gx] = biomeAt(wx, wz, h, mf);
    }

    for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
      const gi = (lz + OFF) * N + lx + OFF;
      const h = HH[gi], b = BB[gi];
      const wx = U.wrap(cx * CHUNK + lx), wz = U.wrap(cz * CHUNK + lz);
      const noCaves = h <= SEA + 3;

      // base stone + bedrock + caves + ores
      for (let y = 0; y <= h; y++) {
        if (y === 0 || (y === 1 && R(wx, y, wz) < 0.55) || (y === 2 && R(wx, y, wz) < 0.2)) {
          data[idx(lx, y, lz)] = B.BEDROCK; continue;
        }
        if (!noCaves && y >= 4 && caveAt(wx, y, wz)) continue; // carved out

        let id = B.STONE;
        const vx = wx >> 1, vy = y >> 1, vz = wz >> 1; // 2x2x2 vein cells
        if (y < 64 && R(vx, vy, vz + 11111) < 0.010 && R(wx, y, wz + 55555) < 0.75) id = B.COAL_ORE;
        else if (y < 42 && R(vx, vy, vz + 22222) < 0.008 && R(wx, y, wz + 55555) < 0.7) id = B.IRON_ORE;
        else if (y < 24 && R(vx, vy, vz + 33333) < 0.005 && R(wx, y, wz + 55555) < 0.7) id = B.GOLD_ORE;
        else if (y < 15 && R(vx, vy, vz + 44444) < 0.0045 && R(wx, y, wz + 55555) < 0.65) id = B.DIAMOND_ORE;
        data[idx(lx, y, lz)] = id;
      }

      // surface layers (find the real top — caves may have breached it)
      let ys = -1;
      for (let y = Math.min(h, HEIGHT - 1); y >= 0; y--) {
        if (data[idx(lx, y, lz)]) { ys = y; break; }
      }
      if (ys > 2) {
        let top = B.GRASS, filler = B.DIRT, fillDepth = 3;
        if (b === BIO.OCEAN) { top = R(wx, 3, wz) < 0.55 ? B.SAND : B.GRAVEL; filler = top; fillDepth = 2; }
        else if (b === BIO.BEACH || b === BIO.DESERT) { top = B.SAND; filler = B.SAND; fillDepth = 3; }
        else if (b === BIO.SNOWY) { top = B.SNOWGRASS; }
        else if (b === BIO.MOUNTAIN) {
          if (ys > 66) { top = B.SNOW; filler = B.STONE; }
          else { top = B.STONE; filler = B.STONE; }
        }
        if (data[idx(lx, ys, lz)] !== B.BEDROCK) data[idx(lx, ys, lz)] = top;
        for (let k = 1; k <= fillDepth; k++) {
          const y = ys - k; if (y < 1) break;
          const cur = data[idx(lx, y, lz)];
          if (cur && cur !== B.BEDROCK) data[idx(lx, y, lz)] = filler;
        }
        if (b === BIO.DESERT || b === BIO.BEACH) {
          for (let k = fillDepth + 1; k <= fillDepth + 3; k++) {
            const y = ys - k; if (y < 1) break;
            if (data[idx(lx, y, lz)] === B.STONE) data[idx(lx, y, lz)] = B.SANDSTONE;
          }
        }
      }

      // water + ice
      if (h < SEA) {
        for (let y = h + 1; y <= SEA; y++) if (!data[idx(lx, y, lz)]) data[idx(lx, y, lz)] = B.WATER;
        if (b === BIO.SNOWY || (b === BIO.OCEAN && climate(wx, wz)[0] < 0.28)) data[idx(lx, SEA, lz)] = B.ICE;
      }

      // small surface decorations
      if (ys === h && h > SEA && h + 1 < HEIGHT) {
        const r = R(wx, 999, wz);
        const above = idx(lx, h + 1, lz);
        if (b === BIO.PLAINS || b === BIO.FOREST) {
          const gDens = b === BIO.FOREST ? 0.045 : 0.055;
          if (r < gDens) data[above] = B.TALLGRASS;
          else if (r < gDens + 0.008) data[above] = B.FLOWER_YELLOW;
          else if (r < gDens + 0.015) data[above] = B.FLOWER_RED;
        } else if (b === BIO.DESERT) {
          if (r < 0.005) {
            const ch = 1 + ((R(wx, 55, wz) * 3) | 0);
            for (let k = 0; k < ch && h + 1 + k < HEIGHT; k++) data[idx(lx, h + 1 + k, lz)] = B.CACTUS;
          } else if (r < 0.011) data[above] = B.DEADBUSH;
        } else if (b === BIO.SNOWY && r < 0.006) data[above] = B.DEADBUSH;
      }
    }

    // trees (scanned over the border region so canopies cross chunk seams)
    const put = (bx, y, bz, id, force) => {
      if (bx < 0 || bx > 15 || bz < 0 || bz > 15 || y < 1 || y >= HEIGHT) return;
      const i = idx(bx, y, bz);
      if (force || data[i] === B.AIR) data[i] = id;
    };
    for (let gz = 2; gz < N - 2; gz++) for (let gx = 2; gx < N - 2; gx++) {
      const bx = gx - OFF, bz = gz - OFF;             // chunk-local position of trunk
      if (bx < -3 || bx > 18 || bz < -3 || bz > 18) continue; // canopy can't reach the chunk
      const gi = gz * N + gx;
      const h = HH[gi], b = BB[gi];
      if (h <= SEA + 1) continue;
      const dens = treeDensity(b, h);
      if (!dens) continue;
      const wx = U.wrap(cx * CHUNK + bx), wz = U.wrap(cz * CHUNK + bz);
      const r = treeRand(wx, wz);
      if (r >= dens) continue;
      // keep only the strongest candidate in each 5x5 neighbourhood
      let best = true;
      for (let dz = -2; dz <= 2 && best; dz++) for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dz) continue;
        const gj = (gz + dz) * N + gx + dx;
        const nd = treeDensity(BB[gj], HH[gj]);
        if (!nd) continue;
        const nr = treeRand(U.wrap(wx + dx), U.wrap(wz + dz));
        if (nr < nd && nr < r) { best = false; break; }
      }
      if (!best) continue;
      const spruce = (b === BIO.SNOWY || b === BIO.MOUNTAIN);
      (spruce ? stampSpruce : stampOak)(put, bx, bz, h + 1, wx, wz);
    }

    MC.Airbase.stamp(data, cx, cz);
    return data;
  }

  // a decent spawn point: dry land, not a mountain top
  function findSpawn() {
    for (let i = 0; i < 400; i++) {
      const wx = U.wrap(8 + i * 37), wz = U.wrap(8 + i * 53);
      if (MC.Airbase.inOuter(wx, wz)) continue; // don't spawn the player inside a hangar wall
      const h = heightAt(wx, wz);
      const b = biomeAt(wx, wz, h);
      if (h > SEA + 1 && (b === BIO.PLAINS || b === BIO.FOREST || b === BIO.BEACH)) {
        return { x: wx + 0.5, y: h + 3, z: wz + 0.5 };
      }
    }
    return { x: 8.5, y: HEIGHT - 10, z: 8.5 };
  }

  return { genChunk, heightAt, biomeAt, findSpawn };
};
