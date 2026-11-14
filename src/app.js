// Poster Atlas: the opening page, the poster pages and the collection.
// Every page of the site loads this one file. It reads the page address and shows the right view.

const ROOT = new URL(document.querySelector('meta[name="pa-root"]')?.content || './', location.href);
const BASE = ROOT.pathname;
const url = p => BASE + p;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => matchMedia('(max-width: 820px)').matches;
const COLS = 6, LETTERS = 'ABCDEF', GAP = 62;
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const EV = { documented: 'Documented', observation: 'In the image', interpretation: 'Visual reading', uncertain: 'Uncertain' };
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

/* ---------- what the site remembers while it is open ---------- */
const S = { cat: null, posters: new Map(), memory: {}, leave: null, held: false, theme: null };
try { S.held = sessionStorage.getItem('pa-held') === '1'; } catch { /* private window: carry on without it */ }
const setHeld = v => { S.held = v; try { sessionStorage.setItem('pa-held', v ? '1' : '0'); } catch { /* fine */ } document.dispatchEvent(new CustomEvent('pa-key')); };
const getJSON = async p => { const r = await fetch(url(p)); if (!r.ok) throw new Error(p); return r.json(); };
const loadPoster = async id => { if (!S.posters.has(id)) S.posters.set(id, await getJSON(`data/posters/${id}.json`)); return S.posters.get(id); };
function colours(ground, ink) {
  const r = document.documentElement.style; r.setProperty('--ground', ground); r.setProperty('--ink', ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ground);
}

