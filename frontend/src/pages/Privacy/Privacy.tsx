import type { ReactNode } from 'react'
import { SiteFooter } from '../../components/SiteFooter'
import { PageIntro } from '../../components/ui/PageIntro'
import { PillLink } from '../../components/ui/PillLink'
import { CONTACT_EMAIL, ROUTE_PATH } from '../../lib/constants'

type PrivacySection = { title: string; body: ReactNode }

const LINK_CLASS =
  'text-accent font-bold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent'

const SECTIONS: readonly PrivacySection[] = [
  {
    title: 'What we store',
    body: (
      <p>
        Your Google ID, name and email. The times of your plans, place searches and updates, used
        for the usage limits and deleted after 24 hours. Your sign-in session, which lasts up to 14
        days. We store no trip inputs and no results.
      </p>
    ),
  },
  {
    title: 'Services that see trip data',
    body: (
      <p>
        TomTom gets the trip&apos;s places, departure time and load to find routes. Geoapify gets
        what you type in the place fields. Open-Meteo gets map points to forecast. None of them gets
        your name or email. Google handles sign-in.
      </p>
    ),
  },
  {
    title: 'Errors and usage',
    body: (
      <p>
        Sentry receives error reports with no trip inputs, cookies or keys. PostHog receives
        anonymous usage events, for example &quot;plan succeeded&quot;, with no trip inputs.
      </p>
    ),
  },
  {
    title: 'In your browser',
    body: (
      <p>
        Your units and theme choices, the sign-in session cookie, and the anonymous IDs that Sentry
        and PostHog keep for themselves.
      </p>
    ),
  },
  {
    title: 'Deleting your account',
    body: (
      <p>
        &quot;Delete my account&quot; in the planner&apos;s account menu removes everything above at
        once.
      </p>
    ),
  },
  {
    title: 'Contact',
    body: (
      <p>
        Questions about your data:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className={LINK_CLASS}>
          {CONTACT_EMAIL}
        </a>
      </p>
    ),
  },
]

/** Privacy page (design 9.1): a reading page with short sections of plain text. */
export function Privacy() {
  return (
    <>
      <div className="flex flex-col items-start gap-10 px-(--edge) py-12 lg:items-center">
        <PageIntro label="PRIVACY" title="What Truck Pilot keeps" />
        <div className="flex w-full max-w-3xl flex-col">
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className="border-border flex flex-col gap-2 border-t py-6 first:border-t-0"
            >
              <h2 className="text-text text-2xl font-extrabold">{section.title}</h2>
              <div className="text-text-muted text-lg">{section.body}</div>
            </section>
          ))}
        </div>
        <PillLink to={ROUTE_PATH.HOME} variant="secondary">
          Try TruckPilot
        </PillLink>
      </div>
      <SiteFooter />
    </>
  )
}
