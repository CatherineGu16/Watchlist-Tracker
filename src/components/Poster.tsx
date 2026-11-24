import { useState, type ReactNode } from 'react'
import type { Title } from '../lib/types.ts'
import { sagaColor } from '../ui/sagas.ts'

/**
 * A title's poster at 2:3, sized by its container. A muted block holds the space while it loads
 * (so nothing jumps), and titles without one get a tile in their saga's color with the name on it.
 * `children` sit over the bottom edge: a progress bar or a watched badge.
 */
export function Poster({ title, className = '', children }: { title: Title; className?: string; children?: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const color = sagaColor(title.saga)
  const src = title.posterPath && !failed ? `${import.meta.env.BASE_URL}${title.posterPath}` : null

  return (
    <span className={`relative block aspect-[2/3] overflow-hidden rounded-lg bg-raised shadow-[0_6px_20px_rgb(0_0_0/0.35)] ${className}`}>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <span
          className="absolute inset-0 flex items-end p-2.5"
          style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${color} 55%, var(--raised)), var(--raised) 75%)` }}
        >
          <span className="line-clamp-4 font-poster text-lg leading-[1.05] tracking-wide text-fg uppercase">{title.title}</span>
        </span>
      )}
      {children}
    </span>
  )
}
