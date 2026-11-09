import { useState } from 'react'
import { measureViewport, viewportEvents, viewportSnapshots } from '../ui/viewportDebug.ts'

/** Temporary: shows screen measurements at launch next to now. Remove with ui/viewportDebug.ts. */
export function ViewportDebug() {
  const [now, setNow] = useState(measureViewport)
  const columns = [...viewportSnapshots(), { label: 'now', values: now }]
  const events = viewportEvents()

  return (
    <section className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Screen diagnostics</h3>
        <button onClick={() => setNow(measureViewport())} className="min-h-9 rounded-lg bg-raised px-3 text-sm font-bold">
          Refresh
        </button>
      </div>
      <table className="mt-2 w-full font-mono text-[0.6875rem] tabular-nums">
        <thead>
          <tr className="text-muted">
            <th className="text-left font-normal" />
            {columns.map((c) => (
              <th key={c.label} className="pl-3 text-right font-normal">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(now).map((key) => (
            <tr key={key}>
              <td className="pr-2 text-muted">{key}</td>
              {columns.map((c) => (
                <td key={c.label} className="pl-3 text-right">
                  {c.values[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-2 font-mono text-[0.6875rem] text-muted">
        {events.length === 0 ? <li>No resize or scroll events yet</li> : events.map((e, i) => <li key={i}>{e}</li>)}
      </ul>
    </section>
  )
}
