/* The map: one world, three ways of seeing it, and it turns from one into the next.
     globe   the world as a ball that turns, and can be paused or dragged
     flat    the same world unrolled
     layers  the flat map pulled apart into sheets, the sea and one sheet per continent, as the posters come apart
   Every continent is drawn on its own sheet all the time. As a globe and as a flat map the sheets lie exactly on top of
   each other. Pulling them apart only moves the sheets. No map library is used: the outlines are Natural Earth's,
   prepared once by scripts/prepare_world.mjs. */

const RAD = Math.PI / 180, HALF = Math.PI / 2;
/* The flat map is the Natural Earth projection: gentle curved sides, nothing stretched to absurdity. */
function flat(lon, lat) {
  const p2 = lat * lat, p4 = p2 * p2;
  return [lon * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
    lat * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))];
}
const XMAX = flat(Math.PI, 0)[0], YMAX = flat(0, HALF)[1];
export const SHAPE = YMAX / XMAX;                                       // the flat map is this tall for every 1 wide
/* A few outlines run across the back of the map (Russia, Fiji) or wrap the pole (Antarctica). On a ball that is no trouble.
   On a flat map they must be cut: each is unrolled into one continuous shape and drawn again a whole turn away, and the
   map's own edge trims what falls outside. */
function unroll(pts) {
  const n = pts.length / 2, out = pts.slice(); let off = 0, crossed = false;
  for (let i = 1; i < n; i++) {
    const d = pts[i * 2] + off - out[(i - 1) * 2];
    if (d > 180) { off -= 360; crossed = true; } else if (d < -180) { off += 360; crossed = true; }
    out[i * 2] = pts[i * 2] + off;
  }
  if (!crossed) return [pts];
  if (Math.abs(out[(n - 1) * 2] - out[0]) > 180) { const pole = out[1] < 0 ? -90 : 90; out.push(out[(n - 1) * 2], pole, out[0], pole); }   // it wraps the pole: close it along the bottom of the map
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < out.length; i += 2) { lo = Math.min(lo, out[i]); hi = Math.max(hi, out[i]); }
  return [-360, 0, 360].filter(k => hi + k > -180 && lo + k < 180).map(k => out.map((v, i) => (i % 2 ? v : v + k)));
}
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const el = (tag, cls, attrs) => { const n = document.createElement(tag); if (cls) n.className = cls; for (const k in (attrs || {})) n.setAttribute(k, attrs[k]); return n; };

