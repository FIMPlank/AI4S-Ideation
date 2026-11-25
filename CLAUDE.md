# AI4S Ideation: Ideation Cards – Twin Transformation (web edition)

Repo: `FIMPlank/AI4S-Ideation` → GitHub Pages at
`https://fimplank.github.io/AI4S-Ideation/` (project site, so all URLs
must work under that subpath).

Playable online version of the printed ideation card deck by the
**Fraunhofer-Forschungscampus Twin Transformation (FFTT)**. The deck helps
companies (mainly German Mittelstand) find AI use cases that serve the economy
and sustainability at the same time.

Audience: workshop facilitators, company teams, lecturers and students. Most
of them arrive from LinkedIn, a QR code or a workshop invite, on a phone.

## The card deck

59 double-sided A6 cards. All content is in `src/data/cards.json`; card images
are in `public/cards/`. Both are **generated** by `tools/extract_cards.py`
from the print PDF in `source/`. Don't hand-edit them: fix the script or get a
new PDF, then re-run:

```bash
pip install pymupdf pillow
python tools/extract_cards.py source/<print-pdf>.pdf .
```

Deck structure:
- 3 instruction cards (`type: "guide"`), one per play mode:
  `inspiration-1`, `inspiration-2`, `strategy`.
- 7 archetypes (`a1`–`a7`), each with its own colour and SDG list, and 8 cards:
  - `archetype`: description intro + points (only a1 has points) + sustainability link
  - `technology` and `organisation`: together these are the
    "Eigenschaften-Karte" from the instructions (points + tip / value proposition)
  - `activation`: the activation question + a one-line overview of the 4 cases
  - `case` ×4: summary + takeaways {technology, organisation, sustainability}

Every card has `images.front|back.full|thumb` (WebP, 893×1259 and 298×420) and
the original PDF page numbers.

`meta.corrections` and `meta.strayHyphensFixed` list typos fixed in the JSON.
The **images still show the print typos** until the editor sends a corrected
PDF. `meta.contentIssues` lists content questions for the authors. Don't
"fix" those silently, and never invent or reword card content.

## Content

- **Leitfaden (`#/leitfaden`)**: source is the brochure "Ideation Cards –
  Broschüre 105x148mm", status **konzept**. Its text lives in
  `src/content/leitfaden.de.md` (frontmatter: cover, paper citation,
  openIssues; headings carry `{#id}` = section deep links). It is parsed at
  build time (`src/content/parse.ts`, Vite plugin in `vite.config.ts`). Keep the
  text word for word; language and content questions go into `openIssues` for
  the authors, not into silent fixes. The PDF is in `source/brochure/` and is
  only published when `brochurePdfPublic` is true in `src/config/site.json`.
- **Mode names**: the website uses the brochure names and order
  (Inspirations-Modus → Ideation-Modus → Strategie-Modus), defined once in
  `src/config/modes.ts`, and shows the printed card name as a hint
  (brochure Inspirations-Modus = card "Inspirations-Modus 2", brochure
  Ideation-Modus = card "Inspirations-Modus 1"). Route ids: `inspiration`,
  `ideation`, `strategie`.

## Play modes (source of truth: the guide cards; names: see Content)

- **Inspirations-Modus 1**: split into groups. Each group draws an archetype
  and reads its archetype card, then technology + organisation, then the case
  cards. Task: develop 2–3 new use cases for their own organisation.
  Output: sketches of new AI use-case ideas.
- **Inspirations-Modus 2**: all information cards open. Everyone reads the
  case cards of every archetype and marks the 2–3 most interesting ones (dot
  voting). Discussion: which archetypes matter for us? Which examples carry
  over to our context? Output: prioritised archetypes and first ideas.
- **Strategie-Modus**: pick a prioritised archetype or use case. Discuss with
  the technology/organisation cards: technical prerequisites, organisational
  changes, how to implement. Rate on Nachhaltigkeitswirkung, Umsetzbarkeit and
  Geschäftsnutzen. Output: prioritised use cases + first implementation steps.

## Stack and conventions

- Vite + React + TypeScript; plain CSS (CSS modules or one stylesheet with
  custom properties). No UI framework unless there's a clear reason.
- Static site on **GitHub Pages**, deployed by a GitHub Actions workflow.
  `base: './'` / relative URLs, so the site also works under a subpath or a
  future FFTT domain. Hash routing (`#/...`), so deep links need no server.
- **No third-party CDNs or trackers**: fonts and everything else are
  self-hosted (corporate networks block a lot, and it keeps things GDPR-simple).
- Backend for live rooms and research data: a **dedicated Supabase project**
  (EU region) used only by this app. Migrations live in `supabase/migrations/`.
  Never apply anything to the live project without asking me first.
- UI language is **German** (cards are German). All UI strings go in one
  string table (`src/i18n/de.ts`), so an English version later only means
  adding `en.ts` plus translated card data.
- Lint + typecheck + unit tests must pass before you say a phase is done:
  `npm run lint`, `npm run typecheck`, `npm test` (Vitest for pure logic:
  vote tallies, rating aggregation, draws, filters).

## Design

- The cards are the hero. Show the real card images; build the UI around them,
  not instead of them.
- Archetype colours come from `archetypes[].colour`. Yellow `#FBB900` and lime
  `#BBCE01` need dark text on top: check WCAG AA contrast wherever a colour
  is used as a background.
- FFTT/Fraunhofer branding: logo files and brand colours go in
  `public/brand/` (I'll add them). Until then, use a neutral placeholder
  wordmark "Fraunhofer-Forschungscampus Twin Transformation". Don't recreate
  the Fraunhofer logo.
- Mobile-first (participants join workshops on phones). Also needs to look
  good on a beamer in facilitator view.
- Accessibility: every card image has a text alternative generated from the
  JSON (a "Text anzeigen" toggle shows the card as HTML). Keyboard: ←/→
  between cards, Space/Enter flips. `prefers-reduced-motion` turns the flip
  animation into a crossfade.
- Load thumbs in grids and full images only in the viewer; lazy-load,
  and preload the other side of the open card.

## Privacy and legal (Germany)

- Impressum and Datenschutzerklärung pages are required. Create them as clearly
  marked **placeholders** (`TODO: Prüfung durch Fraunhofer Rechtsabteilung /
  Datenschutz`). Never present generated legal text as final.
- Solo use needs no account and stores nothing on a server. Local state goes
  in `localStorage`, wrapped in try/catch, so the app still works when
  storage is blocked.
- Research data is opt-in only (see the research-data phase in PROMPTS.md): no names, no
  emails, no free-text fields that ask for personal data, and the consent
  checkbox is unchecked by default.

## Working style

- Work in the phases from `PROMPTS.md`. At the end of each phase: summary,
  how to test it locally, open questions. Then stop.
- Keep `README.md` current (what it is, local dev, deploy, regenerating cards,
  Supabase setup).
- Small, focused commits with clear messages.
