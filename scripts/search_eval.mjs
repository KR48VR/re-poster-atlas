// The fixed test list for search. Run after every change to search or to content/ideas.json:   node build.mjs && node scripts/search_eval.mjs
// It uses the same search code the site uses. Pass marks are written here, before the run, so a result cannot move its own goalposts.
import { readFileSync } from 'node:fs';
import { makeSearch } from '../src/search.js';

const MARKS = {
  titles: 1.0,        // searching a poster's exact title puts that poster first
  makers: 0.95,       // searching a maker's name finds their poster in the first five
  threadFound: 1.0,   // searching a thread's name offers that thread
  threadTop10: 0.5,   // of the first ten details for a thread's name, the share that are from posters King approved on that thread
  threadRecall: 0.4,  // of the details King approved on a thread, the share found in the first sixty results for its name
  ideas: 1.0,         // every idea in the index leads to at least five details on at least four posters
  asks: 0.95,         // every other way of asking for an idea leads somewhere
  slips: 0.9,         // misspellings are read as the word that was meant
  teacher: 0.9,       // plain searches a teacher might type lead somewhere
  why: 1.0,           // every result can show the sentence that put it there
  quick: 30,          // milliseconds: the slowest search allowed
};

const D = new URL('../dist/data/', import.meta.url), load = f => JSON.parse(readFileSync(new URL(f, D)));
const cat = load('catalogue.json'), data = load('search.json'), threads = load('threads.json');
let t0 = performance.now();
const S = makeSearch({ posters: cat.posters, ...data });
const built = performance.now() - t0;
const rows = [], share = (n, d) => (d ? n / d : 1);
const row = (name, got, mark, detail = '', lowerIsBetter = false) => rows.push({ name, got, mark, pass: lowerIsBetter ? got <= mark : got >= mark - 1e-9, detail, lowerIsBetter });

