import { useCallback, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { SLIDER_MAX_HOUR, SLIDER_PAGE_HOURS } from '../../lib/constants'
import type { UnitSystem } from '../../lib/constants'
import { sliderValueText, truckText } from '../../lib/heatmapText'
import type { Plan, Route } from '../../lib/types'

const clampHour = (hour: number) => Math.min(SLIDER_MAX_HOUR, Math.max(0, Math.round(hour)))

/**
 * The slider's text and keys. Radix handles arrows, Home and End; Page Up and Page Down move by
 * 6 h here (Radix would move by 10). Moving it only changes the hour; nothing is requested.
 */
export function useForecastSlider(
  plan: Plan | null,
  route: Route | null,
  hour: number,
  units: UnitSystem,
  onHourChange: (hour: number) => void,
) {
  const current = clampHour(hour)
  const valueText = useMemo(() => (plan ? sliderValueText(plan, current) : ''), [plan, current])
  const truck = useMemo(
    () => truckText(route?.truck[current], route?.distance_mi ?? 0, units),
    [route, current, units],
  )
  const ariaValueText = truck ? `${valueText}. ${truck}` : valueText

  const setHour = useCallback((next: number) => onHourChange(clampHour(next)), [onHourChange])

  const onKeyDownCapture = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'PageUp' && event.key !== 'PageDown') return
      event.preventDefault()
      event.stopPropagation()
      const step = event.key === 'PageUp' ? SLIDER_PAGE_HOURS : -SLIDER_PAGE_HOURS
      onHourChange(clampHour(current + step))
    },
    [current, onHourChange],
  )

  return { hour: current, valueText, truck, ariaValueText, setHour, onKeyDownCapture }
}
