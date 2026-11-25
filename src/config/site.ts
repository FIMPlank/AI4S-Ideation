import site from './site.json'

/**
 * The brochure is still a concept: its PDF is only published (copied to
 * downloads/ and linked as "Broschüre (PDF)") once this is set to true in site.json.
 */
export const brochurePdfPublic: boolean = site.brochurePdfPublic

export const BROCHURE_PDF_PATH = 'downloads/ideation-cards-broschuere.pdf'
