import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** A short message under a control. Announced to screen readers when it appears. */
export function StatusMessage({
  children,
  className,
  tone = 'danger',
}: {
  children: ReactNode
  className?: string
  tone?: 'danger' | 'warning'
}) {
  return (
    <p
      role="alert"
      className={cn(
        tone === 'danger' ? 'text-danger' : 'text-warning',
        'text-center text-sm font-bold',
        className,
      )}
    >
      {children}
    </p>
  )
}
