import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { CaretLeft, CaretRight } from '../../components/ui/icons'
import { cn } from '../../lib/cn'
import { SHEET } from '../../lib/constants'
import type { SheetHeight } from '../../lib/constants'

type BottomSheetProps = {
  height: SheetHeight
  /** Current sheet height in px (follows the finger while dragging). */
  sheetPx: number
  dragging: boolean
  handleProps: ComponentProps<'button'>
  /** Desktop side panel open or collapsed. */
  panelOpen: boolean
  isDesktop: boolean
  onTogglePanel: () => void
  children: ReactNode
}

/**
 * The container of the planner panel (design 8.1). One tree: below 48rem it is a bottom sheet with
 * a drag handle; from 48rem it is a left side panel with a collapse tab. Only the classes change.
 */
export function BottomSheet({
  height,
  sheetPx,
  dragging,
  handleProps,
  panelOpen,
  isDesktop,
  onTogglePanel,
  children,
}: BottomSheetProps) {
  const hidden = isDesktop && !panelOpen
  return (
    <div
      style={{ '--sheet-h': `${sheetPx}px` } as CSSProperties}
      className={cn(
        'fixed inset-x-0 bottom-0 z-20 h-(--sheet-h)',
        'md:inset-x-auto md:top-[4.75rem] md:bottom-(--edge) md:left-(--edge) md:h-auto md:w-(--panel-w) md:max-w-[calc(100vw-2*var(--edge))]',
        'transition-[height,translate] duration-250 ease-out md:duration-320',
        dragging && 'transition-none',
        hidden && 'md:-translate-x-[calc(100%+var(--edge))]',
      )}
    >
      <section
        aria-label="Trip planner"
        inert={hidden}
        className="bg-surface shadow-card-hover flex size-full flex-col overflow-hidden rounded-t-xl md:rounded-lg"
      >
        <button
          type="button"
          aria-label={height === SHEET.FULL ? 'Collapse panel' : 'Expand panel'}
          className="focus-visible:outline-accent flex h-8 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 md:hidden"
          {...handleProps}
        >
          <span aria-hidden className="bg-border-strong h-1.5 w-10 rounded-full" />
        </button>
        <div
          className={cn(
            'min-h-0 flex-1 px-4 pb-4 md:pt-4',
            height === SHEET.PEEK && !isDesktop ? 'overflow-hidden' : 'overflow-y-auto',
          )}
        >
          {children}
        </div>
      </section>
      <button
        type="button"
        aria-label={panelOpen ? 'Hide panel' : 'Show panel'}
        aria-expanded={panelOpen}
        onClick={onTogglePanel}
        className="bg-surface text-text-muted hover:text-text shadow-card-hover focus-visible:outline-accent absolute top-4 left-full hidden h-12 w-6 items-center justify-center rounded-r-lg focus-visible:outline-2 md:flex"
      >
        {panelOpen ? <CaretLeft aria-hidden size={16} /> : <CaretRight aria-hidden size={16} />}
      </button>
    </div>
  )
}
