import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SectionLabel } from './SectionLabel'
import { SectionLead } from './SectionLead'
import './LockSection.css'

type LockSectionProps = {
  id?: string
  /** id of the h2, for aria-labelledby. */
  titleId: string
  label: string
  title: string
  lead?: ReactNode
  /** Extra classes on the section (a pinned scene names itself here, for example `faq-ride`). */
  className?: string
  /** Extra classes on the body (the part that is clipped under the strip). */
  bodyClassName?: string
  /** Extra classes on the heading block. */
  headClassName?: string
  /** Rendered inside the body, after the heading block. */
  children?: ReactNode
  /** Replace the default body layout: render the heading yourself with `head`. */
  renderBody?: (head: ReactNode) => ReactNode
}

/**
 * A section whose heading locks under the header while the section scrolls (UIi 9.7): a slim
 * see-through strip copies the label and title, and the body is clipped at the strip's bottom
 * edge. CSS only; without scroll timelines the strip never shows.
 */
export function LockSection({
  id,
  titleId,
  label,
  title,
  lead,
  className,
  bodyClassName,
  headClassName,
  children,
  renderBody,
}: LockSectionProps) {
  const head = (
    <div className={cn('lock-head flex max-w-3xl flex-col gap-3', headClassName)}>
      <SectionLabel>{label}</SectionLabel>
      <h2
        id={titleId}
        className="wipe-in text-text text-3xl font-extrabold tracking-tight sm:text-5xl"
      >
        {title}
      </h2>
      {lead && <SectionLead>{lead}</SectionLead>}
    </div>
  )
  return (
    <section id={id} aria-labelledby={titleId} className={cn('lock-section', className)}>
      <div aria-hidden className="lock-strip">
        <div className="lock-strip-text">
          <SectionLabel>{label}</SectionLabel>
          <span className="text-text truncate text-lg font-extrabold">{title}</span>
        </div>
      </div>
      <div className={cn('lock-body', bodyClassName)}>
        {renderBody ? (
          renderBody(head)
        ) : (
          <>
            {head}
            {children}
          </>
        )}
      </div>
    </section>
  )
}
