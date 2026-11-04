import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Dialog } from '../components/ui/Dialog'
import { Skeleton } from '../components/ui/Skeleton'
import { StatusMessage } from '../components/ui/StatusMessage'
import { useGoogleButton } from '../hooks/useGoogleButton'
import { useSignIn } from '../hooks/useSignIn'
import { useTheme } from '../hooks/useTheme'
import {
  GOOGLE_BUTTON_STATUS,
  GOOGLE_BUTTON_WIDTH,
  ROUTE_PATH,
  SESSION_ENDED_PARAM,
  SESSION_ENDED_VALUE,
} from '../lib/constants'

const LINK_CLASS =
  'text-text-muted hover:text-text font-bold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent'

/**
 * Sign-in pop-up over the planner for a signed-out visitor (design 7, Step-14). It cannot be
 * closed: the server plans and searches only for signed-in drivers.
 */
export function SignInDialog() {
  const [params] = useSearchParams()
  const { theme } = useTheme()
  const signIn = useSignIn()
  const buttonRef = useRef<HTMLDivElement>(null)
  const status = useGoogleButton(buttonRef, theme, signIn.mutate)

  const failed = signIn.isError || status === GOOGLE_BUTTON_STATUS.FAILED
  const ended = params.get(SESSION_ENDED_PARAM) === SESSION_ENDED_VALUE

  return (
    <Dialog
      open
      onOpenChange={() => {}}
      dismissible={false}
      title="Sign in to plan your trip"
      description="Truck Pilot uses your Google account. We keep only your name, email and Google ID, and the times of your plans and searches for the usage limits."
    >
      <div className="flex flex-col items-center gap-5 text-center">
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
          <Link to={ROUTE_PATH.GUIDE} className={LINK_CLASS}>
            See how it works
          </Link>
          <Link to={ROUTE_PATH.PRIVACY} className={LINK_CLASS}>
            Privacy
          </Link>
        </div>
      </div>
    </Dialog>
  )
}
