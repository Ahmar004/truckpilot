import type { DurationBucket, PlanUpdateKind, Theme, UnitSystem } from './constants'
import { ANALYTICS_EVENT, DURATION_BUCKET } from './constants'

// Sentry and PostHog (architecture 10). Both are public-key services and both no-op when their
// env var is empty. They load by dynamic import after the page is interactive, so they never
// touch the prerender (no window access at module load) or hydration, and stay out of the main
// chunk. Nothing here ever receives a trip input.

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN ?? ''
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY ?? ''
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

type SentryModule = typeof import('@sentry/react')
type PostHogClient = (typeof import('posthog-js'))['default']

let sentry: Promise<SentryModule | null> = Promise.resolve(null)
let posthog: Promise<PostHogClient | null> = Promise.resolve(null)
let started = false

/** Remove the query string and fragment from a URL. */
export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, '')
}

/** Sentry beforeSend: drop request data and strip query strings from URLs. */
export function scrubSentryEvent<T extends Record<string, unknown>>(event: T): T {
  const scrubbed: Record<string, unknown> = { ...event }
  delete scrubbed.request
  delete scrubbed.user
  const exception = scrubbed.exception as { values?: { value?: string }[] } | undefined
  if (exception?.values) {
    exception.values = exception.values.map((entry) =>
      typeof entry.value === 'string'
        ? { ...entry, value: entry.value.replace(/(https?:\/\/[^\s?#]*)[?#]\S*/g, '$1') }
        : entry,
    )
  }
  return scrubbed as T
}

/** Start Sentry and PostHog once, in the browser, after the page is interactive. */
export function initAnalytics(): void {
  if (started || typeof window === 'undefined') return
  started = true
  if (SENTRY_DSN) {
    sentry = import('@sentry/react').then((module) => {
      module.init({
        dsn: SENTRY_DSN,
        beforeSend: (event) => scrubSentryEvent(event as never) as never,
        beforeBreadcrumb: (crumb) => {
          if (crumb.data && typeof crumb.data.url === 'string') {
            crumb.data.url = stripQuery(crumb.data.url)
          }
          return crumb
        },
      })
      return module
    })
  }
  if (POSTHOG_KEY) {
    posthog = import('posthog-js').then(({ default: client }) => {
      client.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        persistence: 'localStorage+cookie',
      })
      return client
    })
  }
}

/** Report an error caught by the error boundary. */
export function reportError(error: Error): void {
  void sentry.then((module) => module?.captureException(error))
}

type EventProps = {
  [ANALYTICS_EVENT.PLAN_REQUESTED]: undefined
  [ANALYTICS_EVENT.PLAN_SUCCEEDED]: {
    route_count: number
    fewer_routes: boolean
    do_not_travel: boolean
    duration_bucket: DurationBucket
  }
  [ANALYTICS_EVENT.PLAN_FAILED]: { code: string; service: string | null }
  [ANALYTICS_EVENT.PLAN_UPDATED]: { what: PlanUpdateKind }
  [ANALYTICS_EVENT.UNITS_CHANGED]: { units: UnitSystem }
  [ANALYTICS_EVENT.THEME_CHANGED]: { theme: Theme }
  [ANALYTICS_EVENT.SLIDER_USED]: undefined
  [ANALYTICS_EVENT.CHECKPOINT_OPENED]: undefined
  [ANALYTICS_EVENT.SIGNED_IN]: undefined
  [ANALYTICS_EVENT.SIGNED_OUT]: undefined
}

/** Record one analytics event. Only the events above, with only the properties listed. */
export function track<E extends keyof EventProps>(
  event: E,
  ...args: EventProps[E] extends undefined ? [] : [props: EventProps[E]]
): void {
  const props = args[0] as Record<string, unknown> | undefined
  void posthog.then((client) => client?.capture(event, props))
}

/** Bucket a duration in ms. */
export function durationBucket(ms: number): DurationBucket {
  if (ms < 3000) return DURATION_BUCKET.UNDER_3S
  if (ms < 6000) return DURATION_BUCKET.S3_TO_6
  if (ms < 10000) return DURATION_BUCKET.S6_TO_10
  return DURATION_BUCKET.OVER_10S
}
