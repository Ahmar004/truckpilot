import * as RadixToast from '@radix-ui/react-toast'
import type { ReactNode } from 'react'

export type ToastMessage = {
  id: number
  title: string
  description?: string
  action?: { label: string; run: () => void }
}

type ToastStackProps = {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
  /** Wrap the app (or the part that can show toasts). */
  children?: ReactNode
}

/** Toast provider, items and viewport (UIi 6.15). The list lives in the caller. */
export function ToastStack({ toasts, onDismiss, children }: ToastStackProps) {
  return (
    <RadixToast.Provider swipeDirection="right" duration={5000}>
      {children}
      {toasts.map((toast) => (
        <RadixToast.Root
          key={toast.id}
          onOpenChange={(open) => {
            if (!open) onDismiss(toast.id)
          }}
          className="border-border border-l-accent bg-surface shadow-card-hover data-[state=open]:animate-slide-in-right data-[state=closed]:animate-fade-out rounded-lg border border-l-4 p-4"
        >
          <RadixToast.Title className="text-text text-sm font-bold">{toast.title}</RadixToast.Title>
          {toast.description && (
            <RadixToast.Description className="text-text-muted mt-1 text-sm">
              {toast.description}
            </RadixToast.Description>
          )}
          {toast.action && (
            <RadixToast.Action
              altText={toast.action.label}
              onClick={toast.action.run}
              className="text-accent hover:bg-surface-hover focus-visible:outline-accent mt-2 inline-flex h-8 items-center rounded-full border border-current px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {toast.action.label}
            </RadixToast.Action>
          )}
        </RadixToast.Root>
      ))}
      <RadixToast.Viewport className="fixed right-0 bottom-0 z-[100] m-0 flex w-full max-w-sm list-none flex-col gap-2 p-4 outline-none" />
    </RadixToast.Provider>
  )
}
