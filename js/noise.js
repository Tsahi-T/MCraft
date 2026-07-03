// Seeded noise. The 2D perlin supports a periodic lattice, which is what makes the
// world tile seamlessly on its torus — noise(x) === noise(x + WORLD_BLOCKS).
MC.Noise = function (seed) {
  const S = seed >>> 0;
  const mod = MC.util.mod, lerp = MC.util.lerp;

  function hash(x, y, z) {
    let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) +
            Math.imul(z | 0, 1440662683) + Math.imul(S, 981039793);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
  }
  function rand(x, y, z) { return hash(x, y, z) / 4294967296; }

  const G = [1, 0, 0.7071, 0.7071, 0, 1, -0.7071, 0.7071, -1, 0, -0.7071, -0.7071, 0, -1, 0.7071, -0.7071];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);

  // 2D perlin, period = lattice period in cells (integer; 0 disables wrapping)
  function perlin2(x, y, period) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi, u = fade(xf), v = fade(yf);
    function g(ix, iy, dx, dy) {
      if (period > 0) { ix = mod(ix, period); iy = mod(iy, period); }
      const gi = (hash(ix, iy, 7) & 7) * 2;
      return G[gi] * dx + G[gi + 1] * dy;
    }
    return lerp(
      lerp(g(xi, yi, xf, yf), g(xi + 1, yi, xf - 1, yf), u),
      lerp(g(xi, yi + 1, xf, yf - 1), g(xi + 1, yi + 1, xf - 1, yf - 1), u), v);
  }

  function fbm2(x, y, octaves, period) {
    let sum = 0, amp = 1, tot = 0, f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * perlin2(x * f, y * f, period > 0 ? period * f : 0);
      tot += amp; amp *= 0.5; f *= 2;
    }
    return sum / tot; // ~[-1, 1]
  }

  // 3D value noise; x/z wrap with the period, y is unbounded (used for caves)
  function value3(x, y, z, period) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = fade(xf), v = fade(yf), w = fade(zf);
    function val(ix, iy, iz) {
      let ax = ix, az = iz;
      if (period > 0) { ax = mod(ix, period); az = mod(iz, period); }
      return hash(ax, iy, az) / 2147483648 - 1;
    }
    const c000 = val(xi, yi, zi),     c100 = val(xi + 1, yi, zi);
    const c010 = val(xi, yi + 1, zi), c110 = val(xi + 1, yi + 1, zi);
    const c001 = val(xi, yi, zi + 1),     c101 = val(xi + 1, yi, zi + 1);
    const c011 = val(xi, yi + 1, zi + 1), c111 = val(xi + 1, yi + 1, zi + 1);
    return lerp(
      lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
      lerp(lerp(c001, c101, u), lerp(c011, c111, u), v), w);
  }

  return { hash, rand, perlin2, fbm2, value3 };
};
