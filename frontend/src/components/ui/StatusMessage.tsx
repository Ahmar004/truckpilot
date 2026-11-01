import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const TONE_CLASS = {
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-text-muted',
} as const

const TINT_CLASS = {
  danger: 'bg-danger/10',
  warning: 'bg-warning/10',
  info: 'bg-text-muted/10',
} as const

type StatusMessageProps = {
  children: ReactNode
  className?: string
  tone?: keyof typeof TONE_CLASS
  /** With an icon or an action the message becomes a tinted box (design 4.2). */
  icon?: ReactNode
  action?: ReactNode
  /** Notes use "status"; errors keep the default "alert". */
  role?: 'alert' | 'status'
}

/** A short message under a control. Announced to screen readers when it appears. */
export function StatusMessage({
  children,
  className,
  tone = 'danger',
  icon,
  action,
  role = 'alert',
}: StatusMessageProps) {
  if (!icon && !action) {
    return (
      <p role={role} className={cn(TONE_CLASS[tone], 'text-center text-sm font-bold', className)}>
        {children}
      </p>
    )
  }
  return (
    <div
      role={role}
      className={cn(
        TINT_CLASS[tone],
        TONE_CLASS[tone],
        'flex flex-col items-start gap-2 rounded-lg p-3 text-sm',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <div className="font-bold">{children}</div>
      </div>
      {action}
    </div>
  )
}
