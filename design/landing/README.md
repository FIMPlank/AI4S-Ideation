# Landing page design: AI4S Ideation

Approved design concept for the landing page (`#/`). Made on a Claude design
canvas and exported here as:

- `landing-reference.html`: static reference with the exact markup and inline
  styles. Open it in a browser from this folder (it loads the card images from
  `public/cards/full/`). The "Neue Karte ziehen" button works.
- `landing-desktop.jpg` / `landing-mobile.jpg`: full-page screenshots at 1440 px
  and 390 px.

This folder is a **reference, not production code**. Rebuild it as proper
components in the app and match it visually.

## Look

Taken straight from the printed material: the brochure cover's flat geometric
tiles (quarter circles, leaves, half circles, circles) in the seven archetype
colours, white space, bold humanist sans headlines, and the real card artwork
as the hero. No gradients, no glassmorphism, no emoji.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--navy` | `#075478` | primary buttons, "Digitalisierung", draw band background |
| `--green-text` | `#0A7F66` | eyebrows, "Nachhaltigkeit" (passes AA on white; `#0A9477` does not for small text) |
| `--ink` | `#16202A` | headings, body on light colours |
| `--body` | `#3B4651` | paragraphs |
| `--muted` | `#5A6672` | labels, captions |
| `--line` | `#E3E7EA` | borders, dividers |
| `--mist` | `#F3F5F4` | soft panels / alternating section background |
| `--footer` | `#0E2433` | footer background |
| `--on-navy` | `#D6E6EF` | body text on navy / footer |
| `--yellow` | `#F9BA09` | CTA on navy ("Neue Karte ziehen", "Raum eröffnen") |

Archetype colours: use `archetypes[].colour` from `src/data/cards.json` (the
design used the brochure's values, which differ by a few points:
`#EF7D05 #BA1251 #008198 #0A9477 #F9BA09 #BCCF0C #44BCCB`). Text on an
archetype colour: **white** on a2, a3, a4 (darken a4 to `#0A7F66` behind white
text), **ink** on a1, a5, a6, a7. Check AA wherever you combine them.

SDG dot colours: 8 `#A21942`, 9 `#FD6925`, 10 `#DD1367`, 11 `#FD9D24`,
12 `#BF8B2E`, 13 `#3F7E44`, 15 `#56C02B`, 16 `#00689D`.

**Type**: Source Sans 3 (400/600/700/800, italic 400), self-hosted via
`@fontsource` (the reference loads it from Google Fonts, but the app must not
use a CDN). It stands in for Frutiger, the font of the printed cards. If
Fraunhofer's Frutiger web licence covers this site, swap it in.

| Style | Size / line height / tracking / weight |
|---|---|
| H1 | `clamp(38px, 4.2vw, 54px)` / 1.04 / -0.028em / 800, soft hyphen in "Wettbewerbs­fähigkeit" |
| H2 | `clamp(32px, 3.6vw, 48px)` / 1.08 / -0.025em / 800 |
| H3 | 21–26px / 1.15 / -0.015em / 800 |
| Eyebrow | 14px / 700 / uppercase / 0.08em, `--green-text` |
| Lead | 21px / 1.5, `--body` |
| Body | 16–18px / 1.5 |
| Small | 13–15px, `--muted` |
| Stat number | 56px / 800 / -0.03em |

**Layout**: container `max-width: 1200px`, side padding `clamp(20px, 4vw, 40px)`,
section rhythm 104px vertical, gaps 22px (grids) / 44px (header → content).
Radii: pills `999px`, cards 22px, panels 28px, card images 9–10px.
Card image shadow: `0 18px 34px -16px rgba(10,30,45,.4)` (hero: stronger).

**Shape vocabulary** (CSS only, a coloured tile + an absolutely positioned
inner shape):
- quarter circle: `border-radius: 100% 0 0 0` (rotate by moving the 100%)
- leaf: `border-radius: 0 100% 0 100%` or `100% 0 100% 0`
- half circle / dome: inner `height: 50%; bottom: 0; border-radius: 999px 999px 0 0`
- circle: `inset: 18%; border-radius: 50%`
Build a small `<Tile bg fg shape>` component and reuse it for the logo mark,
hero mosaic, mode/benefit icons and footer band.

## Sections (top to bottom)

1. **Header**: logo mark (2×2 tile mosaic) + "AI4S Ideation" + "Fraunhofer-
   Forschungscampus Twin Transformation"; nav Karten · Spielmodi · Leitfaden ·
   Forschung; pill CTA "Workshop starten". Wraps on phones.
2. **Hero**: eyebrow, H1 (Digitalisierung in navy, Nachhaltigkeit in green),
   lead, CTAs (primary "Karten entdecken", outline "Workshop starten", link
   "Karte ziehen →"), research line. Right: 3×3 tile mosaic (28px radius) with
   three real archetype cards fanned on top (a2, a3 centre, a5).
3. **Stats strip**: 59 / 7 / 28 / 3 between two hairlines; 2×2 on phones.
4. **"Sieben Wege, wie KI Nachhaltigkeit voranbringt"**: the 7 archetype
   fronts in a row (hover lift), label "ARCHETYP 0X", title (hyphens: auto),
   SDG dots. Each links to `#/archetyp/:id`.
5. **Anatomie eines Decks**: mist panel, two real card backs tilted + the
   5-step list (Archetyp, Technologie, Organisation, Aktivierungsfrage,
   4 Fallbeispiele).
6. **"Ziehen Sie eine Karte."**: full-bleed navy band. The activation card is
   rendered in HTML in the drawn archetype's colour, on a stack of two
   translucent cards; "Neue Karte ziehen" draws a different random activation
   question (`aria-live="polite"`); "Zum Archetyp 0X →" follows the draw.
7. **Spielmodi**: three bordered cards (Inspiration, Ideation, Strategie) with
   tile icon, ghost number, description, Ergebnis/Wann, "Gedruckte Karte: …".
   Then CTAs "Workshop starten" / "Leitfaden lesen".
8. **"Warum Ideation Cards?"**: mist band, 4 benefit tiles
   (auto-fit, min 240px).
9. **"Am Tisch, im Browser oder auf dem Board"**: Live-Raum (navy tile),
   Ausdrucken (Print & Play), In Miro ("Bald verfügbar" badge).
10. **Forschung**: bordered panel with the 7-colour bar on top; text +
    citation figure (authors, title, journal) with "Zum Paper" and the DOI link.
11. **Footer**: 7-tile shape band, logo placeholder, short text, link columns
    (Entdecken, Rechtliches).

## Content rules

- Archetype titles, SDGs, activation questions and images come from
  `cards.json`. Don't hard-code them like the reference does.
- Mode names and order come from `src/config/modes.ts` (Inspiration →
  Ideation → Strategie, with the printed card name as a hint).
- Paper citation comes from the `paper` frontmatter of
  `src/content/leitfaden.de.md`.
- Placeholders to keep visible until real assets exist: `[Logo FFTT /
  Fraunhofer]`, `Lizenz [TBD]`. Miro tile stays "Bald verfügbar" until a
  Miroverse URL is set in the config.
- CTAs whose features don't exist yet (live room, print PDF) point to the
  closest working page or show "bald verfügbar". Never a dead link.
