import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { UnitSystem } from '../../lib/constants'
import type { Route } from '../../lib/types'
import { RouteCard } from './RouteCard'

type RouteCardListProps = {
  routes: Route[]
  routeId: string | null
  units: UnitSystem
  onSelectRoute: (routeId: string) => void
}

const MOVE_KEYS: Record<string, number> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
}

/** The route cards as one single-choice group; arrow keys move the choice (design 8.3). */
export function RouteCardList({ routes, routeId, units, onSelectRoute }: RouteCardListProps) {
  const cards = useRef<(HTMLDivElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    const step = MOVE_KEYS[event.key]
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      onSelectRoute(routes[index].id)
      return
    }
    if (!step) return
    event.preventDefault()
    const next = (index + step + routes.length) % routes.length
    onSelectRoute(routes[next].id)
    cards.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Routes" className="flex flex-col gap-3">
      {routes.map((route, index) => (
        <RouteCard
          key={route.id}
          ref={(node) => {
            cards.current[index] = node
          }}
          route={route}
          selected={route.id === routeId}
          units={units}
          onSelect={() => onSelectRoute(route.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        />
      ))}
    </div>
  )
}
