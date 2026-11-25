/** Simple line icons for the four Kernvorteile, in brochure order. */
const PATHS = [
  // Systematischer Transfer: arrow from a document to a card
  'M4 4h7v9H4zM14 8h6v12h-6zM8 17h3m0 0-2-2m2 2-2 2',
  // Interdisziplinäre Synergie: two overlapping speech bubbles
  'M3 5h11v7H8l-3 3v-3H3zM10 15h6l3 3v-3h2V8h-4',
  // Innovationsförderung: light bulb
  'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  // Strukturierte Planung: checklist
  'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
]

export function BenefitIcon({ index }: { index: number }) {
  return (
    <svg
      className="benefit__icon"
      aria-hidden="true"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[index % PATHS.length]} />
    </svg>
  )
}
