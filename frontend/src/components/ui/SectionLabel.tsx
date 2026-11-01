import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** The bracketed eyebrow: `[ HOW IT WORKS ]` (UIi 6.1). */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-text-muted text-sm font-extrabold tracking-widest uppercase sm:text-base',
        className,
      )}
    >
      <span aria-hidden className="text-accent">
        [{' '}
      </span>
      {children}
      <span aria-hidden className="text-accent">
        {' '}
        ]
      </span>
    </p>
  )
}
