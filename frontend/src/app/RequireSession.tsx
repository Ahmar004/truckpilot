import type { ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { StatusMessage } from '../components/ui/StatusMessage'
import { useSession } from '../hooks/useSession'
import { SignInDialog } from './SignInDialog'

/**
 * Guards the planner (design F1, Step-14): skeleton while checking; signed out, the planner shows
 * under the sign-in pop-up, which stays until the driver signs in.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { user, isLoading, isSignedOut, isError, refetch } = useSession()

  if (isSignedOut) {
    return (
      <>
        {children}
        <SignInDialog />
      </>
    )
  }
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
