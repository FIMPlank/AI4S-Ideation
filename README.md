# Ideation Cards – Twin Transformation (web edition)

Playable online version of the printed ideation card deck by the
**Fraunhofer-Forschungscampus Twin Transformation (FFTT)**: seven archetypes of
how companies use AI to become digital and sustainable at the same time, each
with technology and organisation cards, an activation question and four real
cases. 59 double-sided A6 cards, in German.

Live: <https://fimplank.github.io/AI4S-Ideation/>

Project rules for contributors (and Claude Code) are in [`CLAUDE.md`](CLAUDE.md);
the phase plan is in [`PROMPTS.md`](PROMPTS.md).

## What's in it (phase 1: card explorer)

| Route                          | What it does                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `#/`                           | Landing: what the deck is, the 7 archetypes, the 3 play modes, download the print PDF                      |
| `#/karten`                     | Fanned stacks per archetype + instruction deck; filter by card type and SDG, free-text search, thumb grid  |
| `#/archetyp/:id`               | The 8 cards of one archetype in deck order (`a1`–`a7`, or `anleitung` for the 3 instruction cards)         |
| `#/karte/:id`                  | Viewer: flip (click/tap, Space/Enter), ←/→ or swipe through the current list, "Text anzeigen", SDGs, share |
| `#/ziehen`                     | Draw a random activation question (never the same one twice in a row)                                      |
| `#/impressum`, `#/datenschutz` | Marked placeholders until Fraunhofer legal/data protection review                                          |

Filters live in the URL (`#/karten?typ=case&sdg=13&q=recycling`), and the viewer
keeps the list you came from (`#/karte/a1-case-1?liste=filter&typ=case…`), so
every state can be linked and "back" works.

No backend, no cookies, no trackers, no third-party requests. Fonts are self-hosted.

## Local development

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173 (copies the PDF first)
npm run build      # production build into dist/
npm run preview    # serve dist/ at http://localhost:4173
```

Checks (all three must pass before a phase is done; CI runs them on every push):

```bash
npm run lint       # oxlint (incl. jsx-a11y) + prettier --check
npm run typecheck  # tsc -b
npm test           # vitest: search, filter, draw, routing, deck integrity
npm run format     # prettier --write
```

To try it on a phone in the same Wi-Fi: `npm run dev -- --host` and open the
network URL it prints.

## Project layout

```
source/                 print PDF (copied to downloads/ideation-cards-twin-transformation.pdf at build)
tools/extract_cards.py  generates cards.json + card images from the print PDF
public/cards/{full,thumb}/  card images (generated, don't edit)
src/data/cards.json     card content (generated, don't edit)
src/data/types.ts       Card, Archetype, CardType, SdgId …
src/data/query.ts       normalize (German, case/diacritics-insensitive), filter, search, drawRandom
src/data/deck.ts        typed access: cardsByArchetype, findCards, activationCards …
src/data/sdgs.ts        SDG short titles + official colours
src/i18n/de.ts          every UI string (add en.ts for an English edition)
src/lib/                hash router, list context for the viewer, colour contrast, assets
src/components/         CardImage, FlipCard, CardText, CardGrid, CardStack, FilterBar, SdgChip, …
src/pages/              one component per route
scripts/copy-pdf.mjs    copies source/*.pdf into public/downloads/
```

## Regenerating the cards

`src/data/cards.json` and `public/cards/` are generated from the print PDF.
Fix the script or get a new PDF, never hand-edit the output:

```bash
pip install pymupdf pillow
python tools/extract_cards.py source/<print-pdf>.pdf .
npm test   # deck integrity tests check structure, ids, SDGs and that every image exists
```

Keep exactly one PDF in `source/`; it is published as
`downloads/ideation-cards-twin-transformation.pdf`.

## Deployment

`.github/workflows/deploy.yml` runs lint, typecheck, tests and the build on
every push and pull request, and deploys `dist/` to GitHub Pages on every push
to `main`.

One-time setup in the GitHub repo:

1. The repo must be **public** for Pages on a free plan.
2. Settings → Pages → Source: **GitHub Actions**.

The build uses relative URLs (`base: './'`) and hash routing, so it works under
`/AI4S-Ideation/` and on any future domain without changes.

## Supabase

Not used yet (phase 3: live rooms). Setup notes will follow here.
