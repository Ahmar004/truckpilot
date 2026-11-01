import type { ApiError } from './api'
import { ERROR_CODE, PROVIDER_SERVICE_NAME } from './constants'
import type { ProviderService } from './constants'
import { formatDuration } from './units'

/** "Try again in 25 minutes" under 60; "Try again in 14 h 5 min" from 60 (design 8.6). */
export function retryText(minutes: number): string {
  const m = Math.max(1, Math.round(minutes))
  if (m < 60) return `Try again in ${m} ${m === 1 ? 'minute' : 'minutes'}`
  return `Try again in ${formatDuration(m)}`
}

/** "Search limit reached. Try again in N minutes." (design 8.6) */
export function searchLimitText(minutes: number): string {
  return `Search limit reached. ${retryText(minutes)}.`
}

/** "Limit reached. Try again in N minutes." for the plan and update limits (design 8.6). */
export function planLimitText(minutes: number): string {
  return `Limit reached. ${retryText(minutes)}.`
}

/** "[Service] daily limit reached. Try again tomorrow." for a provider's daily budget (design 8.6). */
export function budgetLimitText(service: ProviderService): string {
  return `${PROVIDER_SERVICE_NAME[service]} daily limit reached. Try again tomorrow.`
}

/** What the toast says when an interval or HOS change fails (design 8.6, Update failed). */
export function updateFailureText(
  error: Pick<ApiError, 'code' | 'service' | 'retryAfterMin'>,
): string {
  if (error.code === ERROR_CODE.RATE_LIMITED) return planLimitText(error.retryAfterMin ?? 1)
  if (error.code === ERROR_CODE.PROVIDER_BUDGET && error.service)
    return budgetLimitText(error.service)
  const name = error.service ? PROVIDER_SERVICE_NAME[error.service] : 'Service'
  return `${name} unavailable.`
}
