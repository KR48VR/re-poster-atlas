// Try searches from the command line and see why each result is there.   node scripts/search_lab.mjs "loneliness" "hand-drawn lettering"
// Add --words to see how the notes use a word:                           node scripts/search_lab.mjs --words alone empty
import { readFileSync } from 'node:fs';
import { makeSearch, stem, fold } from '../src/search.js';
const D = new URL('../dist/data/', import.meta.url);
const cat = JSON.parse(readFileSync(new URL('catalogue.json', D))), data = JSON.parse(readFileSync(new URL('search.json', D)));
const S = makeSearch({ posters: cat.posters, ...data });
const args = process.argv.slice(2);
if (args[0] === '--words') {
  for (const w of args.slice(1)) {
    const s = stem(fold(w)), hits = [];
    for (const d of S.docs) for (const [f, text] of d.fields) for (const sen of text.match(/[^.!?]+[.!?]*\s*/g) || []) if ((sen.match(/[\p{L}]+/gu) || []).some(x => stem(fold(x)) === s)) hits.push(`[${f}] ${sen.trim()}`);
    console.log(`\n== ${w} (${s}): ${hits.length} sentences`); for (let k = 0; k < Math.min(8, hits.length); k++) console.log('  ', hits[Math.floor(k * hits.length / Math.min(8, hits.length))].slice(0, 170));
  }
} else for (const q of args) {
  const r = S.search(q);
  console.log(`\n== ${q}  ->  ${r.details.length} details on ${new Set(r.details.map(x => x.doc.p.id)).size} posters, ${r.posters.length} posters, ${r.threads.length} threads` + (r.fixed.length ? `  (read as ${r.fixed.map(f => f[1])})` : '') + (r.missing.length ? `  (not found: ${r.missing})` : ''));
  if (r.threads.length) console.log('   threads:', r.threads.slice(0, 4).map(x => x.doc.t.name).join(', '));
  if (r.posters.length) console.log('   posters:', r.posters.slice(0, 6).map(x => x.doc.p.title).join(' | '));
  for (const x of r.details.slice(0, 8)) { const y = S.why(x); console.log(`   ${x.rank.toFixed(2)} ${x.doc.p.title} · ${x.doc.d.l} — ${x.doc.d.s}\n        ${y ? `[${y.how}:${y.term} in ${y.field}] …${(y.before.slice(-50) + '«' + y.word + '»' + y.after.slice(0, 50)).replace(/\s+/g, ' ')}…` : ''}`); }
}
