import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** The one sentence under a heading (UIi 6.2). */
export function SectionLead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-text-muted text-xl sm:text-2xl', className)}>{children}</p>
}
