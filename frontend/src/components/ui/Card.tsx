import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

/** A box for data only (UIi 6.11). A card that holds one big link lifts on hover. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'border-border bg-surface shadow-card rounded-lg border has-[>a]:hover:-translate-y-0.5 has-[>a]:hover:border-accent/40 has-[>a]:hover:shadow-card-hover',
        className,
      )}
      {...props}
    />
  )
}
