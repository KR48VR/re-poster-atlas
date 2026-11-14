"""The curated draft of the threads: the links Claude kept after reading every candidate
that draft_threads.py proposed, plus a few it added by hand. King approves or cuts these.

Run from the project folder:  python3 scripts/threads_curated.py
It writes content/threads.draft.json and reports anything that does not match the studies.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from draft_threads import THREADS, C

KEEP = {
 'colour': 'moulin-rouge/moulin-rouge-name mexico-1968/rings the-wind-rises/title book-my-name-is-red/author skegness-is-so-bracing/scarf breathless/lips tokyo-1964-first-poster/disc raise-the-red-lantern/title jaws/title the-third-man/title book-human-acts/panel mother-india/mother-india-blouse book-the-stone-virgins/flower bicycle-thieves/title',
 'character': 'le-chat-noir/head my-neighbor-totoro/totoro book-zoo-city/birds vertigo/woman godzilla/godzilla-head nosferatu/body black-girl/black-girl-hair tsotsi/body raise-the-red-lantern/figure taste-of-cherry/tree book-the-handmaids-tale/red moulin-rouge/moulin-rouge-audience uncle-sam/uncle-sam-coat amelie/hair city-of-god/city-of-god-wings book-ret-samadhi/bird',
 'gesture': 'we-can-do-it/we-can-do-it-sleeve culture-and-resistance/raised rrr/hands gismonda/gismonda-hand mother-india/mother-india-arm ilo-ilo/gesture uncle-sam/uncle-sam-finger kitchener/finger book-the-stone-virgins/hand the-piano/hand book-metamorphosis/figure book-of-air-and-mirrors/hand city-of-god/city-of-god-raised-arm in-the-mood-for-love/hands yeelen/hands moulin-rouge/moulin-rouge-hand touki-bouki/hands nosferatu/hands ong-bak/rear-arms oldboy/hand',
 'framing': 'book-i-am-a-cat/frame the-piano/border book-charlie-chan/robot-panel vertigo/border book-the-hobbit/border jane-avril/border jaws/frame a-separation/scarf nord-express/border the-third-man/frame book-the-handmaids-tale/frame spirited-away/small-pig parasite/parasite-legs breathless/face divan-japonais/performer oldboy/foreground-face hope/creature pather-panchali/circle',
 'motion': 'book-catcher-in-the-rye/tail harder-they-come/guns book-the-whale-rider/tail vertigo/man everything-everywhere-all-at-once/left-man battle-of-algiers/street-shadow culture-and-resistance/title the-wind-rises/aircraft daily-herald-early-bird/trails musica-viva/text-angle manila-in-the-claws-of-light/title breathless/runner jane-avril/stage metropolis/rays nord-express/engine rrr/right-pose bauhaus/bar godzilla/godzilla-beam',
 'scale': 'normandie/birds manila-in-the-claws-of-light/title book-the-rabbits/ship jaws/swimmer book-three-body-problem/moon godzilla/godzilla-city dune/walker the-raid/tower musica-viva/field star-wars/mask book-dekada-70/date nord-express/engine mad-max-fury-road/title the-third-man/face moulin-rouge/moulin-rouge-man harder-they-come/record-figure seven-samurai/hillside',
 'mood': 'skegness-is-so-bracing/sand taste-of-cherry/yellow barbie/letter amelie/ground hope/smoke dune/atmosphere book-great-gatsby/glow raise-the-red-lantern/ribs sepet/sky in-the-mood-for-love/rear-face spirited-away/lanterns tsotsi/sky my-neighbor-totoro/forest',
 'writing': 'book-for-the-voice/initial festival-teatro-1968/headline siam-mashq/title the-wind-rises/calligraphy book-bumi-manusia/serifs battleship-potemkin/title book-call-to-arms/letters normandie/operator mother-india/mother-india-hindi mexico-1968/identity akira/akira-title metropolis/title solidarnosc/joins book-born-a-crime/title kitchener/you harder-they-come/title godzilla/godzilla-title',
 'space': 'the-wind-rises/sky uncle-sam/uncle-sam-blank book-zoo-city/white culture-and-resistance/paper akira/akira-ground chungking-express/chungking-express-white rrr/sky jaws/water tokyo-1964-first-poster/field manila-in-the-claws-of-light/space book-pedro-paramo/open-field oldboy/black-field aristide-bruant/paper we-can-do-it/we-can-do-it-yellow',
 'rhythm': 'moulin-rouge/moulin-rouge-name mexico-1968/lines rrr/right-pose everything-everywhere-all-at-once/arms the-raid/windows delftsche-slaolie/fabric musica-viva/motifs red-wedge/red-wedge-red-bars ilo-ilo/title priester/lower la-revue-blanche/dots we-can-do-it/we-can-do-it-scarf battleship-potemkin/upper-crowd book-for-the-voice/bars book-one-hundred-years-of-solitude/plants yeelen/small-sphere skegness-is-so-bracing/reflection',
 'smallprint': 'pulp-fiction/pulp-fiction-price the-third-man/director yol/award my-neighbor-totoro/credits battle-of-algiers/format la-revue-blanche/address godzilla/godzilla-credits spirited-away/studio the-wind-rises/studio culture-and-resistance/imprint le-chat-noir/printer book-frankenstein-in-baghdad/imprint book-bumi-manusia/imprint flow/entry festival-teatro-1968/sponsor skegness-is-so-bracing/railway',
 'surface': 'book-macunaima/wear battle-of-algiers/folds la-revue-blanche/paper book-wonderful-wizard-of-oz/cloth the-goddess/surface book-bumi-manusia/paper book-i-am-a-cat/paper book-mrs-dalloway/paper siam-mashq/sheet-edge book-one-hundred-years-of-solitude/pale-ground yol/sheet book-great-gatsby/surface keep-calm/folds mad-max-fury-road/letter-texture book-norwegian-wood/edition book-for-the-voice/margin pulp-fiction/pulp-fiction-book',
 'circles': 'vertigo/spiral tokyo-1964-first-poster/rings book-three-body-problem/moon festival-teatro-1968/central-eye le-chat-noir/medallion ne-zha-2/wheels book-the-hobbit/sun nord-express/wheels touki-bouki/headlamp book-for-the-voice/ring pather-panchali/circle mexico-1968/rings bauhaus/circle red-wedge/red-wedge-circle nihon-buyo/circle everything-everywhere-all-at-once/medallion akira/akira-wheels my-neighbor-totoro/eyes',
 'gaze': 'kitchener/eyes uncle-sam/uncle-sam-eyes amelie/eyes obama-hope/gaze a-separation/eyes black-girl/black-girl-face taste-of-cherry/eyes breathless/eyes oldboy/eye heroic-guerrilla/eyes ignorance-equals-fear/eyes parasite/parasite-eyes spirited-away/girl-face the-color-of-pomegranates/eye project-hail-mary/gaze the-wind-rises/portrait book-born-a-crime/face',
}

def main():
    home = json.load(open(os.path.join(C, 'home.json'), encoding='utf-8'))
    lead = {t['short']: set(t['ids']) for t in home['themes']}
    studies = {}
    def study(pid):
        if pid not in studies: studies[pid] = json.load(open(os.path.join(C, 'studies', pid + '.json'), encoding='utf-8'))
        return studies[pid]
    problems, count, out = [], {}, []
    for tid, name, headline, idea, _, _ in THREADS:
        links = []
        for key in KEEP[tid].split():
            pid, rid = key.split('/')
            try:
                d = study(pid); r = next(x for x in d['studyData']['regions'] if x['id'] == rid)
            except (FileNotFoundError, StopIteration):
                problems.append(f'{tid}: {key} not found' + ('; ids are ' + ', '.join(x['id'] for x in study(pid)['studyData']['regions']) if os.path.exists(os.path.join(C, 'studies', pid + '.json')) else '')); continue
            count[key] = count.get(key, 0) + 1
            p = d['poster']
            links.append({'poster': pid, 'region': rid, 'title': p['title'], 'country': p['country'], 'year': p.get('yearNumber'),
                          'label': r['label'], 'sum': r['summary'], 'fromKing': pid in lead.get(name, ())})
        if len({l['poster'] for l in links}) != len(links): problems.append(f'{tid}: a poster appears twice')
        out.append({'id': tid, 'name': name, 'headline': headline, 'idea': idea, 'fromKing': name in lead, 'links': links})
    problems += [f'{k} is in {n} threads' for k, n in count.items() if n > 2]
    json.dump(out, open(os.path.join(C, 'threads.draft.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    posters = {l['poster'] for t in out for l in t['links']}
    print(f"{len(out)} threads, {sum(len(t['links']) for t in out)} links, {len(count)} different details, {len(posters)} of 128 posters")
    print(' · '.join(f"{t['name']} {len(t['links'])}" for t in out))
    print('problems:', problems or 'none')

if __name__ == '__main__':
    main()
