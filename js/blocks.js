// Block + texture-tile registries.
// Tile indices point into the 16x16 procedural atlas built in textures.js.

MC.T = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, BEDROCK: 5, SAND: 6, GRAVEL: 7,
  LOG_SIDE: 8, LOG_TOP: 9, PLANKS: 10, LEAVES: 11, WATER: 12, GLASS: 13, SNOW: 14, GRASS_SIDE_SNOW: 15,
  CACTUS_SIDE: 16, CACTUS_TOP: 17, FLOWER_RED: 18, FLOWER_YELLOW: 19, TALLGRASS: 20,
  COAL: 21, IRON: 22, GOLD: 23, DIAMOND: 24, BRICK: 25, GLOW: 26, LEAVES_SPRUCE: 27,
  SANDSTONE_SIDE: 28, SANDSTONE_TOP: 29, ICE: 30, DEADBUSH: 31, LOG_SPRUCE: 32,
  ASPHALT: 33, CONCRETE: 34, METAL: 35, STRIPE: 36, BEACON: 37
};

MC.B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, BEDROCK: 5, SAND: 6, GRAVEL: 7,
  LOG: 8, LEAVES: 9, PLANKS: 10, WATER: 11, GLASS: 12, SNOWGRASS: 13, SNOW: 14,
  CACTUS: 15, FLOWER_RED: 16, FLOWER_YELLOW: 17, TALLGRASS: 18,
  COAL_ORE: 19, IRON_ORE: 20, GOLD_ORE: 21, DIAMOND_ORE: 22, BRICK: 23, GLOWSTONE: 24,
  SPRUCE_LOG: 25, SPRUCE_LEAVES: 26, SANDSTONE: 27, ICE: 28, DEADBUSH: 29,
  ASPHALT: 30, CONCRETE: 31, METAL: 32, STRIPE: 33, BEACON: 34
};

