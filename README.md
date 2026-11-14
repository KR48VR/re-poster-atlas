# Poster Atlas

128 posters and book covers from 1891 to 2026, each one opened up detail by detail.
Made for teachers and anyone who wants to look more closely.

The site lives at https://kr48vr.github.io/re-poster-atlas/ and updates itself whenever this project changes.

## What is in this project

| Folder or file | What it holds |
|---|---|
| `content/` | The words and pictures: one file per poster in `studies/`, the images, the layer cut-outs and the colours. |
| `src/` | How the site looks and behaves: one style file, one script and the typeface. |
| `build.mjs` | Turns `content/` and `src/` into the finished website in a folder called `dist/`. |
| `scripts/` | One-time helpers that prepare images. |
| `.github/workflows/` | Publishes the site automatically whenever the project changes. |

## Building the site yourself

You need [Node](https://nodejs.org) and nothing else.

```bash
node build.mjs
```

The finished site appears in `dist/`. To look at it on your own computer:

```bash
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000`.

## Changing things

- To change a note, edit the poster's file in `content/studies/`.
- To change a page's colours, add the poster to `content/colours.json`.
- To change the opening line, edit `TAGLINE` near the top of `build.mjs`.

## Credits

The notes, selection and idea are King's. Image credits and sources are shown on each poster's page.
The typeface is Atkinson Hyperlegible, from the Braille Institute, used under the SIL Open Font License.
