// MCraft — global configuration + tiny utils
window.MC = window.MC || {};

MC.CFG = {
  CHUNK: 16,            // chunk width in blocks
  HEIGHT: 96,           // world height in blocks
  SEA: 32,              // sea level
  WORLD_CHUNKS: 64,     // the world is a torus: it wraps after this many chunks (the "infinity" illusion)
  RENDER_DIST: 6,       // chunks rendered in every direction
  CHUNK_BUDGET_MS: 9,   // per-frame time budget for generating/meshing chunks
  DAY_LENGTH: 600,      // seconds for a full day+night cycle
  GRAVITY: 27,
  JUMP_SPEED: 8.8,
  WALK_SPEED: 4.3,
  SPRINT_SPEED: 6.4,
  FLY_SPEED: 11,
  REACH: 6,             // block interaction distance
  AUTOSAVE_SEC: 5,
  MAX_DATA_CHUNKS: 1200 // soft cap on generated chunks kept in memory
};
MC.CFG.WORLD_BLOCKS = MC.CFG.CHUNK * MC.CFG.WORLD_CHUNKS;

MC.util = {
  clamp: (v, a, b) => v < a ? a : (v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  smoothstep: (a, b, t) => {
    t = MC.util.clamp((t - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  },
  mod: (v, m) => ((v % m) + m) % m,
  wrap: v => MC.util.mod(v, MC.CFG.WORLD_BLOCKS),        // wrap a block coordinate
  wrapChunk: c => MC.util.mod(c, MC.CFG.WORLD_CHUNKS),   // wrap a chunk coordinate
  // shortest distance between two wrapped chunk coords on the torus
  torusDist: (a, b) => {
    const W = MC.CFG.WORLD_CHUNKS, d = Math.abs(MC.util.mod(a, W) - MC.util.mod(b, W));
    return Math.min(d, W - d);
  },
  hashStr: s => {
    let h = 2166136261; s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
};
