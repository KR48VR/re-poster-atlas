/* Search for Poster Atlas.
   It works only on the Atlas's own words: every note, question, title and thread. Nothing is sent anywhere and no AI
   runs when someone searches. To find ideas and not only exact words it does three small things:
     1. it treats forms of a word as one word (lonely, loneliness)
     2. it knows which of the notes' words sit close to an idea (content/ideas.json, written by hand and checked)
     3. it forgives a slip of the keyboard
   Every result can say why it is there. The same file runs in the browser and in the tests (scripts/search_eval.mjs). */

const STOP = new Set(('the a an and or of to in on at by for with from as is are was were be been it its this that these those not no but than then so such ' +
  'can may might will would could should has have had do does did into their his her they them he she we you your our which who whom whose what when where how why ' +
  'also more most very much many each every any some all there here about if because per via i me my show find look looking posters poster covers cover').split(' '));
const SPELL = { color: 'colour', colors: 'colours', colored: 'coloured', colorful: 'colourful', gray: 'grey', center: 'centre', centered: 'centred', theater: 'theatre',
  favorite: 'favourite', neighbor: 'neighbour', neighboring: 'neighbouring', jewelry: 'jewellery', mustache: 'moustache', fiber: 'fibre', meter: 'metre', organize: 'organise',
  recognize: 'recognise', symbolize: 'symbolise', emphasize: 'emphasise', traveling: 'travelling', armor: 'armour', harbor: 'harbour', labor: 'labour', honor: 'honour', humor: 'humour' };
const KEEP_LY = new Set('family only early supply apply reply italy july assembly butterfly fly belly holy ugly lily rely ally bully jelly ply sly imply multiply anomaly monopoly melancholy'.split(' '));
const GRADES = new Set(('dark light pale bright small large big tall short long wide narrow thick thin soft hard warm cool cold hot deep high low near close far heavy dense sharp bold fine loud quiet ' +
  'strong weak old young new great clear simple rough smooth broad slow fast quick rich poor full empty flat round plain clean loose tight late busy calm fair dim faint grand ' +
  'pure rare safe strange sweet wild bare brave fierce gentle pink red blue green grey black white brown').split(' '));

export const fold = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'").toLowerCase();
/* Words in Latin letters and numbers, and runs of Japanese, Chinese, Korean, Arabic, Cyrillic, Devanagari, Thai or Hebrew kept whole. */
export const words = s => fold(s).match(/[a-z0-9]+|[Ѐ-ӿ]+|[֐-ۿ]+|[ऀ-ॿ]+|[฀-๿]+|[぀-ヿ一-鿿가-힯]+/g) || [];

const vowel = /[aeiouy]/;
function undouble(w) { const n = w.length; return n > 3 && w[n - 1] === w[n - 2] && !/[lsz]/.test(w[n - 1]) && !vowel.test(w[n - 1]) ? w.slice(0, -1) : w; }
/* One form for the forms of a word. Careful, not clever: it prefers leaving two forms apart to joining two different words. */
export function stem(word) {
  let w = SPELL[word] || word;
  if (w.length < 4 || /[^a-z]/.test(w)) return w;
  if (w.endsWith('iness') && w.length > 6) w = w.slice(0, -5) + 'y';
  else if (w.endsWith('ness') && w.length > 6) w = w.slice(0, -4);
  if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (/(ch|sh|x|z|ss)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.endsWith('ly') && w.length > 5 && !KEEP_LY.has(w)) w = w.slice(0, -2);
  if (w.endsWith('ful') && w.length > 6) w = w.slice(0, -3);
  if (w.endsWith('ing') && w.length > 5 && vowel.test(w.slice(0, -3))) w = undouble(w.slice(0, -3));
  else if (w.endsWith('ed') && w.length > 4 && !w.endsWith('eed') && vowel.test(w.slice(0, -2))) w = undouble(w.slice(0, -2));
  for (const end of ['est', 'er']) {                                   // darker, darkest: only for plain describing words
    if (!w.endsWith(end) || w.length < end.length + 3) continue;
    const base = w.slice(0, -end.length), tries = [base, base + 'e', undouble(base), base.endsWith('i') ? base.slice(0, -1) + 'y' : base];
    const hit = tries.find(t => GRADES.has(t)); if (hit) { w = hit; break; }
  }
  if (w.endsWith('i') && w.length > 4) w = w.slice(0, -1) + 'y';
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1);
  return w;
}
const decade = y => Math.floor(y / 10) * 10 + 's';
/* What someone typed, as search words. "60s" and "1960s" both mean the decade. */
export function ask(q) {
  const all = words(q), kept = all.filter(w => !STOP.has(w));
  return (kept.length ? kept : all).slice(0, 8);
}
function slips(a, b) {                                                  // how many slips of the keyboard apart, counted up to 3
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j), before = null;
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (before && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1);
    }
    before = prev; prev = row;
  }
  return Math.min(3, prev[b.length]);
}
function near(a, b) {                                                   // true when one slip of the keyboard apart
  const m = a.length, n = b.length; if (Math.abs(m - n) > 1) return false;
  let i = 0, j = 0, slips = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++slips > 1) return false;
    if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; } else if (m > n) i++; else if (n > m) j++; else { i++; j++; }
  }
  return slips + (m - i) + (n - j) <= 1;
}

