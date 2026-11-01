import { Button } from '../../components/ui/Button'
import { PageIntro } from '../../components/ui/PageIntro'
import { PillLink } from '../../components/ui/PillLink'

/** Shown by the error boundary (design 9). Few imports, because it ships with every page. */
export function ErrorPage() {
  return (
    <main className="flex flex-col items-start gap-8 px-(--edge) py-16 lg:items-center">
      <PageIntro
        label="ERROR"
        title="Something broke on our side."
        lead="Reload the page to try again, or go back to the start."
      />
      <div className="flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={() => window.location.reload()}>
          Reload
        </Button>
        {/* A full page load, so a broken app state cannot follow the visitor home. */}
        <PillLink to="/" variant="secondary" reloadDocument>
          Back to home
        </PillLink>
      </div>
    </main>
  )
}
