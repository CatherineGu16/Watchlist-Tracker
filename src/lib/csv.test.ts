import { describe, expect, it } from 'vitest'
import { csvRecords, parseCsv } from './csv.ts'

describe('parseCsv', () => {
  it('splits plain fields and rows', () => {
    expect(parseCsv('a,b\r\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
  it('keeps commas and escaped quotes inside quoted fields', () => {
    expect(parseCsv('x,"7 seasons, 136 eps","say ""hi"""')).toEqual([['x', '7 seasons, 136 eps', 'say "hi"']])
  })
  it('keeps trailing empty fields', () => {
    expect(parseCsv('a,,\n')).toEqual([['a', '', '']])
  })
})

describe('csvRecords', () => {
  it('uses the given header row and skips blank rows', () => {
    const text = 'Last updated,,\n,,\nName,Count\nA, 1 \n,\nB,2\n'
    expect(csvRecords(text, 2)).toEqual([
      { Name: 'A', Count: '1' },
      { Name: 'B', Count: '2' },
    ])
  })
})
