import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SectionLabel } from './SectionLabel'
import { SectionLead } from './SectionLead'

type PageIntroProps = {
  label: string
  title: ReactNode
  lead?: ReactNode
  className?: string
}

/** Top of a page: label, the page's one h1 and one lead (UIi 6.4). Centred from lg. */
export function PageIntro({ label, title, lead, className }: PageIntroProps) {
  return (
    <div className={cn('flex flex-col gap-3 lg:items-center lg:text-center', className)}>
      <SectionLabel>{label}</SectionLabel>
      <h1 className="text-text text-4xl font-extrabold tracking-tight sm:text-6xl">{title}</h1>
      {lead && <SectionLead className="max-w-2xl">{lead}</SectionLead>}
    </div>
  )
}
