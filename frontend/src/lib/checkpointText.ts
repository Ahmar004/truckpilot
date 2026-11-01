import { CAUSE_ORDER } from './constants'
import type { Cause } from './constants'

/** "wind", "wind and snow", "wind, rain and snow" (design 8.4). */
export function joinCauses(causes: readonly Cause[]): string {
  const named = CAUSE_ORDER.filter((cause) => causes.includes(cause))
  if (named.length <= 1) return named.join('')
  return `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
}