// kind:    'solid' | 'cross' | 'fluid'
// bucket:  'op' opaque mesh | 'cut' alpha-tested mesh | 'tr' translucent mesh
// solid:   blocks player movement
// opaque:  hides neighbouring faces completely
// occlude: contributes to ambient occlusion
// hard:    0 soft .. 3 hard (used for break sound pitch)
(function () {
  const T = MC.T;
  const def = (name, o) => Object.assign({
    name, kind: 'solid', bucket: 'op', solid: true, opaque: true, occlude: true,
    breakable: true, pick: true, hard: 1, tiles: null
  }, o);

  MC.BLOCKS = [];
  const B = MC.BLOCKS;
  B[MC.B.AIR]        = def('אוויר', { solid: false, opaque: false, occlude: false, pick: false });
  B[MC.B.GRASS]      = def('דשא', { tiles: { top: T.GRASS_TOP, bottom: T.DIRT, side: T.GRASS_SIDE }, hard: 0 });
  B[MC.B.DIRT]       = def('אדמה', { tiles: { all: T.DIRT }, hard: 0 });
  B[MC.B.STONE]      = def('אבן', { tiles: { all: T.STONE }, hard: 2 });
  B[MC.B.COBBLE]     = def('אבן מרוצפת', { tiles: { all: T.COBBLE }, hard: 2 });
  B[MC.B.BEDROCK]    = def('סלע יסוד', { tiles: { all: T.BEDROCK }, hard: 3, breakable: false, pick: false });
  B[MC.B.SAND]       = def('חול', { tiles: { all: T.SAND }, hard: 0 });
  B[MC.B.GRAVEL]     = def('חצץ', { tiles: { all: T.GRAVEL }, hard: 0 });
  B[MC.B.LOG]        = def('בול עץ אלון', { tiles: { top: T.LOG_TOP, bottom: T.LOG_TOP, side: T.LOG_SIDE }, hard: 1 });
  B[MC.B.LEAVES]     = def('עלים', { bucket: 'cut', opaque: false, tiles: { all: T.LEAVES }, hard: 0 });
  B[MC.B.PLANKS]     = def('קרשים', { tiles: { all: T.PLANKS }, hard: 1 });
  B[MC.B.WATER]      = def('מים', { kind: 'fluid', bucket: 'tr', solid: false, opaque: false, occlude: false, tiles: { all: T.WATER }, hard: 0 });
  B[MC.B.GLASS]      = def('זכוכית', { bucket: 'cut', opaque: false, occlude: false, tiles: { all: T.GLASS }, hard: 0 });
  B[MC.B.SNOWGRASS]  = def('דשא מושלג', { tiles: { top: T.SNOW, bottom: T.DIRT, side: T.GRASS_SIDE_SNOW }, hard: 0 });
  B[MC.B.SNOW]       = def('שלג', { tiles: { all: T.SNOW }, hard: 0 });
  B[MC.B.CACTUS]     = def('קקטוס', { bucket: 'cut', opaque: false, tiles: { top: T.CACTUS_TOP, bottom: T.CACTUS_TOP, side: T.CACTUS_SIDE }, hard: 0 });
  B[MC.B.FLOWER_RED]    = def('פרג', { kind: 'cross', bucket: 'cut', solid: false, opaque: false, occlude: false, tiles: { all: T.FLOWER_RED }, hard: 0 });
  B[MC.B.FLOWER_YELLOW] = def('שן הארי', { kind: 'cross', bucket: 'cut', solid: false, opaque: false, occlude: false, tiles: { all: T.FLOWER_YELLOW }, hard: 0 });
  B[MC.B.TALLGRASS]  = def('עשב גבוה', { kind: 'cross', bucket: 'cut', solid: false, opaque: false, occlude: false, tiles: { all: T.TALLGRASS }, hard: 0 });
  B[MC.B.COAL_ORE]   = def('עפרת פחם', { tiles: { all: T.COAL }, hard: 2 });
  B[MC.B.IRON_ORE]   = def('עפרת ברזל', { tiles: { all: T.IRON }, hard: 2 });
  B[MC.B.GOLD_ORE]   = def('עפרת זהב', { tiles: { all: T.GOLD }, hard: 2 });
  B[MC.B.DIAMOND_ORE]= def('עפרת יהלום', { tiles: { all: T.DIAMOND }, hard: 3 });
  B[MC.B.BRICK]      = def('לבנים', { tiles: { all: T.BRICK }, hard: 2 });
  B[MC.B.GLOWSTONE]  = def('אבן זוהרת', { tiles: { all: T.GLOW }, hard: 1 });
  B[MC.B.SPRUCE_LOG] = def('בול עץ אשוח', { tiles: { top: T.LOG_TOP, bottom: T.LOG_TOP, side: T.LOG_SPRUCE }, hard: 1 });
  B[MC.B.SPRUCE_LEAVES] = def('עלי אשוח', { bucket: 'cut', opaque: false, tiles: { all: T.LEAVES_SPRUCE }, hard: 0 });
  B[MC.B.SANDSTONE]  = def('אבן חול', { tiles: { top: T.SANDSTONE_TOP, bottom: T.SANDSTONE_TOP, side: T.SANDSTONE_SIDE }, hard: 2 });
  B[MC.B.ICE]        = def('קרח', { bucket: 'tr', opaque: false, occlude: false, tiles: { all: T.ICE }, hard: 1 });
  B[MC.B.DEADBUSH]   = def('שיח יבש', { kind: 'cross', bucket: 'cut', solid: false, opaque: false, occlude: false, tiles: { all: T.DEADBUSH }, hard: 0 });
  B[MC.B.ASPHALT]    = def('אספלט', { tiles: { all: T.ASPHALT }, hard: 2 });
  B[MC.B.CONCRETE]   = def('בטון', { tiles: { all: T.CONCRETE }, hard: 2 });
  B[MC.B.METAL]      = def('מתכת', { tiles: { all: T.METAL }, hard: 2 });
  B[MC.B.STRIPE]     = def('פס סימון', { tiles: { all: T.STRIPE }, hard: 1 });
  B[MC.B.BEACON]     = def('פנס אזהרה', { tiles: { all: T.BEACON }, hard: 1 });

  MC.tileFor = function (id, face) {
    // face: 'top' | 'bottom' | 'side'
    const t = MC.BLOCKS[id].tiles;
    if (t.all !== undefined) return t.all;
    return t[face];
  };

  // ids the player can put in the hotbar / palette
  MC.PICKABLE = [];
  for (let i = 1; i < B.length; i++) if (B[i] && B[i].pick) MC.PICKABLE.push(i);

  MC.DEFAULT_HOTBAR = [
    MC.B.GRASS, MC.B.DIRT, MC.B.STONE, MC.B.COBBLE, MC.B.PLANKS,
    MC.B.LOG, MC.B.LEAVES, MC.B.GLASS, MC.B.GLOWSTONE
  ];
})();
