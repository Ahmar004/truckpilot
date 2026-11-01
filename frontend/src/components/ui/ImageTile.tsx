import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '../../lib/cn'
import { RoundArrow } from './PillLink'

type ImageTileProps = {
  to: string
  title: string
  blurb?: string
  meta?: string
  /** The picture, usually a SpriteArt. */
  art: ReactNode
  large?: boolean
  className?: string
}

/** Picture-first link card: the picture in a soft frame, text underneath (UIi 6.8). */
export function ImageTile({ to, title, blurb, meta, art, large, className }: ImageTileProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex h-full flex-col gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
        className,
      )}
    >
      <span className="border-border bg-surface shadow-card group-hover:shadow-card-hover block overflow-hidden rounded-lg border transition-all duration-300 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 [&>svg]:transition-transform [&>svg]:duration-500 group-hover:[&>svg]:scale-105 group-focus-visible:[&>svg]:scale-105">
        {art}
      </span>
      <span className="flex items-start justify-between gap-3 px-1">
        <span className="flex flex-col gap-1">
          {meta && <span className="text-text-muted text-xs font-semibold">{meta}</span>}
          <span
            className={cn(
              'text-text font-display font-extrabold',
              large ? 'text-2xl sm:text-3xl' : 'text-lg',
            )}
          >
            {title}
          </span>
          {blurb && <span className="text-text-muted text-sm">{blurb}</span>}
        </span>
        <RoundArrow size="sm" className="mt-1" />
      </span>
    </Link>
  )
}
