import { describe, expect, it } from 'vitest'
import { apaCitation } from './citation'

describe('apaCitation', () => {
  it('formats the brochure paper in APA 7', () => {
    expect(
      apaCitation({
        authors: ['Tobias Plank', 'Daniel Leuthe', 'Tim Meyer-Hollatz', 'Anna M. Oberländer'],
        year: 2026,
        title: 'Navigating Artificial Intelligence for Sustainability in Organizations',
        journal: 'Communications of the Association for Information Systems',
        volume: 58,
        pages: '584–618',
        doi: '10.17705/1CAIS.05824',
        url: 'https://aisel.aisnet.org/cais/vol58/iss1/33/',
      }),
    ).toBe(
      'Plank, T., Leuthe, D., Meyer-Hollatz, T., & Oberländer, A. M. (2026). Navigating Artificial Intelligence for Sustainability in Organizations. Communications of the Association for Information Systems, 58, 584–618. https://doi.org/10.17705/1CAIS.05824',
    )
  })
  it('handles a single author and hyphenated first names', () => {
    expect(
      apaCitation({
        authors: ['Jean-Paul Sartre'],
        year: 1943,
        title: 'T',
        journal: 'J',
        volume: 1,
        pages: '1',
        doi: 'x',
        url: '',
      }),
    ).toBe('Sartre, J.-P. (1943). T. J, 1, 1. https://doi.org/x')
  })
})
