// Copies the print PDF from source/ to public/downloads/ under a stable name,
// so the "PDF herunterladen" link survives a new PDF with a different file name.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const TARGET = 'public/downloads/ideation-cards-twin-transformation.pdf'
const pdfs = readdirSync('source').filter((f) => f.toLowerCase().endsWith('.pdf'))
if (pdfs.length !== 1) {
  console.error(`copy-pdf: expected exactly one PDF in source/, found ${pdfs.length}`)
  process.exit(1)
}
mkdirSync('public/downloads', { recursive: true })
copyFileSync(join('source', pdfs[0]), TARGET)
console.log(`copy-pdf: ${pdfs[0]} → ${TARGET}`)
