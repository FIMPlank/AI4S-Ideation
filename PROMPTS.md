# Claude Code prompts: AI4S Ideation (Ideation Cards web edition)

Five prompts, one per phase. Paste them one at a time into Claude Code in the
repo, and only start the next once you've tried the previous one. `CLAUDE.md`
holds the project rules Claude Code reads every session, so these prompts
only describe each phase's job.

---

## Before prompt 1 (once, ~10 min)

1. Clone the repo `FIMPlank/AI4S-Ideation` (it exists and is still empty).
   It's currently **private**. On a free GitHub account, Pages only works for
   public repos, so either make it public (the cards are public anyway) or
   use a paid plan. The site will be at `https://fimplank.github.io/AI4S-Ideation/`.
2. Copy the contents of this kit into the repo root:
   `CLAUDE.md`, `PROMPTS.md`, `tools/`, `public/cards/`, `src/data/cards.json`, `source/`.
3. In the repo: Settings → Pages → Source: **GitHub Actions**.
4. Optional, but better: put the FFTT logo (SVG) and brand colours in `public/brand/`.
5. Not needed until prompt 3: create a **new** Supabase project (region: EU / Frankfurt)
   and keep its URL and publishable key handy.

---

## Prompt 1: Foundation + card explorer + deploy

```text
Read CLAUDE.md and look at src/data/cards.json and public/cards/ before you plan.
This phase: set up the project and build the card explorer: everything you
need to browse and "play" the deck alone, with no backend. Show me your plan
(routes, components, data access) first, then build it.

Scope:
1. Scaffold Vite + React + TypeScript with lint, typecheck, Vitest, self-hosted
   fonts and a GitHub Actions workflow that builds and deploys to GitHub Pages
   on every push to main. Copy source/*.pdf to the build as
   downloads/ideation-cards-twin-transformation.pdf.
2. Typed data layer over cards.json (types for Card, Archetype, card types).
   Helpers: cards by archetype in deck order, filter, search (German,
   case- and diacritics-insensitive, across all text fields), random draw.
3. Routes (hash routing):
   - #/            Landing: what the deck is (AI for twin transformation:
                   digital + sustainable at the same time), FFTT as publisher,
                   the 3 play modes (from the guide cards), CTAs
                   "Karten entdecken", "Karte ziehen", "PDF herunterladen",
                   and "Workshop starten" (shown as "bald verfügbar" for now).
   - #/karten      Deck overview: 7 archetype decks as fanned card stacks in
                   their colour, plus the instruction deck. Filters: card type,
                   SDG chips, free-text search; results as a thumb grid.
   - #/archetyp/:id  The 8 cards of one archetype in deck order, with a short
                   note on how they're used (archetype → Eigenschaften
                   [technology + organisation] → Aktivierungsfrage → Fallbeispiele).
   - #/karte/:id   Card viewer: large card, 3D flip (tap/click, Space/Enter),
                   prev/next within the current list (←/→, swipe),
                   "Text anzeigen" (card content as accessible HTML from the
                   JSON), SDG chips, share button (Web Share API, fallback:
                   copy link).
   - #/ziehen      "Karte ziehen": shuffle animation, reveals a random
                   activation question in its archetype colour, buttons
                   "Nochmal ziehen" and "Zum Archetyp".
   - #/impressum, #/datenschutz  marked placeholders (see CLAUDE.md).
4. SDG chips with German short titles and official colours:
   8 Menschenwürdige Arbeit und Wirtschaftswachstum #A21942
   9 Industrie, Innovation und Infrastruktur #FD6925
   10 Weniger Ungleichheiten #DD1367
   11 Nachhaltige Städte und Gemeinden #FD9D24
   12 Nachhaltige/r Konsum und Produktion #BF8B2E
   13 Maßnahmen zum Klimaschutz #3F7E44
   15 Leben an Land #56C02B
   16 Frieden, Gerechtigkeit und starke Institutionen #00689D
5. Footer: FFTT, Fraunhofer FIT, card licence (placeholder "Lizenz: TODO"),
   Impressum, Datenschutz.
6. Quality: mobile-first, keyboard and screen-reader friendly,
   prefers-reduced-motion, thumbs in grids / full images only in the viewer,
   Lighthouse ≥ 90 on mobile for performance and accessibility.
   Unit tests for filter, search and draw.

Out of scope for now: workshop modes, Supabase, analytics.
Done = deployed on GitHub Pages, lint/typecheck/tests green, README updated.
Then stop and give me the URL, how to test locally, and open questions.
```

---

## Prompt 2: The three play modes, solo / single screen

