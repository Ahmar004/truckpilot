import { ROUTE_RANK_LABELS, ROUTE_RANK_SHORT } from './constants'

/** "1st best", "2nd best", "3rd best" for a route's rank (spec 9.4). */
export function rankLabel(rank: number): string {
  return ROUTE_RANK_LABELS[rank - 1] ?? `${rank}th best`
}

/** "1st", "2nd", "3rd": the chip label when the map is zoomed far out (Step-14b). */
export function shortRankLabel(rank: number): string {
  return ROUTE_RANK_SHORT[rank - 1] ?? `${rank}th`
}
