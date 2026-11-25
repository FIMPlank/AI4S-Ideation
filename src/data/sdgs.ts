import type { SdgId } from './types'

export interface Sdg {
  id: SdgId
  title: string
  color: string
}

/** German short titles and official UN colours. */
export const SDGS: Record<SdgId, Sdg> = {
  8: { id: 8, title: 'Menschenwürdige Arbeit und Wirtschaftswachstum', color: '#A21942' },
  9: { id: 9, title: 'Industrie, Innovation und Infrastruktur', color: '#FD6925' },
  10: { id: 10, title: 'Weniger Ungleichheiten', color: '#DD1367' },
  11: { id: 11, title: 'Nachhaltige Städte und Gemeinden', color: '#FD9D24' },
  12: { id: 12, title: 'Nachhaltige/r Konsum und Produktion', color: '#BF8B2E' },
  13: { id: 13, title: 'Maßnahmen zum Klimaschutz', color: '#3F7E44' },
  15: { id: 15, title: 'Leben an Land', color: '#56C02B' },
  16: { id: 16, title: 'Frieden, Gerechtigkeit und starke Institutionen', color: '#00689D' },
}
