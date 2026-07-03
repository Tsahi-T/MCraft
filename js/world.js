// Chunk storage + block access. All coordinates wrap on the world torus,
// so walking "forever" silently revisits the same (editable) data.
MC.World = function (seed) {
  const CFG = MC.CFG, U = MC.util, B = MC.B;
  const { CHUNK, HEIGHT } = CFG;
  const gen = MC.WorldGen(seed);

  const chunks = new Map();  // 'cx,cz' (wrapped) -> {cx, cz, data, lightH}
  const edits = new Map();   // 'cx,cz' -> Map(blockIndex -> blockId), survives chunk eviction
  const dirty = new Set();   // wrapped chunk keys whose meshes must rebuild

  const key = (cx, cz) => cx + ',' + cz;
  const bidx = (x, y, z) => (y * CHUNK + z) * CHUNK + x;

  function computeLightColumn(ch, lx, lz) {
    let top = 0;
    for (let y = HEIGHT - 1; y >= 0; y--) {
      if (ch.data[bidx(lx, y, lz)]) { top = y + 1; break; }
    }
    ch.lightH[lz * CHUNK + lx] = top;
  }

  function ensureChunk(cx, cz) {
    cx = U.wrapChunk(cx); cz = U.wrapChunk(cz);
    const k = key(cx, cz);
    let ch = chunks.get(k);
    if (ch) return ch;
    const data = gen.genChunk(cx, cz);
    const em = edits.get(k);
    if (em) for (const [i, v] of em) data[i] = v;
    ch = { cx, cz, data, lightH: new Uint8Array(CHUNK * CHUNK) };
    for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) computeLightColumn(ch, lx, lz);
    chunks.set(k, ch);
    if (MC.onChunkReady) MC.onChunkReady(ch);
    return ch;
  }

  function chunkAt(cx, cz) {
    return chunks.get(key(U.wrapChunk(cx), U.wrapChunk(cz))) || null;
  }

  function getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= HEIGHT) return B.AIR;
    x = U.wrap(Math.floor(x)); z = U.wrap(Math.floor(z));
    const ch = chunks.get(key(x >> 4, z >> 4));
    if (!ch) return B.STONE; // ungenerated — treat as solid so nothing falls through
    return ch.data[bidx(x & 15, y, z & 15)];
  }

  function lightHeightAt(x, z) {
    x = U.wrap(Math.floor(x)); z = U.wrap(Math.floor(z));
    const ch = chunks.get(key(x >> 4, z >> 4));
    return ch ? ch.lightH[(z & 15) * CHUNK + (x & 15)] : HEIGHT;
  }

  function setBlock(x, y, z, id) {
    if (y < 1 || y >= HEIGHT) return false;
    x = U.wrap(Math.floor(x)); z = U.wrap(Math.floor(z));
    const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
    const ch = ensureChunk(cx, cz);
    const i = bidx(lx, y, lz);
    if (ch.data[i] === id) return false;
    ch.data[i] = id;
    computeLightColumn(ch, lx, lz);

    let em = edits.get(key(cx, cz));
    if (!em) { em = new Map(); edits.set(key(cx, cz), em); }
    em.set(i, id);

    dirty.add(key(cx, cz));
    if (lx === 0) dirty.add(key(U.wrapChunk(cx - 1), cz));
    if (lx === 15) dirty.add(key(U.wrapChunk(cx + 1), cz));
    if (lz === 0) dirty.add(key(cx, U.wrapChunk(cz - 1)));
    if (lz === 15) dirty.add(key(cx, U.wrapChunk(cz + 1)));
    if (lx === 0 && lz === 0) dirty.add(key(U.wrapChunk(cx - 1), U.wrapChunk(cz - 1)));
    if (lx === 15 && lz === 0) dirty.add(key(U.wrapChunk(cx + 1), U.wrapChunk(cz - 1)));
    if (lx === 0 && lz === 15) dirty.add(key(U.wrapChunk(cx - 1), U.wrapChunk(cz + 1)));
    if (lx === 15 && lz === 15) dirty.add(key(U.wrapChunk(cx + 1), U.wrapChunk(cz + 1)));

    if (MC.onColumnChange) MC.onColumnChange(x, z);
    return true;
  }

  // drop generated chunks that are far from the player (their edits persist)
  function evictFar(pcx, pcz) {
    if (chunks.size <= CFG.MAX_DATA_CHUNKS) return;
    const limit = CFG.RENDER_DIST + 4;
    for (const [k, ch] of chunks) {
      if (U.torusDist(ch.cx, pcx) > limit || U.torusDist(ch.cz, pcz) > limit) chunks.delete(k);
    }
  }

  // persistence ------------------------------------------------------------
  function exportEdits() {
    const out = {};
    for (const [k, em] of edits) {
      const arr = [];
      for (const [i, v] of em) { arr.push(i, v); }
      out[k] = arr;
    }
    return out;
  }
  function importEdits(obj) {
    if (!obj) return;
    for (const k in obj) {
      const em = new Map();
      const arr = obj[k];
      for (let i = 0; i < arr.length; i += 2) em.set(arr[i], arr[i + 1]);
      edits.set(k, em);
    }
  }

  return {
    seed, gen, chunks, dirty,
    ensureChunk, chunkAt, getBlock, setBlock, lightHeightAt, evictFar,
    exportEdits, importEdits,
    editCount: () => { let n = 0; for (const em of edits.values()) n += em.size; return n; },
    heightAt: gen.heightAt, biomeAt: gen.biomeAt, findSpawn: gen.findSpawn
  };
};
