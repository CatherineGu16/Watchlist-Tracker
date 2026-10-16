/** Minimal RFC 4180 CSV parser: quoted fields, embedded commas/newlines, "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Rows as objects keyed by the header row found at `headerIndex`. */
export function csvRecords(text: string, headerIndex = 0): Record<string, string>[] {
  const rows = parseCsv(text)
  const header = rows[headerIndex].map((h) => h.trim())
  return rows
    .slice(headerIndex + 1)
    .filter((r) => r.some((cell) => cell.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}
