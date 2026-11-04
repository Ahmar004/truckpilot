import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type FloatingHeaderProps = {
  left: ReactNode
  right?: ReactNode
  className?: string
}

/** The floating pill header (UIi 5.3): sticky, translucent, one row at every width. */
export function FloatingHeader({ left, right, className }: FloatingHeaderProps) {
  return (
    <header className={cn('sticky top-0 z-30 px-2 pt-2 sm:px-6 sm:pt-3 lg:px-8', className)}>
      <div className="bg-surface/75 border-border/70 shadow-card flex h-14 flex-nowrap items-center justify-between gap-2 rounded-full border px-2 backdrop-blur-md sm:px-3">
        <div className="flex min-w-0 items-center gap-2">{left}</div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">{right}</div>
      </div>
    </header>
  )
}
