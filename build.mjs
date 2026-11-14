// Builds the Poster Atlas website into the "dist" folder.
// Run with:  node build.mjs
// It needs nothing installed beyond Node itself.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { makeSearch } from './src/search.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const C = join(ROOT, 'content');
const OUT = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://kr48vr.github.io/re-poster-atlas').replace(/\/$/, '');
const RECORD_URL = 'https://claude.ai/artifact/6b8VcjxP12aoZZqoQekWxo';
const BEGAN = { poster: 'the-wind-rises', region: 'calligraphy' };   // the detail King read about, which started the whole project
const TAGLINE = ['Look by layers.', 'See more worlds.'];
const QUESTION = 'Where does your eye go first?';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const write = (p, s) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); };
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- colour: each page takes its ground and ink from its poster ---------- */
const hexToRgb = h => { const x = h.replace('#', ''); const f = x.length === 3 ? [...x].map(c => c + c).join('') : x; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16) / 255); };
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const unlin = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const lum = h => { const [r, g, b] = hexToRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function oklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: Math.atan2(B, A) };
}
function fromOklch({ L, C, H }) {
  const A = C * Math.cos(H), B = C * Math.sin(H);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map(c => Math.round(Math.min(1, Math.max(0, unlin(c))) * 255).toString(16).padStart(2, '0')).join('');
}
function pickColours(palette, accent) {
  const hexes = (palette || []).map(p => p.hex).filter(h => /^#[0-9a-f]{3,8}$/i.test(h || ''));
  if (/^#[0-9a-f]{3,8}$/i.test(accent || '')) hexes.push(accent);
  if (!hexes.length) return { ground: '#1d1d1b', ink: '#ffffff' };
  const all = hexes.map(h => ({ h, ...oklch(h) }));
  const byL = [...all].sort((a, b) => a.L - b.L);
  const dark = byL[0].L < 0.3 ? byL[0].h : '#141414';
  const light = byL.at(-1).L > 0.93 ? byL.at(-1).h : '#ffffff';
  const best = [...all].sort((a, b) => b.C * (b.L > 0.3 && b.L < 0.86 ? 1 : 0.35) - a.C * (a.L > 0.3 && a.L < 0.86 ? 1 : 0.35))[0];
  let ground = best.C < 0.035 ? byL[0].h : best.h;                 // a poster with no colour gets its darkest tone
  const ink = contrast(ground, light) >= contrast(ground, dark) ? light : dark;
  for (let i = 0; i < 60 && contrast(ground, ink) < 5.2; i++) {
    const o = oklch(ground); o.L += ink === light ? -0.012 : 0.012; ground = fromOklch(o);
  }
  return { ground, ink };
}

// The same colour, lightened until words set in it can be read on the dark opening page.
function onDark(hex) {
  let c = hex;
  for (let i = 0; i < 90 && contrast(c, '#101010') < 4.5; i++) { const o = oklch(c); o.L += 0.012; c = fromOklch(o); }
  return c;
}

/* ---------- read the content ---------- */
const home = read(join(C, 'home.json'));
const layersAll = read(join(C, 'layers.json')).layers;
const overrides = existsSync(join(C, 'colours.json')) ? read(join(C, 'colours.json')) : {};
const tones = existsSync(join(C, 'layer-tones.json')) ? read(join(C, 'layer-tones.json')).posters : {};   // what each layer needs behind it to be seen (scripts/layer_tones.py)
const EV = { documented: 'Documented', observation: 'In the image', interpretation: 'Visual reading', uncertain: 'Uncertain' };

const posters = home.order.map((id, i) => {
  const { poster: p, studyData: s } = read(join(C, 'studies', id + '.json'));
  const srcById = Object.fromEntries((s.sources || []).map(x => [x.id, x]));
  const colours = overrides[id] || pickColours(s.palette, p.accent);
  const L = layersAll[id];
  const when = p.category === 'Book cover' ? `Cover ${p.coverYear || p.year}` : (p.posterYear && p.posterYear !== p.year ? `${p.year} · poster ${p.posterYear}` : p.year);
  return {
    id, n: i + 1, title: p.title, year: String(p.year), yearNumber: p.yearNumber, when, country: p.country, countries: p.countries || [p.country],
    category: p.category, creator: p.creator || null, filmCreator: p.filmCreator || null, bookAuthor: p.bookAuthor || null,
    edition: p.edition || null, credit: p.credit || p.imageCredit || null, source: p.source || null, imageSource: p.imageSource || null,
    originNote: p.originNote || null, yearNote: p.yearNote || null,
    ratio: +(+p.ratio).toFixed(4), alt: p.alt, blurb: p.blurb, intro: s.intro, ...colours,
    regions: s.regions.map(r => ({
      id: r.id, n: r.number, label: r.label, short: r.shortLabel || r.label, sum: r.summary, x: r.x, y: r.y,
      b: [r.bounds.x, r.bounds.y, r.bounds.w, r.bounds.h], layer: r.layerIndex ?? 0, q: r.question, related: r.related || [], threads: [],
      secs: r.sections.map(x => ({
        kind: x.kind, h: x.heading, body: x.body, ev: x.evidence,
        orig: (x.originalText || x.japanese) ? { text: x.originalText || x.japanese, lang: x.lang || (x.japanese ? 'ja' : null), reading: x.reading || null, translation: x.translation || null } : null,
        note: x.note || x.interpretation || null, facts: x.facts || null,
        src: (x.sources || []).map(q => ({ ...(srcById[q.id] || {}), note: q.note || null })).filter(q => q.title),
      })),
    })),
    layers: L ? L.labels.map((label, k) => ({ label, desc: (L.descriptions || [])[k] || '', file: L.sources[k].split('/').pop().replace('.png', '.webp') })) : [],
    tones: L && tones[id] && tones[id].film.length === L.labels.length ? tones[id] : null,
    readings: (s.connections || []).map(c => ({ label: c.label, title: c.title, text: c.text, layers: [...new Set((c.anchors || []).map(a => a[0]))] })),
    began: id === BEGAN.poster ? BEGAN.region : null,
    palette: (s.palette || []).map(c => ({ name: c.name, hex: c.hex, role: c.role || '' })), paletteNote: s.paletteNote || null,
    transcript: (s.transcript || []).map(t => ({ heading: t.heading, rows: (t.rows || []).map(r => ({ text: r.text || r.jp || '', meaning: r.meaning || r.en || '', lang: r.lang || (r.jp ? 'ja' : null) })) })),
    transcriptNote: s.transcriptNote || null,
    sources: s.sources || [],
  };
});
const byId = Object.fromEntries(posters.map(p => [p.id, p]));
posters.forEach((p, i) => {
  const a = posters[(i + posters.length - 1) % posters.length], b = posters[(i + 1) % posters.length];
  p.prev = { id: a.id, title: a.title }; p.next = { id: b.id, title: b.title };
});

/* ---------- threads: one idea followed across posters, oldest first ---------- */
const threads = read(join(C, 'threads.json')).map(t => ({
  id: t.id, name: t.name, headline: t.headline, idea: t.idea, fromKing: !!t.fromKing,
  links: t.links.map(l => {
    const p = byId[l.poster], r = p && p.regions.find(x => x.id === l.region);
    if (!r) throw new Error(`Thread ${t.id}: ${l.poster}/${l.region} is not in the studies`);
    return { poster: p.id, title: p.title, country: p.country, when: p.when, year: p.yearNumber, ratio: p.ratio, ground: p.ground, region: r.id, label: r.label, sum: r.sum, b: r.b };
  }).sort((x, y) => x.year - y.year),
}));
for (const t of threads) t.links.forEach((l, i) => {
  const next = t.links[(i + 1) % t.links.length];
  byId[l.poster].regions.find(r => r.id === l.region).threads.push({ id: t.id, name: t.name, idea: t.idea, count: t.links.length, at: i + 1,
    next: { poster: next.poster, region: next.region, title: next.title, label: next.label } });
});

/* A short stamp of everything a visitor's browser might have kept from last time. It changes whenever the site does,
   so a returning visitor always gets the new files and never a mix of old and new. */
const VER = createHash('sha1').update(readFileSync(join(ROOT, 'src', 'app.js'))).update(readFileSync(join(ROOT, 'src', 'app.css'))).update(readFileSync(join(ROOT, 'src', 'search.js'))).update(readFileSync(join(ROOT, 'src', 'atlas.js'))).update(readFileSync(join(C, 'world.json'))).update(readFileSync(join(C, 'places.json')))
  .update(existsSync(join(C, 'ideas.json')) ? readFileSync(join(C, 'ideas.json')) : '')
  .update(JSON.stringify(posters)).update(JSON.stringify(threads)).update(JSON.stringify(home)).digest('hex').slice(0, 10);

/* ---------- write the site ---------- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/* ---------- the map: every place named in the records gets a pin; every continent a sheet and a colour ---------- */
const world = read(join(C, 'world.json')), placeList = read(join(C, 'places.json')).places;
const placeOf = Object.fromEntries(placeList.map(p => [p.name, p.same ? placeList.find(q => q.name === p.same) : p]));
const pinAt = new Map();
for (const p of posters) {
  const names = p.countries && p.countries.length ? p.countries : [p.country];
  for (const name of names) {
    const pl = placeOf[name];
    if (!pl) throw new Error(`No place on the map for "${name}" (${p.id}). Add it to content/places.json`);
    const key = pl.at.join(',');
    let pin = pinAt.get(key); if (!pin) pinAt.set(key, pin = { names: [], at: pl.at, on: pl.on, notes: [], posters: [] });
    if (!pin.names.includes(pl.name)) { pin.names.push(pl.name); if (pl.note) pin.notes.push(pl.note); }
    if (!pin.posters.includes(p.id)) pin.posters.push(p.id);
  }
  p.on = placeOf[names[0]].on;                                             // the continent of the first place named, for the timeline
}
const pins = [...pinAt.values()].map(p => ({ ...p, label: p.names.join(' and ') })).sort((a, b) => a.label.localeCompare(b.label));
const wear = spectrum(6, [byId[BEGAN.poster]]).map(x => x.p), WEARS = { europe: 0, asia: 1, africa: 2, 'south-america': 3, 'north-america': 4, oceania: 5 };
const continents = world.continents.map(c => {
  const mine = pins.filter(p => p.on === c.id), from = wear[WEARS[c.id]];
  return { id: c.id, name: c.name, colour: from ? from.ground : '#d8d4ca', from: from ? { id: from.id, title: from.title } : null, count: new Set(mine.flatMap(p => p.posters)).size, places: mine.length };
});

/* ---------- colour: which families of colour each poster's palette holds, and where its page colour sits in the spectrum ---------- */
const FAMILIES = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown', 'black', 'grey', 'white'];
function family(hex) {
  const { L, C } = oklch(hex), h = hueOf(hex);
  if (C < 0.035) return L > 0.9 ? 'white' : L < 0.3 ? 'black' : 'grey';
  if (h >= 25 && h < 95 && L < 0.56 && C < 0.13) return 'brown';
  return h < 10 || h >= 335 ? 'pink' : h < 45 ? 'red' : h < 75 ? 'orange' : h < 112 ? 'yellow' : h < 170 ? 'green' : h < 215 ? 'teal' : h < 280 ? 'blue' : h < 325 ? 'purple' : 'pink';
}
for (const p of posters) {
  p.pal = p.palette.map(c => c.hex).filter(h => /^#[0-9a-f]{6}$/i.test(h)).slice(0, 7);
  p.fams = FAMILIES.filter(f => p.pal.some(h => family(h) === f));
  const { L, C } = oklch(p.ground);
  p.sort = C < 0.045 ? 1000 + Math.round((1 - L) * 100) : Math.round((hueOf(p.ground) + 340) % 360);     // the spectrum from red round to pink, then the greys from light to dark
}

const catalogue = {
  total: posters.length, tagline: TAGLINE, question: QUESTION, record: RECORD_URL,
  posters: posters.map(p => ({ id: p.id, n: p.n, title: p.title, when: p.when, yearNumber: p.yearNumber, country: p.country, countries: p.countries, category: p.category, creator: p.creator, ratio: p.ratio, ground: p.ground, ink: p.ink, dark: onDark(p.ground), blurb: p.blurb, alt: p.alt, layers: p.layers.length, on: p.on, pal: p.pal, fams: p.fams, sort: p.sort })),
  continents: continents.map(c => ({ id: c.id, name: c.name, colour: c.colour, dark: onDark(c.colour) })),
  families: FAMILIES,
  themes: home.themes.map(t => ({ title: t.title, short: t.short, description: t.description, ids: t.ids, labels: t.labels, thread: (threads.find(x => x.name === t.short) || {}).id || null })),
  threads: threads.map(t => ({ id: t.id, name: t.name, headline: t.headline, count: t.links.length,
    posters: new Set(t.links.map(l => l.poster)).size,
    places: new Set(t.links.flatMap(l => (byId[l.poster].countries && byId[l.poster].countries.length ? byId[l.poster].countries : [l.country]))).size,
    from: t.links[0].year, to: t.links[t.links.length - 1].year })),
};
write(join(OUT, 'data', 'catalogue.json'), JSON.stringify(catalogue));
for (const p of posters) write(join(OUT, 'data', 'posters', p.id + '.json'), JSON.stringify(p));
write(join(OUT, 'data', 'threads.json'), JSON.stringify(threads));
write(join(OUT, 'data', 'world.json'), JSON.stringify({ source: world.source, continents: continents.map(c => ({ ...c, rings: world.continents.find(w => w.id === c.id).rings })), pins }));
/* Everything search reads: every note in full, the threads, and the hand-made list of which words sit close to which idea. */
const ideas = existsSync(join(C, 'ideas.json')) ? read(join(C, 'ideas.json')).ideas : [];
const searchData = {
  details: posters.flatMap(p => p.regions.map(r => ({ p: p.id, r: r.id, l: r.label, s: r.sum, q: r.q || '', b: r.b, t: r.threads.map(t => t.id),
    x: r.secs.map(x => [x.h || '', [x.body, x.note].filter(Boolean).join(' ')]),
    o: r.secs.filter(x => x.orig).map(x => [x.orig.text, x.orig.reading, x.orig.translation].filter(Boolean).join(' / ')).join(' / ') }))),
  threads: threads.map(t => ({ id: t.id, name: t.name, headline: t.headline, idea: t.idea, count: t.links.length })),
  ideas,
};
/* The index of ideas shows, for each idea, how many details it leads to and wears the colour of the poster it finds first.
   Both are worked out here with the very search the site uses, so the index can never promise what search does not find. */
const finder = makeSearch({ posters: catalogue.posters, ...searchData });
searchData.ideas = ideas.map(g => { const r = finder.search(g.name); return { ...g, n: r.details.length, on: new Set(r.details.map(x => x.doc.p.id)).size, first: r.details[0] ? r.details[0].doc.p.id : null }; });
write(join(OUT, 'data', 'search.json'), JSON.stringify(searchData));

cpSync(join(C, 'images', 'catalogue'), join(OUT, 'img', 'poster'), { recursive: true });
cpSync(join(C, 'images', 'thumb'), join(OUT, 'img', 'thumb'), { recursive: true });
cpSync(join(C, 'images', 'about'), join(OUT, 'img', 'about'), { recursive: true });   // King's own photographs for the About page
for (const p of posters) {
  if (!p.layers.length) continue;
  mkdirSync(join(OUT, 'img', 'layers', p.id), { recursive: true });
  p.layers.forEach((l, k) => cpSync(join(C, 'images', 'layers', p.id, l.file), join(OUT, 'img', 'layers', p.id, k + '.webp')));
}
const share = {};                                   // a picture for link previews: the original image file
for (const f of readdirSync(join(C, 'images', 'full'))) { share[f.replace(/\.[^.]+$/, '')] = f; }
cpSync(join(C, 'images', 'full'), join(OUT, 'img', 'full'), { recursive: true });
cpSync(join(ROOT, 'src', 'fonts'), join(OUT, 'fonts'), { recursive: true });
for (const f of ['app.css', 'app.js', 'search.js', 'atlas.js', 'favicon.svg']) cpSync(join(ROOT, 'src', f), join(OUT, f));
write(join(OUT, '.nojekyll'), '');

const page = ({ root, path, title, description, image, ground, ink, view, id, body, cls = 'plain' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Poster Atlas">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE_URL}/${path}">
<meta property="og:image" content="${SITE_URL}/${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${ground}">
<link rel="canonical" href="${SITE_URL}/${path}">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="preload" as="font" type="font/woff2" href="${root}fonts/bodoni-moda-latin-normal.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="${root}fonts/instrument-sans-latin-normal.woff2" crossorigin>
<meta name="pa-v" content="${VER}">
<link rel="stylesheet" href="${root}app.css?v=${VER}">
<meta name="pa-root" content="${root}">
<style>:root{--ground:${ground};--ink:${ink}}</style>
</head>
<body data-view="${view}"${id ? ` data-id="${id}"` : ''}>
<a class="skip" href="#main">Skip to the content</a>
<div id="app">
<header class="bar"><a class="mark" href="${root}">Poster Atlas<span class="sub-mark">Posters, book covers &amp; more</span></a><nav class="bar-nav"><a href="${root}collection/">Collection</a><a href="${root}threads/">Threads</a><a href="${root}search/">Search</a><a href="${root}teachers/">For teachers</a><a href="${root}about/">About</a></nav></header>
<main id="main" class="${cls}">
${body}
</main>
</div>
${view === 'page' ? '' : `<script type="module" src="${root}app.js?v=${VER}"></script>`}
</body>
</html>
`;

const first = byId[home.themes[0].ids[0]];
write(join(OUT, 'index.html'), page({
  root: './', path: '', title: 'Poster Atlas · Posters, book covers & more', description: `${TAGLINE.join(' ')} ${posters.length} posters and book covers from 1891 to 2026, each one opened up detail by detail.`,
  image: 'img/full/' + share[first.id], ground: '#101010', ink: '#ffffff', view: 'home',
  body: `<h1>${TAGLINE.join(' ')}</h1><p>${QUESTION}</p><p>${posters.length} posters and book covers across eras and cultures. Discover the choices that make them work.</p><p><a href="./collection/">Browse the collection</a></p>`,
}));

write(join(OUT, 'collection', 'index.html'), page({
  root: '../', path: 'collection/', title: 'The collection · Poster Atlas', description: `All ${posters.length} posters and book covers in the Poster Atlas, from 1891 to 2026.`,
  image: 'img/full/' + share[first.id], ground: '#f3f2ee', ink: '#141414', view: 'collection',
  body: `<h1>The collection</h1><ol>${posters.map(p => `<li><a href="../posters/${p.id}/">${esc(p.title)}</a>, ${esc(p.country)}, ${esc(p.when)}</li>`).join('')}</ol>`,
}));

write(join(OUT, 'threads', 'index.html'), page({
  root: '../', path: 'threads/', title: 'Threads · Poster Atlas', description: `${threads.length} ideas that turn up on many posters. Pick one and follow it across countries and decades.`,
  image: 'img/full/' + share[first.id], ground: '#f3f2ee', ink: '#141414', view: 'threads',
  body: `<h1>Threads</h1><p>A thread is one idea that turns up on many posters.</p>${threads.map(t => `<h2><a href="./${t.id}/">${esc(t.name)}</a></h2><p>${esc(t.headline)} ${esc(t.idea)}</p><ul>${t.links.map(l => `<li><a href="../posters/${l.poster}/#${l.region}">${esc(l.title)}: ${esc(l.label)}</a></li>`).join('')}</ul>`).join('')}`,
}));
for (const t of threads) write(join(OUT, 'threads', t.id, 'index.html'), page({
  root: '../../', path: `threads/${t.id}/`, title: `${t.name} · Threads · Poster Atlas`, description: `${t.headline} ${t.idea} Followed across ${t.links.length} posters.`,
  image: 'img/full/' + share[t.links[0].poster], ground: '#f3f2ee', ink: '#141414', view: 'thread', id: t.id,
  body: `<h1>${esc(t.name)}</h1><p>${esc(t.headline)} ${esc(t.idea)}</p><ol>${t.links.map(l => `<li><a href="../../posters/${l.poster}/#${l.region}">${esc(l.title)}, ${esc(l.country)}, ${esc(l.when)}</a>: ${esc(l.label)}. ${esc(l.sum)}</li>`).join('')}</ol>`,
}));

for (const p of posters) {
  write(join(OUT, 'posters', p.id, 'index.html'), page({
    root: '../../', path: `posters/${p.id}/`, title: `${p.title} · Poster Atlas`, description: p.blurb, image: 'img/full/' + share[p.id],
    ground: p.ground, ink: p.ink, view: 'poster', id: p.id,
    body: `<h1>${esc(p.title)}</h1><p>${esc([p.creator, p.country, p.when].filter(Boolean).join(' · '))}</p><p>${esc(p.blurb)}</p><p>${esc(p.intro)}</p>
<img src="../../img/poster/${p.id}.webp" alt="${esc(p.alt)}" width="400">
<h2>Details on this poster</h2>
${p.regions.map(r => `<section><h3>${esc(r.label)}</h3><p>${esc(r.sum)}</p>${r.secs.map(s => `<h4>${esc(s.h)}</h4><p>${esc(s.body)}</p><p><small>${esc(EV[s.ev] || '')}</small></p>`).join('')}<p><strong>${esc(r.q)}</strong></p></section>`).join('\n')}
${p.credit ? `<p><small>${esc(p.credit)}</small></p>` : ''}`,
  }));
}

const prose = (root, path, title, description, html) => write(join(OUT, path, 'index.html'), page({
  root, path, title: `${title} · Poster Atlas`, description, image: 'img/full/' + share[first.id], ground: '#f3f2ee', ink: '#141414', view: 'page', body: `<article class="prose">${html}</article>`,
}));

prose('../', 'teachers/', 'For teachers', 'How to use Poster Atlas with a class: the key, the pull bar and the trail.', `
<h1>For teachers</h1>
<p class="lead">Poster Atlas is built for looking together. Everything on a poster page works on a projector or a shared screen, and nothing needs a sign-in.</p>
<h2>The key</h2>
<p>Beside the plate number at the top of every poster page there is a small key. It has no label, so most students will not notice it.</p>
<p>Press it once and the notes are held back. Now, when you tap a spot on the poster, the screen shows only a question about that spot. Let the class talk. When you are ready, press the key under the question. The poster opens, the layer that holds the answer steps forward, and the note appears.</p>
<p>Press the key at the top again to go back to showing notes straight away. The key stays as you set it while you move between posters.</p>
<h2>Where does your eye go first?</h2>
<p>Every poster opens with the same question. Ask a student to point, then tap that spot. Each tap is numbered and joined to the last one, so the class can see the path their eyes took and compare it with someone else's.</p>
<h2>The finger and the moon</h2>
<p>A second question works well after the first: what is this poster pointing you towards?</p>
<p>It comes from the book that started Poster Atlas. In <i>Zen and Ghibli</i>, the priest Shinsuke Hosokawa tells the producer Toshio Suzuki that a film's advertising is like a finger pointing at the moon: &ldquo;the way you point your finger is so that the eye can aim toward the moon.&rdquo;</p>
<p>The poster is the finger. The film, the book or the idea behind it is the moon. Ask the class where the finger sends their eye, and then what they think the moon is. <a href="../about/#began">How Poster Atlas began</a>.</p>
<h2>Pull the poster apart</h2>
<p>The bar under each poster runs from Together to Apart. Drag it to pull the poster into its layers. On a wide screen the sheets stand side by side across the page, each with its name under it. Choose a name, or touch a sheet, to see that layer on its own.</p>
<p>The layers show what is visible in the artwork. They are not the original production separations.</p>
<h2>Threads</h2>
<p>A thread is one idea, such as scale or gesture, followed across many posters. Under a detail's note you will find the thread it belongs to and the next poster on it. The <a href="../threads/">threads page</a> shows all ${threads.length} at once, which makes a ready-made lesson: one idea, a dozen posters, several countries and decades.</p>
<p>Threads are visual readings. They are a way of seeing details together, and students can argue with them.</p>
<h2>A map, a timeline and colours</h2>
<p>The <a href="../collection/">collection</a> can be seen four ways. As a <a href="../map/">map</a>, the world is a globe you can turn and pause, a flat map, or a stack of layers with one sheet for each continent, and it changes from one to the next as a poster does when it is pulled apart. Choose a pin to see the posters from that place.</p>
<p>The <a href="../timeline/">timeline</a> sets the posters out decade by decade, so a class can see what was being made in different places at the same time. <a href="../colour/">Colours</a> sets them out as a spectrum and can show every poster that uses, say, teal.</p>
<h2>Search by idea</h2>
<p><a href="../search/">Search</a> looks through every note on every poster. Type an idea, such as loneliness, hand-drawn lettering or the colour red, and it shows the details that match, each outlined on its poster. It also finds titles, makers, countries and decades.</p>
<p>Under the search line there is an index of ${searchData.ideas.length} ideas to start from. Search reads only the Atlas's own words. It needs no sign-in, and nothing a student types leaves the page. Each result shows the sentence that put it there, so a class can judge whether it belongs.</p>
<h2>How sure is each note?</h2>
<p>Every note carries one of four marks.</p>
<ul>
<li><strong>Documented</strong>: a source is given, and you can open it.</li>
<li><strong>In the image</strong>: something anyone can check by looking.</li>
<li><strong>Visual reading</strong>: an interpretation. Students are welcome to disagree with it.</li>
<li><strong>Uncertain</strong>: the record is unclear, and the note says so.</li>
</ul>
<h2>Grid references</h2>
<p>Each poster has letters along the top and numbers down the side, like a map. "Look at D4" gets a whole room looking at the same place.</p>
<p><a href="../collection/">Browse the collection</a></p>`);

/* Posters whose page colours sit as far apart as the collection allows, set out in the order of the rainbow.
   The About page's tiles and the map's continents both wear them. */
function hueOf(hex) { return ((oklch(hex).H * 180 / Math.PI) + 360) % 360; }
function hueGap(x, y) { return Math.min(Math.abs(x - y), 360 - Math.abs(x - y)); }
function spectrum(n, leaveOut) {
  const vivid = posters.filter(p => !leaveOut.includes(p)).map(p => ({ p, ...oklch(p.ground), h: hueOf(p.ground) })).filter(x => x.C > 0.075 && x.L > 0.45 && x.L < 0.86);
  const picked = [vivid.slice().sort((x, y) => y.C - x.C)[0]];
  while (picked.length < n) {
    const far = x => Math.min(...picked.map(q => hueGap(x.h, q.h)));
    picked.push(vivid.filter(x => !picked.includes(x)).sort((x, y) => (far(y) + y.C * 60) - (far(x) + x.C * 60))[0]);
  }
  return picked.sort((x, y) => x.h - y.h);
}

/* ---------- the About page: bands of colour, each taken from a poster, like the opening's colour fields ---------- */
{
  const WR = byId[BEGAN.poster], line = WR.regions.find(r => r.id === BEGAN.region);
  const place = c => (c === 'Türkiye' ? 'Turkey' : c);                       // one country, two spellings in the records
  const places = new Set(posters.flatMap(p => (p.countries && p.countries.length ? p.countries : [p.country]).map(place))).size;
  const years = [Math.min(...posters.map(p => p.yearNumber)), Math.max(...posters.map(p => p.yearNumber))];
  const nf = n => n.toLocaleString('en-GB');
  const gap = hueGap;
  const last = byId['the-piano'] || posters[7];                              // the closing band borrows this poster's colour
  const picked = spectrum(6, [WR, last]);                                    // six posters whose colours sit as far apart as the collection allows
  const tiles = [
    [nf(posters.length), 'posters and book covers', '../collection/'],
    [nf(posters.reduce((n, p) => n + p.regions.length, 0)), 'details, each with a note and a question', null],
    [nf(posters.reduce((n, p) => n + p.layers.length, 0)), 'layers to pull apart', null],
    [String(threads.length), 'threads to follow between posters', '../threads/'],
    [String(places), 'countries and territories', '../map/'],
    [String(years[1] - years[0]), `years, from ${years[0]} to ${years[1]}`, '../timeline/'],
  ];
  const band = (cls, c, html, id) => `<section class="band ${cls}"${id ? ` id="${id}"` : ''} style="--ground:${c[0]};--ink:${c[1]}">${html}</section>`;
  const go = (href, text) => `<a class="tgo" href="${href}"><span>${text}</span><i aria-hidden="true"></i></a>`;
  const body = `<article class="abt">
<section class="band hero">
<h1>About Poster Atlas</h1>
<p class="lead">${posters.length} posters and book covers from ${years[0]} to ${years[1]}, each opened up detail by detail. Posters, book covers and more: it is an independent educational project by King.</p>
<ul class="tiles">${tiles.map(([n, label, href], k) => { const q = picked[k].p; return `<li style="--g:${q.ground};--i:${q.ink}">${href ? `<a class="fig" href="${href}">` : '<div class="fig">'}<b>${n}</b><span>${label}</span>${href ? '</a>' : '</div>'}<small>Colour from <a href="../posters/${q.id}/">${esc(q.title)}</a></small></li>`; }).join('')}</ul>
</section>
${band('story', [WR.ground, WR.ink], `<div class="tell">
<h2>How this began</h2>
<p>I was reading <i>Zen and Ghibli</i> by Toshio Suzuki, the producer at Studio Ghibli. He mentions the line on the poster for The Wind Rises, &ldquo;You must live&rdquo;, and says: &ldquo;I happened to write it with a brush, and the advertising producer said, &lsquo;Let&rsquo;s go with that.&rsquo;&rdquo;</p>
<p>That made me curious. I had AI build a site to tease posters apart and mark them up, to help me understand the craft that went into different posters. The site it built was beautiful, but lacked the X-factor. I then had the idea of pulling a poster into its layers, so I can better see and understand how it is put together.</p>
<p>${go(`../posters/${WR.id}/#${line.id}`, 'See the brush-written line on The Wind Rises')}</p>
<p class="sig">&mdash; King</p>
</div>
<div class="plates">
<figure><img src="../img/about/zen-and-ghibli-cover.webp" width="1050" height="1400" alt="A copy of the book Zen and Ghibli by Toshio Suzuki, lying on a green table. Its cover shows Totoro holding an umbrella above the treetops under a blue sky."><figcaption>The book.</figcaption></figure>
<figure><img src="../img/about/zen-and-ghibli-page-21.webp" width="1050" height="1400" alt="Page 21 of the book, held open with a thumb, with a yellow page marker at its edge. The last paragraph begins: The tagline for The Wind Rises was You must live. I happened to write it with a brush."><figcaption>Page 21. The brush is in the last paragraph.</figcaption></figure>
<figure><a class="marked" href="../posters/${WR.id}/#${line.id}"><img src="../img/poster/${WR.id}.webp" width="${Math.round(900 * WR.ratio)}" height="900" alt="The Wind Rises poster, with the brush-written line at the top marked."><i class="box" style="left:${line.b[0]}%;top:${line.b[1]}%;width:${line.b[2]}%;height:${line.b[3]}%"></i><b class="pin now" style="left:${line.x}%;top:${line.y}%">1</b></a><figcaption>The line itself, on the poster.</figcaption></figure>
<p class="credit">Photographs by King. The book is <i>Zen and Ghibli: Life Lessons for Lasting Happiness from the Legendary Studio</i> by Toshio Suzuki, translated by Beth Cary, published by G. P. Putnam&rsquo;s Sons, New York, in 2026. Its cover and text belong to their rights holders and are shown here only to say where this project began.</p>
</div>`, 'began')}
${band('moon', ['#f1ede4', '#141312'], `<div class="tell">
<h2>The finger and the moon</h2>
<p>On that same page, the priest Shinsuke Hosokawa tells Suzuki that a film's advertising is like a finger pointing at the moon.</p>
<p>A poster is that finger. Poster Atlas looks closely at the finger to see how it points. That is why every poster here opens with the same question: where does your eye go first?</p>
<p>${go('../collection/', 'Start with any poster')}</p>
</div>
<div class="say">
<blockquote>&ldquo;the way you point your finger is so that the eye can aim toward the moon.&rdquo;</blockquote>
<div class="aim" aria-hidden="true" style="--moon:${picked.slice().sort((x, y) => gap(x.h, 100) - gap(y.h, 100))[0].p.ground}"><i></i><b></b></div>
</div>`)}
${band('fanband', WR.tones && WR.tones.stage === 'paper' ? ['#f1ede4', '#141312'] : ['#141312', '#f1ede4'], `<div class="tell">
<h2>What the layers are</h2>
<p>Every poster here can be pulled apart into the layers that make it. Layers analyse the visible artwork. They are not original production separations.</p>
</div>
<ol class="fan" style="--n:${WR.layers.length};--ratio:${WR.ratio}">${WR.layers.map((l, k) => `<li><span class="sh${WR.tones && WR.tones.film[k] ? ' film-' + WR.tones.film[k] : ''}"><img src="../img/layers/${WR.id}/${k}.webp" alt="" loading="lazy" width="${Math.round(600 * WR.ratio)}" height="600"></span><b>${k + 1}</b><span class="nm">${esc(l.label)}</span></li>`).join('')}</ol>
<p>${go(`../posters/${WR.id}/`, 'Pull The Wind Rises apart yourself')}</p>`)}
${band('facts', [last.ground, last.ink], `<div>
<h2>What the notes are</h2>
<p>Each poster has between ten and eighteen details. Every detail has a short note, a mark that says how sure the note is, and a question to take away. Sources, edition details and image credits are inside each poster's page.</p>
<ul class="marks">
<li><span class="ev documented"><i aria-hidden="true"></i>Documented</span><span>A source is given, and you can open it.</span></li>
<li><span class="ev observation"><i aria-hidden="true"></i>In the image</span><span>Something anyone can check by looking.</span></li>
<li><span class="ev interpretation"><i aria-hidden="true"></i>Visual reading</span><span>An interpretation. You are welcome to disagree with it.</span></li>
<li><span class="ev uncertain"><i aria-hidden="true"></i>Uncertain</span><span>The record is unclear, and the note says so.</span></li>
</ul>
</div>
<div>
<h2>Images</h2>
<p>Each poster page names the edition shown and credits its source. The images are reproduced for study and teaching.</p>
<h2>For teachers</h2>
<p>There is a quiet way to hold the notes back and let a class look first. ${'<a href="../teachers/">How to use Poster Atlas with a class</a>'}.</p>
</div>
<div>
<h2>How this was made</h2>
<p>King had the first Poster Atlas built with an AI tool, added the idea of pulling posters into layers, and rebuilt it here with Claude, an AI model. A record of every step, who did what, and how the work was checked is kept on a private page. <a href="${RECORD_URL}">How this was made</a> opens only for people King has shared it with.</p>
</div>`)}
</article>`;
  write(join(OUT, 'about', 'index.html'), page({ root: '../', path: 'about/', title: 'About · Poster Atlas', description: 'How Poster Atlas began, what its notes and layers are, and how it was made.',
    image: 'img/full/' + share[first.id], ground: '#101010', ink: '#ffffff', view: 'page', cls: 'full', body }));
}

write(join(OUT, 'search', 'index.html'), page({ root: '../', path: 'search/', title: 'Search · Poster Atlas', description: 'Look something up in Poster Atlas: an idea, a colour, a name. Or start from the index of ideas.',
  image: 'img/full/' + share[first.id], ground: '#101010', ink: '#ffffff', view: 'search',
  body: `<article class="prose"><h1>Search</h1><p>Look something up: an idea, a colour, a name. Search reads the Atlas's own notes.</p><h2>Index of ideas</h2><ul>${searchData.ideas.map(g => `<li><a href="./?q=${encodeURIComponent(g.name)}">${esc(g.name)}</a> (${g.n})</li>`).join('')}</ul></article>` }));

/* Map, timeline and colour: the app draws them. These are what a reader without scripts, or a search engine, gets. */
const plainList = ps => `<ul>${ps.map(p => `<li><a href="../posters/${p.id}/">${esc(p.title)}</a>, ${esc(p.country)}, ${esc(p.when)}</li>`).join('')}</ul>`;
for (const [path, title, description, html] of [
  ['map/', 'Map', 'Where the posters in Poster Atlas come from: a globe, a flat map, or the continents as layers.',
    `<h1>The map</h1><p>Where the posters come from.</p>${pins.map(p => `<h2>${esc(p.label)}</h2>${plainList(p.posters.map(id => byId[id]))}`).join('')}`],
  ['timeline/', 'Timeline', 'Poster Atlas decade by decade, from the 1890s to the 2020s.',
    `<h1>The timeline</h1>${plainList([...posters].sort((a, b) => a.yearNumber - b.yearNumber))}`],
  ['colour/', 'Colour', 'Poster Atlas set out as a spectrum, and filtered by the colours each poster uses.',
    `<h1>The colours</h1>${plainList([...posters].sort((a, b) => a.sort - b.sort))}`],
]) write(join(OUT, path, 'index.html'), page({ root: '../', path, title: `${title} · Poster Atlas`, description, image: 'img/full/' + share[first.id], ground: '#101010', ink: '#ffffff', view: path.slice(0, -1), body: `<article class="prose">${html}</article>` }));

write(join(OUT, '404.html'), page({ root: '/re-poster-atlas/', path: '404.html', title: 'Not found · Poster Atlas', description: 'That page is not in the Atlas.', image: 'img/full/' + share[first.id], ground: '#f3f2ee', ink: '#141414', view: 'page',
  body: `<article class="prose"><h1>That page is not in the Atlas.</h1><p><a href="/re-poster-atlas/">Go to the opening page</a> or <a href="/re-poster-atlas/collection/">browse the collection</a>.</p></article>` }));
write(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', 'collection/', 'threads/', ...threads.map(t => `threads/${t.id}/`), 'search/', 'map/', 'timeline/', 'colour/', 'teachers/', 'about/', ...posters.map(p => `posters/${p.id}/`)].map(u => `<url><loc>${SITE_URL}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

const low = posters.filter(p => contrast(p.ground, p.ink) < 4.5).map(p => p.id);
console.log(`Threads: ${threads.length}, links: ${threads.reduce((n, t) => n + t.links.length, 0)}, posters on no thread: ${posters.filter(p => !p.regions.some(r => r.threads.length)).length}`);
console.log(`Built ${posters.length} poster pages, ${posters.reduce((n, p) => n + p.regions.length, 0)} details, ${posters.reduce((n, p) => n + p.layers.length, 0)} layers.`);
console.log(`Posters without layers: ${posters.filter(p => !p.layers.length).map(p => p.id).join(', ') || 'none'}`);
console.log(`Pages whose text contrast is under 4.5 to 1: ${low.join(', ') || 'none'}`);
