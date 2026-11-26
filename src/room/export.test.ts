import { describe, expect, it } from 'vitest'
import { toCsv } from './export'

describe('toCsv', () => {
  it('quotes, escapes and adds a BOM', () => {
    const csv = toCsv([
      ['a', 'b;c', 'd"e'],
      [1.5, null, 'x\ny'],
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1)).toBe('a;"b;c";"d""e"\r\n1,5;;"x\ny"\r\n')
  })
  it('neutralises spreadsheet formulas', () => {
    expect(toCsv([['=HYPERLINK("x")']]).slice(1)).toBe(`"'=HYPERLINK(""x"")"\r\n`)
  })
})
