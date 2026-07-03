// Touch controls for phones/tablets: virtual joystick (move), drag-to-look,
// tap = place, press-and-hold = break, plus jump/fly/pause buttons.
// Hold/repeat timing is driven from the main loop via update() — no timers,
// so it stays in sync with the game even when the browser throttles timeouts.
MC.Touch = (function () {
  const state = {
    enabled: false,
    moveX: 0, moveZ: 0 // analog stick, same space as the WASD input vector
  };

  const HOLD_MS = 350, TAP_MS = 300, TAP_SLOP = 14, BREAK_REPEAT_MS = 320;
  let opts = null;
  let joyTouch = null;   // {id, cx, cy}
  let lookTouch = null;  // {id, x, y, t0, moved, breaking, lastBreak}
  let stickEl = null;

  function detect(force) {
    // (pointer: coarse) = the PRIMARY pointer is a finger, so touch-laptops
    // with a mouse keep the desktop flow
    return !!force || matchMedia('(pointer: coarse)').matches;
  }

  function buildUI() {
    const ui = document.createElement('div');
    ui.id = 'touch-ui';
    ui.innerHTML =
      '<div id="joy-base"><div id="joy-stick"></div></div>' +
      '<div class="tbtn" id="tb-jump">⬆</div>' +
      '<div class="tbtn small" id="tb-fly">✈</div>' +
      '<div class="tbtn small" id="tb-down">⬇</div>' +
      '<div class="tbtn tiny" id="tb-pause">⏸</div>' +
      '<div class="tbtn tiny" id="tb-map">🗺</div>' +
      '<div class="tbtn tiny" id="tb-inv">🎒</div>';
    document.body.appendChild(ui);
    stickEl = document.getElementById('joy-stick');

    const hold = (id, code) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', e => { e.preventDefault(); el.classList.add('on'); opts.keys.add(code); }, { passive: false });
      const off = e => { e.preventDefault(); el.classList.remove('on'); opts.keys.delete(code); };
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('touchcancel', off, { passive: false });
    };
    const tap = (id, fn) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
    };
    hold('tb-jump', 'Space');
    hold('tb-down', 'KeyC');
    tap('tb-fly', () => opts.onToggleFly());
    tap('tb-pause', () => opts.onPause());
    tap('tb-map', () => MC.UI.toggleBigMap());
    tap('tb-inv', () => MC.UI.togglePalette());

    // joystick
    const base = document.getElementById('joy-base');
    const R = 44;
    function setStick(dx, dy) {
      const m = Math.hypot(dx, dy);
      if (m > R) { dx = dx / m * R; dy = dy / m * R; }
      stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
      state.moveX = dx / R;
      state.moveZ = dy / R; // screen-up (negative dy) = forward (negative fz)
      // pushed to the rim = sprint
      if (Math.hypot(state.moveX, state.moveZ) > 0.92) opts.keys.add('ShiftLeft');
      else opts.keys.delete('ShiftLeft');
    }
    base.addEventListener('touchstart', e => {
      e.preventDefault();
      if (joyTouch) return;
      const t = e.changedTouches[0];
      const r = base.getBoundingClientRect();
      joyTouch = { id: t.identifier, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      setStick(t.clientX - joyTouch.cx, t.clientY - joyTouch.cy);
    }, { passive: false });
    base.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!joyTouch) return;
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouch.id) setStick(t.clientX - joyTouch.cx, t.clientY - joyTouch.cy);
      }
    }, { passive: false });
    const joyEnd = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (joyTouch && t.identifier === joyTouch.id) {
          joyTouch = null;
          state.moveX = state.moveZ = 0;
          stickEl.style.transform = '';
          opts.keys.delete('ShiftLeft');
        }
      }
    };
    base.addEventListener('touchend', joyEnd, { passive: false });
    base.addEventListener('touchcancel', joyEnd, { passive: false });
  }

  function bindLook(canvas) {
    const SENS = 0.0045;
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      if (lookTouch) return;
      const t = e.changedTouches[0];
      lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY, t0: performance.now(), moved: 0, breaking: false, lastBreak: 0 };
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!lookTouch || !opts.isPlaying()) { if (!opts.isPlaying()) return; }
      for (const t of e.changedTouches) {
        if (!lookTouch || t.identifier !== lookTouch.id) continue;
        const dx = t.clientX - lookTouch.x, dy = t.clientY - lookTouch.y;
        lookTouch.x = t.clientX; lookTouch.y = t.clientY;
        lookTouch.moved += Math.abs(dx) + Math.abs(dy);
        opts.player.yaw -= dx * SENS;
        opts.player.pitch = MC.util.clamp(opts.player.pitch - dy * SENS, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
      }
    }, { passive: false });
    const end = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (!lookTouch || t.identifier !== lookTouch.id) continue;
        const lt = lookTouch;
        lookTouch = null;
        if (!opts.isPlaying()) continue;
        if (!lt.breaking && lt.moved < TAP_SLOP && performance.now() - lt.t0 < TAP_MS) {
          opts.onTapPlace(t.clientX, t.clientY);
        }
      }
    };
    canvas.addEventListener('touchend', end, { passive: false });
    canvas.addEventListener('touchcancel', end, { passive: false });
  }

  // called every frame from the game loop; drives hold-to-break
  state.update = function () {
    if (!lookTouch || !opts.isPlaying()) return;
    const now = performance.now();
    if (!lookTouch.breaking && lookTouch.moved < TAP_SLOP && now - lookTouch.t0 > HOLD_MS) {
      lookTouch.breaking = true;
      lookTouch.lastBreak = 0;
    }
    if (lookTouch.breaking && now - lookTouch.lastBreak > BREAK_REPEAT_MS) {
      lookTouch.lastBreak = now;
      opts.onHoldBreak(lookTouch.x, lookTouch.y);
    }
  };

  // opts: {force, canvas, keys, player, isPlaying, onTapPlace, onHoldBreak, onToggleFly, onPause}
  state.init = function (o) {
    state.enabled = detect(o.force);
    if (!state.enabled) return false;
    opts = o;
    document.body.classList.add('touch');
    buildUI();
    bindLook(o.canvas);
    return true;
  };

  return state;
})();
