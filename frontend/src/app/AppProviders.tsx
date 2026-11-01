import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastStack } from '../components/ui/Toast'
import type { ToastMessage } from '../components/ui/Toast'
import { ToastContext } from '../hooks/useToast'
import type { ShowToast } from '../hooks/useToast'
import { useSessionEndedRedirect } from '../hooks/useSessionEndedRedirect'

/** Mounts inside the query provider so the redirect hook can reach the client. */
function SessionWatcher() {
  useSessionEndedRedirect()
  return null
}

/** TanStack Query and toasts. Theme and units are hooks on the page and storage, not providers. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nextId = useRef(0)

  const showToast = useCallback<ShowToast>((title, description, action) => {
    nextId.current += 1
    const id = nextId.current
    setToasts((current) => [...current, { id, title, description, action }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <SessionWatcher />
      <ToastContext.Provider value={showToast}>
        <ToastStack toasts={toasts} onDismiss={dismiss}>
          {children}
        </ToastStack>
      </ToastContext.Provider>
    </QueryClientProvider>
  )
}