export function makeAtlas(stage, { continents, pins, calm = false, onPick = () => {}, onMode = () => {}, onSpin = () => {} }) {
  /* Each outline, kept two ways: as points on a ball, and as points on the flat map. */
  const line = pts => {
    const n = pts.length / 2, u = new Float32Array(n * 3), f = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const lon = pts[i * 2] * RAD, lat = pts[i * 2 + 1] * RAD, c = Math.cos(lat), [x, y] = flat(lon, lat);
      u[i * 3] = c * Math.sin(lon); u[i * 3 + 1] = Math.sin(lat); u[i * 3 + 2] = c * Math.cos(lon);
      f[i * 2] = 0.5 + x / XMAX / 2; f[i * 2 + 1] = 0.5 - y / YMAX / 2;
    }
    let mx = 0, my = 0, mz = 0; for (let i = 0; i < n; i++) { mx += u[i * 3]; my += u[i * 3 + 1]; mz += u[i * 3 + 2]; }
    const len = Math.hypot(mx, my, mz) || 1; mx /= len; my /= len; mz /= len;
    let least = 1; for (let i = 0; i < n; i++) least = Math.min(least, u[i * 3] * mx + u[i * 3 + 1] * my + u[i * 3 + 2] * mz);
    return { n, u, f, mid: [mx, my, mz], reach: Math.sqrt(Math.max(0, 1 - least * least)) + 0.02 };   // its middle, and how far it spreads from it
  };
  const grid = [];                                                      // lines of longitude and latitude, every 30 degrees
  for (let lon = -180; lon <= 180; lon += 30) { const p = []; for (let lat = -90; lat <= 90; lat += 5) p.push(lon, lat); grid.push(line(p)); }
  for (let lat = -60; lat <= 60; lat += 30) { const p = []; for (let lon = -180; lon <= 180; lon += 5) p.push(lon, lat); grid.push(line(p)); }
  const edge = (() => { const p = []; for (let lat = -90; lat <= 90; lat += 5) p.push(-180, lat); for (let lat = 90; lat >= -90; lat -= 5) p.push(180, lat); return line(p); })();

  const plate = el('div', 'wplate'), one = el('canvas', 'wone', { 'aria-hidden': 'true' }), whole = one.getContext('2d');
  plate.append(one);
  let split = false;                                                    // false: all the sheets are drawn as one picture. true: each on its own sheet
  const sheets = [{ id: 'sea', name: 'The sea', sea: true }, ...continents.map(c => ({ ...c, lines: c.rings.flatMap(r => unroll(r).map((u, k) => Object.assign(line(u), { again: k > 0 }))) }))];
  sheets.forEach((s, k) => {
    s.plane = el('div', 'wplane' + (s.sea ? ' sea' : ''), { 'data-id': s.id });
    s.canvas = el('canvas', null, { 'aria-hidden': 'true' }); s.ctx = s.canvas.getContext('2d');
    s.plane.append(s.canvas); plate.append(s.plane);
    if (!s.sea) s.plane.addEventListener('click', e => { if (plate.classList.contains('wopen') && !e.target.closest('.wpin')) { e.stopPropagation(); api.focus(focused === s.id ? null : s.id); } });
  });
  const byId = Object.fromEntries(sheets.map(s => [s.id, s]));
  pins.forEach((p, k) => {
    p.k = k; p.pt = line(p.at);
    p.node = el('button', 'wpin', { type: 'button', 'aria-label': `${p.label}, ${p.posters.length} poster${p.posters.length === 1 ? '' : 's'}`, title: p.label });
    const r = Math.round(9 + Math.sqrt(p.posters.length) * 4.2); p.node.style.setProperty('--d', r + 'px');
    if (p.posters.length > 2) p.node.textContent = String(p.posters.length);
    p.node.addEventListener('click', e => { e.stopPropagation(); if (!moved) api.pick(p.k); });
    byId[p.on].plane.append(p.node);
  });
  const tags = el('ol', 'wtags');                                       // the sheets' names, beside them when they are apart
  sheets.slice().reverse().forEach(s => {
    const b = el('button', null, { type: 'button', 'aria-pressed': 'false' }); b.textContent = s.sea ? s.name : `${s.name} · ${s.count}`;
    if (s.sea) b.disabled = true; else b.addEventListener('click', () => api.focus(focused === s.id ? null : s.id));
    s.tag = el('li'); s.tag.append(b); s.button = b; tags.append(s.tag);
  });
  stage.append(plate, tags);

  let W = 0, H = 0, dpr = 1, R = 0;                                     // the plate's size on screen, and the globe's radius
  let m = calm ? 1 : 0, mFrom = 0, mTo = m, mStart = 0;                 // 0 is the globe, 1 is the flat map
  let lon0 = -20 * RAD, lat0 = 18 * RAD, turnTo = null;                 // which way the globe faces
  let mode = calm ? 'flat' : 'globe', spinning = !calm, open = 0, focused = null, picked = null;
  let frame = 0, last = 0, dragging = null, moved = false, later = 0;

  function size() {
    const box = stage.getBoundingClientRect(), room = Math.max(260, box.height);
    W = Math.max(240, Math.min(box.width, room / SHAPE, 1180)); H = W * SHAPE; R = H / 2 * 0.97;
    if (H > room) { H = room; W = H / SHAPE; R = H / 2 * 0.97; }
    dpr = Math.min(2, window.devicePixelRatio || 1);
    plate.style.width = W + 'px'; plate.style.height = H + 'px';
    for (const s of [...sheets, { canvas: one, ctx: whole }]) { s.canvas.width = Math.round(W * dpr); s.canvas.height = Math.round(H * dpr); s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    const look = getComputedStyle(stage); inkNow = look.color; seaNow = look.getPropertyValue('--sea').trim() || '#1d1d1d';
    // pulled apart: the sheets tilt back and stand one above the other, the sea lowest and the north highest
    const n = sheets.length, shrink = Math.max(0.28, 1 - Math.min(0.8, (box.width - 150) / W)), s = 1 - shrink, face = H * s * Math.cos(62 * RAD);
    const pitch = Math.max(26, Math.min(face * 0.62, (room - face - 16) / (n - 1)));
    plate.style.setProperty('--shrink', shrink.toFixed(3));
    sheets.forEach((sh, k) => {
      const dy = ((n - 1) / 2 - k) * pitch;
      sh.plane.style.setProperty('--dy', dy.toFixed(1)); sh.tag.style.top = `calc(50% + ${dy.toFixed(1)}px)`;
    });
    draw();
  }

  /* Where a point on the ball lands on screen, part way between globe and flat map. Points on the far side of the
     globe are held at its rim, so land slides round the edge instead of showing through. */
  let cl = 1, sl = 0, cp = 1, sp = 0, e = 0;
  function at(L, i, out) {
    const ux = L.u[i * 3], uy = L.u[i * 3 + 1], uz = L.u[i * 3 + 2];
    const x1 = ux * cl - uz * sl, z1 = ux * sl + uz * cl, y2 = uy * cp - z1 * sp, z2 = uy * sp + z1 * cp;
    let gx = x1, gy = y2;
    if (z2 < 0) { const d = Math.hypot(x1, y2) || 1e-6; gx = x1 / d; gy = y2 / d; }
    gx = W / 2 + R * gx; gy = H / 2 - R * gy;
    out[0] = gx + (L.f[i * 2] * W - gx) * e; out[1] = gy + (L.f[i * 2 + 1] * H - gy) * e; out[2] = z2;
  }
  const pt = [0, 0, 0];
  let rough = false, inkNow = '#fff', seaNow = '#1d1d1d';               // while the map is moving, long outlines are drawn from every other point
  function trace(ctx, L, close) {
    const step = rough && L.n > 48 ? 2 : 1;
    for (let i = 0; i < L.n; i += step) { at(L, i, pt); if (i) ctx.lineTo(pt[0], pt[1]); else ctx.moveTo(pt[0], pt[1]); }
    if (close) ctx.closePath();
  }
  const behind = L => {                                                 // true when the whole outline is on the far side of the globe
    const [ux, uy, uz] = L.mid, z1 = ux * sl + uz * cl, z2 = uy * sp + z1 * cp;
    return z2 < -L.reach;
  };
  function paintSea(c) {
    c.fillStyle = seaNow;
    if (e < 1) { c.globalAlpha = 1 - e; c.beginPath(); c.arc(W / 2, H / 2, R, 0, Math.PI * 2); c.fill(); }
    if (e > 0) { c.globalAlpha = e; const keep = e; e = 1; c.beginPath(); trace(c, edge, true); c.fill(); e = keep; }
    c.globalAlpha = 0.13; c.strokeStyle = inkNow; c.lineWidth = 1; c.beginPath(); for (const g of grid) trace(c, g, false); c.stroke();
    if (e < 1) { c.globalAlpha = 0.3 * (1 - e); c.beginPath(); c.arc(W / 2, H / 2, R, 0, Math.PI * 2); c.stroke(); }
    c.globalAlpha = 1;
  }
  function paintLand(c, s) {
    c.fillStyle = c.strokeStyle = s.colour; c.lineWidth = 0.8; c.lineJoin = 'round';
    c.beginPath();
    for (const L of s.lines) { if (e === 0 && (L.again || behind(L))) continue; trace(c, L, true); }   // an outline wholly on the far side of the globe is not drawn
    c.fill(); c.stroke();
  }
  const trim = c => { c.save(); c.beginPath(); trace(c, edge, true); c.clip(); };   // the flat map's own edge trims what was unrolled past it
  function draw() {
    if (!W) return;
    e = ease(m); cl = Math.cos(lon0 * (1 - e)); sl = Math.sin(lon0 * (1 - e)); cp = Math.cos(lat0 * (1 - e)); sp = Math.sin(lat0 * (1 - e));
    if (!split) {                                                        // together: one picture, drawn many times a second
      whole.clearRect(0, 0, W, H); paintSea(whole);
      if (e === 1) trim(whole);
      for (const s of sheets) if (!s.sea) paintLand(whole, s);
      if (e === 1) whole.restore();
    } else for (const s of sheets) {                                     // apart: each sheet holds its own picture, drawn once
      const c = s.ctx; c.clearRect(0, 0, W, H);
      if (s.sea) { paintSea(c); continue; }
      trim(c); paintLand(c, s); c.restore();
    }
    for (const p of pins) {
      at(p.pt, 0, pt);
      const hidden = pt[2] < 0 && e < 0.6;
      if (hidden !== p.hidden) { p.hidden = hidden; p.node.style.visibility = hidden ? 'hidden' : ''; }
      if (hidden) continue;
      p.node.style.transform = `translate(${pt[0].toFixed(1)}px, ${pt[1].toFixed(1)}px)`;
      const faint = pt[2] < 0 ? String(Math.max(0, (e - 0.6) / 0.4)) : '';
      if (faint !== p.faint) { p.faint = faint; p.node.style.opacity = faint; }
    }
  }

  function tick(now) {
    frame = 0;
    const dt = Math.min(60, now - (last || now)); last = now;
    let busy = false;
    if (mTo !== m) { const t = Math.min(1, (now - mStart) / 1400); m = mFrom + (mTo - mFrom) * t; if (t >= 1) m = mTo; busy = true; }
    if (turnTo) {                                                        // turning to face a chosen place
      const dl = ((turnTo[0] - lon0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI, dp = turnTo[1] - lat0;
      lon0 += dl * Math.min(1, dt / 220); lat0 += dp * Math.min(1, dt / 220);
      if (Math.abs(dl) < 0.004 && Math.abs(dp) < 0.004) turnTo = null; busy = true;
    } else if (m === 0 && mTo === 0 && spinning && !dragging) { lon0 += dt / 1000 * 7 * RAD; busy = true; }
    const was = rough; rough = busy; draw();
    if (busy) run(); else if (was) draw();                              // once it comes to rest, draw it again in full
  }
  const run = () => { if (!frame) frame = requestAnimationFrame(tick); };
  const morph = to => { lon0 = ((lon0 + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; mFrom = m; mTo = to; mStart = performance.now(); last = 0; run(); };   // unwind whole turns first
  let joining = 0;
  const part = on => { split = on; plate.classList.toggle('wsplit', on); draw(); };
  const setOpen = v => {
    clearTimeout(joining); open = v;
    if (v) part(true); else joining = setTimeout(() => part(false), calm ? 0 : 1250);     // the sheets become one picture again once they have come together
    plate.style.setProperty('--open', v); plate.classList.toggle('wopen', v > 0); stage.classList.toggle('wapart', v > 0); if (!v) api.focus(null);
  };

  /* dragging the globe */
  plate.addEventListener('pointerdown', ev => { moved = false; if (mode !== 'globe' || ev.button) return; dragging = { x: ev.clientX, y: ev.clientY, lon: lon0, lat: lat0 }; turnTo = null; });
  addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  function onMove(ev) {
    if (!dragging) return;
    const dx = ev.clientX - dragging.x, dy = ev.clientY - dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
    if (!moved) return;
    lon0 = dragging.lon - dx / R; lat0 = Math.max(-1.2, Math.min(1.2, dragging.lat + dy / R)); run();
  }
  function onUp() { if (dragging) { dragging = null; run(); setTimeout(() => { moved = false; }, 0); } }
  plate.tabIndex = 0; plate.setAttribute('role', 'group');
  plate.setAttribute('aria-label', 'Map of where the posters come from. As a globe, the arrow keys turn it. Every place is also in the list beside the map.');
  plate.addEventListener('keydown', ev => {
    if (mode !== 'globe' || ev.target !== plate) return;
    const step = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[ev.key]; if (!step) return;
    ev.preventDefault(); turnTo = [lon0 + step[0] * RAD, Math.max(-1.2, Math.min(1.2, lat0 + step[1] * RAD))]; run();
  });

  const api = {
    get mode() { return mode; }, get spinning() { return spinning; },
    setMode(next) {
      if (next === mode) return; clearTimeout(later);
      const was = mode; mode = next; stage.dataset.mode = next; onMode(next);
      if (next === 'layers') { if (was === 'globe') { morph(1); later = setTimeout(() => setOpen(1), calm ? 0 : 1250); } else setOpen(1); }
      else if (was === 'layers') { setOpen(0); if (next === 'globe') later = setTimeout(() => morph(0), calm ? 0 : 1100); }
      else morph(next === 'globe' ? 0 : 1);
      if (calm) { m = mTo; draw(); }
    },
    spin(on) { spinning = !!on && !calm; onSpin(spinning); run(); },
    pick(k) {
      picked = k; pins.forEach(p => p.node.classList.toggle('on', p.k === k));
      const p = k === null || k === undefined ? null : pins[k];
      if (p && mode === 'globe') { turnTo = [p.at[0] * RAD, p.at[1] * RAD * 0.7]; run(); }
      onPick(p);
    },
    focus(id) {
      focused = id; stage.classList.toggle('wfocus', !!id);
      sheets.forEach(s => { s.plane.classList.toggle('on', s.id === id); s.button.setAttribute('aria-pressed', String(s.id === id)); });
      onPick(null, id ? byId[id] : null);
    },
    resize: size,
    destroy() { cancelAnimationFrame(frame); clearTimeout(later); clearTimeout(joining); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); },
  };
  stage.dataset.mode = mode; size(); run();
  return api;
}
