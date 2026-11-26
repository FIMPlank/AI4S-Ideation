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

| Route                          | What it does                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `#/`                           | Landing (design: `design/landing/README.md`): hero, stats, 7 archetypes, deck anatomy, draw an activation question, play modes, research   |
| `#/spielmodi`, `#/forschung`   | Landing page scrolled to that section                                                                                                      |
| `#/karten`                     | Fanned stacks per archetype + instruction deck; filter by card type and SDG, free-text search, thumb grid                                  |
| `#/archetyp/:id`               | The 8 cards of one archetype in deck order (`a1`–`a7`, or `anleitung` for the 3 instruction cards)                                         |
| `#/karte/:id`                  | Viewer: flip (click/tap, Space/Enter), ←/→ or swipe through the current list, "Text anzeigen", SDGs, share                                 |
| `#/leitfaden`                  | The brochure as a web guide: TOC with deep links (`#/leitfaden/hintergrund`), citation, card-set overview, resource checklist, print as A4 |
| `#/ziehen`                     | Draw a random activation question (never the same one twice in a row)                                                                      |
| `#/impressum`, `#/datenschutz` | Marked placeholders until Fraunhofer legal/data protection review                                                                          |

Filters live in the URL (`#/karten?typ=case&sdg=13&q=recycling`), and the viewer
keeps the list you came from (`#/karte/a1-case-1?liste=filter&typ=case…`), so
every state can be linked and "back" works.

No cookies, no trackers, no third-party requests. Fonts are self-hosted. The
card explorer has no backend; only the Live-Raum talks to Supabase (EU).

## Live-Raum (online workshop)

The facilitator runs the workshop from a laptop (mirrored to a projector),
participants join on their phones with a 6-character code or QR code. No accounts:
everyone gets an anonymous Supabase session.

| Route                     | Who          | What                                                                      |
| ------------------------- | ------------ | ------------------------------------------------------------------------- |
| `#/raum`                  | everyone     | Join with a code, open a room, or try the Demo-Raum                       |
| `#/raum/neu`              | facilitator  | Pick a program and settings, get the code and the Moderationslink         |
| `#/raum/:code`            | participants | Phone view: follows the facilitator step by step                          |
| `#/raum/:code/moderation` | facilitator  | Console: step rail, timer, groups, draw, reveal (keys: → ← Space)         |
| `#/raum/:code/leinwand`   | facilitator  | Projector: big code + QR, live results, draw animation                    |
| `#/raum/:code/ergebnis`   | everyone     | Summary; print stylesheet; facilitator exports CSV + PNG matrix           |
| `#/raum/demo/...`         | anyone       | Demo-Raum: same screens with simulated participants, runs only in the tab |

Programs: Inspirations-Modus 2, Inspirations-Modus 1, Strategie-Modus, or the full
workshop (2 → 1 → Strategie). Steps come from the guide cards; Klärungszeit and
Pitch are optional and marked as coming from the Leitfaden.

Code layout:

```
src/workshop/           pure TS domain engine (flows, program, groups, draw, tally, ratings, timer, rules) + tests
src/workshop/store/     WorkshopStore interface; MemoryStore (tests + Demo-Raum)
src/room/               React screens (lazy-loaded), labels, export, demo bots
src/room/supabase/      SupabaseStore: RPCs, postgres_changes + presence, optimistic updates (lazy-loaded)
supabase/migrations/    schema, RLS, RPCs, realtime publication, pg_cron expiry
supabase/tests/         RLS test (66 checks) + auth shim
```

The offer is switched on by `liveRooms` in `src/config/site.json` **and** the
two build variables below. Without them `#/raum` shows "bald verfügbar" and only
the Demo-Raum works.

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
src/content/            leitfaden.de.md (brochure text) + build-time parser
design/landing/         approved landing design: README (tokens, type, shapes, sections), reference HTML, screenshots
src/styles/tokens.css   design tokens (colours, type scale, radii, spacing, shadows); landing.css uses only these
src/components/Tile.tsx shape vocabulary (quarter circle, leaf, dome, circle) for logo, hero mosaic, icons, footer band
src/config/             modes.ts (mode names/order), site.json (brochurePdfPublic, miroverseUrl)
src/i18n/de.ts          every UI string (add en.ts for an English edition)
src/lib/                hash router, list context for the viewer, colour contrast, assets
src/components/         CardImage, FlipCard, CardText, CardGrid, CardStack, FilterBar, SdgChip, …
src/pages/              one component per route
scripts/copy-pdf.mjs    copies source/*.pdf (and, if public, the brochure) into public/downloads/
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

## Updating the Leitfaden (brochure)

The Leitfaden page is built from `src/content/leitfaden.de.md`, the brochure as
web text. When the final brochure arrives:

1. Replace the PDF in `source/brochure/` (keep exactly one PDF there).
2. Sync the text in `leitfaden.de.md` with the new PDF, word for word, except
   where it contradicts the printed cards (they win; list such deviations in
   `webChanges`). Keep the
   `{#id}` on every heading: the ids are deep links and the page builds special
   blocks on them (`kernvorteile`, `hintergrund`, `kartenset`, `vorbereitung`,
   `ressourcen`, `allgemeine-vorbereitung`, `spielmodi`). `npm test` checks
   that they are all there.
3. Update the frontmatter: `status: final`, the paper citation if it changed,
   and remove the `openIssues` and `webChanges` the authors have resolved.
4. To offer the brochure as a download, set `"brochurePdfPublic": true` in
   `src/config/site.json`. The build then publishes it as
   `downloads/ideation-cards-broschuere.pdf` and shows "Broschüre (PDF)".

Play-mode names (as printed on the guide cards) and their order live in
`src/config/modes.ts`.

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

A dedicated project (EU, Ireland) used only by this app.

**Client config:** only the project URL and the **publishable** key. Never put
the secret key (`sb_secret_...`) into the repo, the frontend, a workflow or
`.env*` files.

- Local: copy `.env.example` to `.env.local` and fill in both values.
- GitHub: Settings → Secrets and variables → Actions → **Variables**:
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `deploy.yml` passes them
  to the build.

**Project settings:** Authentication → Sign In / Providers → allow anonymous
sign-ins. pg_cron must be enabled for the daily expiry job.

**Migrations** (`supabase/migrations/`): apply with the CLI

```bash
supabase link --project-ref <ref>
supabase db push
```

or paste the files into the SQL editor in order. If you applied them through the
SQL editor, tell the CLI once so `db push` doesn't run them again:

```bash
supabase migration repair --status applied 20261126090000 20261126090100
```

**What it stores:** rooms, members (anonymous id + display name), group draws,
ideas, votes, ratings, notes, implementation steps. Votes and ratings stay hidden
from others until the facilitator reveals them (enforced by RLS). Rooms and
everything in them are deleted 30 days after creation (`live-rooms-expiry`
cron job, 03:00 UTC); anonymous users without rooms after 30 days.
`research_mode` / `research_consent` exist but are off and unused (opt-in only).

**RLS test:** `scripts/rls-test.sh` runs `supabase/tests/rls.test.sql` in a
rolled-back transaction, either against a throwaway Docker Postgres (default) or
against `DATABASE_URL` (for example a local `supabase start` database). Never run
it against the live project.

**Keep-alive:** free projects pause after a week without traffic.
`.github/workflows/keep-alive.yml` calls the public `ping()` RPC every 3 days
using the same two variables.
