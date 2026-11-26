import site from './site.json'

/**
 * The brochure is still a concept: its PDF is only published (copied to
 * downloads/ and linked as "Broschüre (PDF)") once this is set to true in site.json.
 */
export const brochurePdfPublic: boolean = site.brochurePdfPublic

export const BROCHURE_PDF_PATH = 'downloads/ideation-cards-broschuere.pdf'

/**
 * Miroverse template of the deck. Empty until it exists: the landing page's
 * "In Miro" tile then shows "Bald verfügbar" instead of a link.
 */
export const miroverseUrl: string = site.miroverseUrl

/**
 * Feature flag for live rooms: switches "Raum eröffnen" on the landing page from
 * "bald verfügbar" to a link. Live rooms also need VITE_SUPABASE_URL and
 * VITE_SUPABASE_PUBLISHABLE_KEY at build time (see src/room/config.ts).
 */
export const liveRoomsFlag: boolean = site.liveRooms
