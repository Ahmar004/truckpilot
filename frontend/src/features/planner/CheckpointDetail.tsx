import { RiskBadge } from '../../components/ui/RiskBadge'
import { NO_WEATHER_DETAIL, RISK_LEVEL } from '../../lib/constants'
import type { UnitSystem } from '../../lib/constants'
import { joinCauses } from '../../lib/checkpointText'
import { formatTime } from '../../lib/time'
import type { Checkpoint, Load } from '../../lib/types'
import { formatLoad, formatMileOf, formatPrecip, formatWind } from '../../lib/units'

type CheckpointDetailProps = {
  checkpoint: Checkpoint
  /** The load as typed, for the load rule line (design 8.4). */
  load: Load
  units: UnitSystem
}

const termClass = 'text-text-muted text-sm'
const valueClass = 'text-text text-sm font-bold'

/** The exact detail lines of design 8.4 as a definition list. Shows server results only. */
export function CheckpointDetail({ checkpoint, load, units }: CheckpointDetailProps) {
  const { weather, level, causes, load_rule: loadRule } = checkpoint
  const showCauses = level !== null && level !== RISK_LEVEL.LOW && causes.length > 0
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-text text-base font-bold">
        Checkpoint {checkpoint.n} · {formatMileOf(checkpoint.mile, checkpoint.of_mi, units)}
      </h3>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
        <dt className={termClass}>Arrives:</dt>
        <dd className={valueClass}>{formatTime(checkpoint.eta_utc, checkpoint.tz)}</dd>
        {weather === null || level === null ? (
          <p className="text-text-muted col-span-2 text-sm">{NO_WEATHER_DETAIL}</p>
        ) : (
          <>
            <dt className={termClass}>Wind:</dt>
            <dd className={valueClass}>{formatWind(weather.wind_mph, units)}</dd>
            <dt className={termClass}>Rain:</dt>
            <dd className={valueClass}>{formatPrecip(weather.rain_in, units)}</dd>
            <dt className={termClass}>Snow:</dt>
            <dd className={valueClass}>{formatPrecip(weather.snow_in, units)}</dd>
            <dt className={termClass}>Risk:</dt>
            <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <RiskBadge level={level} />
              {showCauses && (
                <span className="text-text text-sm">
                  set by {joinCauses(causes)}
                  {loadRule &&
                    ` (${formatWind(weather.wind_mph, units)} with a ${formatLoad(load)} load)`}
                </span>
              )}
            </dd>
          </>
        )}
      </dl>
    </div>
  )
}