/* Field weights: where a word appears says how much the note is about it. */
const W = { label: 5, sum: 3.2, head: 2.2, orig: 2.2, body: 1, q: 1, ctx: 0.55, title: 6, maker: 4, place: 4, blurb: 2, alt: 1.6, name: 6, idea: 2.5, thread: 4.5, strand: 1.2 };
const CLOSE = 0.5, STARTS = 0.6, SPELT = 0.7;

export function makeSearch({ posters, details, threads, ideas }) {
  const byId = Object.fromEntries(posters.map(p => [p.id, p]));
  const docs = [];
  for (const p of posters) docs.push({ kind: 'poster', p, fields: [['title', p.title], ['maker', p.creator || ''], ['place', [p.country, ...(p.countries || [])].join(' ')],
    ['place', `${p.when} ${p.yearNumber} ${decade(p.yearNumber)}`], ['blurb', `${p.category || ''}. ${p.blurb || ''}`], ['alt', p.alt || '']] });
  const thread = Object.fromEntries(threads.map(t => [t.id, t]));
  for (const d of details) {
    const p = byId[d.p], on = (d.t || []).map(id => thread[id]).filter(Boolean);       // the threads this detail has been placed on, by hand
    docs.push({ kind: 'detail', p, d, on, fields: [['label', d.l], ['sum', d.s], ...d.x.flatMap(([h, body]) => [['head', h || ''], ['body', body || '']]), ['orig', d.o || ''], ['q', d.q || ''],
      ...on.flatMap(t => [['thread', t.name], ['strand', t.idea]]),
      ['ctx', `${p.title}. ${p.country}. ${decade(p.yearNumber)} ${p.creator || ''}`]] });
  }
  for (const t of threads) docs.push({ kind: 'thread', t, fields: [['name', t.name], ['idea', `${t.headline} ${t.idea}`]] });

  const known = new Map();                                             // every word as written -> how often, for forgiving a slip of the keyboard
  const post = new Map();                                              // word -> (note number -> how strongly the note uses it)
  docs.forEach((doc, i) => {
    doc.best = new Map();                                              // word -> the field that uses it most strongly
    for (const [f, text] of doc.fields) for (const w of words(text)) {
      if (STOP.has(w) && f !== 'title' && f !== 'name') continue;       // small words count only in a title, so "We Can Do It!" can be found
      if (w.length > 3) known.set(w, (known.get(w) || 0) + 1);
      const s = stem(w); let m = post.get(s); if (!m) post.set(s, m = new Map());
      m.set(i, (m.get(i) || 0) + W[f]);
      if (!doc.best.has(s) || W[f] > W[doc.best.get(s)]) doc.best.set(s, f);
    }
  });
  const N = docs.length, vocab = [...post.keys()];
  const rare = s => Math.log(1 + (N - post.get(s).size + 0.5) / (post.get(s).size + 0.5));
  const closeTo = new Map(), phrases = [], shared = new Map();         // word -> the words that sit close to it; whole phrases that name an idea; how many ideas share a word
  const lead = (from, group) => { let m = closeTo.get(from); if (!m) closeTo.set(from, m = new Set()); group.forEach(o => o !== from && m.add(o)); shared.set(from, (shared.get(from) || 0) + 1); };
  for (const g of ideas) {
    const group = [...new Set([...words(g.name), ...g.words.flatMap(words)].filter(w => !STOP.has(w)).map(stem))];
    group.forEach(s => lead(s, group));
    for (const p of [g.name, ...(g.asks || [])]) {                     // other things a visitor might type for the same idea
      const ws = words(p).filter(w => !STOP.has(w)).map(stem);
      if (ws.length > 1) phrases.push([ws, group, /\band\b/.test(fold(p))]); else if (ws.length === 1 && !group.includes(ws[0])) lead(ws[0], group);
      for (const w of words(p)) if (w.length > 3 && !known.has(w)) known.set(w, 1);
    }
  }
  const spellings = [...known.keys()];
  const sentences = doc => (doc.sen ||= doc.fields.filter(([f]) => f !== 'ctx').flatMap(([, text]) => (text.match(/[^.!?。]+[.!?。]*\s*/g) || []).map(t => new Set(words(t).map(stem)))));

  function search(q, { typing = false } = {}) {
    const asked = ask(q), tokens = [];
    asked.forEach((w, k) => {
      const s = stem(w), ways = [], t0 = {};                           // [word in the notes, strength, how]
      if (/^\d0s$/.test(w)) ['19' + w, '20' + w].forEach(v => post.has(v) && ways.push([v, 1, 'word']));   // "60s" means the 1960s
      if (post.has(s)) ways.push([s, 1, 'word']);
      for (const o of closeTo.get(s) || []) if (post.has(o)) ways.push([o, CLOSE / Math.sqrt(shared.get(s) || 1), 'close']);   // a word that belongs to several ideas leans less on each
      const unfinished = typing && k === asked.length - 1;             // the last word may still be being typed
      if (unfinished && w.length >= 3) {
        const seen = new Set(ways.map(x => x[0]));
        for (const v of spellings) {
          if (!v.startsWith(w) || v === w || seen.size > 24) continue;
          const sv = stem(v);
          if (post.has(sv) && !seen.has(sv)) { seen.add(sv); ways.push([sv, STARTS, 'starts']); }
          for (const o of closeTo.get(sv) || []) if (post.has(o) && !seen.has(o)) { seen.add(o); ways.push([o, CLOSE * STARTS, 'close']); }
        }
      }
      if (!ways.length && w.length >= 4 && !unfinished) {              // not a word the Atlas knows: is it one slip away from one it does?
        const fix = spellings.filter(v => v[0] === w[0] && slips(w, v) <= (w.length > 7 ? 2 : 1)).sort((x, y) => slips(w, x) - slips(w, y) || known.get(y) - known.get(x))[0];
        if (fix) {
          const v = stem(fix); t0.fixed = fix;
          if (post.has(v)) ways.push([v, SPELT, 'spelt']);
          for (const o of closeTo.get(v) || []) if (post.has(o)) ways.push([o, CLOSE * SPELT, 'close']);
        }
      }
      tokens.push({ w, s, ways, ...t0 });
    });
    const said = k => tokens[k].w;
    for (const [ws, group, either] of phrases.slice().sort((x, y) => y[0].length - x[0].length)) {   // "hand-drawn lettering" is one idea, not three words
      const at = tokens.findIndex((t, k) => ws.every((x, j) => tokens[k + j] && tokens[k + j].s === x));
      if (at < 0) continue;
      const ways = group.filter(o => post.has(o)).map(o => [o, ws.includes(o) ? 1.1 : 0.62, ws.includes(o) ? 'word' : 'close']);
      if (ways.length) tokens.splice(at, ws.length, { w: ws.map((_, j) => said(at + j)).join(' '), s: null, ways, idea: either ? 'either' : 'together' });
    }
    const typed = fold(q).trim().replace(/\s+/g, ' '), phrase = asked.length > 1 && typed.length > 5 ? typed : null;
    const scores = new Map();                                          // note number -> { per search word: best way }
    tokens.forEach((t, k) => {
      for (const [term, strength, how] of t.ways) {
        const idf = rare(term);
        for (const [i, wtf] of post.get(term)) {
          const v = strength * idf * (wtf / (wtf + 1.6));
          let r = scores.get(i); if (!r) scores.set(i, r = { got: [] });
          const had = r.got[k];
          const typedToo = how === 'word' && t.idea ? 1 : 0;                // in a phrase, each further word that was actually typed counts well
          if (!had) r.got[k] = { v, term, how, extra: 0, typed: 0, said: t.fixed || t.w, idea: t.idea || null };
          else if (v > had.v) r.got[k] = { v, term, how, extra: Math.min(2, had.extra + 1), typed: had.typed + (had.how === 'word' && t.idea ? 1 : 0), said: had.said, idea: had.idea };
          else { had.extra = Math.min(2, had.extra + 1); had.typed += typedToo; }
        }
      }
    });
    const out = { posters: [], details: [], threads: [], asked, tokens };
    for (const [i, r] of scores) {
      const doc = docs[i], got = r.got.filter(Boolean);
      // "fear and danger" is either word. "hand-drawn lettering" is the words together: one of them on its own ("drawn") counts for little.
      const lonely = g => g.idea === 'together' && g.how === 'word' && g.typed === 0 && g.extra === 0;
      let score = got.reduce((n, g) => n + g.v * (lonely(g) ? 0.4 : 1 + 0.08 * g.extra + 0.45 * g.typed), 0) * Math.pow(got.length / tokens.length, 1.6);
      if (got.length < Math.ceil(tokens.length / 2)) continue;
      if (phrase && doc.fields.some(([f, text]) => (f === 'label' || f === 'sum' || f === 'title' || f === 'name') && fold(text).includes(phrase))) score *= 1.6;
      if (doc.kind === 'detail' && got.every(g => doc.best.get(g.term) === 'ctx')) continue;      // the poster's name or country alone does not make a detail a result
      const lead = got.filter(g => doc.best.get(g.term) !== 'ctx').sort((a, b) => b.v - a.v)[0] || got[0];
      (doc.kind === 'poster' ? out.posters : doc.kind === 'thread' ? out.threads : out.details).push({ doc, score, got, lead, all: got.length === tokens.length });
    }
    const order = (a, b) => b.score - a.score;
    out.posters.sort(order); out.threads.sort(order); out.details.sort(order);
    // A poster is a result in its own right only when its title, maker, place or date was asked for, or it is clearly about the idea.
    out.posters = out.posters.filter(r => r.all && r.got.some(g => ['title', 'maker', 'place'].includes(r.doc.best.get(g.term)) || g.v > 1.2));
    // A thread is offered when the search uses its words. For a phrase that names an idea, one stray word is not enough.
    out.threads = out.threads.filter(r => r.all && r.got.some(g => (g.how !== 'close' && (!g.idea || g.extra > 0)) || r.doc.best.get(g.term) === 'name'));
    for (const doc of docs) {                                          // a thread asked for by its own name is always offered, first
      if (doc.kind !== 'thread' || typed.length < 4) continue;
      const name = fold(doc.t.name).replace(/^the /, '');
      if (!(typed === name || typed.includes(name) || (typed.length > 4 && name.startsWith(typed)))) continue;
      out.threads = [{ doc, score: 99, got: [], lead: null, all: true }, ...out.threads.filter(r => r.doc !== doc)];
    }
    if (tokens.length > 1) for (const r of out.details.slice(0, 240)) {  // words that meet in one sentence belong together more than words scattered through a note
      const sets = sentences(r.doc); let most = 1;
      for (const set of sets) { const n = tokens.filter(t => t.ways.some(x => set.has(x[0]))).length; if (n > most) most = n; }
      r.score *= 1 + 0.45 * (most - 1);
    }
    out.details.sort(order);
    const seen = new Map();                                            // spread the details across posters: each further one from the same poster counts a little less
    out.details.forEach(r => { const n = seen.get(r.doc.p.id) || 0; seen.set(r.doc.p.id, n + 1); r.rank = r.score * Math.pow(0.82, n); });
    out.details.sort((a, b) => b.rank - a.rank);
    const top = out.details[0]?.rank || 0;
    out.details = out.details.filter(r => r.rank >= top * 0.22).slice(0, 150);   // drop the long tail of faint matches
    out.fixed = tokens.filter(t => t.fixed && t.ways.length).map(t => [t.w, t.fixed]);
    out.missing = tokens.filter(t => !t.ways.length).map(t => t.w);
    return out;
  }

  /* Why a note is in the results: the sentence that uses the word, with the word marked. */
  function why(result) {
    const { doc, lead } = result, order = ['sum', 'label', 'head', 'orig', 'body', 'q', 'thread', 'strand', 'blurb', 'alt', 'idea', 'title', 'name', 'maker', 'place'];
    for (const f of order) for (const [g, text] of doc.fields) {
      if (g !== f || !text) continue;
      for (const sentence of text.match(/[^.!?。]+[.!?。]*\s*/g) || []) {
        const m = [...sentence.matchAll(/[\p{L}\p{N}]+/gu)].find(x => stem(fold(x[0])) === lead.term);
        if (m) return { field: f, thread: f === 'thread' || f === 'strand' ? doc.on.find(t => t.name === text || t.idea === text) : null, before: sentence.slice(0, m.index), word: m[0], after: sentence.slice(m.index + m[0].length).trimEnd(), how: lead.how, term: lead.term, said: lead.said };
      }
    }
    return null;
  }
  const count = name => search(name).details.length;
  return { search, why, count, docs, has: w => post.has(stem(w)), vocab };
}
