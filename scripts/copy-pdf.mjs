// Copies the print PDFs from source/ to public/downloads/ under stable names,
// so download links survive new PDFs with different file names.
// The brochure PDF is only copied when src/config/site.json has brochurePdfPublic: true.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

function onePdf(dir) {
  const pdfs = existsSync(dir) ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')) : []
  if (pdfs.length !== 1) {
    console.error(`copy-pdf: expected exactly one PDF in ${dir}/, found ${pdfs.length}`)
    process.exit(1)
  }
  return join(dir, pdfs[0])
}

mkdirSync('public/downloads', { recursive: true })

const cards = onePdf('source')
copyFileSync(cards, 'public/downloads/ideation-cards-twin-transformation.pdf')
console.log(`copy-pdf: ${cards} → downloads/ideation-cards-twin-transformation.pdf`)

const { brochurePdfPublic } = JSON.parse(readFileSync('src/config/site.json', 'utf8'))
const brochureTarget = 'public/downloads/ideation-cards-broschuere.pdf'
if (brochurePdfPublic) {
  const brochure = onePdf('source/brochure')
  copyFileSync(brochure, brochureTarget)
  console.log(`copy-pdf: ${brochure} → downloads/ideation-cards-broschuere.pdf`)
} else {
  rmSync(brochureTarget, { force: true })
  console.log('copy-pdf: brochure PDF not published (brochurePdfPublic = false)')
}
