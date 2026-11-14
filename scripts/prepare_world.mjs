// One-time preparation of the world's outlines for the map. Writes content/world.json.
// The shapes are Natural Earth's (public domain) as packaged in the npm package world-atlas. Which continent a country is on
// comes from the npm package world-countries. Neither is needed to build or run the site: this script is run once, by hand.
//   mkdir geo && cd geo && npm install world-atlas@2 world-countries@5 && node ../scripts/prepare_world.mjs "$PWD/node_modules"
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const mods = process.argv[2], ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const topo = JSON.parse(readFileSync(join(mods, 'world-atlas', 'countries-110m.json')));
const facts = JSON.parse(readFileSync(join(mods, 'world-countries', 'countries.json')));

const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
const arcs = topo.arcs.map(arc => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
const ring = ids => { const pts = []; for (const i of ids) { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; pts.push(...(pts.length ? a.slice(1) : a)); } return pts; };

const ORDER = [['antarctica', 'Antarctica'], ['oceania', 'Oceania'], ['south-america', 'South America'], ['africa', 'Africa'], ['asia', 'Asia'], ['europe', 'Europe'], ['north-america', 'North America']];   // south to north, the order the sheets stack in
const byCode = Object.fromEntries(facts.filter(c => c.ccn3).map(c => [c.ccn3, c]));
const noCode = { 'N. Cyprus': 'asia', Somaliland: 'africa', Kosovo: 'europe' };
function continent(g) {
  const c = byCode[g.id];
  if (!c) { const k = noCode[g.properties.name]; if (!k) throw new Error('No continent for ' + g.properties.name); return k; }
  if (c.region === 'Americas') return c.subregion === 'South America' ? 'south-america' : 'north-america';
  if (c.region === 'Antarctic') return 'antarctica';
  return { Africa: 'africa', Asia: 'asia', Europe: 'europe', Oceania: 'oceania' }[c.region];
}
const rings = Object.fromEntries(ORDER.map(([id]) => [id, []]));
let points = 0;
for (const g of topo.objects.countries.geometries) {
  const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs, k = continent(g);
  for (const poly of polys) for (const r of poly) {
    const pts = ring(r); points += pts.length;
    const here = g.id === '250' && pts[0][0] < -30 ? 'south-america' : k;     // French Guiana is part of France but sits in South America
    rings[here].push(pts.flatMap(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]));
  }
}
writeFileSync(join(ROOT, 'content', 'world.json'), JSON.stringify({
  source: 'Outlines: Natural Earth, 1:110m, public domain. Continent of each country: world-countries. Russia is drawn with Europe and Turkey with Asia, as those sources have them.',
  continents: ORDER.map(([id, name]) => ({ id, name, rings: rings[id] })),
}));
console.log(`${topo.objects.countries.geometries.length} countries, ${points} points. ` + ORDER.map(([id, name]) => `${name}: ${rings[id].length} shapes`).join(', '));
