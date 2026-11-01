import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SectionLabel } from './SectionLabel'
import { SectionLead } from './SectionLead'

type SectionHeadingProps = {
  label: string
  title: ReactNode
  lead?: ReactNode
  id?: string
  className?: string
}

/** Label, h2 and lead together (UIi 6.3). */
export function SectionHeading({ label, title, lead, id, className }: SectionHeadingProps) {
  return (
    <div className={cn('flex max-w-3xl flex-col gap-3', className)}>
      <SectionLabel>{label}</SectionLabel>
      <h2 id={id} className="text-text text-3xl font-extrabold tracking-tight sm:text-5xl">
        {title}
      </h2>
      {lead && <SectionLead>{lead}</SectionLead>}
    </div>
  )
}
