"""One-time image preparation for Poster Atlas.

1. Makes small thumbnails of every poster for the collection wall.
2. Splits The Wind Rises into its six layers. The original site did this in the
   visitor's browser; this follows the same recipe once, ahead of time.

Run from the project folder:  python3 scripts/prepare_images.py
Needs Pillow and numpy.
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, 'content')


def thumbs():
    out = os.path.join(C, 'images', 'thumb'); os.makedirs(out, exist_ok=True)
    n = 0
    for f in sorted(os.listdir(os.path.join(C, 'images', 'catalogue'))):
        im = Image.open(os.path.join(C, 'images', 'catalogue', f)).convert('RGB')
        h = 420; w = round(im.width * h / im.height)
        im.resize((w, h), Image.LANCZOS).save(os.path.join(out, f), 'WEBP', quality=80, method=5); n += 1
    return n


def box(X, Y, x0, y0, x1, y1):
    return (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1)


def wind_rises_layers():
    study_path = os.path.join(C, 'studies', 'the-wind-rises.json')
    study = json.load(open(study_path, encoding='utf-8'))
    shapes = study['studyData']['layerShapes']
    im = Image.open(os.path.join(C, 'images', 'full', 'the-wind-rises.jpg')).convert('RGBA')
    W, H = im.size
    a = np.asarray(im).astype(np.int32)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    yy, xx = np.mgrid[0:H, 0:W]
    X, Y = xx / W, yy / H
    V = np.maximum(np.maximum(R, G), B)

    def poly_mask(polys, minus=None, ellipse=None):
        m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
        for p in polys: d.polygon([(x * W, y * H) for x, y in p], fill=255)
        if ellipse:
            cx, cy, rx, ry = ellipse; d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
        if minus: d.polygon([(x * W, y * H) for x, y in minus], fill=0)
        return np.asarray(m) > 127

    portrait = poly_mask([shapes['we']], minus=shapes['Te'])
    aircraft = poly_mask(shapes['N'], ellipse=(W * .355, H * .257, W * .047, H * .035))

    upper = (box(X, Y, .417, .058, .56, .145) | box(X, Y, .447, .138, .554, .218) | box(X, Y, .414, .215, .568, .274)
             | box(X, Y, .456, .266, .558, .32) | box(X, Y, .536, .313, .595, .343) | box(X, Y, .587, .051, .664, .234))
    lower = (box(X, Y, .326, .731, .653, .767) | box(X, Y, .079, .924, .908, .938) | box(X, Y, .126, .937, .884, .95)
             | box(X, Y, .173, .948, .828, .96) | box(X, Y, .329, .958, .712, .987) | box(X, Y, .85, .957, .979, .991))
    band = box(X, Y, .045, .755, .952, .926)

    def shifted(m, dx, dy):
        out = np.zeros_like(m)
        ys, yd = (slice(max(0, -dy), H - max(0, dy)), slice(max(0, dy), H - max(0, -dy)))
        xs, xd = (slice(max(0, -dx), W - max(0, dx)), slice(max(0, dx), W - max(0, -dx)))
        out[yd, xd] = m[ys, xs]
        return out

    dirs = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)]
    pink = (Y > .755) & (Y < .926) & (R > 135) & (R > G * 1.35) & (B > G * 1.12)
    reach = max(2, round(W / 250))
    near_pink = np.zeros_like(pink)
    for i in range(1, reach + 1):
        for dx, dy in dirs: near_pink |= shifted(pink, dx * i, dy * i)

    f = np.zeros((H, W), np.int32)
    is5 = (upper & (V < 105)) | (box(X, Y, .025, .02, .134, .061) & (R > 58) & (R > G * .48))
    is6 = ~is5 & (pink | (band & (V < 115) & near_pink) | (lower & (V < 125)))
    f[is5] = 5; f[is6] = 6

    def beside(val):
        m = f == val; out = np.zeros_like(m)
        for dx, dy in dirs: out |= shifted(m, dx, dy)
        return out

    sky = (R < 90) & (B > R * 1.45) & (G > R * 1.35) & (B - G > 25)
    layer = np.full((H, W), 1, np.int32)                       # clouds unless something claims the pixel
    layer[sky] = 0
    layer[portrait] = 3
    layer[aircraft & ~sky] = 2
    edge6 = ((lower & (V < 175)) | (band & (V < 150))) & beside(6)
    layer[edge6] = 5
    edge5 = upper & (V < 145) & beside(5)
    layer[edge5] = 4
    layer[f > 0] = f[f > 0] - 1

    out = os.path.join(C, 'images', 'layers', 'the-wind-rises'); os.makedirs(out, exist_ok=True)
    src = np.asarray(im)
    counts = []
    for k in range(6):
        px = src.copy(); px[layer != k] = 0
        Image.fromarray(px, 'RGBA').save(os.path.join(out, f'plane-{k}.webp'), 'WEBP', quality=88, method=4)
        counts.append(int((layer == k).sum()))
    assert sum(counts) == W * H

    names = study['studyData']['layers']
    by_layer = {'studio': 4, 'calligraphy': 4, 'dedication': 4, 'aircraft': 2, 'sky': 0, 'clouds': 1,
                'portrait': 3, 'glasses': 3, 'hat': 3, 'clothing': 3}
    for r in study['studyData']['regions']:
        r['layerIndex'] = by_layer.get(r['id'], 5)
    json.dump(study, open(study_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    lp = os.path.join(C, 'layers.json'); L = json.load(open(lp, encoding='utf-8'))
    L['layers']['the-wind-rises'] = {
        'mode': 'computed', 'width': W, 'height': H,
        'labels': [n['label'] for n in names], 'shortLabels': [n['shortLabel'] for n in names],
        'descriptions': [n['description'] for n in names],
        'sources': [f'/layers/studies/the-wind-rises/plane-{k}.png' for k in range(6)],
        'methodNote': 'Split ahead of time with the same recipe the original site ran in the browser.',
        'anchorLayer': 3}
    json.dump(L, open(lp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return counts, [r['id'] for r in study['studyData']['regions']]


if __name__ == '__main__':
    print('thumbnails made:', thumbs())
    counts, ids = wind_rises_layers()
    print('wind rises layer pixel counts:', counts)
    print('wind rises region ids:', ids)
