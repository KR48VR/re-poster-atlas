"""Works out, for every layer of every poster, what it needs behind it to be seen.

A layer is a cut-out on clear glass. Pale marks vanish on a pale ground and dark
marks vanish on a dark one. This script measures each layer and decides:

  stage  the ground the pulled-apart poster stands on: "night" (near black) or "paper" (off white)
  film   for each layer, None (clear glass) or the opposite ground, laid behind that
         one sheet because too much of it would be lost on the stage
  veil   for each layer, the ground that shows it best when it is lit on its own

Writes content/layer-tones.json.  Run from the project folder:  python3 scripts/layer_tones.py
Needs Pillow and numpy.
"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, 'content')
NIGHT, PAPER = '#141312', '#f1ede4'
SEEN = 1.6          # a mark counts as seen when it differs from its ground by at least this ratio
ENOUGH = 0.6        # a layer is fine on a ground when at least this share of it is seen


def lum(rgb):       # relative luminance, 0 to 1
    c = rgb.astype(np.float64) / 255
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def hexlum(h):
    return float(lum(np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)]], dtype=np.uint8))[0])


LN, LP = hexlum(NIGHT), hexlum(PAPER)


def seen(Y, a, ground):   # share of the layer's visible marks that stand out from this ground
    ratio = (np.maximum(Y, ground) + 0.05) / (np.minimum(Y, ground) + 0.05)
    return float((a * (ratio >= SEEN)).sum() / a.sum())


def measure(path):
    im = Image.open(path).convert('RGBA')
    im.thumbnail((360, 360))
    px = np.asarray(im)
    a = px[..., 3].astype(np.float64) / 255
    a = np.where(a < 0.12, 0, a)
    if a.sum() < 1:
        return {'night': 1.0, 'paper': 1.0}
    Y = lum(px[..., :3])
    return {'night': round(seen(Y, a, LN), 3), 'paper': round(seen(Y, a, LP), 3)}


def main():
    layers = json.load(open(os.path.join(C, 'layers.json'), encoding='utf-8'))['layers']
    out, tally = {}, {'night': 0, 'paper': 0, 'films': 0, 'layers': 0, 'weak': []}
    for slug in sorted(layers):
        n = len(layers[slug]['labels'])
        files = [src.split('/')[-1].replace('.png', '.webp') for src in layers[slug]['sources']]
        m = [measure(os.path.join(C, 'images', 'layers', slug, files[k])) for k in range(n)]
        # the stage is the ground on which more of the layers can stay clear glass; a tie goes to night
        clear = {g: sum(1 for x in m if x[g] >= ENOUGH) for g in ('night', 'paper')}
        total = {g: sum(x[g] for x in m) for g in ('night', 'paper')}
        stage = 'paper' if (clear['paper'], total['paper']) > (clear['night'], total['night']) else 'night'
        other = 'paper' if stage == 'night' else 'night'
        film = [other if (x[stage] < ENOUGH and x[other] > x[stage]) else None for x in m]
        veil = ['paper' if x['paper'] > x['night'] else 'night' for x in m]
        best = [max(x['night'], x['paper']) for x in m]
        out[slug] = {'stage': stage, 'film': film, 'veil': veil}
        tally[stage] += 1; tally['films'] += sum(1 for f in film if f); tally['layers'] += n
        for k, b in enumerate(best):
            if b < ENOUGH:
                tally['weak'].append(f'{slug} layer {k + 1}: at best {b:.2f} seen')
    json.dump({'night': NIGHT, 'paper': PAPER, 'posters': out}, open(os.path.join(C, 'layer-tones.json'), 'w', encoding='utf-8'), indent=0, separators=(',', ':'))
    print(f"Stages: {tally['night']} night, {tally['paper']} paper. Layers: {tally['layers']}, of which {tally['films']} get a film behind them.")
    print(f"Layers that stand out on neither ground (under {ENOUGH:.0%} seen): {len(tally['weak'])}")
    for w in tally['weak']:
        print('  ', w)


if __name__ == '__main__':
    main()