/* ---------- a plate: one poster that can come apart into its layers ---------- */
function makePlate(p, { ticks = true, pull = false } = {}) {
  const count = Array.isArray(p.layers) ? p.layers.length : (p.layers || 0);
  const rows = Math.round(COLS / p.ratio);
  const stack = el('div', { class: 'stack', 'aria-hidden': 'true' },
    Array.from({ length: count }, (_, k) => el('div', { class: 'plane', style: `--z:${(k - (count - 1) / 2) * GAP}` },
      el('img', { src: url(`img/layers/${p.id}/${k}.webp`), alt: '', draggable: 'false' }))));
  const flat = el('img', { class: 'flat', src: url(`img/poster/${p.id}.webp`), alt: p.alt, draggable: 'false' });
  const casing = sv('polyline', { stroke: '#111111', 'stroke-width': '6' }), route = sv('polyline', { stroke: '#ffffff', 'stroke-width': '2.5' });
  const trail = sv('svg', { class: 'trail', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' }); trail.append(casing, route);
  const marks = el('div', { class: 'marks' }), ref = el('span', { class: 'ref', hidden: true });
  const plate = el('div', { class: 'plate' }, stack, flat, trail, marks, ref);
  const input = pull && count ? el('input', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': 'Pull the poster apart into its layers' }) : null;
  const frame = el('div', { class: 'frame' + (ticks ? '' : ' bare') },
    ticks && el('div', { class: 'ticks-top', 'aria-hidden': 'true' }, [...LETTERS].map(c => el('span', null, c))),
    ticks && el('div', { class: 'ticks-left', 'aria-hidden': 'true' }, Array.from({ length: rows }, (_, k) => el('span', null, String(k + 1)))),
    plate,
    input && el('div', { class: 'pull' }, el('span', { 'aria-hidden': 'true' }, 'Together'), input, el('span', { 'aria-hidden': 'true' }, 'Apart')));
  let timers = [], closing = null, busy = false;
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const api = {
    p, frame, plate, marks, ref, casing, route, input, count,
    get busy() { return busy; },
    gridRef: (x, y) => LETTERS[Math.min(COLS - 1, Math.floor(x / 100 * COLS))] + (Math.min(rows - 1, Math.floor(y / 100 * rows)) + 1),
    size(pw, ph) { plate.style.setProperty('--pw', Math.round(pw) + 'px'); plate.style.setProperty('--ph', Math.round(ph) + 'px'); },
    pos(e) { const b = plate.getBoundingClientRect(); return [Math.max(0, Math.min(100, (e.clientX - b.left) / b.width * 100)), Math.max(0, Math.min(100, (e.clientY - b.top) / b.height * 100))]; },
    setOpen(v, dur) {
      plate.style.setProperty('--dur', dur + 's'); clearTimeout(closing);
      if (v > 0 && count) { plate.classList.add('is-open'); plate.style.setProperty('--open', v); }
      else { plate.style.setProperty('--open', 0); closing = setTimeout(() => plate.classList.remove('is-open'), dur * 1000); }
    },
    light(cls, ks) {                       // show some layers and dim the rest: "spot" when flat, "focus" when apart
      const set = new Set([].concat(ks ?? []));
      plate.classList.remove('spot', 'focus');
      [...stack.children].forEach((pl, i) => pl.classList.toggle('on', set.has(i)));
      if (cls && count) plate.classList.add(cls);
    },
    flourish(level, hold, dur, k, done) {  // open, hold, close
      if (calm || !count) { done && done(); return; }
      busy = true; if (input) input.value = Math.round(level * 100);
      if (k !== null && k !== undefined) api.light('focus', k);
      api.setOpen(level, dur);
      later(() => {
        api.setOpen(0, dur); if (input) input.value = 0;
        later(() => { api.light(null); busy = false; done && done(); }, dur * 1000);
      }, dur * 1000 + hold);
    },
    openNow(level) { if (!count) return; busy = true; if (input) input.value = Math.round(level * 100); api.setOpen(level, 0); },   // start layered
    collapse(hold, dur, done) {            // then come together
      later(() => {
        api.setOpen(0, dur); if (input) input.value = 0;
        later(() => { api.light(null); busy = false; done && done(); }, dur * 1000);
      }, hold);
    },
    spot(k, ms) { api.stop(); api.light('spot', k); later(() => api.light(null), ms); },
    stop() { timers.forEach(clearTimeout); timers = []; busy = false; },
    settle() { api.stop(); api.light(null); if (input) input.value = 0; api.setOpen(0, 0.4); },
    ready: () => Promise.race([
      Promise.all([flat, ...stack.querySelectorAll('img')].map(i => (i.decode ? i.decode().catch(() => {}) : null))),
      new Promise(r => setTimeout(r, 2500))]),
  };
  return api;
}

/* ---------- the bar across the top, and putting a view on the page ---------- */
function mount(view, node, mid, withKey) {
  document.body.dataset.view = view;
  const key = el('button', { class: 'key', type: 'button', 'aria-pressed': String(S.held), 'aria-label': 'Hold back the notes until you choose to reveal them' }, keyIcon());
  on(key, 'click', () => { setHeld(!S.held); key.setAttribute('aria-pressed', String(S.held)); });
  const bar = el('header', { class: 'bar' },
    link('', { class: 'mark' }, 'Poster Atlas', el('span', { class: 'sub-mark' }, 'Posters, book covers & more')),
    el('span', { class: 'mid' }, withKey ? key : null, mid),
    el('nav', { class: 'bar-nav', 'aria-label': 'Site' }, link('collection/', null, 'Collection'), el('a', { href: url('teachers/') }, 'For teachers'), el('a', { href: url('about/') }, 'About')));
  const main = el('main', { id: 'main', tabindex: '-1' }, node);
  document.getElementById('app').replaceChildren(bar, main);
  return main;
}

/* ---------- a poster page ---------- */
async function viewPoster(id, firstLook) {
  const p = await loadPoster(id);
  colours(p.ground, p.ink);
  document.title = `${p.title} · Poster Atlas`;
  const T = S.cat.total, P = makePlate(p, { ticks: true, pull: true });
  const panel = el('section', { class: 'panel', 'aria-live': 'polite' });
  const sheet = el('div', { class: 'sheet' }, el('div', { class: 'stage' }, P.frame), panel);
  mount('poster', sheet, [
    link(`posters/${p.prev.id}/`, { class: 'step', 'aria-label': `Previous plate: ${p.prev.title}` }, '‹'),
    el('span', { id: 'plateno' }, `Plate ${String(p.n).padStart(2, '0')} of ${T} · ${p.title}`),
    link(`posters/${p.next.id}/`, { class: 'step', 'aria-label': `Next plate: ${p.next.title}` }, '›')], true);

  const mem = (S.memory[id] ||= { trail: [], found: new Set() });
  let revealed = false, welcomed = !!firstLook || mem.trail.length > 0 || calm, layersOn = null;
  const apart = () => P.input && +P.input.value > 0;
  const region = rid => p.regions.find(r => r.id === rid);
  const last = () => mem.trail[mem.trail.length - 1];

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
  }
  function drawMarks() {
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
  const indexList = () => el('details', { class: 'more index' },
    el('summary', null, `Index of this plate · ${mem.found.size} of ${p.regions.length} found`),
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
  const again = () => el('div', null, on(el('button', { class: 'link', type: 'button' }, 'Start this plate again'), 'click', () => { mem.trail = []; mem.found = new Set(); revealed = false; render(); }));

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

  function renderApart() {
    const pick = ks => { const same = JSON.stringify(layersOn) === JSON.stringify(ks); layersOn = same ? null : ks; P.light(layersOn ? 'focus' : null, layersOn); render(); };
    const is = ks => String(JSON.stringify(layersOn) === JSON.stringify(ks));
    return [
      el('p', { class: 'where' }, `${p.title}, pulled apart`),
      el('h2', { class: 'name' }, `${COUNT[p.layers.length] || p.layers.length} layers make this poster.`),
      el('ol', { class: 'rows' }, p.layers.map((l, k) => el('li', null, on(
        el('button', { type: 'button', 'aria-pressed': is([k]) }, el('span', { class: 'num' }, String(k + 1)), el('strong', null, l.label), el('span', { class: 'd' }, l.desc)),
        'click', () => pick([k]))))),
      p.readings.length > 0 && el('p', { class: 'sub' }, 'Ways to read the layers together'),
      p.readings.length > 0 && el('ul', { class: 'rows' }, p.readings.map(r => el('li', null, on(
        el('button', { type: 'button', 'aria-pressed': is(r.layers) }, el('span', { class: 'num', 'aria-hidden': 'true' }, '+'), el('strong', null, r.title), el('span', { class: 'd' }, r.text)),
        'click', () => pick(r.layers))))),
      el('p', { class: 'small' }, 'Layers analyse the visible artwork. They are not original production separations.')];
  }

  function render() {
    drawMarks();
    const l = last();
    let kids;
    if (apart() && !P.busy) kids = renderApart();
    else if (!welcomed) kids = [el('h1', { class: 'ask' }, S.cat.tagline.join(' '))];
    else if (!l) {
      kids = [el('h1', { class: 'ask fade' }, S.cat.question),
        el('p', { class: 'lead' }, 'Tap that spot on the poster. There is no wrong place to start.'),
        el('p', { class: 'meta' }, el('strong', null, p.title), el('br'), [p.creator, p.country, p.when].filter(Boolean).join(' · ')),
        S.held ? null : el('p', { class: 'meta' }, p.blurb),
        S.held ? null : extras()];
    } else {
      const r = region(l.rid), here = P.gridRef(l.x, l.y);
      if (S.held && !revealed) {
        kids = [el('p', { class: 'where' }, `Look ${mem.trail.length} · ${here}`), el('p', { class: 'bigq fade' }, r.q),
          el('div', null, on(el('button', { class: 'key turn', type: 'button', 'aria-label': 'Reveal the note' }, keyIcon()), 'click', reveal))];
      } else {
        const also = r.related.map(region).filter(Boolean);
        kids = [
          el('p', { class: 'where' }, l.exact ? `Look ${mem.trail.length} · you went to ${here}`
            : `Look ${mem.trail.length} · you went to ${here}. Nothing is written about that exact spot yet. The nearest detail is at ${P.gridRef(r.x, r.y)}.`),
          el('h2', { class: 'name' }, r.label), el('p', { class: 'sum' }, r.sum),
          el('div', { class: 'secs' }, r.secs.map(secNode)),
          S.held ? null : el('p', { class: 'question' }, el('small', null, 'A question to take with you'), r.q),
          also.length > 0 && el('div', { class: 'also' }, el('span', null, 'Connected on this plate'),
            also.map(a => on(el('button', { type: 'button' }, `${P.gridRef(a.x, a.y)} ${a.short}`), 'click', () => look(a.x, a.y, a)))),
          el('p', { class: 'next' }, mem.found.size === p.regions.length
            ? `You have found all ${p.regions.length} details on this plate.` : `Where next? ${mem.found.size} of ${p.regions.length} details found.`),
          again(), S.held ? null : extras()];
      }
    }
    panel.replaceChildren(...kids.flat().filter(Boolean));
    panel.querySelector('.key.turn')?.focus({ preventScroll: true });     // Enter or Space then turns the key
  }

  function look(x, y, known) {
    if (P.busy) { P.settle(); }
    const hit = known ? { r: known, exact: true } : regionAt(x, y);
    mem.trail.push({ x: +x.toFixed(1), y: +y.toFixed(1), rid: hit.r.id, exact: hit.exact });
    mem.found.add(hit.r.id); revealed = false; welcomed = true; render();
    if (!S.held) P.spot(hit.r.layer, 1150);          // the layer you touched steps forward for a moment
    if (narrow()) scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); else panel.scrollTop = 0;
  }
  function reveal() {                                 // the teacher turns the key: the poster opens on the answer
    const l = last(); if (!l || P.busy) return;
    P.flourish(0.62, 1200, 1.0, region(l.rid).layer, () => { revealed = true; render(); });
    if (calm || !P.count) { revealed = true; render(); }
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
    if (v === 0) { layersOn = null; P.light(null); } else if (layersOn) P.light('focus', layersOn);
    P.setOpen(v, 0.18); render();
  });
  const onKey = () => { revealed = false; welcomed = true; if (!P.busy) render(); };
  document.addEventListener('pa-key', onKey);
  addEventListener('resize', size);
  S.leave = () => { P.stop(); document.removeEventListener('pa-key', onKey); removeEventListener('resize', size); };

  const opening = !welcomed && P.count > 0;
  if (opening) P.openNow(0.8);                      // arrive layered, then come together
  size(); render();
  await P.ready();
  if (firstLook) look(firstLook[0], firstLook[1]);
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
  const chooser = el('div', { class: 'chooser' }, el('span', { class: 'chooser-label', id: 'chooser-label' }, 'Choose a thread'), tabs, calm ? null : toggle);
  const home = el('div', { class: 'home' }, chooser, el('p', { class: 'about' }, title, desc), trio,
    el('div', { class: 'words' },
      el('h1', { class: 'tag' }, el('span', null, cat.tagline[0]), el('span', null, words.flatMap((w, k) => (k ? [' ', w] : [w])))),
      el('p', { class: 'ask2' }, cat.question, el('span', { class: 'hint' }, 'Tap a poster.'))));
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
    toggle.setAttribute('aria-label', auto ? 'Stop the threads changing by themselves' : 'Let the threads change by themselves');
  };
  function show(i) {
    timers.forEach(clearTimeout); timers = []; plates.forEach(x => x.P.stop());
    S.theme = i; elapsed = 0; flat = calm;
    const mine = ++turn, t = cat.themes[i];
    title.textContent = t.title; desc.textContent = t.description;
    words.forEach((w, k) => { w.style.color = byId[t.ids[k % t.ids.length]].dark; });
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
  mount('collection', el('div', { class: 'coll' },
    el('h1', null, 'The collection'),
    el('div', { class: 'filters' }, groups, search,
      select('Decade', 'decade', [['', 'Any decade'], ...decades.map(d => [String(d), d + 's'])]),
      select('Country', 'country', [['', 'Anywhere'], ...countries.map(c => [c, c])]),
      select('Order', 'order', [['Curated', 'Curated order'], ['Oldest', 'Oldest first'], ['Newest', 'Newest first'], ['Title', 'Title A to Z']])),
    count, wall), null, false);
  draw();
}

/* ---------- finding the right view for the address ---------- */
function where() {
  const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : '';
  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'posters' && seg[1]) return { view: 'poster', id: seg[1] };
  if (seg[0] === 'collection') return { view: 'collection' };
  return { view: 'home' };
}
async function route(state, first) {
  S.leave?.(); S.leave = null;
  const w = where();
  try {
    S.cat ||= await getJSON('data/catalogue.json');
    if (w.view === 'poster' && S.cat.posters.some(p => p.id === w.id)) await viewPoster(w.id, state?.look || null);
    else if (w.view === 'collection') await viewCollection();
    else await viewHome();
  } catch (e) {
    document.getElementById('main')?.prepend(el('p', { class: 'lead' }, 'This page could not be loaded. Reload to try again.'));
    throw e;
  }
  if (!first) { scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); }
}
function go(path, state) { history.pushState(null, '', url(path)); route(state, false); }
addEventListener('popstate', () => route(null, false));
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[data-nav]');
  if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); go(a.getAttribute('href').slice(BASE.length));
});
route(null, true);
