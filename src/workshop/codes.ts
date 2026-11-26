/** Room codes: 6 characters, no look-alikes (0/O, 1/I/L). Same alphabet as create_room(). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

/** Uppercases and drops spaces/dashes, so "abc 234" and "ABC-234" both work. */
export const normalizeCode = (input: string): string => input.toUpperCase().replace(/[\s-]/g, '')

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)
export const isValidCode = (code: string): boolean => CODE_RE.test(code)

export function generateCode(random: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  return out
}

/** "ABC234" → "ABC 234" for display. */
export const formatCode = (code: string): string => (code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code)
