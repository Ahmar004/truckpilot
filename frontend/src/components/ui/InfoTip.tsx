import * as Tooltip from '@radix-ui/react-tooltip'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Info } from './icons'

type InfoTipProps = {
  /** The term it explains, for the button's name: "What is Interval?" */
  term: string
  children: ReactNode
}

/**
 * A small "i" button with a plain-language note (Step-14b). The note opens on hover or keyboard
 * focus (Radix Tooltip). A mouse click keeps it open (the pointer is already over it); a tap or
 * Enter toggles it, so it works on touch screens too. Esc or a tap elsewhere closes it.
 */
export function InfoTip({ term, children }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <button
            ref={trigger}
            type="button"
            aria-label={`What is ${term}?`}
            // Radix closes a tooltip on click; here it opens or toggles it instead.
            onClick={(event) => {
              event.preventDefault()
              const mouse = (event.nativeEvent as PointerEvent).pointerType === 'mouse'
              setOpen((current) => mouse || !current)
            }}
            className="text-text-muted hover:text-text focus-visible:outline-accent grid size-6 place-items-center rounded-full focus-visible:outline-2"
          >
            <Info aria-hidden size={16} weight="bold" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            sideOffset={6}
            collisionPadding={12}
            // A tap on the button itself is a toggle, not a tap elsewhere.
            onPointerDownOutside={(event) => {
              if (trigger.current?.contains(event.target as Node)) event.preventDefault()
            }}
            className="bg-surface text-text border-border shadow-card-hover z-50 max-w-64 rounded-lg border px-3 py-2 text-sm"
          >
            {children}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
