#!/usr/bin/env python3
"""
Extract the FFTT "Ideation Cards – Twin Transformation" print PDF into
web-ready assets:

  public/cards/full/<card-id>-<front|back>.webp   (~900 px wide, for the viewer)
  public/cards/thumb/<card-id>-<front|back>.webp  (~300 px wide, for grids)
  src/data/cards.json                              (structured German card text)

Usage:
  pip install pymupdf pillow
  python tools/extract_cards.py source/Ideation_Cards.pdf .

Re-run whenever the editor delivers a new PDF. The page layout it expects
(118 pages, front/back alternating):

  p1–6     3 instruction cards (Anleitung)
  then 7 archetype blocks of 16 pages (8 cards) each:
           archetype, technology, organisation, activation question, 4 case studies

Text is cleaned (line-break hyphenation undone) and the known typos in the
print file are corrected in the JSON only — see CORRECTIONS and the
`meta.corrections` / `meta.contentIssues` fields of the output. The card
images are rendered as-is, so typos stay in the images until the editor
fixes the PDF.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

import pymupdf
from PIL import Image

EXPECTED_PAGES = 118
ARCHETYPE_START = 7  # 1-based page of the first archetype front
BLOCK = 16

# SDG icons are images, not text — read off the archetype backs by eye.
SDGS = {1: [9, 12, 13, 16], 2: [11, 15], 3: [11, 12], 4: [11, 12],
        5: [11, 12, 15], 6: [8, 9, 10, 12], 7: [8, 9]}

# Applied to all extracted text (not to images).
CORRECTIONS = [
    ("Insprations-Modus", "Inspirations-Modus"),
    ("Nutzten Sie", "Nutzen Sie"),
    ("ertsellt", "erstellt"),
    ("Maschienenbau", "Maschinenbau"),
    ("Univeler", "Unilever"),
    ("Ausschreibungs-unterlagen", "Ausschreibungsunterlagen"),
    ("Nachhaltigkeits-strategien", "Nachhaltigkeitsstrategien"),
    ("Kund*innen", "Kund:innen"),
    ("Nutzer*innen", "Nutzer:innen"),
    ("verbunden..", "verbunden."),
]

# The print file also has stray hyphens inside words where an earlier line
# break used to be ("Energiemanage-ment", "Prozess-daten"). A hyphen between
# two lowercase letters is removed unless the word is listed here.
KEEP_HYPHEN = {"Know-how", "semi-überwachte", "app-basierter"}
STRAY_HYPHENS_FIXED = set()

CARD_TYPES = ["archetype", "technology", "organisation", "activation"]
TAKEAWAY_KEYS = {"Technologie": "technology", "Organisation": "organisation",
                 "Nachhaltigkeit": "sustainability"}
NO_JOIN = {"und", "oder", "bzw.", "sowie", "bis"}


def _unhyphen(m):
    word = m.group(0)
    if word in KEEP_HYPHEN:
        return word
    STRAY_HYPHENS_FIXED.add(word)
    return re.sub(r"(?<=[a-zäöüß])-(?=[a-zäöüß])", "", word)


def fix(text):
    for a, b in CORRECTIONS:
        text = text.replace(a, b)
    return re.sub(r"[\wäöüÄÖÜß]*[a-zäöüß]-[a-zäöüß][\wäöüÄÖÜß-]*", _unhyphen, text)


def join_lines(lines):
    """Join wrapped lines, undoing end-of-line hyphenation but keeping real hyphens."""
    out = ""
    for ln in lines:
        ln = re.sub(r"[\u200b\u00ad\ufeff]", "", ln)  # zero-width / soft hyphens
        ln = re.sub(r"\s+", " ", ln.replace("\t", " ")).strip()
        if not ln:
            continue
        if not out:
            out = ln
            continue
        first = ln.split(" ")[0]
        if out.endswith("-"):
            prev = out[-2] if len(out) > 1 else ""
            if first in NO_JOIN:
                out += " " + ln            # "Energie- und ..."
            elif prev.islower() and ln[0].islower():
                out = out[:-1] + ln        # "Nachhal-" + "tigkeit"
            else:
                out += ln                  # "ESG-" + "Berichte", "KI-" + "gestützt"
        else:
            out += " " + ln
    return fix(re.sub(r"\s+", " ", out).strip())


def blocks(page):
    return [b[4] for b in page.get_text("blocks", sort=True) if b[6] == 0 and b[4].strip()]


def lines_of(block):
    return [l for l in block.split("\n")]


def strip_label(block, label):
    ls = lines_of(block)
    if ls and ls[0].strip().upper().startswith(label):
        ls = ls[1:]
    return ls


def front_title(page, label):
    ls = [l.strip() for l in page.get_text("text", sort=True).split("\n") if l.strip()]
    return join_lines([l for l in ls if l.lower() != label.lower()])


def parse_guide(back):
    bs = blocks(back)[1:]  # drop "ANLEITUNG"
    title = join_lines(lines_of(bs[0]))
    steps, what, when = [], "", ""
    for b in bs[1:]:
        if b.lstrip().startswith("Was:"):
            body = b.split("Was:", 1)[1]
            w, _, n = body.partition("Wann:")
            what, when = join_lines(lines_of(w)), join_lines(lines_of(n))
            continue
        ls = lines_of(b)
        if not re.match(r"^\s*\d+\.", ls[0]):
            if steps:  # indented follow-up block, e.g. the discussion questions in mode 2
                steps[-1]["subItems"].append(join_lines(ls))
            continue
        num_line = re.sub(r"^\s*\d+\.\s*", "", ls[0])
        main, subs = [num_line], []
        for l in ls[1:]:
            if l.strip().startswith("- "):
                subs.append(l.strip()[2:])
            elif subs:
                subs[-1] += "\n" + l       # wrapped sub-item
            else:
                main.append(l)
        steps.append({"text": join_lines(main),
                      "subItems": [join_lines(s.split("\n")) for s in subs]})
    return {"title": title, "steps": steps, "what": what, "when": when}


def parse_archetype_back(back):
    bs = blocks(back)[1:]
    intro, points, link, mode = [], [], [], "desc"
    for b in bs:
        if b.strip().startswith("NACHHALTIGKEITSBEZUG"):
            mode = "link"
            link += strip_label(b, "NACHHALTIGKEITSBEZUG")
            continue
        if mode == "link":
            link += lines_of(b)
            continue
        ls = strip_label(b, "BESCHREIBUNG")
        if ls and re.match(r"^\s*\d+\.", ls[0]):
            text = join_lines(ls)
            points += [re.sub(r"^\d+\.\s*", "", t) for t in re.split(r"\s(?=\d+\.\s)", text)]
        else:
            intro += ls
    return {"intro": join_lines(intro), "points": points,
            "sustainabilityLink": join_lines(link)}


def parse_paragraph_card(back, label, footer_label):
    bs = blocks(back)[1:]
    paras, footer = [], []
    for b in bs:
        if b.strip().upper().startswith(footer_label):
            footer += strip_label(b, footer_label)
        elif footer:
            footer += lines_of(b)
        else:
            paras.append(join_lines(lines_of(b)))
    return paras, join_lines(footer)


def parse_activation(back):
    bs = blocks(back)
    question, overview, in_overview = [], [], False
    for b in bs:
        s = b.strip()
        if s.startswith("AKTIVIERUNGSFRAGE"):
            question += strip_label(b, "AKTIVIERUNGSFRAGE")
            continue
        if s.startswith("ÜBERBLICK"):
            in_overview = True
            continue
        if s.startswith("•"):
            in_overview = True
            overview.append(join_lines(lines_of(s.lstrip("•"))))
        elif not in_overview:
            question += lines_of(b)
    return join_lines(question), overview


def parse_case(back):
    bs = blocks(back)
    name, summary, takeaways = "", [], {}
    for b in bs:
        s = b.strip()
        if s.startswith("FALLBEISPIEL"):
            rest = strip_label(b, "FALLBEISPIEL")
            if rest and not name:
                name = join_lines(rest)
            continue
        if s.startswith("•"):
            t = join_lines(lines_of(s.lstrip("•")))
            key, _, val = t.partition(":")
            takeaways[TAKEAWAY_KEYS.get(key.strip(), key.strip())] = val.strip()
            continue
        if not name and len(s) < 60 and "\n" not in s:
            name = join_lines([s])
            continue
        ls = [l for l in lines_of(b) if l.strip().upper() != "KEY TAKEAWAYS"]
        summary += ls
    return fix(name), join_lines(summary), takeaways


def render(doc, pno, out_full, out_thumb):
    pymupdf.TOOLS.set_icc(True)  # print file is CMYK (PDF/X-1a) — convert properly
    page = doc[pno - 1]
    for out, zoom, q in ((out_full, 3.0, 82), (out_thumb, 1.0, 78)):
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(out, "WEBP", quality=q, method=6)


def corner_colour(doc, pno):
    pymupdf.TOOLS.set_icc(True)
    pix = doc[pno - 1].get_pixmap(matrix=pymupdf.Matrix(0.5, 0.5))
    return "#%02X%02X%02X" % pix.pixel(5, 5)[:3]


def main(pdf_path, root):
    root = Path(root)
    doc = pymupdf.open(pdf_path)
    if doc.page_count != EXPECTED_PAGES:
        sys.exit(f"Expected {EXPECTED_PAGES} pages, got {doc.page_count} — card layout changed, update the script.")
    full, thumb = root / "public/cards/full", root / "public/cards/thumb"
    full.mkdir(parents=True, exist_ok=True)
    thumb.mkdir(parents=True, exist_ok=True)

    cards, archetypes = [], []

    def add(card_id, front_p, back_p, **fields):
        img = {}
        for side, p in (("front", front_p), ("back", back_p)):
            name = f"{card_id}-{side}.webp"
            render(doc, p, full / name, thumb / name)
            img[side] = {"full": f"cards/full/{name}", "thumb": f"cards/thumb/{name}"}
        cards.append({"id": card_id, **fields, "images": img, "pages": {"front": front_p, "back": back_p}})

    # Instruction cards
    mode_ids = ["inspiration-1", "inspiration-2", "strategy"]
    for i, mid in enumerate(mode_ids):
        f, b = 1 + 2 * i, 2 + 2 * i
        add(f"guide-{mid}", f, b, type="guide", archetypeId=None, mode=mid, **parse_guide(doc[b - 1]))

    # Archetype blocks
    for k in range(7):
        n = k + 1
        aid = f"a{n}"
        base = ARCHETYPE_START + BLOCK * k
        title = front_title(doc[base - 1], "Archetyp")
        colour = corner_colour(doc, base)
        arche = parse_archetype_back(doc[base])
        tech, tip = parse_paragraph_card(doc[base + 2], "TECHNOLOGIE", "TIPP")
        org, value = parse_paragraph_card(doc[base + 4], "ORGANISATION", "WERTVERSPRECHEN")
        question, overview = parse_activation(doc[base + 6])

        archetypes.append({"id": aid, "number": n, "title": title, "colour": colour, "sdgs": SDGS[n]})
        add(f"{aid}-archetype", base, base + 1, type="archetype", archetypeId=aid, title=title, **arche)
        add(f"{aid}-technology", base + 2, base + 3, type="technology", archetypeId=aid,
            title="Technologie", points=tech, tip=tip)
        add(f"{aid}-organisation", base + 4, base + 5, type="organisation", archetypeId=aid,
            title="Organisation", points=org, valueProposition=value)
        add(f"{aid}-activation", base + 6, base + 7, type="activation", archetypeId=aid,
            title="Aktivierungsfrage", question=question, caseOverview=overview)
        for c in range(4):
            f = base + 8 + 2 * c
            name, summary, takeaways = parse_case(doc[f])
            add(f"{aid}-case-{c + 1}", f, f + 1, type="case", archetypeId=aid,
                title=name, summary=summary, takeaways=takeaways)

    data = {
        "meta": {
            "title": "Ideation Cards – Twin Transformation",
            "publisher": "Fraunhofer-Forschungscampus Twin Transformation (FFTT)",
            "language": "de",
            "cardFormat": "A6, 105 × 148 mm, double-sided",
            "source": Path(pdf_path).name,
            "extracted": date.today().isoformat(),
            "corrections": [{"from": a, "to": b} for a, b in CORRECTIONS],
            "strayHyphensFixed": sorted(STRAY_HYPHENS_FIXED),
            # Not auto-fixed — content questions for the editor / authors.
            # Written for the Nov 2026 print file: review this list after a new PDF.
            "contentIssues": [
                "a1-activation: case overview names 'One Ocean Modelle', but the case card is 'Ocean Disclosure Initiative'.",
                "a3-organisation: value proposition is identical to a1-organisation ('…im Nachhaltigkeitsreporting'), although a3 is about personalised advice.",
                "a5-technology tip and a5-organisation value proposition say almost the same thing.",
                "a7-technology tip is identical to a6-technology tip (Llama 3); a7-organisation value proposition is near-identical to a6-organisation.",
                "a4-case-4: front says 'Brammibal‘s Donut', back says 'Brammibal‘s Donuts'.",
            ],
        },
        "archetypes": archetypes,
        "cards": cards,
    }
    out = root / "src/data/cards.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(cards)} cards, {len(archetypes)} archetypes → {out}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