```text
Phase 2 (see CLAUDE.md, "Play modes"): turn the three guide cards into guided,
step-by-step flows that one person or one team around one screen can play,
with no backend. State lives in localStorage (try/catch). Plan first, then build.

Mode names, order and route ids come from src/config/modes.ts (names and order
as on the printed guide cards; route ids inspiration-1, inspiration-2,
strategie). Set `available: true` there when a mode is built, so the Leitfaden
and landing link to it.

Shared building blocks:
- Facilitator prep screen before a workshop: the Ressourcen checklist from the
  Leitfaden (same localStorage state) + Allgemeine Vorbereitung step 1.
- Step flow with progress bar, back/next, optional timer per step
  (presets 5/10/15/20 min, pause, gentle sound/visual at the end,
  off by default), and a "Beamer-Ansicht" toggle (large type, high contrast).
- Every mode starts with its guide card (flip to see the instructions) and
  ends with a results screen + export (CSV, PNG, and a print stylesheet so
  "Drucken / als PDF speichern" gives a clean 1–2 page summary).
  No heavy PDF libraries.

Inspirations-Modus 1 (#/modus/inspiration-1):
- Setup: number of groups (1–6). "Archetyp ziehen" per group: random, no
  duplicates, with a draw animation that works on a beamer; manual override.
- Per group: guided reading archetype → technology → organisation → 4 cases
  (each a flippable card), then an idea form: title, short description,
  "inspiriert von" (optional case card), target audience / process (free
  text). Goal 2–3 ideas, shown as a soft counter, not enforced.
- Optional "Klärungszeit" step after the sequential reading of the cards
  (Leitfaden, Allgemeine Vorbereitung step 2): timer, default 15 min, skippable.
- Optional "Pitch" step at the end (Leitfaden; not on the guide card, see
  openIssues, so skippable): groups present their ideas one after another;
  pitch timer per group (default 2 min), the facilitator moves group by group.
- Result: idea wall grouped by archetype colour.

Inspirations-Modus 2 (#/modus/inspiration-2):
- All 28 case cards, grouped by archetype, open. Dot voting: each person has
  N dots (default 3, configurable 2–5); in single-screen mode you can add
  people (names optional, "Person 1, 2…").
- Hide results until "Auflösen" (to avoid herding), then show a ranking by case
  and by archetype (sum of the archetype's case votes).
- The two discussion questions from the guide card, each with a notes field;
  mark "relevante Archetypen".
- Result: prioritised archetypes + top cases + notes.

Strategie-Modus (#/modus/strategie):
- Pick what to work on: a prioritised archetype, a top case or an idea
  from the other modes (if any are in localStorage), or any card.
- Discussion step using that archetype's technology + organisation cards,
  with a notes field for each guide question (technical prerequisites,
  organisational changes, implementation).
- Rating on 1–5 for Nachhaltigkeitswirkung, Umsetzbarkeit and Geschäftsnutzen
  (one or more raters; show mean and spread).
- Matrix: x = Umsetzbarkeit, y = Geschäftsnutzen, bubble size and colour
  intensity = Nachhaltigkeitswirkung, labels readable, accessible table
  alternative below the chart.
- "Erste Umsetzungsschritte": list of steps (was / wer / bis wann).

Also: a "Kompletter Workshop" path in the order the Leitfaden describes
(Inspirations-Modus 2 as the entry → Inspirations-Modus 1 → Strategie-Modus)
and carries results
forward. Switch the landing page CTA "Workshop starten" on,
leading to a mode picker that explains when to use which mode (from the
cards' "Was/Wann").

Unit tests for vote tallying, ranking ties, rating aggregation and draw
without duplicates. Done = deployed, tests green, README updated; then stop
and summarise.
```

---

## Prompt 3: Live rooms (multiplayer)

```text
Phase 3: live multiplayer rooms for all three modes. The facilitator runs the
session on a laptop/beamer; participants join on their phones with a code or
QR code. Reuse the Phase 2 flows: same steps, now synced.
Plan first, including the full data model and security model, and wait for
my OK before writing migrations.

Backend: the dedicated Supabase project from CLAUDE.md. I'll give you the URL
and publishable key; put them in a config module (safe to ship) and
document the setup in README.

Security model (important, don't simplify it to "anyone with the anon key can
read everything"):
- Supabase Anonymous Sign-ins: every browser that creates or joins a room
  calls signInAnonymously(), so each person has an auth.uid().
- Rooms are never listable. Create and join only via SECURITY DEFINER RPCs:
  create_room(...) returns id + 6-char code (no ambiguous characters);
  join_room(code, display_name) adds a room_members row.
- RLS on every room-scoped table: a user can read/write rows of a room only
  if they're a member; they can edit/delete only their own rows; only the
  room's facilitator can change room state (phase, timer, groups, draws,
  reveal).
- Realtime: Postgres Changes filtered by room_id (RLS applies) for data,
  Presence for who's online.
- Rooms expire (default 30 days, configurable) with a cleanup job; say how
  you'll schedule it.
- Limits: display name ≤ 40 chars, text fields length-capped, simple
  per-user insert limits in the RPCs/policies.

Suggested tables (adjust if you have a better design, but explain why):
rooms, room_members (incl. role, group_no), draws (group → archetype),
ideas, votes, ratings, notes, steps (implementation steps). The timer is a
server-side end timestamp on the room, so every device counts down in sync.

UX:
- #/raum/neu (facilitator): pick mode or "Kompletter Workshop", groups,
  dots per person, timer presets → room with big join code + QR code
  (generated locally, no external service) + live participant list.
- #/raum/:code (participant): name → waiting screen → follows the facilitator.
  Phone-first: one card at a time, big buttons, works on a weak connection
  (optimistic updates, reconnect state shown).
- Facilitator controls: next/previous step, start/pause timer, assign or draw
  archetypes per group, "Auflösen" for votes and ratings, close room.
- Beamer view: live idea wall, live dot heatmap (hidden until reveal),
  rating matrix.
- Export at the end, same formats as Phase 2.
- Solo mode from Phase 2 keeps working without any backend.

Deliverables: migrations in supabase/migrations/ (not applied, I'll review
and apply them, or tell me exactly which command to run), RLS tests (SQL or
a script that proves a non-member can't read a room), a two-browser manual
test plan, README section. Then stop.
```

