import { ROUTE_RANK_LABELS } from './constants'

/** "1st best", "2nd best", "3rd best" for a route's rank (spec 9.4). */
export function rankLabel(rank: number): string {
  return ROUTE_RANK_LABELS[rank - 1] ?? `${rank}th best`
}
