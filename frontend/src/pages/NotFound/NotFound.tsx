import { PageIntro } from '../../components/ui/PageIntro'
import { PillLink } from '../../components/ui/PillLink'

/** 404 page (design 9): label, heading and one way out. */
export function NotFound() {
  return (
    <div className="flex flex-col items-start gap-8 px-(--edge) py-16 lg:items-center">
      <PageIntro
        label="404"
        title="This road doesn't go anywhere."
        lead="We could not find the page you asked for."
      />
      <PillLink to="/">Back to home</PillLink>
    </div>
  )
}
