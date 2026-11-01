import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** A short message under a control. Announced to screen readers when it appears. */
export function StatusMessage({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p role="alert" className={cn('text-danger text-center text-sm font-bold', className)}>
      {children}
    </p>
  )
}
