import { createContext, useContext } from 'react'

export type ShowToast = (title: string, description?: string) => void

export const ToastContext = createContext<ShowToast | null>(null)

/** Show a confirming toast (UIi 6.15). Must be used inside AppProviders. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside AppProviders')
  return show
}
