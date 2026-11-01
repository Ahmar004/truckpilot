import { cn } from '../../lib/cn'
import './Landing.css'

const COPIES = 4

type WordBandProps = {
  words: readonly string[]
  /** Which way the band slides while it passes the screen. */
  direction: 'left' | 'right'
}

/** Full-width band of huge outlined words (UIi 8.4). Decoration only, so hidden from readers. */
export function WordBand({ words, direction }: WordBandProps) {
  return (
    <div aria-hidden className="word-band">
      <div className={cn('word-band-track', direction === 'right' && 'word-band-track-right')}>
        {Array.from({ length: COPIES }, (_, copy) =>
          words.map((word) => (
            <span key={`${copy}-${word}`} className="word-band-word" data-word={word}>
              <span className="word-band-dot" />
            </span>
          )),
        )}
      </div>
    </div>
  )
}
