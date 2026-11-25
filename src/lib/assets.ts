/** URL of a file in public/, relative to the deployed base (works under any subpath). */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

/** Copied from source/*.pdf by scripts/copy-pdf.mjs. */
export const PDF_PATH = 'downloads/ideation-cards-twin-transformation.pdf'
