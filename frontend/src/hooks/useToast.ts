import { createContext, useContext } from 'react'

/** An optional button on a toast, such as Retry. */
export interface ToastAction {
  label: string
  run: () => void
}

export type ShowToast = (title: string, description?: string, action?: ToastAction) => void

export const ToastContext = createContext<ShowToast | null>(null)

/** Show a confirming toast (UIi 6.15). Must be used inside AppProviders. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside AppProviders')
  return show
}
