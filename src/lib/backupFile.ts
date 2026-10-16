import { todayIso } from './partialDate.ts'
import { parsePrivateData } from './privateData.ts'
import type { PrivateData } from './types.ts'

export function downloadBackup(data: PrivateData, now: Date = new Date()) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `marvel-watchlist-${todayIso(now)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readBackup(file: File): Promise<PrivateData> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error(`"${file.name}" isn't a JSON file.`)
  }
  return parsePrivateData(json)
}
