// Builds the Poster Atlas website into the "dist" folder.
// Run with:  node build.mjs
// It needs nothing installed beyond Node itself.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const C = join(ROOT, 'content');
const OUT = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://kr48vr.github.io/re-poster-atlas').replace(/\/$/, '');
const RECORD_URL = 'https://claude.ai/artifact/6b8VcjxP12aoZZqoQekWxo';
const TAGLINE = ['Made for a glance.', 'Worth a long look.'];
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

/* ---------- read the content ---------- */
const home = read(join(C, 'home.json'));
const layersAll = read(join(C, 'layers.json')).layers;
const overrides = existsSync(join(C, 'colours.json')) ? read(join(C, 'colours.json')) : {};
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
      b: [r.bounds.x, r.bounds.y, r.bounds.w, r.bounds.h], layer: r.layerIndex ?? 0, q: r.question, related: r.related || [],
      secs: r.sections.map(x => ({
        kind: x.kind, h: x.heading, body: x.body, ev: x.evidence,
        orig: (x.originalText || x.japanese) ? { text: x.originalText || x.japanese, lang: x.lang || (x.japanese ? 'ja' : null), reading: x.reading || null, translation: x.translation || null } : null,
        note: x.note || x.interpretation || null, facts: x.facts || null,
        src: (x.sources || []).map(q => ({ ...(srcById[q.id] || {}), note: q.note || null })).filter(q => q.title),
      })),
    })),
    layers: L ? L.labels.map((label, k) => ({ label, desc: (L.descriptions || [])[k] || '', file: L.sources[k].split('/').pop().replace('.png', '.webp') })) : [],
    readings: (s.connections || []).map(c => ({ label: c.label, title: c.title, text: c.text, layers: [...new Set((c.anchors || []).map(a => a[0]))] })),
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

