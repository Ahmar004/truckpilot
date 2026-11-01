import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  GOOGLE_BUTTON_STATUS,
  GOOGLE_BUTTON_WIDTH,
  GOOGLE_SCRIPT_URL,
  THEME,
} from '../lib/constants'
import type { GoogleButtonStatus, Theme } from '../lib/constants'

let scriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GOOGLE_SCRIPT_URL
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        script.remove()
        scriptPromise = null // allow a later visit to try again
        reject(new Error('Google script failed to load'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

/**
 * Loads Google Identity Services (only where this hook is used), initializes it and draws
 * Google's button into `containerRef`. Everything runs in effects, so prerender is safe.
 */
export function useGoogleButton(
  containerRef: RefObject<HTMLDivElement | null>,
  theme: Theme,
  onCredential: (credential: string) => void,
): GoogleButtonStatus {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const [status, setStatus] = useState<GoogleButtonStatus>(GOOGLE_BUTTON_STATUS.LOADING)
  const callbackRef = useRef(onCredential)
  useEffect(() => {
    callbackRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadGoogleScript().then(
      () => {
        if (cancelled) return
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current(response.credential),
        })
        setStatus(GOOGLE_BUTTON_STATUS.READY)
      },
      () => {
        if (!cancelled) setStatus(GOOGLE_BUTTON_STATUS.FAILED)
      },
    )
    return () => {
      cancelled = true
    }
  }, [clientId])

  useEffect(() => {
    const container = containerRef.current
    if (status !== GOOGLE_BUTTON_STATUS.READY || !container) return
    container.replaceChildren()
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: theme === THEME.DARK ? 'filled_black' : 'outline',
      text: 'signin_with',
      size: 'large',
      width: GOOGLE_BUTTON_WIDTH,
    })
  }, [status, theme, containerRef])

  return clientId ? status : GOOGLE_BUTTON_STATUS.FAILED
}
