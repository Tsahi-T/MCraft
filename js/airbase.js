// A single, fixed air-force base stamped into the world after normal terrain
// and tree generation. Coordinates are absolute world space and intentionally
// kept well inside the torus (no seam-wrapping needed for a one-off structure).
MC.Airbase = (function () {
  const CFG = MC.CFG, B = MC.B;
  const { CHUNK, HEIGHT } = CFG;

  const Y = 38;                 // pad elevation
  const X0 = 440, Z0 = 460;     // outer footprint origin (world coords)
  const W = 150, D = 100;       // outer footprint size
  const X1 = X0 + W, Z1 = Z0 + D;

  // all sub-areas are in LOCAL coords, relative to (X0, Z0)
  const RUNWAY  = { x0: 15, z0: 42, x1: 135, z1: 52 };
  const TAXIWAY = { x0: 96, z0: 52, x1: 104, z1: 70 };
  const APRON   = { x0: 15, z0: 68, x1: 140, z1: 92 };
  const HANGARS = [
    { x0: 20, z0: 68, x1: 48, z1: 90, h: 12 },
    { x0: 54, z0: 68, x1: 82, z1: 90, h: 12 }
  ];
  const TOWER = { x0: 126, z0: 14, x1: 132, z1: 20, h: 20, cabinH: 6, cabinPad: 1 };
  const PLANES = [
    { x: 34, z: 82, axis: 'z', dir: -1 },  // parked inside hangar 1, nose toward the open door
    { x: 68, z: 82, axis: 'z', dir: -1 },  // parked inside hangar 2
    { x: 110, z: 82, axis: 'x', dir: 1 },  // parked on open apron
    { x: 122, z: 82, axis: 'x', dir: -1 }
  ];

  function inOuter(wx, wz) { return wx >= X0 && wx < X1 && wz >= Z0 && wz < Z1; }

  // fills a world-space box [wx0,wx1) x [wy0,wy1) x [wz0,wz1) into one chunk's
  // local data array, clipped to that chunk's 16x16 columns
  function box(data, cx, cz, wx0, wy0, wz0, wx1, wy1, wz1, id) {
    const cwx0 = cx * CHUNK, cwz0 = cz * CHUNK;
    const lx0 = Math.max(wx0, cwx0) - cwx0, lx1 = Math.min(wx1, cwx0 + CHUNK) - cwx0;
    const lz0 = Math.max(wz0, cwz0) - cwz0, lz1 = Math.min(wz1, cwz0 + CHUNK) - cwz0;
    if (lx0 >= lx1 || lz0 >= lz1) return;
    const ly0 = Math.max(0, wy0), ly1 = Math.min(HEIGHT, wy1);
    for (let ly = ly0; ly < ly1; ly++) for (let lz = lz0; lz < lz1; lz++) for (let lx = lx0; lx < lx1; lx++) {
      data[(ly * CHUNK + lz) * CHUNK + lx] = id;
    }
  }
  function put(data, cx, cz, wx, wy, wz, id) { box(data, cx, cz, wx, wy, wz, wx + 1, wy + 1, wz + 1, id); }

  function stampRunwayMarkings(data, cx, cz) {
    const midZ = ((RUNWAY.z0 + RUNWAY.z1) / 2) | 0;
    for (let x = RUNWAY.x0 + 6; x < RUNWAY.x1 - 6; x += 8) {
      box(data, cx, cz, X0 + x, Y, Z0 + midZ - 1, X0 + x + 3, Y + 1, Z0 + midZ + 1, B.STRIPE);
    }
    for (let x = RUNWAY.x0; x < RUNWAY.x1; x += 10) {
      put(data, cx, cz, X0 + x, Y + 1, Z0 + RUNWAY.z0 - 2, B.GLOWSTONE);
      put(data, cx, cz, X0 + x, Y + 1, Z0 + RUNWAY.z1 + 1, B.GLOWSTONE);
    }
  }

  function stampHangar(data, cx, cz, hg) {
    const { x0, z0, x1, z1, h } = hg;
    box(data, cx, cz, X0 + x0, Y, Z0 + z0, X0 + x1, Y + 1, Z0 + z1, B.CONCRETE); // floor
    // walls: west, east, back (high-z) — north (low-z, apron-facing) stays open as the door
    box(data, cx, cz, X0 + x0, Y + 1, Z0 + z0, X0 + x0 + 1, Y + h, Z0 + z1, B.CONCRETE);
    box(data, cx, cz, X0 + x1 - 1, Y + 1, Z0 + z0, X0 + x1, Y + h, Z0 + z1, B.CONCRETE);
    box(data, cx, cz, X0 + x0, Y + 1, Z0 + z1 - 1, X0 + x1, Y + h, Z0 + z1, B.CONCRETE);
    box(data, cx, cz, X0 + x0, Y + h, Z0 + z0, X0 + x1, Y + h + 1, Z0 + z1, B.METAL); // roof
  }

  function stampTower(data, cx, cz) {
    const { x0, z0, x1, z1, h, cabinH, cabinPad } = TOWER;
    box(data, cx, cz, X0 + x0, Y, Z0 + z0, X0 + x1, Y + h, Z0 + z1, B.CONCRETE); // shaft
    const cx0 = x0 - cabinPad, cx1 = x1 + cabinPad, cz0 = z0 - cabinPad, cz1 = z1 + cabinPad;
    box(data, cx, cz, X0 + cx0, Y + h, Z0 + cz0, X0 + cx1, Y + h + cabinH, Z0 + cz1, B.GLASS); // cabin shell
    box(data, cx, cz, X0 + cx0 + 1, Y + h + 1, Z0 + cz0 + 1, X0 + cx1 - 1, Y + h + cabinH, Z0 + cz1 - 1, B.AIR); // hollow
    box(data, cx, cz, X0 + cx0, Y + h + cabinH, Z0 + cz0, X0 + cx1, Y + h + cabinH + 1, Z0 + cz1, B.METAL); // roof
    const midX = ((cx0 + cx1) / 2) | 0, midZ = ((cz0 + cz1) / 2) | 0;
    put(data, cx, cz, X0 + midX, Y + h + cabinH + 1, Z0 + midZ, B.BEACON);
  }

  function stampPlane(data, cx, cz, p) {
    const gy = Y + 1;
    const along = p.axis === 'x' ? [p.dir, 0] : [0, p.dir];
    const across = p.axis === 'x' ? [0, 1] : [1, 0];
    for (let i = 0; i < 7; i++) { // fuselage, nose (glass) at i=6
      put(data, cx, cz, X0 + p.x + along[0] * i, gy, Z0 + p.z + along[1] * i, i === 6 ? B.GLASS : B.METAL);
    }
    for (let i = -3; i <= 3; i++) { // wings through the midpoint
      put(data, cx, cz, X0 + p.x + along[0] * 3 + across[0] * i, gy, Z0 + p.z + along[1] * 3 + across[1] * i, B.METAL);
    }
    put(data, cx, cz, X0 + p.x, gy + 1, Z0 + p.z, B.METAL); // tail fin
    put(data, cx, cz, X0 + p.x, gy + 2, Z0 + p.z, B.METAL);
  }

  function stamp(data, cx, cz) {
    const cwx0 = cx * CHUNK, cwz0 = cz * CHUNK;
    if (cwx0 + CHUNK <= X0 || cwx0 >= X1 || cwz0 + CHUNK <= Z0 || cwz0 >= Z1) return; // chunk doesn't touch the base

    // flat plateau: solid stone foundation + thin dirt/grass cap, bulldoze everything above
    box(data, cx, cz, X0, 1, Z0, X1, Y - 4, Z1, B.STONE);
    box(data, cx, cz, X0, Y - 4, Z0, X1, Y, Z1, B.DIRT);
    box(data, cx, cz, X0, Y, Z0, X1, Y + 1, Z1, B.GRASS);
    box(data, cx, cz, X0, Y + 1, Z0, X1, HEIGHT - 1, Z1, B.AIR);

    box(data, cx, cz, X0 + RUNWAY.x0, Y, Z0 + RUNWAY.z0, X0 + RUNWAY.x1, Y + 1, Z0 + RUNWAY.z1, B.ASPHALT);
    box(data, cx, cz, X0 + TAXIWAY.x0, Y, Z0 + TAXIWAY.z0, X0 + TAXIWAY.x1, Y + 1, Z0 + TAXIWAY.z1, B.ASPHALT);
    box(data, cx, cz, X0 + APRON.x0, Y, Z0 + APRON.z0, X0 + APRON.x1, Y + 1, Z0 + APRON.z1, B.CONCRETE);
    stampRunwayMarkings(data, cx, cz);
    for (const hg of HANGARS) stampHangar(data, cx, cz, hg);
    stampTower(data, cx, cz);
    for (const p of PLANES) stampPlane(data, cx, cz, p);
  }

  return { stamp, inOuter, X0, Z0, X1, Z1, Y, W, D };
})();
