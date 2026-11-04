import * as Collapsible from '@radix-ui/react-collapsible'
import * as Switch from '@radix-ui/react-switch'
import { useId } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { ArrowsDownUp, CaretDown, CircleNotch } from '../../components/ui/icons'
import { INTERVAL_AUTO, TRIP_FIELD } from '../../lib/constants'
import type { IntervalChoice, UnitSystem } from '../../lib/constants'
import type { TripErrors, TripForm as TripFormValue, FormLoad } from '../../lib/tripValidation'
import type { Place } from '../../lib/types'
import { formatInterval } from '../../lib/units'
import { DepartureField } from './DepartureField'
import { IntervalSelect } from './IntervalSelect'
import { LoadField } from './LoadField'
import { PlaceField } from './PlaceField'
import type { PickField } from './usePlacePick'
import { InfoTip } from '../../components/ui/InfoTip'
import { HOS_TIP, INTERVAL_TIP } from './settingTips'

type TripFormProps = {
  form: TripFormValue
  errors: TripErrors
  units: UnitSystem
  /** True while a plan is in progress: fields are disabled and the button reads "Planning...". */
  planning: boolean
  /** The field "Choose on map" is filling (Step-14b), or null. */
  pickingField: PickField | null
  onChooseOnMap: (field: PickField) => void
  onOriginChange: (place: Place | null) => void
  onDestinationChange: (place: Place | null) => void
  onSwap: () => void
  onDepartureChange: (value: string) => void
  onLoadChange: (load: FormLoad) => void
  onIntervalChange: (interval: IntervalChoice) => void
  onHosChange: (hos: boolean) => void
  onSubmit: () => void
}

/** "More options · Interval Auto · HOS breaks on" (design 8.2). */
function optionsSummary(interval: IntervalChoice, hos: boolean, units: UnitSystem): string {
  const intervalText = interval === INTERVAL_AUTO ? 'Auto' : formatInterval(interval, units)
  return `More options · Interval ${intervalText} · HOS breaks ${hos ? 'on' : 'off'}`
}

/** The trip form (design 8.2 item 1). A real form: Enter submits. */
export function TripForm({
  form,
  errors,
  units,
  planning,
  pickingField,
  onChooseOnMap,
  onOriginChange,
  onDestinationChange,
  onSwap,
  onDepartureChange,
  onLoadChange,
  onIntervalChange,
  onHosChange,
  onSubmit,
}: TripFormProps) {
  const hosId = useId()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!planning) onSubmit()
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={planning} className="flex flex-col gap-3">
      <fieldset disabled={planning} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <legend className="sr-only">Trip</legend>
        <PlaceField
          label="Origin"
          value={form.origin}
          onChange={onOriginChange}
          error={errors[TRIP_FIELD.ORIGIN]}
          choosing={pickingField === TRIP_FIELD.ORIGIN}
          onChooseOnMap={() => onChooseOnMap(TRIP_FIELD.ORIGIN)}
        />
        <div className="flex justify-end">
          <Button
            variant="outline"
            aria-label="Swap origin and destination"
            onClick={onSwap}
            className="size-9 p-0"
          >
            <ArrowsDownUp aria-hidden size={18} />
          </Button>
        </div>
        <PlaceField
          label="Destination"
          value={form.destination}
          onChange={onDestinationChange}
          error={errors[TRIP_FIELD.DESTINATION]}
          choosing={pickingField === TRIP_FIELD.DESTINATION}
          onChooseOnMap={() => onChooseOnMap(TRIP_FIELD.DESTINATION)}
        />
        <DepartureField
          value={form.departureLocal}
          onChange={onDepartureChange}
          timeZone={form.origin?.tz ?? null}
          error={errors[TRIP_FIELD.DEPARTURE]}
        />
        <LoadField
          load={form.load}
          units={units}
          onChange={onLoadChange}
          error={errors[TRIP_FIELD.LOAD]}
        />
        <Collapsible.Root>
          <Collapsible.Trigger className="text-text-muted hover:text-text focus-visible:outline-accent group flex w-full items-center justify-between gap-2 rounded text-left text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2">
            <span>{optionsSummary(form.interval, form.hos, units)}</span>
            <CaretDown
              aria-hidden
              size={16}
              className="transition-transform group-data-[state=open]:rotate-180"
            />
          </Collapsible.Trigger>
          <Collapsible.Content className="grid gap-3 pt-3">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1">
                <span className="text-text text-sm font-bold">Interval</span>
                <InfoTip term="Interval">{INTERVAL_TIP}</InfoTip>
              </span>
              <IntervalSelect value={form.interval} onChange={onIntervalChange} units={units} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1">
                <label htmlFor={hosId} className="text-text text-sm font-bold">
                  HOS breaks
                </label>
                <InfoTip term="HOS breaks">{HOS_TIP}</InfoTip>
              </span>
              <Switch.Root
                id={hosId}
                checked={form.hos}
                onCheckedChange={onHosChange}
                className="bg-border-strong data-[state=checked]:bg-accent focus-visible:outline-accent relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
              >
                <Switch.Thumb className="bg-bg block size-5 translate-x-0.5 rounded-full transition-transform data-[state=checked]:translate-x-[22px]" />
              </Switch.Root>
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </fieldset>
      <Button type="submit" size="lg" disabled={planning} className="w-full">
        {planning ? (
          <>
            <CircleNotch aria-hidden size={18} className="animate-spin" />
            Planning...
          </>
        ) : (
          'Plan trip'
        )}
      </Button>
    </form>
  )
}
