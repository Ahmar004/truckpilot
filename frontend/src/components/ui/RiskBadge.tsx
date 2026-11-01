import type { ComponentProps } from 'react'
import { Badge } from './Badge'
import { CheckCircle, CloudSlash, Info, Prohibit, Warning, WarningOctagon } from './icons'
import { cn } from '../../lib/cn'
import { NO_WEATHER_LABEL, RISK_LABEL, RISK_LEVEL } from '../../lib/constants'
import type { RiskLevel } from '../../lib/constants'

// Literal class names so Tailwind sees them. A level is always icon plus label (design 3.2).
const LEVEL_STYLE = {
  [RISK_LEVEL.LOW]: { icon: CheckCircle, tone: 'bg-risk-low/15 text-risk-low' },
  [RISK_LEVEL.MODERATE]: { icon: Info, tone: 'bg-risk-moderate/15 text-risk-moderate' },
  [RISK_LEVEL.HIGH]: { icon: Warning, tone: 'bg-risk-high/15 text-risk-high' },
  [RISK_LEVEL.SEVERE]: { icon: WarningOctagon, tone: 'bg-risk-severe/15 text-risk-severe' },
  [RISK_LEVEL.NO_TRAVEL]: { icon: Prohibit, tone: 'bg-risk-no-travel/15 text-risk-no-travel' },
} as const

type RiskBadgeProps = Omit<ComponentProps<typeof Badge>, 'tone' | 'children'> & {
  /** null = No weather data */
  level: RiskLevel | null
}

/** A risk level as a tint badge with its icon and label (design 4.2). */
export function RiskBadge({ level, className, ...props }: RiskBadgeProps) {
  if (level === null) {
    return (
      <Badge className={cn('bg-risk-none/15 text-risk-none', className)} {...props}>
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
