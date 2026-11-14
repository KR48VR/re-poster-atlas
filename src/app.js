// Poster Atlas: the opening page, the poster pages and the collection.
// Every page of the site loads this one file. It reads the page address and shows the right view.

const ROOT = new URL(document.querySelector('meta[name="pa-root"]')?.content || './', location.href);
const BASE = ROOT.pathname;
const url = p => BASE + p;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => matchMedia('(max-width: 820px)').matches;
const COLS = 6, LETTERS = 'ABCDEF', GAP = 62, TURN = 38, FAR = 2400;
const CAVEAT = 'Layers analyse the visible artwork. They are not original production separations.';
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const EV = { documented: 'Documented', observation: 'In the image', interpretation: 'Visual reading', uncertain: 'Uncertain' };
const KINDS = [['language', 'Words & meaning'], ['design', 'Colour & composition'], ['context', 'People & history'], ['business', 'Credits & business']];   // the four kinds of note
const SVG = 'http://www.w3.org/2000/svg';

const el = (tag, attrs, ...kids) => {
  const n = document.createElement(tag);
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(3).filter(k => k !== null && k !== undefined && k !== false).forEach(k => n.append(k));
  return n;
};
const sv = (tag, attrs) => { const n = document.createElementNS(SVG, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
const on = (node, type, fn) => { node.addEventListener(type, fn); return node; };
const link = (path, attrs, ...kids) => el('a', { href: url(path), 'data-nav': true, ...attrs }, ...kids);
function keyIcon() {
  const s = sv('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
  s.append(sv('circle', { cx: '7.5', cy: '15.5', r: '4.5' }), sv('path', { d: 'M10.7 12.3 20 3' }), sv('path', { d: 'm17 6 3 3' }), sv('path', { d: 'm14 9 2.5 2.5' }));
  return s;
}
function loupeIcon() {
  const s = sv('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
  s.append(sv('circle', { cx: '10.5', cy: '10.5', r: '6.5' }), sv('path', { d: 'M15.4 15.4 21 21' }));
  return s;
}

/* ---------- what the site remembers while it is open ---------- */
const S = { cat: null, posters: new Map(), memory: {}, leave: null, held: false, theme: null, threads: null };
try { S.held = sessionStorage.getItem('pa-held') === '1'; } catch { /* private window: carry on without it */ }
const tbtn = (text, fn) => on(el('button', { class: 'tgo', type: 'button' }, el('span', null, text), el('i', { 'aria-hidden': 'true' })), 'click', fn);   // the same, as a button
const tgo = (path, text) => link(path, { class: 'tgo' }, el('span', null, text), el('i', { 'aria-hidden': 'true' }));   // a link drawn as a thread: words, then a fine line that lengthens
const setHeld = v => { S.held = v; try { sessionStorage.setItem('pa-held', v ? '1' : '0'); } catch { /* fine */ } document.dispatchEvent(new CustomEvent('pa-key')); };
const VER = document.querySelector('meta[name="pa-v"]')?.content || '';      // changes with every release, so saved copies of the data are never stale
const getJSON = async p => { const r = await fetch(url(p) + (VER ? '?v=' + VER : '')); if (!r.ok) throw new Error(p); return r.json(); };
const loadPoster = async id => { if (!S.posters.has(id)) S.posters.set(id, await getJSON(`data/posters/${id}.json`)); return S.posters.get(id); };
function colours(ground, ink) {
  const r = document.documentElement.style; r.setProperty('--ground', ground); r.setProperty('--ink', ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ground);
}

/* ---------- a plate: one poster that can come apart into its layers ---------- */
function makePlate(p, { ticks = true, pull = false, loupe = false } = {}) {
  const count = Array.isArray(p.layers) ? p.layers.length : (p.layers || 0);
  const rows = Math.round(COLS / p.ratio);
  const tones = p.tones || null;                    // what each layer needs behind it to be seen
  const planes = Array.from({ length: count }, (_, k) => el('div', { class: 'plane' + (tones && tones.film[k] ? ' film-' + tones.film[k] : ''), style: `--z:${(k - (count - 1) / 2) * GAP}` },
    el('img', { src: url(`img/layers/${p.id}/${k}.webp`), alt: '', draggable: 'false' })));
  const stack = el('div', { class: 'stack', 'aria-hidden': 'true', style: `--zf:${(count - 1) / 2 * GAP}` }, planes, el('div', { class: 'veil' }));
  const flat = el('img', { class: 'flat', src: url(`img/poster/${p.id}.webp`), alt: p.alt, draggable: 'false' });
  const casing = sv('polyline', { stroke: '#111111', 'stroke-width': '6' }), route = sv('polyline', { stroke: '#ffffff', 'stroke-width': '2.5' });
  const trail = sv('svg', { class: 'trail', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' }); trail.append(casing, route);
  const marks = el('div', { class: 'marks' }), ref = el('span', { class: 'ref', hidden: true });
  const plate = el('div', { class: 'plate' }, stack, flat, trail, marks, ref);
  const input = pull && count ? el('input', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': 'Pull the poster apart into its layers' }) : null;
  const glass = loupe && ticks ? el('button', { class: 'loupe', type: 'button', 'aria-label': 'Look closer at the poster', title: 'Look closer' }, loupeIcon()) : null;   // in the corner where the two rulers meet
  const frame = el('div', { class: 'frame' + (ticks ? '' : ' bare') },
    glass,
    ticks && el('div', { class: 'ticks-top', 'aria-hidden': 'true' }, [...LETTERS].map(c => el('span', null, c))),
    ticks && el('div', { class: 'ticks-left', 'aria-hidden': 'true' }, Array.from({ length: rows }, (_, k) => el('span', null, String(k + 1)))),
    plate,
    input && el('div', { class: 'pull' }, el('span', { 'aria-hidden': 'true' }, 'Together'), input, el('span', { 'aria-hidden': 'true' }, 'Apart')));
  let timers = [], closing = null, busy = false;
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const api = {
    p, frame, plate, planes, marks, ref, casing, route, input, count, glass,
    get busy() { return busy; },
    gridRef: (x, y) => LETTERS[Math.min(COLS - 1, Math.floor(x / 100 * COLS))] + (Math.min(rows - 1, Math.floor(y / 100 * rows)) + 1),
    size(pw, ph) { plate.style.setProperty('--pw', Math.round(pw) + 'px'); plate.style.setProperty('--ph', Math.round(ph) + 'px'); },
    pos(e) { const b = plate.getBoundingClientRect(); return [Math.max(0, Math.min(100, (e.clientX - b.left) / b.width * 100)), Math.max(0, Math.min(100, (e.clientY - b.top) / b.height * 100))]; },
    setOpen(v, dur) {
      plate.style.setProperty('--dur', dur + 's'); clearTimeout(closing);
      if (v > 0 && count) { plate.classList.add('is-open'); plate.style.setProperty('--open', v); }
      else { plate.style.setProperty('--open', 0); closing = setTimeout(() => plate.classList.remove('is-open'), dur * 1000); }
    },
    light(cls, ks) {                       // light some layers and quieten the rest: "spot" when flat, "focus" when apart
      const set = new Set([].concat(ks ?? []));
      plate.classList.remove('spot', 'focus');
      planes.forEach((pl, i) => pl.classList.toggle('on', set.has(i)));
      if (!cls || !count) return;
      const tone = tones ? tones.veil[[...set][0]] : 'night';      // the rest is veiled in the ground that shows the lit layer best
      plate.style.setProperty('--veil', tone === 'paper' ? 'var(--paper)' : 'var(--night)');
      plate.classList.add(cls);
    },
    wide(v) { plate.classList.toggle('wide', !!v); },   // pulled apart across the page, not stacked in place
    flourish(level, hold, dur, k, done) {  // open, hold, close
      if (calm || !count) { done && done(); return; }
      api.wide(false);
      busy = true; if (input) input.value = Math.round(level * 100);
      if (k !== null && k !== undefined) api.light('focus', k);
      api.setOpen(level, dur);
      later(() => {
        api.setOpen(0, dur); if (input) input.value = 0;
        later(() => { api.light(null); busy = false; done && done(); }, dur * 1000);
      }, dur * 1000 + hold);
    },
    openNow(level) { if (!count) return; api.wide(false); busy = true; if (input) input.value = Math.round(level * 100); api.setOpen(level, 0); },   // start layered
    collapse(hold, dur, done) {            // then come together
      later(() => {
        api.setOpen(0, dur); if (input) input.value = 0;
        later(() => { api.light(null); busy = false; done && done(); }, dur * 1000);
      }, hold);
    },
    spot(k, ms) { api.stop(); api.wide(false); api.light('spot', k); later(() => api.light(null), ms); },
    stop() { timers.forEach(clearTimeout); timers = []; busy = false; },
    settle() { api.stop(); api.light(null); if (input) input.value = 0; api.setOpen(0, 0.4); },
    ready: () => Promise.race([
      Promise.all([flat, ...stack.querySelectorAll('img')].map(i => (i.decode ? i.decode().catch(() => {}) : null))),
      new Promise(r => setTimeout(r, 2500))]),
  };
  return api;
}

/* ---------- a closer look: the poster on its own, as large as our picture of it allows ---------- */
function closer(p, grey = false, spot = null) {     // spot: the detail being read, to go straight to it
  const img = el('img', { src: url(`img/poster/${p.id}.webp`), alt: p.alt, draggable: 'false' });
  const view = el('div', { class: 'cview' }, img);
  const zin = el('input', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': 'How close to look' });
  const zoomBar = el('div', { class: 'pull czoom', hidden: true }, el('span', { 'aria-hidden': 'true' }, 'Whole'), zin, el('span', { 'aria-hidden': 'true' }, 'Close'));
  const limit = el('span', { class: 'climit', hidden: true }, 'This is as large as our picture of it goes.');
  const TONE = ['See it without colour', 'Bring the colour back'];
  const tone = el('button', { class: 'link', type: 'button' }, TONE[+grey]), back = el('button', { class: 'link', type: 'button' }, 'Back to the plate');
  const wrap = el('div', { class: 'cwrap' + (grey ? ' grey' : '') }, view, el('div', { class: 'cbar' }, el('span', { class: 'ctitle' }, p.title), zoomBar, limit, tone, back));
  const dlg = el('dialog', { class: 'closer', 'aria-label': `A closer look at ${p.title}` }, wrap);
  let z = 1, zmax = 1, tx = 0, ty = 0, fw = 0, fh = 0, tall = 0;   // tall: the height of the largest picture we hold, in its own dots
  const can = () => zmax >= 1.2;                                   // there is more in the picture than the screen is showing
  function set(nz, nx, ny, smooth) {
    z = Math.max(1, Math.min(can() ? zmax : 1, nz));
    const mx = Math.max(0, (fw * z - view.clientWidth) / 2 + (z > 1 ? 16 : 0)), my = Math.max(0, (fh * z - view.clientHeight) / 2 + (z > 1 ? 16 : 0));
    tx = Math.max(-mx, Math.min(mx, nx)); ty = Math.max(-my, Math.min(my, ny));
    img.style.transition = smooth && !calm ? 'transform .3s ease' : 'none';
    img.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${z.toFixed(4)})`;
    zin.value = can() ? Math.round(Math.log(z) / Math.log(zmax) * 100) : 0;
    view.classList.toggle('zoomed', z > 1.01);
  }
  const at = (nz, cx, cy, smooth) => {                              // look closer while the spot under the pointer stays under it. cx and cy are measured from the middle of the view
    nz = Math.max(1, Math.min(can() ? zmax : 1, nz)); const k = nz / z;
    set(nz, cx - (cx - tx) * k, cy - (cy - ty) * k, smooth);
  };
  function fit() {
    const W = view.clientWidth - 32, H = view.clientHeight - 32;
    fh = Math.min(H, W / p.ratio); fw = fh * p.ratio;
    img.style.width = fw.toFixed(1) + 'px'; img.style.height = fh.toFixed(1) + 'px';
    zmax = tall ? Math.max(1, tall / fh) : 1;
    zoomBar.hidden = !can(); limit.hidden = can() || !tall; view.classList.toggle('can', can());
    set(z, tx, ty);
  }
  const mid = e => { const b = view.getBoundingClientRect(); return [e.clientX - b.left - b.width / 2, e.clientY - b.top - b.height / 2]; };
  on(zin, 'input', () => at(Math.pow(zmax, zin.value / 100), 0, 0));
  view.addEventListener('wheel', e => { e.preventDefault(); if (can()) at(z * Math.exp(-e.deltaY * 0.0016), ...mid(e)); }, { passive: false });
  on(view, 'dblclick', e => { if (!can()) return; if (z > 1.05) set(1, 0, 0, true); else at(Math.min(zmax, 2.5), ...mid(e), true); });
  const pts = new Map(); let held = null;                           // one finger drags the picture, two pinch it
  const hold = () => { held = { z, tx, ty, pts: [...pts.values()] }; };
  on(view, 'pointerdown', e => { view.setPointerCapture(e.pointerId); pts.set(e.pointerId, mid(e)); hold(); });
  on(view, 'pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, mid(e)); const now = [...pts.values()], was = held.pts;
    if (now.length === 1) set(z, held.tx + now[0][0] - was[0][0], held.ty + now[0][1] - was[0][1]);
    else if (now.length === 2 && was.length === 2 && can()) {
      const d = a => Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), c = a => [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2];
      const nz = Math.max(1, Math.min(zmax, held.z * d(now) / Math.max(1, d(was)))), k = nz / held.z, c0 = c(was), c1 = c(now);
      set(nz, c1[0] - (c0[0] - held.tx) * k, c1[1] - (c0[1] - held.ty) * k);
    }
  });
  const drop = e => { pts.delete(e.pointerId); hold(); };
  on(view, 'pointerup', drop); on(view, 'pointercancel', drop);
  on(dlg, 'keydown', e => {
    e.stopPropagation();                                            // the page behind must not also answer the keys
    if (e.target === zin || e.altKey || e.ctrlKey || e.metaKey) return;
    const far = 90;
    if (e.key === '+' || e.key === '=') at(z * 1.4, 0, 0, true);
    else if (e.key === '-') at(z / 1.4, 0, 0, true);
    else if (e.key === '0') set(1, 0, 0, true);
    else if (e.key === 'ArrowLeft') set(z, tx + far, ty, true);
    else if (e.key === 'ArrowRight') set(z, tx - far, ty, true);
    else if (e.key === 'ArrowUp') set(z, tx, ty + far, true);
    else if (e.key === 'ArrowDown') set(z, tx, ty - far, true);
    else return;
    e.preventDefault();
  });
  on(tone, 'click', () => { const g = wrap.classList.toggle('grey'); tone.textContent = TONE[+g]; });
  on(back, 'click', () => dlg.close());
  on(dlg, 'close', () => { removeEventListener('resize', fit); dlg.remove(); });
  document.body.append(dlg); dlg.showModal(); fit(); addEventListener('resize', fit);
  if (p.full) {                                                     // the page's own picture shows at once; the largest one takes its place when it has arrived
    const big = new Image(); big.src = url('img/full/' + p.full);
    big.decode().then(() => {
      if (!dlg.isConnected) return; tall = big.naturalHeight; img.src = big.src; fit();
      if (!spot || !can()) return;                                  // then move in on the detail, leaving some of its surroundings in view
      const [x, y, w, h] = spot.b, nz = Math.max(1, Math.min(zmax, 0.62 * Math.min(view.clientWidth / (w / 100 * fw), view.clientHeight / (h / 100 * fh))));
      setTimeout(() => set(nz, -((x + w / 2) / 100 - 0.5) * fw * nz, -((y + h / 2) / 100 - 0.5) * fh * nz, true), 350);
    }).catch(() => {});
  }
  return dlg;
}

/* ---------- the bar across the top, and putting a view on the page ---------- */
function mount(view, node, mid, withKey) {
  document.body.dataset.view = view;
  const key = el('button', { class: 'key', type: 'button', 'aria-pressed': String(S.held), 'aria-label': 'Hold back the notes until you choose to reveal them' }, keyIcon());
  on(key, 'click', () => { setHeld(!S.held); key.setAttribute('aria-pressed', String(S.held)); });
  const bar = el('header', { class: 'bar' },
    link('', { class: 'mark' }, 'Poster Atlas', el('span', { class: 'sub-mark' }, 'Posters, book covers & more')),
    el('span', { class: 'mid' }, withKey ? key : null, mid),
    el('nav', { class: 'bar-nav', 'aria-label': 'Site' }, link('collection/', null, 'Collection'), link('threads/', null, 'Threads'), link('search/', null, 'Search'), el('a', { href: url('teachers/') }, 'For teachers'), el('a', { href: url('about/') }, 'About')));
  const main = el('main', { id: 'main', tabindex: '-1' }, node);
  document.getElementById('app').replaceChildren(bar, main);
  return main;
}

/* ---------- a poster page ---------- */
async function viewPoster(id, firstLook) {
  const p = await loadPoster(id);
  colours(p.ground, p.ink);
  document.title = `${p.title} · Poster Atlas`;
  const T = S.cat.total, P = makePlate(p, { ticks: true, pull: true, loupe: true });
  const panel = el('section', { class: 'panel', 'aria-live': 'polite' });
  const sheet = el('div', { class: 'sheet' }, el('div', { class: 'stage' }, P.frame), panel, el('p', { class: 'small caveat' }, CAVEAT));
  mount('poster', sheet, [
    link(`posters/${p.prev.id}/`, { class: 'step', 'aria-label': `Previous plate: ${p.prev.title}` }, '‹'),
    el('span', { id: 'plateno' }, `Plate ${String(p.n).padStart(2, '0')} of ${T} · ${p.title}`),
    link(`posters/${p.next.id}/`, { class: 'step', 'aria-label': `Next plate: ${p.next.title}` }, '›')], true);

  const mem = (S.memory[id] ||= { trail: [], found: new Set() });
  let revealed = false, welcomed = !!firstLook || mem.trail.length > 0 || calm, layersOn = null, geo = null, staged = false;
  let tour = null;                                    // on the guided tour: which stop, counting from 0. Otherwise null.
  let walk = null;                                    // the tour can also follow one kind of note. Which kind, or null for the prepared tour.
  let uy = 0, ux = 0, drag = null, dragged = false;   // how far the layers have been turned and tilted by hand, in degrees
  let indexOpen = false;
  const apart = () => P.input && +P.input.value > 0;
  const GROUNDS = { night: ['#141312', '#f1ede4'], paper: ['#f1ede4', '#141312'] };
  function stage(on) {                                // pulled apart, the poster stands on a quiet ground of its own, not on its own colour
    on = !!on && !!p.tones;
    if (on === staged) return; staged = on;
    const [g, i] = on ? GROUNDS[p.tones.stage] : [p.ground, p.ink];
    colours(g, i); sheet.classList.toggle('apart', on && !narrow());
  }
  const region = rid => p.regions.find(r => r.id === rid);
  const last = () => mem.trail[mem.trail.length - 1];
  const stops = (p.tour || []).map(rid => p.regions.find(r => r.id === rid)).filter(Boolean);    // the tour: a prepared order to walk the details in
  const walks = Object.fromEntries(KINDS.map(([k]) => [k, p.regions.filter(r => r.secs.some(s => s.kind === k))]));    // every detail that has a note of one kind
  const along = () => (walk ? walks[walk] : stops);                     // the stops being walked now
  const kindName = () => KINDS.find(x => x[0] === walk)[1];
  const onLayer = k => p.regions.filter(r => r.layer === k);            // the details that sit on one layer
  p.regions.forEach(r => P.planes[r.layer]?.append(el('span', { class: 'lpin', style: `left:${r.x}%;top:${r.y}%` }, String(r.n))));   // each sheet carries the pins of its own details, seen when the poster is apart
  function showLayer(k) {                             // from a detail to its layer: pull the poster apart with that sheet lit
    if (!P.input) return;
    tour = null; walk = null; P.input.value = 100; layersOn = [k];
    P.input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function regionAt(x, y) {
    const inside = p.regions.filter(r => x >= r.b[0] && x <= r.b[0] + r.b[2] && y >= r.b[1] && y <= r.b[1] + r.b[3]);
    if (inside.length) return { r: inside.sort((a, b) => a.b[2] * a.b[3] - b.b[2] * b.b[3])[0], exact: true };
    const d = r => Math.hypot((r.x - x) * p.ratio, r.y - y);
    return { r: p.regions.slice().sort((a, b) => d(a) - d(b))[0], exact: false };
  }
  function size() {
    let pw, ph;
    if (narrow()) { ph = Math.min((sheet.clientWidth - 22) / p.ratio, innerHeight * 0.5); pw = ph * p.ratio; }
    else {
      ph = sheet.clientHeight - 22 - (P.input ? 38 : 0); pw = ph * p.ratio;
      const maxW = sheet.clientWidth * 0.54 - 22;
      if (pw > maxW) { pw = maxW; ph = pw / p.ratio; }
    }
    P.size(pw, ph);
    spread(pw, ph);
    if (uy || ux) turnTo(uy, ux, 0);                  // a turn made by hand is kept when the window changes size
    if (staged && sheet.classList.contains('apart') === narrow()) {       // the window crossed between wide and narrow while apart
      sheet.classList.toggle('apart', !narrow()); P.wide(!narrow()); unturn(); render();
    }
  }
  function turnTo(y, x, dur) {                        // turn and tilt the pulled-apart layers. Side by side each sheet turns where it stands; stacked, the whole stack turns
    const wide = sheet.classList.contains('apart'), base = wide ? (geo ? geo.turn : TURN) : -40;
    uy = Math.max((wide ? -58 : -72) - base, Math.min((wide ? 68 : 72) - base, y)); ux = Math.max(-16, Math.min(16, x));
    const room = wide && geo ? Math.min(1, geo.pitch / (0.8 * geo.wide * Math.cos((base + uy) * Math.PI / 180))) : 1;   // turned to face us the sheets are wider, so they step back: none may hide more than a fifth of its neighbour
    const st = P.plate.style; st.setProperty('--dur', dur + 's'); st.setProperty('--uy', uy.toFixed(1) + 'deg'); st.setProperty('--ux', ux.toFixed(1) + 'deg'); st.setProperty('--us', room.toFixed(4));
    P.plate.classList.toggle('back', wide && base + uy < 0);       // turned past face-on, the sheets overlap the other way round
    panel.querySelector('.straight')?.toggleAttribute('hidden', !uy && !ux);
  }
  function unturn() { if (uy || ux) turnTo(0, 0, 0.4); }
  function spread(pw, ph) {                           // where each sheet stands when the poster is pulled fully apart
    const n = P.count; geo = null;
    if (!n || narrow()) { P.plate.style.removeProperty('--shrink'); return; }
    const W = sheet.clientWidth, H = sheet.clientHeight, pad = 24;
    const turn = Math.max(TURN, Math.min(54, TURN + (p.ratio - 0.8) * 22));     // a wide poster turns further, so its sheets can stay large
    const rad = turn * Math.PI / 180, cos = Math.cos(rad), near = FAR / (FAR - pw / 2 * Math.sin(rad));   // the near edge of a turned sheet stands taller
    const widest = (W - pad * 2) / (1 + 0.8 * (n - 1));                    // a sheet may hide at most a fifth of its neighbour
    const room = Math.min(H * 0.56, H - 392);                              // leave space under the sheets for their names, the note and the pull bar
    const s = Math.min(room / (ph * near), widest / (pw * cos)), face = pw * s * cos, hs = ph * s, ext = hs * (near - 1) / 2;
    const pitch = Math.min(face * 1.07, (W - pad * 2 - face) / Math.max(1, n - 1));
    const set = (k, v) => P.plate.style.setProperty(k, v);
    set('--shrink', (1 - s).toFixed(4)); set('--turn', turn.toFixed(1) + 'deg');
    set('--sx', (W / 2 - 22 - pw / 2).toFixed(1)); set('--sy', (ext + 4 + hs / 2 - ph / 2).toFixed(1));
    P.planes.forEach((pl, k) => pl.style.setProperty('--x', ((k - (n - 1) / 2) * pitch).toFixed(1)));
    geo = { pitch, turn, wide: pw * s, top: 22 + 4 + hs + ext * 2 + 14 };
    sheet.style.setProperty('--ptop', Math.round(geo.top) + 'px'); sheet.style.setProperty('--pitch', Math.round(pitch) + 'px');
    sheet.style.setProperty('--pully', Math.max(0, Math.round(H - 38 - 22 - ph)) + 'px');   // the pull bar goes to the foot of the page with the sheets' names above it
  }
  function drawMarks() {
    if (tour !== null) {                               // on the tour the plate shows the whole prepared route, and where we are on it
      const way = along().slice(0, tour + 1).map(r => r.x + ',' + r.y).join(' ');      // the line grows as the tour goes; stops still to come show as fainter pins
      P.casing.setAttribute('points', way); P.route.setAttribute('points', way);
      P.marks.replaceChildren();
      const b = along()[tour].b;
      if (!(S.held && !revealed)) P.marks.append(el('div', { class: 'box', style: `left:${b[0]}%;top:${b[1]}%;width:${b[2]}%;height:${b[3]}%` }));
      along().forEach((r, i) => P.marks.append(el('span', { class: 'pin' + (i === tour ? ' now' : i > tour ? ' ahead' : ''), style: `left:${r.x}%;top:${r.y}%` }, String(i + 1))));
      return;
    }
    const pts = mem.trail.map(t => t.x + ',' + t.y).join(' ');
    P.casing.setAttribute('points', pts); P.route.setAttribute('points', pts);
    P.marks.replaceChildren();
    const l = last();
    if (l && !(S.held && !revealed)) {
      const b = region(l.rid).b;
      P.marks.append(el('div', { class: 'box', style: `left:${b[0]}%;top:${b[1]}%;width:${b[2]}%;height:${b[3]}%` }));
    }
    mem.trail.forEach((t, i) => P.marks.append(el('span', { class: 'pin' + (i === mem.trail.length - 1 ? ' now' : ''), style: `left:${t.x}%;top:${t.y}%` }, String(i + 1))));
  }

  /* the words beside the plate */
  const indexList = () => el('details', { class: 'more index', open: indexOpen },
    el('summary', null, `Index of this plate · ${mem.found.size} of ${p.regions.length} found`),
    el('p', { class: 'kinds' }, el('span', null, 'Follow one kind of note'),           // the same details, sorted by what their notes are about
      KINDS.map(([k, name]) => on(el('button', { type: 'button', 'aria-pressed': String(tour !== null && walk === k) }, name, el('span', { class: 'cnt' }, ` ${walks[k].length}`, el('span', { class: 'sr-only' }, walks[k].length === 1 ? ' stop' : ' stops'))),
        'click', () => goTour(0, k)))),
    el('ol', null, p.regions.map(r => el('li', null, on(
      el('button', { type: 'button', 'aria-label': `${P.gridRef(r.x, r.y)}, ${r.label}${mem.found.has(r.id) ? ', found' : ''}` },
        el('span', { class: 'gr' }, P.gridRef(r.x, r.y)), el('span', { 'aria-hidden': 'true' }, mem.found.has(r.id) ? '●' : '○'), el('span', null, r.label)),
      'click', () => look(r.x, r.y, r))))));
  const wordsList = () => p.transcript.some(t => t.rows.length) && el('details', { class: 'more' },
    el('summary', null, 'The words on this poster'),
    el('table', { class: 'wordlist' }, p.transcript.filter(t => t.rows.length).map(t => el('tbody', null,
      el('tr', null, el('th', { colspan: '2', scope: 'colgroup' }, t.heading)),
      t.rows.map(r => el('tr', null, el('td', { lang: r.lang && r.lang !== 'en' ? r.lang : null }, r.text), el('td', null, r.meaning)))))),
    p.transcriptNote && el('p', { class: 'small' }, p.transcriptNote));
  const coloursList = () => p.palette.length > 0 && el('details', { class: 'more' },
    el('summary', null, 'The colours in this poster'),
    el('ul', { class: 'swatches' }, p.palette.map(c => el('li', null, el('i', { style: `background:${c.hex}`, 'aria-hidden': 'true' }), el('b', null, c.name), el('span', null, c.role || c.hex)))),
    el('p', null, on(el('button', { class: 'link', type: 'button' }, 'See the poster without its colour'), 'click', () => closer(p, true))),
    p.paletteNote && el('p', { class: 'small' }, p.paletteNote));
  const aboutPlate = () => el('details', { class: 'more' },
    el('summary', null, 'About this plate'),
    el('div', null,
      p.edition && el('p', { class: 'small' }, 'Edition shown: ' + p.edition),
      p.yearNote && el('p', { class: 'small' }, p.yearNote),
      p.originNote && el('p', { class: 'small' }, p.originNote),
      p.credit && el('p', { class: 'small' }, p.credit),
      p.imageSource && el('p', { class: 'small' }, el('a', { href: p.imageSource, target: '_blank', rel: 'noopener' }, 'Where this image comes from')),
      p.sources.length > 0 && el('p', { class: 'small' }, 'Sources used on this plate:'),
      p.sources.map(s => el('p', { class: 'small' }, s.url ? el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title) : s.title, s.kind ? ` (${s.kind})` : ''))));
  const extras = () => [indexList(), wordsList(), coloursList(), aboutPlate()];
  const again = () => el('div', null, on(el('button', { class: 'link', type: 'button' }, 'Start this plate again'), 'click', () => { mem.trail = []; mem.found = new Set(); revealed = false; mark(null); render(); }));

  const secNode = s => el('div', { class: 'sec' },
    el('h3', null, s.h),
    s.orig && el('div', { class: 'orig' },
      el('p', { class: 'ot', lang: s.orig.lang }, s.orig.text),
      s.orig.reading && el('p', { class: 'rd' }, s.orig.reading),
      s.orig.translation && el('p', { class: 'tr' }, s.orig.translation)),
    el('p', null, s.body),
    s.note && el('p', { class: 'aside' }, s.note),
    s.facts && el('dl', { class: 'facts' }, s.facts.map(f => [el('dt', null, f.label), el('dd', null, f.value)])),
    el('div', { class: 'evrow' },
      el('span', { class: 'ev ' + s.ev }, el('i', { 'aria-hidden': 'true' }), EV[s.ev] || s.ev),
      s.src.length > 0 && el('details', { class: 'src' },
        el('summary', null, s.src.length === 1 ? '1 source' : `${s.src.length} sources`),
        s.src.map(q => el('p', null, q.url ? el('a', { href: q.url, target: '_blank', rel: 'noopener' }, q.title) : q.title, q.kind ? ` (${q.kind}). ` : '. ', q.note || q.summary || '')))));

  const secsOf = r => {                               // following one kind of note, that kind is read first
    if (tour === null || !walk) return el('div', { class: 'secs' }, r.secs.map(secNode));
    const rest = r.secs.filter(s => s.kind !== walk);
    return el('div', { class: 'secs' }, r.secs.filter(s => s.kind === walk).map(secNode), rest.length > 0 && el('p', { class: 'alsohere' }, 'Also at this spot'), rest.map(secNode));
  };
  const same = ks => JSON.stringify(layersOn) === JSON.stringify(ks);
  function pick(ks) { layersOn = same(ks) ? null : ks; P.light(layersOn ? 'focus' : null, layersOn); render(); }
  function renderApart() {
    const is = ks => String(same(ks)), n = p.layers.length;
    const head = [el('p', { class: 'where' }, `${p.title}, pulled apart`), el('h2', { class: 'name' }, `${COUNT[n] || n} layers make this poster.`)];
    const small = el('p', { class: 'small' }, CAVEAT);
    const chev = () => { const s = sv('svg', { viewBox: '0 0 8 12', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }); s.append(sv('path', { d: 'M6.5 1 1.5 6l5 5' })); return s; };
    const step = (name, cls, less, more, dy, dx) => el('span', { class: 'stepper ' + cls },
      on(el('button', { type: 'button', 'aria-label': less }, chev()), 'click', () => turnTo(uy - dy, ux - dx, 0.3)),
      el('span', { 'aria-hidden': 'true' }, name),
      on(el('button', { type: 'button', 'aria-label': more }, chev()), 'click', () => turnTo(uy + dy, ux + dx, 0.3)));
    const turner = el('p', { class: 'turner' },                              // the layers can be turned by hand, or with these
      el('span', { class: 'quiet' }, sheet.classList.contains('apart') ? 'Drag the sheets to turn them.' : 'Swipe across the poster to turn it.'),
      step('Turn', 'yaw', 'Turn left', 'Turn right', 12, 0), step('Tilt', 'pitch', 'Tilt back', 'Tilt forward', 0, -6),
      on(el('button', { class: 'straight link', type: 'button', hidden: !uy && !ux }, 'Straighten'), 'click', () => turnTo(0, 0, 0.4)));
    const details = k => {                                                 // which details sit on a layer, each a way back to its note
      const rs = onLayer(k);
      return el('div', { class: 'also onit' }, el('span', null, rs.length === 1 ? 'One detail on this layer' : `${rs.length} details on this layer`),
        rs.map(r => on(el('button', { type: 'button' }, el('b', null, String(r.n)), ` ${r.short || r.label}`), 'click', () => look(r.x, r.y, r))));
    };
    if (!sheet.classList.contains('apart')) return [                       // a narrow screen: the layers stay stacked, with a list beside them
      ...head, turner,
      el('ol', { class: 'rows' }, p.layers.map((l, k) => el('li', null, on(
        el('button', { type: 'button', 'aria-pressed': is([k]) }, el('span', { class: 'num' }, String(k + 1)), el('strong', null, l.label), el('span', { class: 'd' }, `${l.desc} ${many(onLayer(k).length, 'detail')}.`)),
        'click', () => pick([k])), same([k]) ? details(k) : null))),
      p.readings.length > 0 && el('p', { class: 'sub' }, 'Ways to read the layers together'),
      p.readings.length > 0 && el('ul', { class: 'rows' }, p.readings.map(r => el('li', null, on(
        el('button', { type: 'button', 'aria-pressed': is(r.layers) }, el('span', { class: 'num', 'aria-hidden': 'true' }, '+'), el('strong', null, r.title), el('span', { class: 'd' }, r.text)),
        'click', () => pick(r.layers))))),
      small];
    const one = layersOn && layersOn.length === 1 ? layersOn[0] : null, way = layersOn && one === null ? p.readings.find(r => same(r.layers)) : null;
    return [                                                                // a wide screen: each sheet is named where it stands
      el('ol', { class: 'tags' }, p.layers.map((l, k) => el('li', null, on(
        el('button', { type: 'button', 'aria-pressed': is([k]) }, el('span', { class: 'top' }, el('span', { class: 'num' }, String(k + 1)), el('span', { class: 'cnt' }, many(onLayer(k).length, 'detail'))), el('strong', null, l.label)),
        'click', () => pick([k]))))),
      el('div', { class: 'afoot' },
        el('div', { class: 'ahead' }, head[1], turner),
        el('div', { class: 'anote' }, one !== null ? [el('p', { class: 'where' }, `Layer ${one + 1} of ${n} · ${p.layers[one].label}`), el('p', { class: 'sum' }, p.layers[one].desc), details(one)]
          : way ? [el('p', { class: 'where' }, way.title), el('p', { class: 'sum' }, way.text)]
          : el('p', { class: 'sum quiet' }, 'Choose a layer to see it on its own, with the details that sit on it. The numbered pins are those details.')),
        p.readings.length > 0 && el('div', { class: 'aways' }, el('p', { class: 'where' }, 'Read layers together'),
          el('ul', null, p.readings.map(r => el('li', null, on(el('button', { type: 'button', 'aria-pressed': is(r.layers) }, r.title), 'click', () => pick(r.layers)))))))];
  }

  function render() {
    const hadFocus = panel.contains(document.activeElement);   // someone is using the keyboard inside the panel, which is about to be redrawn
    const idx = panel.querySelector('details.index'); if (idx) indexOpen = idx.open;   // an index left open stays open when the panel is redrawn
    drawMarks();
    const l = last(), touring = tour !== null;
    let kids;
    if (apart() && !P.busy) kids = renderApart();
    else if (!welcomed) kids = [el('h1', { class: 'ask' }, S.cat.tagline.join(' '))];
    else if (!l && !touring) {
      kids = [el('h1', { class: 'ask fade' }, S.cat.question),
        el('p', { class: 'lead' }, 'Tap that spot on the poster. There is no wrong place to start.'),
        stops.length > 0 && el('p', { class: 'tourin' }, tbtn(`Or take the tour: ${stops.length} stops`, () => goTour(0, null))),
        el('p', { class: 'meta' }, el('strong', null, p.title), el('br'), [p.creator, p.country, p.when].filter(Boolean).join(' · ')),
        S.held ? null : el('p', { class: 'meta' }, p.blurb),
        p.began && !S.held ? el('p', { class: 'began' }, 'This is the poster that started Poster Atlas. ', el('a', { href: url('about/') + '#began' }, 'How it began')) : null,
        S.held ? null : extras()];
    } else {
      const r = touring ? along()[tour] : region(l.rid), here = touring ? P.gridRef(r.x, r.y) : P.gridRef(l.x, l.y);
      const lastStop = touring && tour === along().length - 1, stopLine = touring && `${walk ? kindName() : 'Tour'} · stop ${tour + 1} of ${along().length} · ${here}`;
      const tourNav = () => el('div', { class: 'tournav' },              // the way along the tour, always in view
        lastStop ? el('span', { class: 'tend' }, walk ? 'That is every note of this kind here.' : 'The tour ends here.') : tbtn(`Next: ${along()[tour + 1].label}`, () => goTour(tour + 1)),
        tour > 0 && on(el('button', { class: 'link', type: 'button' }, '‹ Back'), 'click', () => goTour(tour - 1)),
        lastStop && on(el('button', { class: 'link', type: 'button' }, 'Start again'), 'click', () => goTour(0)),
        on(el('button', { class: 'link', type: 'button' }, lastStop ? 'Explore on your own' : 'Leave the tour'), 'click', leaveTour),
        lastStop && (walk ? tgo(`posters/${p.next.id}/#tour-${walk}`, `${kindName()} on the next plate: ${p.next.title}`) : tgo(`posters/${p.next.id}/#tour`, `Tour the next plate: ${p.next.title}`)));
      if (S.held && !revealed) {
        kids = [el('p', { class: 'where' }, touring ? stopLine : `Look ${mem.trail.length} · ${here}`), el('p', { class: 'bigq fade' }, r.q),
          el('div', null, on(el('button', { class: 'key turn', type: 'button', 'aria-label': 'Reveal the note' }, keyIcon()), 'click', reveal)),
          touring && tourNav()];
      } else {
        const also = r.related.map(region).filter(Boolean);
        kids = [
          el('p', { class: 'where' }, touring ? stopLine : l.exact ? `Look ${mem.trail.length} · you went to ${here}`
            : `Look ${mem.trail.length} · you went to ${here}. Nothing is written about that exact spot yet. The nearest detail is at ${P.gridRef(r.x, r.y)}.`),
          el('h2', { class: 'name' }, r.label), el('p', { class: 'sum' }, r.sum),
          touring && tourNav(),
          p.began === r.id && !S.held ? el('p', { class: 'began' }, 'Reading about this brush-written line is what started Poster Atlas. ', el('a', { href: url('about/') + '#began' }, 'How it began')) : null,
          S.held ? null : r.threads.map(t => el('div', { class: 'follow' },          // right under the detail's name, where it is seen without scrolling
            el('p', { class: 'ft' }, el('span', { class: 'ev interpretation' }, el('i', { 'aria-hidden': 'true' }), 'Thread'), el('strong', null, t.name), el('span', null, t.idea)),
            el('p', { class: 'fn' }, tgo(`posters/${t.next.poster}/#${t.next.region}`, `Next: ${t.next.title}`),
              el('span', { class: 'tfacts' }, `${t.at} of ${t.count} · `, link(`threads/${t.id}/`, null, 'see them all'))))),
          secsOf(r),
          S.held ? null : el('p', { class: 'question' }, el('small', null, 'A question to take with you'), r.q),
          also.length > 0 && el('div', { class: 'also' }, el('span', null, 'Connected on this plate'),
            also.map(a => on(el('button', { type: 'button' }, `${P.gridRef(a.x, a.y)} ${a.short}`), 'click', () => look(a.x, a.y, a)))),
          P.count > 0 && p.layers[r.layer] && el('div', { class: 'also' }, el('span', null, `On layer ${r.layer + 1} of ${p.layers.length}`),
            on(el('button', { type: 'button' }, `${p.layers[r.layer].label}, with ${onLayer(r.layer).length - 1 === 0 ? 'no other detail' : many(onLayer(r.layer).length - 1, 'other detail')}`), 'click', () => showLayer(r.layer))),
          el('p', { class: 'next' }, mem.found.size === p.regions.length
            ? `You have found all ${p.regions.length} details on this plate.` : `Where next? ${mem.found.size} of ${p.regions.length} details found.`),
          !touring && stops.length > 0 && el('div', null, tbtn(`Take the tour: ${stops.length} stops`, () => goTour(0, null))),
          again(), S.held ? null : extras()];
      }
    }
    panel.replaceChildren(...kids.flat().filter(Boolean));
    panel.querySelector('.key.turn')?.focus({ preventScroll: true });     // Enter or Space then turns the key
    if (hadFocus && !panel.contains(document.activeElement)) {            // keep the keyboard where the action is: the chosen sheet, the way along the tour, or the new heading
      const to = panel.querySelector('[aria-pressed="true"], .tournav .tgo, .tournav .link') || panel.querySelector('.name, .ask');
      if (to) { if (!to.matches('a, button')) to.tabIndex = -1; to.focus({ preventScroll: true }); }
    }
  }

  function goTour(i, kind) {                          // step to a stop on the guided tour. A kind, when given, changes what is walked: null for the prepared tour, or one kind of note
    if (kind !== undefined) walk = kind;
    if (P.busy || apart()) { P.settle(); stage(false); layersOn = null; unturn(); }
    tour = Math.max(0, Math.min(along().length - 1, i)); const r = along()[tour];
    mem.found.add(r.id); revealed = false; welcomed = true; render();
    if (!S.held) { P.spot(r.layer, 1150); mark(r.id); }
    if (narrow()) scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); else panel.scrollTop = 0;
  }
  function leaveTour() { tour = null; walk = null; revealed = false; mark(last() ? last().rid : null); render(); }
  const onTourKey = e => {                            // a clicker or the arrow keys walk the tour
    if (tour === null || e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); if (tour < along().length - 1) goTour(tour + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); if (tour > 0) goTour(tour - 1); }
    else if (e.key === 'Escape') leaveTour();
  };
  function look(x, y, known) {
    tour = null; walk = null;                          // a tap of your own leaves the tour
    if (P.busy || apart()) { P.settle(); stage(false); layersOn = null; unturn(); }
    const hit = known ? { r: known, exact: true } : regionAt(x, y);
    mem.trail.push({ x: +x.toFixed(1), y: +y.toFixed(1), rid: hit.r.id, exact: hit.exact });
    mem.found.add(hit.r.id); revealed = false; welcomed = true; render();
    if (!S.held) { P.spot(hit.r.layer, 1150); mark(hit.r.id); }   // the layer you touched steps forward for a moment
    if (narrow()) scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); else panel.scrollTop = 0;
  }
  const mark = rid => history.replaceState(null, '', location.pathname + (rid ? '#' + rid : ''));   // the address always names the detail on show
  function reveal() {                                 // the teacher turns the key: the poster opens on the answer
    const l = last(), r = tour !== null ? along()[tour] : l && region(l.rid); if (!r || P.busy) return;
    P.flourish(0.62, 1200, 1.0, r.layer, () => { revealed = true; mark(r.id); render(); });
    if (calm || !P.count) { revealed = true; mark(r.id); render(); }
  }

  on(P.plate, 'click', e => {
    if (P.busy) { P.settle(); welcomed = true; render(); return; }           // a tap skips the opening
    if (apart()) return;
    const [x, y] = P.pos(e); look(x, y);
  });
  on(P.plate, 'pointermove', e => { if (P.busy || apart()) return; const [x, y] = P.pos(e); P.ref.hidden = false; P.ref.textContent = P.gridRef(x, y); });
  on(P.plate, 'pointerleave', () => { P.ref.hidden = true; });
  if (P.input) on(P.input, 'input', () => {
    P.stop(); welcomed = true;
    const v = +P.input.value / 100;
    if (v > 0) P.wide(!narrow());
    stage(v > 0); sheet.classList.toggle('settled', v >= 0.72);            // the names appear once the sheets have room
    if (v === 0) { layersOn = null; P.light(null); unturn(); } else if (layersOn) P.light('focus', layersOn);
    P.setOpen(v, 0.18); render();
  });
  if (P.glass) on(P.glass, 'click', () => {             // the magnifier goes to the detail being read, when there is one in view
    const l = last(), r = tour !== null ? along()[tour] : l ? region(l.rid) : null;
    closer(p, false, r && !(S.held && !revealed) ? r : null);
  });
  /* turning the layers by hand: drag across them once the poster is apart */
  on(sheet, 'pointerdown', e => {
    if (!apart() || P.busy || e.button > 0 || !e.isPrimary || e.target.closest('.panel, .pull, a, button, input')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, uy, ux, moved: false };
  });
  on(sheet, 'pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) { if (Math.hypot(dx, dy) < 6) return; drag.moved = true; sheet.classList.add('turning'); try { sheet.setPointerCapture(e.pointerId); } catch { /* fine without */ } }
    turnTo(drag.uy + dx * 0.3, narrow() ? drag.ux : drag.ux - dy * 0.14, 0);
  });
  const letGo = e => { if (!drag || e.pointerId !== drag.id) return; if (drag.moved) { dragged = true; setTimeout(() => { dragged = false; }, 0); sheet.classList.remove('turning'); } drag = null; };
  on(sheet, 'pointerup', letGo); on(sheet, 'pointercancel', letGo);
  sheet.addEventListener('click', e => { if (dragged) { dragged = false; e.stopPropagation(); e.preventDefault(); } }, true);   // letting go after a turn is not a tap on a sheet
  P.planes.forEach((pl, k) => on(pl, 'click', e => { if (sheet.classList.contains('apart')) { e.stopPropagation(); pick([k]); } }));   // a sheet can be chosen by touching it
  const onKey = () => { revealed = false; welcomed = true; if (!P.busy) render(); };
  document.addEventListener('pa-key', onKey);
  addEventListener('resize', size);
  document.addEventListener('keydown', onTourKey);
  S.leave = () => { P.stop(); document.querySelector('dialog.closer')?.close(); document.removeEventListener('pa-key', onKey); document.removeEventListener('keydown', onTourKey); removeEventListener('resize', size); };

  const linked = region(decodeURIComponent(location.hash.slice(1)));     // a link can point straight at one detail
  const toWalk = (KINDS.find(([k]) => location.hash === '#tour-' + k && walks[k].length) || [null])[0];   // or at one kind of note
  const toTour = (location.hash === '#tour' && stops.length > 0) || !!toWalk;          // or straight at the start of the tour
  const opening = !welcomed && !linked && !toTour && P.count > 0;
  if (opening) P.openNow(0.8);                      // arrive layered, then come together
  size(); render();
  await P.ready();
  if (firstLook) look(firstLook[0], firstLook[1]);
  else if (toTour) { P.settle(); goTour(0, toWalk); }
  else if (linked) { P.settle(); look(linked.x, linked.y, linked); }
  else if (opening) P.collapse(1300, 1.2, () => { welcomed = true; render(); });
  else if (!welcomed) { welcomed = true; render(); }
}

/* ---------- the opening page: three posters, opened side by side ---------- */
async function viewHome() {
  const cat = S.cat, byId = Object.fromEntries(cat.posters.map(p => [p.id, p])), N = cat.themes.length, CYCLE = 9000;
  colours('#101010', '#ffffff');
  document.title = 'Poster Atlas · Posters, book covers & more';
  if (S.theme === null) S.theme = Math.floor(Date.now() / 864e5) % N;      // a different thread starts each day
  const trio = el('div', { class: 'trio' }), tabs = el('div', { class: 'tabs', role: 'group', 'aria-labelledby': 'chooser-label' });
  const title = el('strong'), desc = el('span');
  const words = (cat.tagline[1] || '').split(' ').map(w => el('span', { class: 'w' }, w));     // each word wears one poster's colour
  const toggle = el('button', { class: 'link tab-toggle', type: 'button' });
  const more = el('p', { class: 'about-go' });
  const rest = cat.threads.length - N;
  const chooser = el('div', { class: 'chooser' }, el('span', { class: 'chooser-label', id: 'chooser-label' }, 'Choose a thread'), tabs,
    rest > 0 ? link('threads/', { class: 'tab more', 'aria-label': `${rest} more threads` }, el('span', null, `${rest} more`)) : null, calm ? null : toggle);
  const home = el('div', { class: 'home' }, chooser, el('div', { class: 'about' }, el('p', { class: 'about-text' }, title, desc), more), trio,
    el('div', { class: 'words' },
      el('h1', { class: 'tag' }, el('span', null, cat.tagline[0]), el('span', null, words.flatMap((w, k) => (k ? [' ', w] : [w])))),
      el('p', { class: 'ask2' }, cat.question, el('span', { class: 'hint' }, 'Tap a poster. Or ', link('search/', null, 'look something up'), ', or ', link('map/', null, 'see the map'), '.'))));
  mount('home', home, null, false);

  let plates = [], timers = [], auto = !calm, hovering = false, elapsed = 0, flat = calm, turn = 0;
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const size = () => plates.forEach(({ P, col }) => {
    const w = col.clientWidth - 28, h = col.clientHeight - 84;
    const ph = Math.max(120, Math.min(h, (w * 0.72) / P.p.ratio));
    P.size(ph * P.p.ratio, ph);
  });
  const setAuto = v => {
    auto = v; chooser.classList.toggle('manual', !auto);
    toggle.textContent = auto ? 'Pause' : 'Play';
    toggle.setAttribute('aria-label', auto ? 'Pause: stop the threads changing by themselves' : 'Play: let the threads change by themselves');
  };
  function show(i) {
    timers.forEach(clearTimeout); timers = []; plates.forEach(x => x.P.stop());
    S.theme = i; elapsed = 0; flat = calm;
    const mine = ++turn, t = cat.themes[i];
    title.textContent = t.title; desc.textContent = t.description;
    words.forEach((w, k) => { w.style.color = byId[t.ids[k % t.ids.length]].dark; });
    const th = cat.threads.find(x => x.id === t.thread);
    more.replaceChildren(...(th ? [tgo(`threads/${th.id}/`, 'Follow this thread'), el('span', { class: 'tfacts' }, `${th.posters} posters · ${th.places} countries · ${th.from} to ${th.to}`)] : []));
    tabs.replaceChildren(...cat.themes.map((x, k) => on(
      el('button', { class: 'tab', type: 'button', 'aria-pressed': String(k === i) }, el('span', null, x.short), el('i', { 'aria-hidden': 'true' })),
      'click', () => { setAuto(false); show(k); })));
    plates = t.ids.map((id, k) => {
      const p = byId[id], P = makePlate(p, { ticks: false });
      if (!calm) P.openNow(1);                                    // each poster arrives layered
      const col = el('div', { class: 'col', style: `--g:${p.ground};--i:${p.ink}` }, P.frame,
        el('p', { class: 'cap' }, el('b', null, t.labels[k]), `${p.title} · ${p.country} · ${p.when}`));
      on(P.plate, 'click', e => {
        const [x, y] = P.pos(e), look = flat ? [x, y] : null;       // a tap on a layered poster just opens its page
        timers.forEach(clearTimeout); plates.forEach(q => q.P.stop());
        col.classList.add('chosen'); trio.classList.add('leaving');
        setTimeout(() => go(`posters/${id}/`, { look }), calm ? 0 : 320);
      });
      return { P, col };
    });
    trio.classList.remove('leaving'); trio.replaceChildren(...plates.map(x => x.col));
    size();
    Promise.all(plates.map(x => x.P.ready())).then(() => {
      if (mine !== turn) return;
      plates.forEach(x => x.col.classList.add('in'));
      if (calm) return;
      plates.forEach((x, k) => x.P.collapse(1500 + k * 140, 1.3));  // then they come together
      later(() => { flat = true; }, 1500 + 280 + 1300);
    });
  }
  on(toggle, 'click', () => setAuto(!auto));
  on(trio, 'pointerenter', () => { hovering = true; });
  on(trio, 'pointerleave', () => { hovering = false; });
  const ticker = setInterval(() => {                                // move on to the next thread every few seconds
    if (!auto || hovering || document.hidden) return;
    elapsed += 100;
    const bar = tabs.querySelector('.tab[aria-pressed="true"] i');
    if (bar) bar.style.transform = `scaleX(${Math.min(1, elapsed / CYCLE)})`;
    if (elapsed >= CYCLE) show((S.theme + 1) % N);
  }, 100);
  addEventListener('resize', size);
  S.leave = () => { clearInterval(ticker); timers.forEach(clearTimeout); plates.forEach(x => x.P.stop()); removeEventListener('resize', size); };
  setAuto(!calm); show(S.theme);
}

/* ---------- the collection ---------- */
async function viewCollection() {
  const cat = S.cat;
  colours('#f3f2ee', '#141414');
  document.title = 'The collection · Poster Atlas';
  const groupOf = p => (p.category === 'Film' ? 'Film' : p.category === 'Book cover' ? 'Book covers' : 'Posters');
  const state = { group: 'All', q: '', decade: '', country: '', order: 'Curated' };
  const wall = el('div', { class: 'wall' }), count = el('p', { class: 'meta', 'aria-live': 'polite' });
  const decades = [...new Set(cat.posters.map(p => Math.floor(p.yearNumber / 10) * 10))].sort((a, b) => a - b);
  const countries = [...new Set(cat.posters.flatMap(p => p.countries))].sort((a, b) => a.localeCompare(b));
  const groups = el('span', { role: 'group', 'aria-label': 'Kind of work', style: 'display:inline-flex;gap:18px' });
  const search = on(el('input', { type: 'search', id: 'q', placeholder: 'Title, maker, country or year', 'aria-label': 'Search the collection' }), 'input', e => { state.q = e.target.value.trim().toLowerCase(); draw(); });
  const select = (label, key, options) => on(el('select', { 'aria-label': label }, options.map(([v, t]) => el('option', { value: v }, t))), 'change', e => { state[key] = e.target.value; draw(); });
  function draw() {
    groups.replaceChildren(...['All', 'Film', 'Posters', 'Book covers'].map(g => on(el('button', { type: 'button', 'aria-pressed': String(state.group === g) }, g), 'click', () => { state.group = g; draw(); })));
    let list = cat.posters.filter(p => (state.group === 'All' || groupOf(p) === state.group)
      && (!state.decade || Math.floor(p.yearNumber / 10) * 10 === +state.decade)
      && (!state.country || p.countries.includes(state.country))
      && (!state.q || [p.title, p.creator, p.country, p.when, p.category].join(' ').toLowerCase().includes(state.q)));
    if (state.order === 'Oldest') list = [...list].sort((a, b) => a.yearNumber - b.yearNumber);
    if (state.order === 'Newest') list = [...list].sort((a, b) => b.yearNumber - a.yearNumber);
    if (state.order === 'Title') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    count.textContent = `${list.length} of ${cat.total}`;
    wall.replaceChildren(...list.map(p => link(`posters/${p.id}/`, { class: 'tile' },
      el('span', { class: 'sw', style: `--g:${p.ground}` }, el('img', { src: url(`img/thumb/${p.id}.webp`), alt: '', loading: 'lazy' })),
      el('span', { class: 't' }, p.title), el('span', { class: 'm' }, `${p.country} · ${p.when}`))));
  }
  mount('collection', el('div', { class: 'coll' }, waysIn('collection/'),
    el('h1', null, 'The collection'),
    el('div', { class: 'filters' }, groups, search,
      select('Decade', 'decade', [['', 'Any decade'], ...decades.map(d => [String(d), d + 's'])]),
      select('Country', 'country', [['', 'Anywhere'], ...countries.map(c => [c, c])]),
      select('Order', 'order', [['Curated', 'Curated order'], ['Oldest', 'Oldest first'], ['Newest', 'Newest first'], ['Title', 'Title A to Z']])),
    count, wall), null, false);
  draw();
}

/* ---------- threads: one idea followed across posters ---------- */
const loadThreads = async () => (S.threads ||= await getJSON('data/threads.json'));
const readingNote = () => el('p', { class: 'evnote' }, el('span', { class: 'ev interpretation' }, el('i', { 'aria-hidden': 'true' }), 'Visual reading'),
  ' Threads are a way of seeing details together. They are not a claim about how any poster was made.');

async function viewThreads() {
  const T = await loadThreads();
  colours('#f3f2ee', '#141414');
  document.title = 'Threads · Poster Atlas';
  mount('threads', el('div', { class: 'coll' },
    el('h1', null, 'Threads'),
    el('p', { class: 'lead' }, 'A thread is one idea that turns up on many posters. Pick one and follow it across countries and decades.'),
    readingNote(),
    el('nav', { class: 'filters', 'aria-label': 'All threads' }, T.map(t => link(`threads/${t.id}/`, { class: 'tlink' }, t.name))),
    T.map(t => el('section', { class: 'trow' },
      el('div', { class: 'trow-head' },
        el('h2', null, link(`threads/${t.id}/`, null, t.name)),
        el('p', { class: 'trow-line' }, t.headline),
        el('p', { class: 'meta' }, `${t.idea} ${t.links.length} posters, ${t.links[0].year} to ${t.links[t.links.length - 1].year}.`)),
      el('div', { class: 'strip' }, t.links.map(l => link(`posters/${l.poster}/#${l.region}`, { class: 'chip', style: `--g:${l.ground}`, title: `${l.title} · ${l.label}`, 'aria-label': `${l.title}: ${l.label}` },
        el('img', { src: url(`img/thumb/${l.poster}.webp`), alt: '', loading: 'lazy' }))))))), null, false);
}

// Where a poster of a given shape sits inside the picture area of a card (which is 0.759 wide for every 1 tall).
const fit = r => { const w = r <= 0.759 ? r / 0.759 * 100 : 100, h = r <= 0.759 ? 100 : 0.759 / r * 100; return `width:${w.toFixed(2)}%;height:${h.toFixed(2)}%;left:${((100 - w) / 2).toFixed(2)}%;top:${((100 - h) / 2).toFixed(2)}%`; };

async function viewThread(id) {
  const T = await loadThreads(), i = T.findIndex(t => t.id === id), t = T[i];
  const before = T[(i + T.length - 1) % T.length], after = T[(i + 1) % T.length];
  colours('#f3f2ee', '#141414');
  document.title = `${t.name} · Threads · Poster Atlas`;
  mount('thread', el('div', { class: 'coll' },
    el('p', { class: 'where' }, link('threads/', null, 'Threads'), ` · ${i + 1} of ${T.length}`),
    el('h1', null, t.name),
    el('p', { class: 'lead' }, el('strong', null, t.headline), ' ', t.idea),
    el('p', { class: 'meta' }, `${t.links.length} posters, from ${t.links[0].year} to ${t.links[t.links.length - 1].year}, oldest first. Each opens at the detail outlined.`),
    readingNote(),
    el('div', { class: 'wall' }, t.links.map(l => link(`posters/${l.poster}/#${l.region}`, { class: 'tile' },
      el('span', { class: 'sw', style: `--g:${l.ground}` }, el('span', { class: 'pic' },
        el('span', { style: fit(l.ratio) },
          el('img', { src: url(`img/thumb/${l.poster}.webp`), alt: '', loading: 'lazy' }),
          el('i', { style: `left:${l.b[0]}%;top:${l.b[1]}%;width:${l.b[2]}%;height:${l.b[3]}%`, 'aria-hidden': 'true' })))),
      el('span', { class: 't' }, l.label), el('span', { class: 'm' }, l.sum), el('span', { class: 'm' }, `${l.title} · ${l.country} · ${l.when}`)))),
    el('p', { class: 'between' }, link(`threads/${before.id}/`, { class: 'link' }, `‹ ${before.name}`), link(`threads/${after.id}/`, { class: 'link' }, `${after.name} ›`))), null, false);
}

/* ---------- four ways to see the whole collection: a wall, a map, a timeline, colours ---------- */
const waysIn = here => el('nav', { class: 'ways', 'aria-label': 'Ways to see the collection' }, el('span', null, 'The collection as'),
  [['collection/', 'a wall'], ['map/', 'a map'], ['timeline/', 'a timeline'], ['colour/', 'colours']].map(([p, t]) => link(p, here === p ? { 'aria-current': 'page' } : null, t)));
const smallTile = p => link(`posters/${p.id}/`, { class: 'tile' },
  el('span', { class: 'sw', style: `--g:${p.ground}` }, el('img', { src: url(`img/thumb/${p.id}.webp`), alt: '', loading: 'lazy' })),
  el('span', { class: 't' }, p.title), el('span', { class: 'm' }, `${p.country} · ${p.when}`));

/* The map: a globe, a flat map, or the continents as layers. The drawing lives in atlas.js. */
let mapping = null;
const loadMap = () => (mapping ||= Promise.all([import(url('atlas.js') + (VER ? '?v=' + VER : '')), getJSON('data/world.json')]));
async function viewMap() {
  const cat = S.cat, byId = Object.fromEntries(cat.posters.map(p => [p.id, p]));
  colours('#101010', '#ffffff');
  document.title = 'Map · Poster Atlas';
  const stage = el('div', { class: 'wstage' }), panel = el('section', { class: 'wpanel', 'aria-live': 'polite' });
  const modes = el('div', { class: 'tabs', role: 'group', 'aria-labelledby': 'wlabel' }), spin = el('button', { class: 'link tab-toggle', type: 'button' });
  mount('map', el('div', { class: 'wmap' }, waysIn('map/'), el('h1', { class: 'sr-only' }, 'The map'),
    el('div', { class: 'chooser manual' }, el('span', { class: 'chooser-label', id: 'wlabel' }, 'See the world as'), modes, spin),
    el('div', { class: 'wbody' }, stage, panel)), null, false);
  const [mod, world] = await loadMap();
  if (document.body.dataset.view !== 'map' || !stage.isConnected) return;
  const sheets = world.continents.slice().reverse().filter(c => c.count > 0);        // north first, as on the page
  let A = null;
  const place = p => on(el('button', { type: 'button', class: 'wplace' }, p.label, el('span', null, String(p.posters.length))), 'click', () => A.pick(p.k));
  function show(pin, sheet) {
    if (pin) {
      panel.replaceChildren(...[
        on(el('button', { class: 'link', type: 'button' }, '‹ All places'), 'click', () => A.pick(null)),
        el('h2', { class: 'name' }, pin.label), pin.notes.map(n => el('p', { class: 'meta' }, n)),
        el('p', { class: 'where' }, pin.posters.length === 1 ? 'One poster names this place in its record.' : `${pin.posters.length} posters name this place in their records.`),
        el('div', { class: 'wall' }, pin.posters.map(id => smallTile(byId[id])))].flat().filter(Boolean));
    } else {
      const list = sheet ? sheets.filter(c => c.id === sheet.id) : sheets;
      panel.replaceChildren(...[
        sheet ? on(el('button', { class: 'link', type: 'button' }, '‹ All continents'), 'click', () => A.focus(null)) : null,
        el('h2', { class: 'name' }, sheet ? sheet.name : 'Where they come from'),
        el('p', { class: 'meta' }, sheet ? `${many(sheet.count, 'poster')} from ${many(sheet.places, 'place')}.` : 'Each pin is a place named in a poster’s record, set at its capital. Choose a pin, or a place below.'),
        list.map(c => el('div', { class: 'wgroup' }, sheet ? null : el('h3', null, el('i', { style: `background:${c.colour}`, 'aria-hidden': 'true' }), c.name, el('span', null, String(c.count))),
          el('p', null, world.pins.filter(p => p.on === c.id).map(place)))),
        sheet && sheet.from ? el('p', { class: 'small' }, 'This sheet wears the colour of ', link(`posters/${sheet.from.id}/`, null, sheet.from.title), '.') : null,
        sheet ? null : el('p', { class: 'small' }, 'A poster made in several places has a pin in each. Former states keep the names the records give them.')].flat().filter(Boolean));
    }
  }
  const drawSpin = () => { spin.hidden = !A || A.mode !== 'globe' || calm; spin.textContent = A && A.spinning ? 'Pause' : 'Play'; spin.setAttribute('aria-label', A && A.spinning ? 'Pause: stop the globe turning' : 'Play: let the globe turn'); };
  const drawModes = () => { modes.replaceChildren(...[['globe', 'A globe'], ['flat', 'A flat map'], ['layers', 'Layers']].map(([id, t]) => on(
    el('button', { class: 'tab', type: 'button', 'aria-pressed': String(A.mode === id) }, el('span', null, t), el('i', { 'aria-hidden': 'true' })), 'click', () => A.setMode(id)))); drawSpin(); };
  A = mod.makeAtlas(stage, { continents: world.continents, pins: world.pins, calm, onPick: show, onMode: () => drawModes(), onSpin: drawSpin });
  on(spin, 'click', () => A.spin(!A.spinning));
  const again = () => A.resize();
  addEventListener('resize', again);
  S.leave = () => { A.destroy(); removeEventListener('resize', again); };
  drawModes(); show(null, null);
}

/* The timeline: the collection decade by decade, oldest first. */
async function viewTimeline() {
  const cat = S.cat, land = Object.fromEntries(cat.continents.map(c => [c.id, c]));
  colours('#101010', '#ffffff');
  document.title = 'Timeline · Poster Atlas';
  const decades = new Map();
  for (const p of [...cat.posters].sort((a, b) => a.yearNumber - b.yearNumber)) { const d = Math.floor(p.yearNumber / 10) * 10; if (!decades.has(d)) decades.set(d, []); decades.get(d).push(p); }
  const most = Math.max(...[...decades.values()].map(v => v.length));
  mount('timeline', el('div', { class: 'tline' }, waysIn('timeline/'), el('h1', { class: 'sr-only' }, 'The timeline'),
    el('nav', { class: 'tbars', 'aria-label': 'Jump to a decade' }, [...decades].map(([d, ps]) => el('a', { href: `#d${d}`, 'aria-label': `${d}s, ${many(ps.length, 'poster')}` },
      el('span', { class: 'tcol' }, el('span', { class: 'stack2', style: `height:${Math.max(6, Math.round(ps.length / most * 104))}px` }, ps.map(p => el('i', { style: `background:${land[p.on].colour}` })))), el('span', { class: 'yr' }, `${d}s`)))),
    el('p', { class: 'tkey' }, cat.continents.filter(c => cat.posters.some(p => p.on === c.id)).reverse().map(c => el('span', null, el('i', { style: `background:${c.colour}` }), c.name)),
      el('span', { class: 'note' }, 'Each block is one poster, coloured by where it was first made.')),
    [...decades].map(([d, ps]) => el('section', { class: 'trow2', id: `d${d}` },
      el('div', { class: 'thead' }, el('h2', null, `${d}s`), el('p', null, `${many(ps.length, 'poster')} from ${many(new Set(ps.flatMap(p => p.countries)).size, 'place')}`)),
      el('div', { class: 'tstrip' }, ps.map(p => link(`posters/${p.id}/`, { class: 'tile' },
        el('span', { class: 'sw', style: `--g:${p.ground}` }, el('img', { src: url(`img/thumb/${p.id}.webp`), alt: '', loading: 'lazy' })),
        el('span', { class: 't' }, p.title), el('span', { class: 'm' }, el('i', { class: 'dot', style: `background:${land[p.on].colour}`, 'aria-hidden': 'true' }), `${p.country} · ${p.when}`))))))), null, false);
}

/* Colour: the collection set out as a spectrum, and filtered by the colours each poster uses. */
async function viewColour() {
  const cat = S.cat, sorted = [...cat.posters].sort((a, b) => a.sort - b.sort);
  colours('#101010', '#ffffff');
  document.title = 'Colour · Poster Atlas';
  const SHOW = { red: '#d5281c', orange: '#ef7d1a', yellow: '#f2c61f', green: '#3d8b45', teal: '#1b9a94', blue: '#2a61c9', purple: '#7d4bb5', pink: '#ee4f9a', brown: '#7b5234', black: '#161616', grey: '#8d8d8d', white: '#f4f1e8' };
  let want = null;
  const wall = el('div', { class: 'wall' }), chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Show posters that use a colour' }), count = el('p', { class: 'sline', 'aria-live': 'polite' });
  const strip = el('div', { class: 'spectrum', 'aria-hidden': 'true' }, sorted.map(p => el('i', { style: `background:${p.ground}`, title: p.title })));
  function draw() {
    const list = sorted.filter(p => !want || p.fams.includes(want));
    chips.replaceChildren(...cat.families.filter(f => cat.posters.some(p => p.fams.includes(f))).map(f => on(
      el('button', { type: 'button', class: 'chip2', 'aria-pressed': String(want === f) }, el('i', { style: `background:${SHOW[f]}`, 'aria-hidden': 'true' }), f, el('span', null, String(cat.posters.filter(p => p.fams.includes(f)).length))),
      'click', () => { want = want === f ? null : f; draw(); })));
    count.textContent = want ? `${many(list.length, 'poster')} with ${want} in ${list.length === 1 ? 'its' : 'their'} palette, in the order of the spectrum.` : `All ${cat.total}, from red round to pink, then the greys. Each stands on its own colour.`;
    wall.replaceChildren(...list.map(p => link(`posters/${p.id}/`, { class: 'tile' },
      el('span', { class: 'sw', style: `--g:${p.ground}` }, el('img', { src: url(`img/thumb/${p.id}.webp`), alt: '', loading: 'lazy' })),
      el('span', { class: 'pal', 'aria-hidden': 'true' }, p.pal.map(h => el('i', { style: `background:${h}` }))),
      el('span', { class: 't' }, p.title), el('span', { class: 'm' }, `${p.country} · ${p.when}`))));
  }
  mount('colour', el('div', { class: 'colr' }, waysIn('colour/'), el('h1', { class: 'sr-only' }, 'The colours'), strip,
    el('div', { class: 'chooser' }, el('span', { class: 'chooser-label' }, 'Show posters that use'), chips), count, wall,
    el('p', { class: 'small' }, 'The colours under each poster are the ones named in its study. Sorting them into families such as red or teal is done by rule, so a colour near a boundary may sit in either.')), null, false);
  draw();
}

/* ---------- search: the Atlas's own words, and an index of ideas ---------- */
let searching = null;
const loadSearch = () => (searching ||= Promise.all([import(url('search.js') + (VER ? '?v=' + VER : '')), getJSON('data/search.json')])
  .then(([m, data]) => ({ data, find: m.makeSearch({ posters: S.cat.posters, ...data }) })));
const many = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

async function viewSearch() {
  const cat = S.cat, byId = Object.fromEntries(cat.posters.map(p => [p.id, p]));
  colours('#101010', '#ffffff');
  document.title = 'Search · Poster Atlas';
  const input = el('input', { type: 'search', id: 'sq', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search', placeholder: 'an idea, a colour, a name', 'aria-describedby': 'sline' });
  const line = el('p', { class: 'sline', id: 'sline', 'aria-live': 'polite' }, 'Getting the index ready.');
  const res = el('div', { class: 'sres' });
  mount('search', el('div', { class: 'srch' }, el('h1', { class: 'sr-only' }, 'Search'), el('label', { class: 'sq', for: 'sq' }, 'Look something up'), input, line, res), null, false);
  input.value = new URLSearchParams(location.search).get('q') || '';
  const { data, find } = await loadSearch();
  if (document.body.dataset.view !== 'search' || !input.isConnected) return;      // the visitor moved on while the index was loading
  let shown = 24, timer = 0;
  const setQ = q => history.replaceState(null, '', url('search/') + (q ? '?q=' + encodeURIComponent(q) : ''));

  const index = () => el('section', { class: 'sindex' },
    el('h2', null, 'Or start from the index of ideas'),
    [...new Set(data.ideas.map(g => g.under))].map(u => el('div', { class: 'srow' }, el('h3', null, u),
      el('p', null, data.ideas.filter(g => g.under === u && g.n > 0).map(g => link('search/?q=' + encodeURIComponent(g.name), { class: 'idea', style: g.first ? `color:${byId[g.first].dark}` : '' },
        g.name, el('sup', null, el('span', { class: 'sr-only' }, ', '), String(g.n), el('span', { class: 'sr-only' }, g.n === 1 ? ' detail' : ' details'))))))),
    el('p', { class: 'small' }, 'The number beside an idea is how many details it leads to. Each idea wears the colour of the first poster it finds.'),
    el('p', { class: 'small' }, 'Search reads the Atlas’s own notes and nothing else. It treats forms of a word as one word, knows which words in the notes sit close to an idea, and forgives a slip of the keyboard. Nothing you type leaves this page.'));

  const clip = (t, n, fromEnd) => (t.length <= n ? t : fromEnd ? '…' + t.slice(-n).replace(/^\S*\s/, '') : t.slice(0, n).replace(/\s\S*$/, '') + '…');
  function detailTile(x) {
    const p = x.doc.p, d = x.doc.d, y = find.why(x);
    const quote = !y || ['label', 'thread', 'strand', 'ctx'].includes(y.field) ? d.s
      : y.field === 'sum' ? [y.before, el('mark', null, y.word), y.after]
      : [clip(y.before, 70, true), el('mark', null, y.word), clip(y.after, 90)];
    const why = y && y.thread ? `On the thread ${y.thread.name}` : y && y.how === 'close' ? `“${y.word.toLowerCase()}” sits close to “${y.said}”` : null;
    return link(`posters/${p.id}/#${d.r}`, { class: 'tile dt' },
      el('span', { class: 'sw', style: `--g:${p.ground}` }, el('span', { class: 'pic' }, el('span', { style: fit(p.ratio) },
        el('img', { src: url(`img/thumb/${p.id}.webp`), alt: '', loading: 'lazy' }),
        el('i', { style: `left:${d.b[0]}%;top:${d.b[1]}%;width:${d.b[2]}%;height:${d.b[3]}%`, 'aria-hidden': 'true' })))),
      el('span', { class: 't' }, d.l), el('span', { class: 'm' }, quote),
      el('span', { class: 'm from' }, `${p.title} · ${p.country} · ${p.when}`), why && el('span', { class: 'm why' }, why));
  }
  const posterTile = p => link(`posters/${p.id}/`, { class: 'tile' },
    el('span', { class: 'sw', style: `--g:${p.ground}` }, el('img', { src: url(`img/thumb/${p.id}.webp`), alt: '', loading: 'lazy' })),
    el('span', { class: 't' }, p.title), el('span', { class: 'm' }, `${p.country} · ${p.when}`));

  function draw(typing) {
    const q = input.value.trim();
    if (!q) { line.textContent = `${data.details.length.toLocaleString('en-GB')} details on ${cat.total} posters, read word by word.`; res.replaceChildren(index()); return; }
    const r = find.search(q, { typing }), across = new Set(r.details.map(x => x.doc.p.id)).size;
    const found = [r.details.length && `${r.details.length === 150 ? 'More than 150' : r.details.length} detail${r.details.length === 1 ? '' : 's'} on ${many(across, 'poster')}`,
      r.posters.length && many(r.posters.length, 'poster'), r.threads.length && many(r.threads.length, 'thread')].filter(Boolean);
    line.replaceChildren(found.length ? found.join(' · ') + '.' : `Nothing in the Atlas for “${q}”.`,
      r.fixed.length && found.length ? ` Read as “${r.fixed.map(f => f[1]).join(' ')}”.` : '',
      r.missing.length && found.length ? ` Not in the notes: ${r.missing.join(', ')}.` : '');
    // A name, a place or a date was asked for: posters first. An idea was asked for: the details first.
    const named = r.posters.some(x => x.got.every(g => g.how !== 'close' && ['title', 'maker', 'place'].includes(x.doc.best.get(g.term))));
    const posters = r.posters.length > 0 && el('section', null, el('h2', null, named ? 'Posters' : 'Posters that are about this as a whole'), el('div', { class: 'wall' }, r.posters.slice(0, 12).map(x => posterTile(x.doc.p))));
    const details = r.details.length > 0 && el('section', null, el('h2', null, 'Details'), el('div', { class: 'wall' }, r.details.slice(0, shown).map(detailTile)),
      r.details.length > shown && on(el('button', { class: 'link more24', type: 'button' }, `Show ${Math.min(24, r.details.length - shown)} more`), 'click', () => { shown += 24; draw(false); }));
    res.replaceChildren(...[
      r.threads.length > 0 && el('section', null, el('h2', null, 'Threads'), r.threads.slice(0, 3).map(x => el('p', { class: 'sthread' }, tgo(`threads/${x.doc.t.id}/`, x.doc.t.name), el('span', null, x.doc.t.headline)))),
      ...(named ? [posters, details] : [details, posters]),
      !found.length && el('p', { class: 'lead' }, 'Try a plainer word, or start from an idea below.'), !found.length && index(),
    ].filter(Boolean));
  }
  on(input, 'input', () => { clearTimeout(timer); timer = setTimeout(() => { shown = 24; setQ(input.value.trim()); draw(true); }, 140); });
  on(input, 'keydown', e => { if (e.key === 'Enter') { clearTimeout(timer); setQ(input.value.trim()); draw(false); input.blur(); } });
  S.leave = () => clearTimeout(timer);
  draw(false);
  if (!input.value && !narrow()) input.focus({ preventScroll: true });
}

/* ---------- finding the right view for the address ---------- */
function where() {
  const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : '';
  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'posters' && seg[1]) return { view: 'poster', id: seg[1] };
  if (seg[0] === 'collection') return { view: 'collection' };
  if (seg[0] === 'search') return { view: 'search' };
  if (['map', 'timeline', 'colour'].includes(seg[0])) return { view: seg[0] };
  if (seg[0] === 'threads') return seg[1] ? { view: 'thread', id: seg[1] } : { view: 'threads' };
  return { view: 'home' };
}
async function route(state, first) {
  S.leave?.(); S.leave = null;
  const w = where();
  try {
    S.cat ||= await getJSON('data/catalogue.json');
    if (w.view === 'poster' && S.cat.posters.some(p => p.id === w.id)) await viewPoster(w.id, state?.look || null);
    else if (w.view === 'collection') await viewCollection();
    else if (w.view === 'search') await viewSearch();
    else if (w.view === 'map') await viewMap();
    else if (w.view === 'timeline') await viewTimeline();
    else if (w.view === 'colour') await viewColour();
    else if (w.view === 'thread' && S.cat.threads.some(t => t.id === w.id)) await viewThread(w.id);
    else if (w.view === 'threads' || w.view === 'thread') await viewThreads();
    else await viewHome();
  } catch (e) {
    document.getElementById('main')?.prepend(el('p', { class: 'lead' }, 'This page could not be loaded. Reload to try again.'));
    throw e;
  }
  // After moving to a new view, the keyboard starts at its content. On the search page that means the line to type on.
  if (!first) { scrollTo(0, 0); ((w.view === 'search' && !narrow() && document.getElementById('sq')) || document.getElementById('main'))?.focus({ preventScroll: true }); }
}
function go(path, state) { history.pushState(null, '', url(path)); route(state, false); }
addEventListener('popstate', () => route(null, false));
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[data-nav]');
  if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); go(a.getAttribute('href').slice(BASE.length));
});
route(null, true);
