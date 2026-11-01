import { RiskBadge } from '../../components/ui/RiskBadge'
import { SectionHeading } from '../../components/ui/SectionHeading'
import { SECTION_ID } from '../../lib/constants'
import { LOAD_RULES, RISK_TABLE_COLUMNS, RISK_TABLE_ROWS } from './riskTable'

/** Section 6: the risk bands and load rules, an open table (UIi 10 reading pages). */
export function RiskLevels() {
  return (
    <section
      id={SECTION_ID.RISK_LEVELS}
      aria-labelledby="risk-levels-title"
      className="flex scroll-mt-24 flex-col gap-8 py-16"
    >
      <SectionHeading
        id="risk-levels-title"
        label="RISK LEVELS"
        title="The same rules everywhere."
        lead="A Checkpoint takes the highest level of wind, rain and snow."
      />
      <div
        role="region"
        aria-label="Risk bands by condition"
        tabIndex={0}
        className="border-border overflow-x-auto rounded-lg border"
      >
        <table className="w-full min-w-176 border-collapse text-left">
          <caption className="sr-only">Risk bands by condition, in imperial units</caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="text-text-muted p-4 text-sm font-bold">
                Condition
              </th>
              {RISK_TABLE_COLUMNS.map((level) => (
                <th key={level} scope="col" className="p-4">
                  <RiskBadge level={level} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RISK_TABLE_ROWS.map((row) => (
              <tr key={row.condition} className="border-border border-b last:border-b-0">
                <th scope="row" className="text-text p-4 font-bold">
                  {row.condition}
                </th>
                {row.bands.map((band, i) => (
                  <td key={RISK_TABLE_COLUMNS[i]} className="text-text-muted p-4 tabular-nums">
                    {band}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex max-w-3xl flex-col gap-3">
        <h3 className="text-text text-2xl font-extrabold">Load rules</h3>
        <p className="text-text-muted text-lg">
          These apply to the wind level and can only raise it.
        </p>
        <ul className="text-text flex list-disc flex-col gap-2 pl-6 text-lg">
          {LOAD_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="text-text-muted text-lg">Metric units are one tap away in the planner.</p>
      </div>
    </section>
  )
}