{ // 1. titles
  const miss = cat.posters.filter(p => S.search(p.title).posters[0]?.doc.p.id !== p.id).map(p => p.title);
  row('A poster\'s title finds that poster first', share(cat.posters.length - miss.length, cat.posters.length), MARKS.titles, `${cat.posters.length - miss.length} of ${cat.posters.length}` + (miss.length ? `. Missed: ${miss.slice(0, 6).join('; ')}` : ''));
}
{ // 2. makers
  const makers = [...new Set(cat.posters.map(p => p.creator).filter(c => c && !/unknown|unidentified|anonymous|not (named|credited|identified)/i.test(c)))];
  const miss = makers.filter(m => !S.search(m).posters.slice(0, 5).some(r => r.doc.p.creator === m));
  row('A maker\'s name finds their poster in the first five', share(makers.length - miss.length, makers.length), MARKS.makers, `${makers.length - miss.length} of ${makers.length}` + (miss.length ? `. Missed: ${miss.slice(0, 5).join('; ')}` : ''));
}
{ // 3. threads, against the links King approved
  let found = 0, top = 0, recall = 0; const lines = [];
  for (const t of threads) {
    const r = S.search(t.name), on = new Set(t.links.map(l => l.poster)), keys = new Set(t.links.map(l => l.poster + '/' + l.region));
    if (r.threads.some(x => x.doc.t.id === t.id)) found++;
    const first = r.details.slice(0, 10), p10 = share(first.filter(x => on.has(x.doc.p.id)).length, first.length || 1);
    const rec = share(r.details.slice(0, 60).filter(x => keys.has(x.doc.p.id + '/' + x.doc.d.r)).length, keys.size);
    top += p10; recall += rec; lines.push(`${t.name} ${Math.round(p10 * 100)}%/${Math.round(rec * 100)}%`);
  }
  row('A thread\'s name offers that thread', share(found, threads.length), MARKS.threadFound, `${found} of ${threads.length}`);
  row('First ten details for a thread\'s name come from posters on that thread', top / threads.length, MARKS.threadTop10, 'by thread, first ten / found: ' + lines.join(', '));
  row('Details King approved on a thread are found in the first sixty', recall / threads.length, MARKS.threadRecall, 'average over 14 threads');
}
{ // 4. the index of ideas, and other ways of asking
  const thin = [], dead = []; let asks = 0;
  for (const g of data.ideas) {
    const r = S.search(g.name), n = r.details.length, ps = new Set(r.details.map(x => x.doc.p.id)).size;
    if (n < 5 || ps < 4) thin.push(`${g.name} (${n} on ${ps})`);
    for (const a of g.asks || []) { asks++; const x = S.search(a); if (!x.details.length && !x.posters.length) dead.push(a); }
  }
  row('Every idea in the index leads to five details on four posters', share(data.ideas.length - thin.length, data.ideas.length), MARKS.ideas, `${data.ideas.length - thin.length} of ${data.ideas.length}` + (thin.length ? `. Thin: ${thin.join('; ')}` : ''));
  row('Other ways of asking for an idea lead somewhere', share(asks - dead.length, asks), MARKS.asks, `${asks - dead.length} of ${asks}` + (dead.length ? `. Nothing for: ${dead.join('; ')}` : ''));
}
{ // 5. slips of the keyboard
  const slips = [['lonliness', 'loneliness'], ['sillhouette', 'silhouette'], ['typografy', 'typography'], ['symetry', 'symmetry'], ['diagnal', 'diagonal'], ['caligraphy', 'calligraphy'],
    ['propoganda', 'propaganda'], ['shaddow', 'shadow'], ['rythm', 'rhythm'], ['potrait', 'portrait'], ['lettring', 'lettering'], ['vertgo', 'vertigo']];
  const miss = slips.filter(([typed, meant]) => { const r = S.search(typed); return !(r.fixed.some(f => f[1] === meant) && (r.details.length || r.posters.length)); }).map(x => x[0]);
  row('A misspelling is read as the word that was meant', share(slips.length - miss.length, slips.length), MARKS.slips, `${slips.length - miss.length} of ${slips.length}` + (miss.length ? `. Missed: ${miss.join(', ')}` : ''));
}
{ // 6. plain searches a teacher might type
  const asks = ['loneliness', 'fear', 'war', 'propaganda', 'hand-drawn lettering', 'negative space', 'red', 'the colour blue', 'silhouette', 'eyes', 'pointing finger', 'motherhood', 'city at night', 'speed',
    'monsters', 'dance', 'protest', 'typography', 'Japanese lettering', '1960s', 'Japan', 'posters from India', 'book covers', 'symmetry', 'diagonal lines', 'awards', 'photography', 'the moon', 'animals', 'what makes a poster feel calm'];
  const miss = asks.filter(a => { const r = S.search(a); return r.details.length < 3 && !r.posters.length; });
  row('Plain searches a teacher might type lead somewhere', share(asks.length - miss.length, asks.length), MARKS.teacher, `${asks.length - miss.length} of ${asks.length}` + (miss.length ? `. Nothing for: ${miss.join('; ')}` : ''));
  const nothing = ['xyzzy', 'qwertyuiop'].filter(a => { const r = S.search(a); return r.details.length || r.posters.length; });
  row('Nonsense finds nothing, and says so', share(2 - nothing.length, 2), 1, nothing.length ? `Found something for: ${nothing.join(', ')}` : '2 of 2');
}
{ // 7. every result can explain itself
  let n = 0, bad = 0;
  for (const g of data.ideas) for (const r of S.search(g.name).details.slice(0, 20)) { n++; if (!S.why(r)) bad++; }
  row('Every result can show the sentence that put it there', share(n - bad, n), MARKS.why, `${n - bad} of ${n} results checked`);
}
{ // 8. speed
  const qs = [...data.ideas.map(g => g.name), ...cat.posters.slice(0, 40).map(p => p.title), 'red lettering on a black ground', 'the colour blue in Japan'];
  let worst = 0; for (const q of qs) { t0 = performance.now(); S.search(q); worst = Math.max(worst, performance.now() - t0); }
  row('The slowest search, in milliseconds', Math.round(worst), MARKS.quick, `${qs.length} searches timed. Getting ready took ${Math.round(built)} ms.`, true);
}

const pct = r => (r.mark > 1 || r.lowerIsBetter ? String(r.got) : Math.round(r.got * 100) + '%'), need = r => (r.mark > 1 || r.lowerIsBetter ? (r.lowerIsBetter ? 'at most ' : '') + r.mark : Math.round(r.mark * 100) + '%');
for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}: ${pct(r)} (needs ${need(r)}). ${r.detail}`);
console.log(`\n${rows.filter(r => r.pass).length} of ${rows.length} checks pass. ${S.docs.length} things searched: ${data.details.length} details, ${cat.posters.length} posters, ${threads.length} threads. ${data.ideas.length} ideas in the index.`);
if (process.argv.includes('--json')) console.log(JSON.stringify(rows));
process.exitCode = rows.every(r => r.pass) ? 0 : 1;
