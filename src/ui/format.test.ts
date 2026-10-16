import { describe, expect, it } from 'vitest'
import { daysUntil, formatCountdown, formatDate, formatRange, formatWatch } from './format.ts'

describe('formatDate', () => {
  it('shows only as much precision as the date has', () => {
    expect(formatDate('2018-06-19')).toBe('Jun 19, 2018')
    expect(formatDate('2021-09')).toBe('Sep 2021')
    expect(formatDate('2021')).toBe('2021')
  })
})

describe('formatRange', () => {
  it('collapses shared month and year', () => {
    expect(formatRange('2024-03-04', '2024-03-15')).toBe('Mar 4 – 15, 2024')
    expect(formatRange('2024-03-30', '2024-04-05')).toBe('Mar 30 – Apr 5, 2024')
    expect(formatRange('2024-12-28', '2025-01-03')).toBe('Dec 28, 2024 – Jan 3, 2025')
    expect(formatRange('2019', '2020-02-01')).toBe('2019 – Feb 1, 2020')
    expect(formatRange('2024-03-04', '2024-03-04')).toBe('Mar 4, 2024')
  })
})

describe('formatWatch', () => {
  const w = (startDate: string | null, endDate: string | null, approximate = false) => ({ startDate, endDate, approximate })
  it('covers every watch shape', () => {
    expect(formatWatch(w(null, null))).toBe('Date unknown')
    expect(formatWatch(w('2022', null))).toBe('Started 2022')
    expect(formatWatch(w(null, '2019', true))).toBe('~2019')
    expect(formatWatch(w('2024-03-04', '2024-03-04'))).toBe('Mar 4, 2024')
  })
})

describe('countdowns', () => {
  it('counts days and words them', () => {
    expect(daysUntil('2026-12-18', '2026-10-16')).toBe(63)
    expect(formatCountdown('2026-10-17', '2026-10-16')).toBe('Out tomorrow')
    expect(formatCountdown('2026-11-01', '2026-10-16')).toBe('Out in 16 days')
    expect(formatCountdown('2026-12-18', '2026-10-16')).toBe('Out Dec 18, 2026')
    expect(formatCountdown('2027-03', '2026-10-16')).toBe('Coming Mar 2027')
  })
})
