import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { X } from './icons'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  /** Where the panel sits: centred pop-up, or a sheet sliding in from the left (menus). */
  side?: 'center' | 'left'
}

/** Pop-up (UIi 6.14). Esc closes and focus returns to the trigger; Radix handles both. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'center',
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out fixed inset-0 z-40 bg-black/20 backdrop-blur-xs" />
        <RadixDialog.Content
          className={cn(
            'bg-surface border-border shadow-card-hover fixed z-50 border p-6',
            side === 'center' &&
              'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg',
            side === 'left' &&
              'data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left inset-y-0 left-0 w-80 max-w-[85vw]',
          )}
        >
          <RadixDialog.Title className="text-text text-center text-2xl font-extrabold">
            {title}
          </RadixDialog.Title>
          <RadixDialog.Description
            className={description ? 'text-text-muted mt-2 text-center' : 'sr-only'}
          >
            {description ?? title}
          </RadixDialog.Description>
          <div className="mt-4">{children}</div>
          <RadixDialog.Close
            aria-label="Close"
            className="hover:bg-surface-hover absolute top-3 right-3 rounded-full p-1.5 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X aria-hidden className="size-5" />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
