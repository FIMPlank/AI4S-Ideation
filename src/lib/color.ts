function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const ch = channels(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Same values as --ink and --white in src/styles/tokens.css. */
export const INK = '#16202a'
export const WHITE = '#ffffff'
/** WCAG AA for normal-size text. */
export const AA = 4.5

/** White or ink, whichever reads better on the given background. */
export function textOn(bg: string): string {
  return contrast(bg, WHITE) >= contrast(bg, INK) ? WHITE : INK
}

const hex2 = (v: number) =>
  Math.round(Math.max(0, Math.min(255, v)))
    .toString(16)
    .padStart(2, '0')

/** Mixes the colour towards black by `amount` (0–1). */
export function darken(hex: string, amount: number): string {
  return `#${channels(hex)
    .map((v) => hex2(v * (1 - amount)))
    .join('')}`
}

/**
 * Background and text colour for text on an archetype colour (design/landing/README.md):
 * colours designed for white text (white reaches at least 3:1) keep white text and are
 * darkened just enough for AA (a4 → close to --green-text); light colours get ink.
 */
export function archetypeSurface(colour: string): { bg: string; fg: string } {
  if (contrast(colour, WHITE) < 3) return { bg: colour, fg: INK }
  let bg = colour
  for (let i = 1; contrast(bg, WHITE) < AA && i <= 20; i++) bg = darken(colour, i * 0.02)
  return { bg, fg: WHITE }
}