/* ---------- write the site ---------- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const catalogue = {
  total: posters.length, tagline: TAGLINE, question: QUESTION, record: RECORD_URL,
  posters: posters.map(p => ({ id: p.id, n: p.n, title: p.title, when: p.when, yearNumber: p.yearNumber, country: p.country, countries: p.countries, category: p.category, creator: p.creator, ratio: p.ratio, ground: p.ground, ink: p.ink, blurb: p.blurb, alt: p.alt, layers: p.layers.length })),
  themes: home.themes.map(t => ({ title: t.title, short: t.short, description: t.description, ids: t.ids, labels: t.labels })),
};
write(join(OUT, 'data', 'catalogue.json'), JSON.stringify(catalogue));
for (const p of posters) write(join(OUT, 'data', 'posters', p.id + '.json'), JSON.stringify(p));

cpSync(join(C, 'images', 'catalogue'), join(OUT, 'img', 'poster'), { recursive: true });
cpSync(join(C, 'images', 'thumb'), join(OUT, 'img', 'thumb'), { recursive: true });
for (const p of posters) {
  if (!p.layers.length) continue;
  mkdirSync(join(OUT, 'img', 'layers', p.id), { recursive: true });
  p.layers.forEach((l, k) => cpSync(join(C, 'images', 'layers', p.id, l.file), join(OUT, 'img', 'layers', p.id, k + '.webp')));
}
const share = {};                                   // a picture for link previews: the original image file
for (const f of readdirSync(join(C, 'images', 'full'))) { share[f.replace(/\.[^.]+$/, '')] = f; }
cpSync(join(C, 'images', 'full'), join(OUT, 'img', 'full'), { recursive: true });
cpSync(join(ROOT, 'src', 'fonts'), join(OUT, 'fonts'), { recursive: true });
for (const f of ['app.css', 'app.js', 'favicon.svg']) cpSync(join(ROOT, 'src', f), join(OUT, f));
write(join(OUT, '.nojekyll'), '');

const page = ({ root, path, title, description, image, ground, ink, view, id, body }) => `<!doctype html>
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
<link rel="preload" as="font" type="font/woff2" href="${root}fonts/latin-700-normal.woff2" crossorigin>
<link rel="stylesheet" href="${root}app.css">
<meta name="pa-root" content="${root}">
<style>:root{--ground:${ground};--ink:${ink}}</style>
</head>
<body data-view="${view}"${id ? ` data-id="${id}"` : ''}>
<a class="skip" href="#main">Skip to the content</a>
<div id="app">
<header class="bar"><a class="mark" href="${root}">Poster Atlas</a><nav class="bar-nav"><a href="${root}collection/">Collection</a><a href="${root}teachers/">For teachers</a></nav></header>
<main id="main" class="plain">
${body}
</main>
</div>
${view === 'page' ? '' : `<script type="module" src="${root}app.js"></script>`}
</body>
</html>
`;

const first = byId[home.themes[0].ids[0]];
write(join(OUT, 'index.html'), page({
  root: './', path: '', title: 'Poster Atlas', description: `${TAGLINE.join(' ')} ${posters.length} posters and book covers from 1891 to 2026, each one opened up detail by detail.`,
  image: 'img/full/' + share[first.id], ground: '#101010', ink: '#ffffff', view: 'home',
  body: `<h1>${TAGLINE.join(' ')}</h1><p>${QUESTION}</p><p>${posters.length} posters and book covers across eras and cultures. Discover the choices that make them work.</p><p><a href="./collection/">Browse the collection</a></p>`,
}));

write(join(OUT, 'collection', 'index.html'), page({
  root: '../', path: 'collection/', title: 'The collection · Poster Atlas', description: `All ${posters.length} posters and book covers in the Poster Atlas, from 1891 to 2026.`,
  image: 'img/full/' + share[first.id], ground: '#f3f2ee', ink: '#141414', view: 'collection',
  body: `<h1>The collection</h1><ol>${posters.map(p => `<li><a href="../posters/${p.id}/">${esc(p.title)}</a>, ${esc(p.country)}, ${esc(p.when)}</li>`).join('')}</ol>`,
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
<h2>Pull the poster apart</h2>
<p>The bar under each poster runs from Together to Apart. Drag it to separate the poster into its layers. The list beside it names each layer, and choosing one lights it up.</p>
<p>The layers show what is visible in the artwork. They are not the original production separations.</p>
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

prose('../', 'about/', 'About', 'What Poster Atlas is, how its notes are sourced, and how it was made.', `
<h1>About Poster Atlas</h1>
<p class="lead">${posters.length} posters and book covers from ${Math.min(...posters.map(p => p.yearNumber))} to ${Math.max(...posters.map(p => p.yearNumber))}, each opened up detail by detail. It is an independent educational project by King.</p>
<h2>What the notes are</h2>
<p>Each poster has between ten and eighteen details. Every detail has a short note, a mark that says how sure the note is, and a question to take away. Sources, edition details and image credits are inside each poster's page.</p>
<h2>What the layers are</h2>
<p>Layers analyse the visible artwork. They are not original production separations.</p>
<h2>Images</h2>
<p>Each poster page names the edition shown and credits its source. The images are reproduced for study and teaching.</p>
<h2>How this was made</h2>
<p>King built the first Poster Atlas and rebuilt it here with Claude, an AI model. A record of every step, who did what, and how the work was checked is kept on a private page. <a href="${RECORD_URL}">How this was made</a> opens only for people King has shared it with.</p>`);

write(join(OUT, '404.html'), page({ root: '/re-poster-atlas/', path: '404.html', title: 'Not found · Poster Atlas', description: 'That page is not in the Atlas.', image: 'img/full/' + share[first.id], ground: '#f3f2ee', ink: '#141414', view: 'page',
  body: `<article class="prose"><h1>That page is not in the Atlas.</h1><p><a href="/re-poster-atlas/">Go to the opening page</a> or <a href="/re-poster-atlas/collection/">browse the collection</a>.</p></article>` }));
write(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', 'collection/', 'teachers/', 'about/', ...posters.map(p => `posters/${p.id}/`)].map(u => `<url><loc>${SITE_URL}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

const low = posters.filter(p => contrast(p.ground, p.ink) < 4.5).map(p => p.id);
console.log(`Built ${posters.length} poster pages, ${posters.reduce((n, p) => n + p.regions.length, 0)} details, ${posters.reduce((n, p) => n + p.layers.length, 0)} layers.`);
console.log(`Posters without layers: ${posters.filter(p => !p.layers.length).map(p => p.id).join(', ') || 'none'}`);
console.log(`Pages whose text contrast is under 4.5 to 1: ${low.join(', ') || 'none'}`);
