"""Drafts the threads that connect details across posters.

It reads every detail note and looks for the idea each thread is about, using the
words King's notes already use. It proposes links; a person approves or cuts them.

Run from the project folder:  python3 scripts/draft_threads.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, 'content')

# id, name, headline, the idea in one sentence, strong signs, weak signs
THREADS = [
 ('colour', 'Colour', 'Colour becomes a signal.', 'One strong colour, used sparingly, tells the eye where to go.',
  [r'\baccent', r'\bonly (?:red|blue|yellow|pink|orange|green)', r'\b(?:single|one) (?:red|blue|yellow|pink|orange|green|colour)', r'\b(?:red|pink|yellow|orange|blue|green|gold) (?:title|name|word|letters?|mark|note|disc|circle|strip|band|line|seal|stamp|dot)\b', r'\bcolour (?:interrupts|anchors|signals|carries|leads|marks|links|separates|becomes)', r'\bvivid', r'\bsaturated'],
  [r'\bbright\b', r'\bcolour\b']),
 ('character', 'Character', 'A character emerges.', 'A shape, an outline or a silhouette turns a figure into a presence.',
  [r'\bsilhouette', r'\boutlin', r'\bcharacter\b', r'\bcreature', r'\bmonster', r'\bmascot', r'\bcompanion', r'\bpresence'],
  [r'\banimal', r'\bcat\b', r'\bfigure\b']),
 ('gesture', 'Gesture', 'A gesture carries the message.', 'A hand, an arm or a pose says it without words.',
  [r'\bgesture', r'\bpoint(?:s|ing|ed)\b', r'\braised\b', r'\bfist', r'\bhands?\b', r'\bfingers?', r'\barms?\b', r'\bgrip', r'\btouch', r'\bembrace', r'\bpose\b', r'\bstride', r'\bkneel'],
  [r'\bbody\b', r'\bbodies\b']),
 ('framing', 'Framing', 'A frame shapes the story.', 'Borders, crops and panels decide how near we stand.',
  [r'\bframe[sd]?\b', r'\bframing', r'\bborder', r'\bcrop', r'\bcut off', r'\bpanels?\b', r'\bmargin', r'\bwindow', r'\bclose-up', r'\bvignette', r'\benclos'],
  [r'\bsurround']),
 ('motion', 'Motion', 'The page begins to move.', 'A diagonal, a lean or a sweep gives a still image momentum.',
  [r'\bdiagonal', r'\bmotion', r'\bmovement', r'\bmoving', r'\bmomentum', r'\btilt', r'\blean', r'\bfall(?:s|ing)\b', r'\bspeed', r'\bsweep', r'\brush', r'\bswirl', r'\bflight', r'\bdirection', r'\bleap', r'\brun(?:s|ning)\b'],
  [r'\bcrosses', r'\bupward']),
 ('scale', 'Scale', 'Scale tells the story.', 'Something tiny makes something else enormous.',
  [r'\bscale\b', r'\btiny', r'\bimmense', r'\benormous', r'\bhuge', r'\btower(?:s|ing)', r'\bmonumental', r'\bgiant', r'\bdwarf', r'\bvast', r'\bminiature', r'\bcolossal'],
  [r'\bsmall figure', r'\blargest', r'\bmuch (?:larger|smaller)']),
 ('mood', 'Mood', 'Colour sets the mood.', 'A palette, a glow or a shadow sets the feeling before a word is read.',
  [r'\bmood', r'\batmospher', r'\bglow', r'\bshadow', r'\bnight', r'\bdusk', r'\bhaze', r'\bmist', r'\bwarmth', r'\beerie', r'\buneas', r'\bmenac', r'\btender', r'\bdream', r'\bmelanchol'],
  [r'\bquiet', r'\bcalm']),
 ('writing', 'Writing', 'Writing becomes a shape.', 'Letters drawn, built or bent until they act like pictures.',
  [r'\bletter(?:s|ing|forms?)\b', r'\bcalligraph', r'\bbrush', r'\bhand-(?:drawn|lettered|written)', r'\bhandwrit', r'\btypeface', r'\btypograph', r'\bscript\b', r'\bcapitals', r'\bstrokes?\b', r'\bserif'],
  [r'\btitle\b', r'\bwords?\b']),
 ('space', 'Open space', 'Empty space does the work.', 'A field with almost nothing in it gives everything else room and weight.',
  [r'\bopen (?:space|field|sky|area|ground|water)', r'\bempty', r'\bemptiness', r'\bblank', r'\bunprinted', r'\bbare\b', r'\bvoid', r'\bleaves? room', r'\bnegative space', r'\bbreathing', r'\bunmarked', r'\buncrowded'],
  [r'\bspace\b', r'\bopen\b']),
 ('rhythm', 'Rhythm', 'Repetition becomes rhythm.', 'The same mark again and again, until a still page has a beat.',
  [r'\brepeat', r'\brepetition', r'\brhythm', r'\bpattern', r'\becho', r'\bstripes?', r'\bthree times', r'\bseries of', r'\bgrid\b', r'\bparallel'],
  [r'\bseveral', r'\brows?\b']),
 ('smallprint', 'The small print', 'The small print tells the business.', 'Credits, dates, prices and logos show who made it, who paid, and what you were meant to do next.',
  [r'\bcredits?\b', r'\bsmall print', r'\bsponsor', r'\bpublisher', r'\bprice', r'\bprinter', r'\blogo', r'\bstudio\b', r'\bdistribut', r'\brelease', r'\bticket', r'\baward', r'\bcopyright', r'\bimprint', r'\bcertificat'],
  [r'\bdate\b', r'\bproduction']),
 ('surface', 'Paper and surface', 'The object behind the image.', 'Folds, grain, wear and ink remind us this was a printed thing someone held.',
  [r'\bpaper', r'\btexture', r'\bgrain', r'\bworn', r'\bwear\b', r'\bfold', r'\bcrease', r'\bstain', r'\bfaded', r'\bscan\b', r'\breproduction', r'\bcloth', r'\bbinding', r'\bspine', r'\bstamp'],
  [r'\bsheet\b', r'\bsurface']),
 ('circles', 'Circles', 'A circle holds the eye.', 'Discs, rings, suns and spirals give the eye a place to rest, or nowhere to rest at all.',
  [r'\bcircle', r'\bcircular', r'\bdisc\b', r'\brings?\b', r'\bspiral', r'\bsun\b', r'\bmoon\b', r'\borb', r'\bwheel', r'\bhalo', r'\bglobe'],
  [r'\bround']),
 ('gaze', 'Faces and gaze', 'Where a face looks, we look.', 'Eyes that meet ours, or look away, and send our attention somewhere.',
  [r'\bgaze', r'\beyes?\b', r'\bstare', r'\blooks? (?:out|at|toward|towards|away|up|down|back)', r'\bglance', r'\bprofile', r'\bwatch'],
  [r'\bface\b', r'\bfaces\b', r'\bportrait']),
]

def load():
    home = json.load(open(os.path.join(C, 'home.json'), encoding='utf-8'))
    items = []
    for pid in home['order']:
        d = json.load(open(os.path.join(C, 'studies', pid + '.json'), encoding='utf-8'))
        p = d['poster']
        for r in d['studyData']['regions']:
            items.append({'poster': pid, 'title': p['title'], 'country': p['country'], 'year': p.get('yearNumber'), 'region': r['id'],
                          'label': r['label'], 'sum': r['summary'], 'heads': ' . '.join(s['heading'] for s in r['sections']),
                          'body': ' '.join(s['body'] for s in r['sections'])})
    return home, items

def score(item, strong, weak):
    n = lambda pats, text: sum(1 for p in pats if re.search(p, text, re.I))
    top = 3 * n(strong, item['label']) + 2 * n(strong, item['sum']) + 1 * n(strong, item['heads'])
    if top == 0:
        return 0
    return top + 0.4 * min(3, n(strong, item['body'])) + 0.5 * n(weak, item['label'] + ' ' + item['sum'])

def draft(per_thread=30, per_detail=2):
    home, items = load()
    theme_by_name = {t['short']: t for t in home['themes']}
    scores = {t[0]: [(score(it, t[4], t[5]), it) for it in items] for t in THREADS}
    best = {}                                       # a detail joins at most two threads: its strongest
    for tid, rows in scores.items():
        for s, it in rows:
            if s > 0: best.setdefault((it['poster'], it['region']), []).append((s, tid))
    allowed = {k: {tid for _, tid in sorted(v, reverse=True)[:per_detail]} for k, v in best.items()}
    out = []
    for tid, name, headline, idea, strong, weak in THREADS:
        lead = theme_by_name.get(name, {}).get('ids', [])
        chosen = {}
        for s, it in sorted(scores[tid], key=lambda x: -x[0]):
            if it['poster'] in lead and it['poster'] not in chosen and (s > 0 or True):
                pass
            if s <= 0 or tid not in allowed.get((it['poster'], it['region']), ()): continue
            if it['poster'] in chosen: continue                         # one detail per poster
            chosen[it['poster']] = (s, it)
        for pid in lead:                            # King's original three always belong
            if pid not in chosen:
                s, it = max(((s, it) for s, it in scores[tid] if it['poster'] == pid), key=lambda x: x[0])
                chosen[pid] = (s, it)
        rows = sorted(chosen.values(), key=lambda x: (x[1]['poster'] not in lead, -x[0]))[:per_thread]
        out.append({'id': tid, 'name': name, 'headline': headline, 'idea': idea, 'fromKing': name in theme_by_name,
                    'links': [{'poster': it['poster'], 'region': it['region'], 'title': it['title'], 'country': it['country'], 'year': it['year'],
                               'label': it['label'], 'sum': it['sum'], 'score': round(s, 1), 'lead': it['poster'] in lead} for s, it in rows]})
    return out

if __name__ == '__main__':
    threads = draft()
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(C, 'threads.draft.json')
    json.dump(threads, open(dest, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for t in threads:
        print(f"\n## {t['id']} · {t['name']} · {len(t['links'])} links")
        for i, l in enumerate(t['links']):
            print(f"{i:2d} {'*' if l['lead'] else ' '}{l['score']:4} {l['poster']}/{l['region']} | {l['label']} — {l['sum']}")
