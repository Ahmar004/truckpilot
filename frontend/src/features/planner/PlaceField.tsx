import { useId, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { MapPin } from '../../components/ui/plannerIcons'
import { cn } from '../../lib/cn'
import { searchLimitText } from '../../lib/limitText'
import type { Place } from '../../lib/types'
import { PLACE_SEARCH_STATUS, usePlaceSearch } from './usePlaceSearch'

type PlaceFieldProps = {
  label: string
  /** The picked place, or null. */
  value: Place | null
  onChange: (place: Place | null) => void
  error?: string
  disabled?: boolean
  placeholder?: string
  /** "Choose on map" (Step-14b): starts or stops picking this field's place on the map. */
  onChooseOnMap?: () => void
  choosing?: boolean
}

const NO_ACTIVE = -1

/**
 * Labelled combobox (design 4.2): type 2+ characters, arrow keys and Enter pick, Esc closes.
 * Shows the picked place; typing after a pick clears it. The search itself is in `usePlaceSearch`.
 */
export function PlaceField({
  label,
  value,
  onChange,
  error,
  disabled,
  placeholder = 'City or address',
  onChooseOnMap,
  choosing = false,
}: PlaceFieldProps) {
  const id = useId()
  const listId = `${id}-list`
  const errorId = `${id}-error`
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(NO_ACTIVE)

  const shown = value ? value.label : text
  const search = usePlaceSearch(open && !value ? text : '')
  const options = search.places
  const hasOptions = search.status === PLACE_SEARCH_STATUS.RESULTS
  const showPanel = open && !value && search.status !== PLACE_SEARCH_STATUS.IDLE
  const activeId = hasOptions && active >= 0 ? `${id}-option-${active}` : undefined

  const close = () => {
    setOpen(false)
    setActive(NO_ACTIVE)
  }

  const pick = (place: Place) => {
    setText(place.label)
    onChange(place)
    close()
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value)
    if (value) onChange(null) // typing after a pick clears the pick
    setOpen(true)
    setActive(NO_ACTIVE)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!hasOptions) return
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + options.length) % options.length)
    } else if (event.key === 'Enter') {
      // Enter picks the highlighted suggestion; with none highlighted it submits the form.
      if (showPanel && hasOptions && active >= 0) {
        event.preventDefault()
        pick(options[active])
      }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-text text-sm font-bold">
          {label}
        </label>
        {onChooseOnMap && (
          <button
            type="button"
            aria-pressed={choosing}
            aria-label={`Choose ${label} on map`}
            onClick={onChooseOnMap}
            disabled={disabled}
            className="text-accent focus-visible:outline-accent inline-flex items-center gap-1 rounded text-xs font-bold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            <MapPin aria-hidden size={14} weight={choosing ? 'fill' : 'bold'} />
            {choosing ? 'Choosing on map' : 'Choose on map'}
          </button>
        )}
      </div>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={showPanel}
        aria-controls={hasOptions && showPanel ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={shown}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => !value && text && setOpen(true)}
        onBlur={close}
        className={cn(
          'border-border bg-surface text-text placeholder:text-text-faint focus-visible:outline-accent h-9 rounded border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-50',
          error && 'border-danger',
        )}
      />
      {error && (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      )}
      {showPanel && (
        <div className="border-border bg-surface shadow-card-hover absolute top-full right-0 left-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border">
          {hasOptions ? (
            <ul id={listId} role="listbox" aria-label={`${label} suggestions`}>
              {options.map((place, index) => (
                <li
                  key={place.token}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // Pick before the input loses focus, which would close the list first.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(place)}
                  className={cn(
                    'text-text cursor-pointer px-3 py-2 text-sm',
                    index === active ? 'bg-surface-hover' : 'hover:bg-surface-hover',
                  )}
                >
                  {place.label}
                </li>
              ))}
            </ul>
          ) : (
            <PlaceListState
              status={search.status}
              retryAfterMin={search.retryAfterMin}
              onRetry={search.retry}
            />
          )}
        </div>
      )}
    </div>
  )
}

function PlaceListState({
  status,
  retryAfterMin,
  onRetry,
}: {
  status: (typeof PLACE_SEARCH_STATUS)[keyof typeof PLACE_SEARCH_STATUS]
  retryAfterMin?: number
  onRetry: () => void
}) {
  if (status === PLACE_SEARCH_STATUS.LOADING) {
    return (
      <div role="status" aria-busy="true" aria-label="Searching places" className="grid gap-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    )
  }
  if (status === PLACE_SEARCH_STATUS.EMPTY) {
    return (
      <p role="status" className="text-text-muted p-3 text-sm">
        No places found in the US or Canada
      </p>
    )
  }
  if (status === PLACE_SEARCH_STATUS.LIMIT) {
    return (
      <p role="status" className="text-warning p-3 text-sm">
        {searchLimitText(retryAfterMin ?? 1)}
      </p>
    )
  }
  return (
    <div role="status" className="flex items-center justify-between gap-2 p-3">
      <p className="text-danger text-sm">Place search unavailable.</p>
      {/* Keep focus in the input so a click does not close the list before Retry runs. */}
      <Button
        size="sm"
        variant="outline"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  )
}
