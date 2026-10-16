import { describe, expect, it } from 'vitest'
import { isOnOrBefore, isPartialDate, parseUsDate, parseWatchCell, precisionOf, todayIso } from './partialDate.ts'

describe('parseUsDate', () => {
  it('converts M/D/YYYY to ISO', () => {
    expect(parseUsDate('7/14/2000')).toBe('2000-07-14')
    expect(parseUsDate('12/17/2027')).toBe('2027-12-17')
  })
  it('returns null for non-dates', () => {
    expect(parseUsDate('Fall 2026 (TBA)')).toBeNull()
    expect(parseUsDate('')).toBeNull()
    expect(parseUsDate('13/01/2020')).toBeNull()
  })
})

describe('parseWatchCell', () => {
  it('handles empty cells', () => {
    expect(parseWatchCell('')).toEqual([])
    expect(parseWatchCell('  ')).toEqual([])
  })
  it('handles a full date', () => {
    expect(parseWatchCell('08/11/2026')).toEqual([{ start: null, end: '2026-08-11', approximate: false }])
  })
  it('handles year-only and approximate years', () => {
    expect(parseWatchCell('2020')).toEqual([{ start: null, end: '2020', approximate: false }])
    expect(parseWatchCell('2021?')).toEqual([{ start: null, end: '2021', approximate: true }])
  })
  it('splits comma lists into separate watches', () => {
    expect(parseWatchCell('2021, 2026')).toEqual([
      { start: null, end: '2021', approximate: false },
      { start: null, end: '2026', approximate: false },
    ])
  })
  it('handles ranges where the start borrows the end year', () => {
    expect(parseWatchCell('03/04 - 03/15/2024')).toEqual([{ start: '2024-03-04', end: '2024-03-15', approximate: false }])
  })
  it('rolls the start back a year when a range crosses New Year', () => {
    expect(parseWatchCell('12/28 - 01/03/2027')).toEqual([{ start: '2026-12-28', end: '2027-01-03', approximate: false }])
  })
  it('handles open-ended ranges as in progress', () => {
    expect(parseWatchCell('2021 - ')).toEqual([{ start: '2021', end: null, approximate: false }])
  })
  it('rejects text it cannot read instead of guessing', () => {
    expect(() => parseWatchCell('sometime')).toThrow(/Unrecognized/)
  })
})

describe('partial date helpers', () => {
  it('validates partial ISO dates', () => {
    expect(isPartialDate('2021')).toBe(true)
    expect(isPartialDate('2021-09')).toBe(true)
    expect(isPartialDate('2021-09-18')).toBe(true)
    expect(isPartialDate('2021-13')).toBe(false)
    expect(isPartialDate('21-09-18')).toBe(false)
  })
  it('reports precision', () => {
    expect(precisionOf('2021')).toBe('year')
    expect(precisionOf('2021-09')).toBe('month')
    expect(precisionOf('2021-09-18')).toBe('day')
  })
  it('treats a year or month as reached on its first day', () => {
    expect(isOnOrBefore('2027-03', '2027-03-01')).toBe(true)
    expect(isOnOrBefore('2027-03', '2027-02-28')).toBe(false)
    expect(isOnOrBefore('2026', '2026-10-16')).toBe(true)
  })
  it('formats today in local time', () => {
    expect(todayIso(new Date(2026, 9, 16, 23, 30))).toBe('2026-10-16')
  })
})
