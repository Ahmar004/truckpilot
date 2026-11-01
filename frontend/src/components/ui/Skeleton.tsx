import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

/** Loading placeholder. Give it the same size as the content it stands for (CLS 0). */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--surface-hover)_0%,color-mix(in_oklab,var(--surface-hover),var(--surface)_70%)_50%,var(--surface-hover)_100%)]',
        className,
      )}
      {...props}
    />
  )
}