---

## Prompt 4: Research data (opt-in)

```text
Phase 4: collect use-case ideas from live rooms (and optionally from solo play)
as research data, so we can evaluate the card deck as a design science
artifact. Opt-in only, GDPR-minded. Plan first, then build.

Rules:
- Two consents needed: the facilitator enables "Forschungsmodus" for the room,
  AND each participant ticks an unchecked consent box when joining
  (short text + link to Datenschutz; text marked TODO for Fraunhofer data
  protection review). Without both, nothing goes to research.
- Research records are copies, not links: when the facilitator closes the
  room, a SECURITY DEFINER function copies consented ideas (title,
  description, archetype, inspired-by card, mode, aggregated ratings,
  card-set version from cards.json meta, a random room pseudonym, date)
  into research_ideas. No names, no user ids, no codes.
- Optional room context the facilitator may fill in for research: industry
  (WZ 2008 sections A–U as a dropdown) and company size class
  (1–9, 10–49, 50–249, 250+). No company name.
- Hint near the idea form: please don't enter personal data.
- Solo mode: an optional "Idee anonym für die Forschung teilen" button with the
  same consent text, inserting via an RPC (insert-only, rate-limited).
- research_ideas: no select for anon or anonymous users. Read access only for
  allowlisted researcher accounts (email login via Supabase Auth, a
  researchers table, RLS on it).
- #/forschung (noindex, not linked in the nav): researcher login, table with
  filters (archetype, mode, date, industry), CSV export, simple counts per
  archetype/case.
- Room deletion/expiry never deletes research_ideas; document retention as a
  TODO for data protection.

Tests: RLS proves anon and room members can't read research_ideas; the copy
function respects both consents. Update the Datenschutz placeholder with a
list of what is stored where (as input for the legal review). Then stop.
```

---

## Prompt 5: Launch kit

```text
Phase 5: everything we need for launch and reach. Plan first, then build.

1. Print & Play: tools/make_print_and_play.py (PyMuPDF) turns the print PDF
   into an A4 home-print PDF: 4 cards per sheet, scaled to fit printable
   margins (≥ 5 mm), cut marks, back pages positioned for long-edge duplex,
   with a cover page explaining printing and cutting. Offer it on the landing
   page next to the original print PDF.
2. LinkedIn carousels: tools/make_carousels.py renders one PDF per archetype
   (cover slide in the archetype colour + its 8 cards front/back, 1080×1350,
   last slide with the link to the site). Output to dist-marketing/ (not deployed).
3. Share previews: at build time, generate static share pages
   (/s/karte/<id>/ and /s/archetyp/<id>/) with Open Graph/Twitter tags and
   a 1200×630 JPG preview image (card front + back on a brand background),
   which then redirect to the hash route. Share buttons use these URLs.
4. QR codes: SVG QR codes for the landing page, each archetype and the "Karte
   ziehen" page, for posters, the card box and slides (in dist-marketing/).
5. Miro: config value for a Miroverse template URL; when it's set, show
   "Als Miro-Vorlage nutzen" on the landing page and in the mode picker.
6. Reach metrics without cookies (ask me before building it): an RPC that
   increments daily aggregate counters (page, card id, mode started, room
   created), no IPs or ids stored by us, visible on #/forschung.
7. Final audit: Lighthouse (mobile), axe accessibility check, broken-link
   check, test on iOS Safari + Android Chrome sizes, a meta description and
   title on every route, favicon / app icons from the brand folder.
8. README: final sections for regenerating everything when the editor sends a
   corrected PDF (extract_cards → print & play → carousels → share images).

Then give me a launch checklist with the things only I can do (legal review,
licence decision, brand assets, Miroverse submission).
```
