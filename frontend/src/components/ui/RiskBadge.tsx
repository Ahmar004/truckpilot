import type { ComponentProps } from 'react'
import { Badge } from './Badge'
import { CheckCircle, CloudSlash, Info, Prohibit, Warning, WarningOctagon } from './icons'
import { cn } from '../../lib/cn'
import { NO_WEATHER_LABEL, RISK_LABEL, RISK_LEVEL } from '../../lib/constants'
import type { RiskLevel } from '../../lib/constants'

// Literal class names so Tailwind sees them. A level is always icon plus label (design 3.2).
const LEVEL_STYLE = {
  [RISK_LEVEL.LOW]: {
    icon: CheckCircle,
    tone: 'bg-[color-mix(in_srgb,var(--risk-low)_12%,var(--surface))] text-risk-low',
  },
  [RISK_LEVEL.MODERATE]: {
    icon: Info,
    tone: 'bg-[color-mix(in_srgb,var(--risk-moderate)_12%,var(--surface))] text-risk-moderate',
  },
  [RISK_LEVEL.HIGH]: {
    icon: Warning,
    tone: 'bg-[color-mix(in_srgb,var(--risk-high)_12%,var(--surface))] text-risk-high',
  },
  [RISK_LEVEL.SEVERE]: {
    icon: WarningOctagon,
    tone: 'bg-[color-mix(in_srgb,var(--risk-severe)_12%,var(--surface))] text-risk-severe',
  },
  [RISK_LEVEL.NO_TRAVEL]: {
    icon: Prohibit,
    tone: 'bg-[color-mix(in_srgb,var(--risk-no-travel)_12%,var(--surface))] text-risk-no-travel',
  },
} as const

type RiskBadgeProps = Omit<ComponentProps<typeof Badge>, 'tone' | 'children'> & {
  /** null = No weather data */
  level: RiskLevel | null
}

/** A risk level as a tint badge with its icon and label (design 4.2). */
export function RiskBadge({ level, className, ...props }: RiskBadgeProps) {
  if (level === null) {
    return (
      <Badge
        className={cn(
          'bg-[color-mix(in_srgb,var(--risk-none)_12%,var(--surface))] text-risk-none',
          className,
        )}
        {...props}
      >
        <CloudSlash aria-hidden size={14} weight="bold" />
        {NO_WEATHER_LABEL}
      </Badge>
    )
  }
  const { icon: Icon, tone } = LEVEL_STYLE[level]
  return (
    <Badge className={cn(tone, className)} {...props}>
      <Icon aria-hidden size={14} weight="bold" />
      {RISK_LABEL[level]}
    </Badge>
  )
}
