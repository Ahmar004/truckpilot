import { useRef } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Card } from '../../components/ui/Card'
import { SectionLabel } from '../../components/ui/SectionLabel'
import { Skeleton } from '../../components/ui/Skeleton'
import { StatusMessage } from '../../components/ui/StatusMessage'
import { useGoogleButton } from '../../hooks/useGoogleButton'
import { useSession } from '../../hooks/useSession'
import { useSignIn } from '../../hooks/useSignIn'
import { useTheme } from '../../hooks/useTheme'
import {
  GOOGLE_BUTTON_STATUS,
  GOOGLE_BUTTON_WIDTH,
  ROUTE_PATH,
  SESSION_ENDED_PARAM,
  SESSION_ENDED_VALUE,
} from '../../lib/constants'

const LINK_CLASS =
  'text-text-muted hover:text-text font-bold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent'

/** Sign-in page (design 7). */
export function SignIn() {
  const [params] = useSearchParams()
  const { user } = useSession()
  const { theme } = useTheme()
  const signIn = useSignIn()
  const buttonRef = useRef<HTMLDivElement>(null)
  const status = useGoogleButton(buttonRef, theme, signIn.mutate)

  if (user) return <Navigate to={ROUTE_PATH.PLAN} replace />

  const failed = signIn.isError || status === GOOGLE_BUTTON_STATUS.FAILED
  const ended = params.get(SESSION_ENDED_PARAM) === SESSION_ENDED_VALUE

  return (
    <div className="flex justify-center px-(--edge) py-16">
      <Card className="flex w-full max-w-sm flex-col items-center gap-5 p-6 text-center">
        <SectionLabel>SIGN IN</SectionLabel>
        <h1 className="text-text text-3xl font-extrabold tracking-tight">
          Sign in to plan your trip
        </h1>
        <p className="text-text-muted">
          Truck Pilot uses your Google account. We keep only your name, email and Google ID, and the
          times of your plans and searches for the usage limits.
        </p>
        <div className="flex min-h-10 w-full flex-col items-center justify-center">
          {status === GOOGLE_BUTTON_STATUS.LOADING && (
            <Skeleton className="h-10 rounded-full" style={{ width: GOOGLE_BUTTON_WIDTH }} />
          )}
          <div ref={buttonRef} />
        </div>
        {failed ? (
          <StatusMessage>Sign-in failed. Try again.</StatusMessage>
        ) : ended ? (
          <StatusMessage>Your session ended. Sign in again.</StatusMessage>
        ) : null}
        <div className="flex items-center gap-6">
          <Link to={ROUTE_PATH.HOME} className={LINK_CLASS}>
            Back to home
          </Link>
          <Link to={ROUTE_PATH.PRIVACY} className={LINK_CLASS}>
            Privacy
          </Link>
        </div>
      </Card>
    </div>
  )
}
