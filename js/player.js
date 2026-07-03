// First-person player: AABB physics vs voxels, walking / sprinting / swimming / flying.
MC.Player = function (world) {
  const CFG = MC.CFG, U = MC.util, B = MC.B;
  const HW = 0.3, HEIGHT = 1.8, EYE = 1.62, EPS = 0.001;

  const self = {
    pos: new THREE.Vector3(8, 60, 8),
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    onGround: false,
    flying: false,
    inWater: false,
    headInWater: false,
    sprinting: false
  };

  function solidAt(x, y, z) {
    const bl = MC.BLOCKS[world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))];
    return bl && bl.solid;
  }

  function boxCollides(px, py, pz) {
    const x0 = Math.floor(px - HW), x1 = Math.floor(px + HW);
    const y0 = Math.floor(py), y1 = Math.floor(py + HEIGHT);
    const z0 = Math.floor(pz - HW), z1 = Math.floor(pz + HW);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (solidAt(x + 0.5, y + 0.5, z + 0.5)) return { x, y, z };
    }
    return null;
  }

  function moveAxis(axis, delta) {
    if (!delta) return;
    const p = self.pos;
    p.setComponent(axis, p.getComponent(axis) + delta);
    const hit = boxCollides(p.x, p.y, p.z);
    if (!hit) return;
    const bc = axis === 0 ? hit.x : axis === 1 ? hit.y : hit.z;
    if (axis === 0) p.x = delta > 0 ? bc - HW - EPS : bc + 1 + HW + EPS;
    else if (axis === 2) p.z = delta > 0 ? bc - HW - EPS : bc + 1 + HW + EPS;
    else {
      if (delta > 0) p.y = bc - HEIGHT - EPS;
      else { p.y = bc + 1 + EPS; self.onGround = true; }
    }
    self.vel.setComponent(axis, 0);
  }

  self.update = function (dt, keys) {
    const v = self.vel;

    // water state
    const feet = world.getBlock(Math.floor(self.pos.x), Math.floor(self.pos.y + 0.4), Math.floor(self.pos.z));
    const head = world.getBlock(Math.floor(self.pos.x), Math.floor(self.pos.y + EYE), Math.floor(self.pos.z));
    self.inWater = feet === B.WATER || head === B.WATER;
    self.headInWater = head === B.WATER;

    // wish direction from keys, relative to yaw
    let fx = 0, fz = 0;
    if (keys.has('KeyW')) fz -= 1;
    if (keys.has('KeyS')) fz += 1;
    if (keys.has('KeyA')) fx -= 1;
    if (keys.has('KeyD')) fx += 1;
    if (MC.Touch && MC.Touch.enabled) { fx += MC.Touch.moveX; fz += MC.Touch.moveZ; }
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; } // keep analog (joystick) below full speed
    // rotate input into world space so W always follows the camera forward
    const sin = Math.sin(self.yaw), cos = Math.cos(self.yaw);
    const wx = fx * cos + fz * sin;
    const wz = -fx * sin + fz * cos;

    self.sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');

    if (self.flying) {
      const sp = CFG.FLY_SPEED * (self.sprinting ? 1.7 : 1);
      const damp = Math.pow(0.002, dt);
      v.x = v.x * damp + wx * sp * (1 - damp);
      v.z = v.z * damp + wz * sp * (1 - damp);
      let vy = 0;
      if (keys.has('Space')) vy += sp;
      if (keys.has('KeyC')) vy -= sp;
      v.y = v.y * damp + vy * (1 - damp);
    } else if (self.inWater) {
      const sp = 2.6;
      const damp = Math.pow(0.02, dt);
      v.x = v.x * damp + wx * sp * (1 - damp);
      v.z = v.z * damp + wz * sp * (1 - damp);
      v.y -= CFG.GRAVITY * 0.22 * dt;
      if (keys.has('Space')) v.y = Math.min(v.y + 22 * dt, 3.2);
      v.y = Math.max(v.y * Math.pow(0.25, dt), -3.5);
    } else {
      const sp = self.sprinting ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
      const control = self.onGround ? 1 : 0.35;
      const damp = Math.pow(self.onGround ? 0.0001 : 0.2, dt);
      v.x = v.x * damp + wx * sp * (1 - damp) * control + wx * sp * (1 - control) * (1 - damp) * 0;
      v.z = v.z * damp + wz * sp * (1 - damp) * control;
      v.y -= CFG.GRAVITY * dt;
      if (keys.has('Space') && self.onGround) { v.y = CFG.JUMP_SPEED; self.onGround = false; }
      v.y = Math.max(v.y, -60);
    }

    self.onGround = false;
    moveAxis(1, v.y * dt);
    moveAxis(0, v.x * dt);
    moveAxis(2, v.z * dt);

    if (self.pos.y < -10) { self.pos.y = MC.CFG.HEIGHT; v.y = 0; } // safety net
  };

  self.eyePos = function (out) {
    out = out || new THREE.Vector3();
    return out.set(self.pos.x, self.pos.y + EYE, self.pos.z);
  };
  self.lookDir = function (out) {
    out = out || new THREE.Vector3();
    const cp = Math.cos(self.pitch);
    return out.set(-Math.sin(self.yaw) * cp, Math.sin(self.pitch), -Math.cos(self.yaw) * cp);
  };
  // would placing a block at (x,y,z) overlap the player?
  self.overlapsBlock = function (x, y, z) {
    return x + 1 > self.pos.x - HW && x < self.pos.x + HW &&
           z + 1 > self.pos.z - HW && z < self.pos.z + HW &&
           y + 1 > self.pos.y && y < self.pos.y + HEIGHT;
  };

  return self;
};
