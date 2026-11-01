import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { StatusMessage } from '../components/ui/StatusMessage'
import { useSession } from '../hooks/useSession'
import { ROUTE_PATH } from '../lib/constants'

/** Guards the planner: skeleton while checking, sign-in page when signed out (design F1). */
export function RequireSession({ children }: { children: ReactNode }) {
  const { user, isLoading, isSignedOut, isError, refetch } = useSession()

  if (isSignedOut) return <Navigate to={ROUTE_PATH.SIGN_IN} replace />
  if (isError && !user) {
    return (
      <div className="flex flex-col items-center gap-4 px-(--edge) py-16">
        <StatusMessage>We could not check your sign-in.</StatusMessage>
        <Button onClick={() => void refetch()}>Retry</Button>
      </div>
    )
  }
  if (isLoading || !user) {
    return (
      <div className="px-(--edge) py-8">
        <Skeleton className="h-12 w-full max-w-sm" />
      </div>
    )
  }
  return <>{children}</>
}
