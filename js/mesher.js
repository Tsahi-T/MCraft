// Turns chunk voxel data into three.js BufferGeometries.
// Per-vertex ambient occlusion + fake column skylight give the Minecraft look.
MC.Mesher = (function () {
  const CFG = MC.CFG, B = MC.B;
  const { CHUNK, HEIGHT } = CFG;

  // face table (corner order forms a triangle strip: 0,1,2 / 2,1,3)
  const FACES = [
    { face: 'side', dir: [-1, 0, 0], shade: 0.63, corners: [
      { pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] }] },
    { face: 'side', dir: [1, 0, 0], shade: 0.63, corners: [
      { pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] }] },
    { face: 'bottom', dir: [0, -1, 0], shade: 0.5, corners: [
      { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] }] },
    { face: 'top', dir: [0, 1, 0], shade: 1.0, corners: [
      { pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] }] },
    { face: 'side', dir: [0, 0, -1], shade: 0.8, corners: [
      { pos: [1, 0, 0], uv: [0, 0] }, { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 1] }] },
    { face: 'side', dir: [0, 0, 1], shade: 0.8, corners: [
      { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] }] }
  ];
  // tangent axes per face (for AO sampling)
  for (const f of FACES) {
    f.t1 = f.dir[0] ? [0, 1, 0] : [1, 0, 0];
    f.t2 = f.dir[2] ? [0, 1, 0] : [0, 0, 1];
  }
  const AOF = [0.45, 0.66, 0.83, 1.0];

  // wcx/wcz are wrapped chunk coords; returns block getter over the 3x3 area
  function makeGetters(world, wcx, wcz) {
    const grid = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      grid.push(world.chunkAt(wcx + dx, wcz + dz));
    }
    function block(lx, y, lz) {
      if (y < 0) return B.BEDROCK;
      if (y >= HEIGHT) return B.AIR;
      const gx = lx + 16, gz = lz + 16;
      const ch = grid[(gz >> 4) * 3 + (gx >> 4)];
      if (!ch) return B.STONE;
      return ch.data[(y * CHUNK + (gz & 15)) * CHUNK + (gx & 15)];
    }
    function light(lx, y, lz) {
      // fake skylight: full above the column top, dimming with depth below it
      if (y >= HEIGHT) return 1;
      const gx = lx + 16, gz = lz + 16;
      const ch = grid[(gz >> 4) * 3 + (gx >> 4)];
      const top = ch ? ch.lightH[(gz & 15) * CHUNK + (gx & 15)] : HEIGHT;
      if (y >= top) return 1;
      return Math.max(0.16, Math.pow(0.8, top - y));
    }
    return { block, light };
  }

  function buildChunkGeometry(world, wcx, wcz) {
    const { block, light } = makeGetters(world, wcx, wcz);
    const buckets = {
      op: { pos: [], uv: [], col: [], idx: [] },
      cut: { pos: [], uv: [], col: [], idx: [] },
      tr: { pos: [], uv: [], col: [], idx: [] }
    };

    const occ = id => { const bl = MC.BLOCKS[id]; return bl && bl.occlude; };

    function quad(a, verts, uvRect, uvs, bright) {
      // verts: 4x[x,y,z], bright: 4 brightness values, uvs: 4x[u,v] in tile space
      const base = a.pos.length / 3;
      for (let i = 0; i < 4; i++) {
        a.pos.push(verts[i][0], verts[i][1], verts[i][2]);
        a.uv.push(
          uvRect[0] + uvs[i][0] * (uvRect[2] - uvRect[0]),
          uvRect[1] + uvs[i][1] * (uvRect[3] - uvRect[1])
        );
        const c = bright[i];
        a.col.push(c, c, c);
      }
      // flip the quad diagonal when AO is asymmetric (avoids banding)
      if (bright[0] + bright[3] >= bright[1] + bright[2]) {
        a.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      } else {
        a.idx.push(base + 1, base + 3, base, base, base + 3, base + 2);
      }
    }

    function addCube(id, x, y, z) {
      const bl = MC.BLOCKS[id];
      const bucket = buckets[bl.bucket];
      for (const f of FACES) {
        const nx = x + f.dir[0], ny = y + f.dir[1], nz = z + f.dir[2];
        const nId = block(nx, ny, nz);
        const nBl = MC.BLOCKS[nId];
        if (nBl.opaque) continue;                 // hidden face
        if (!bl.opaque && nId === id) continue;   // glass-glass, leaves-leaves, ice-ice
        const L = light(nx, ny, nz);
        const bright = [];
        for (const c of f.corners) {
          let aoLvl = 3;
          if (bl.occlude || bl.opaque) {
            const s1s = c.pos[f.t1[0] ? 0 : (f.t1[1] ? 1 : 2)] ? 1 : -1;
            const s2s = c.pos[f.t2[0] ? 0 : (f.t2[1] ? 1 : 2)] ? 1 : -1;
            const s1 = occ(block(nx + f.t1[0] * s1s, ny + f.t1[1] * s1s, nz + f.t1[2] * s1s)) ? 1 : 0;
            const s2 = occ(block(nx + f.t2[0] * s2s, ny + f.t2[1] * s2s, nz + f.t2[2] * s2s)) ? 1 : 0;
            const co = occ(block(
              nx + f.t1[0] * s1s + f.t2[0] * s2s,
              ny + f.t1[1] * s1s + f.t2[1] * s2s,
              nz + f.t1[2] * s1s + f.t2[2] * s2s)) ? 1 : 0;
            aoLvl = (s1 && s2) ? 0 : 3 - (s1 + s2 + co);
          }
          bright.push(Math.min(1, f.shade * AOF[aoLvl] * L));
        }
        const uvRect = MC.tileUV(MC.tileFor(id, f.face));
        const verts = f.corners.map(c => [x + c.pos[0], y + c.pos[1], z + c.pos[2]]);
        quad(bucket, verts, uvRect, f.corners.map(c => c.uv), bright);
      }
    }

    function addWater(id, x, y, z) {
      const bucket = buckets.tr;
      const uvRect = MC.tileUV(MC.tileFor(id, 'top'));
      const aboveWater = block(x, y + 1, z) === B.WATER;
      const topY = aboveWater ? 1 : 0.875;
      const L = Math.min(1, light(x, y + 1, z) + 0.15);
      const seeThrough = n => { const nb = MC.BLOCKS[n]; return n === B.AIR || nb.kind === 'cross'; };

      if (!aboveWater && !MC.BLOCKS[block(x, y + 1, z)].opaque) {
        const b4 = [L, L, L, L];
        quad(bucket,
          [[x, y + topY, z + 1], [x + 1, y + topY, z + 1], [x, y + topY, z], [x + 1, y + topY, z]],
          uvRect, [[1, 1], [0, 1], [1, 0], [0, 0]], b4);
      }
      for (const f of FACES) {
        if (f.dir[1] === 1) continue; // top handled above
        const nId = block(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
        if (!seeThrough(nId)) continue;
        const bl = Math.min(1, f.shade * light(x + f.dir[0], y + f.dir[1], z + f.dir[2]) + 0.1);
        const verts = f.corners.map(c => [x + c.pos[0], y + c.pos[1] * topY, z + c.pos[2]]);
        quad(bucket, verts, uvRect, f.corners.map(c => c.uv), [bl, bl, bl, bl]);
      }
    }

    function addCross(id, x, y, z) {
      const bucket = buckets.cut;
      const uvRect = MC.tileUV(MC.tileFor(id, 'side'));
      const L = Math.min(1, light(x, y, z) + 0.05);
      const b4 = [L, L, L, L];
      const a = 0.146, b = 0.854; // inset diagonals
      quad(bucket, [[x + a, y + 1, z + a], [x + a, y, z + a], [x + b, y + 1, z + b], [x + b, y, z + b]],
        uvRect, [[0, 1], [0, 0], [1, 1], [1, 0]], b4);
      quad(bucket, [[x + a, y + 1, z + b], [x + a, y, z + b], [x + b, y + 1, z + a], [x + b, y, z + a]],
        uvRect, [[0, 1], [0, 0], [1, 1], [1, 0]], b4);
    }

    const ch = world.chunkAt(wcx, wcz);
    for (let y = 0; y < HEIGHT; y++) for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
      const id = ch.data[(y * CHUNK + z) * CHUNK + x];
      if (!id) continue;
      const bl = MC.BLOCKS[id];
      if (bl.kind === 'fluid') addWater(id, x, y, z);
      else if (bl.kind === 'cross') addCross(id, x, y, z);
      else addCube(id, x, y, z);
    }

    const out = {};
    for (const name of ['op', 'cut', 'tr']) {
      const a = buckets[name];
      if (!a.idx.length) { out[name] = null; continue; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3));
      g.setIndex(a.idx);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, HEIGHT / 2, 8), Math.sqrt(64 + HEIGHT * HEIGHT / 4 + 64) + 1);
      out[name] = g;
    }
    return out;
  }

  return { buildChunkGeometry };
})();
