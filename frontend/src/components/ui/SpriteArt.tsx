import { cn } from '../../lib/cn'

export type ArtRef = { sprite: string; id: string; width: number; height: number }

/**
 * A picture drawn from an SVG sprite `<symbol>` (UIi 7). Fixed width and height reserve the space,
 * so nothing shifts while it loads. Decorative: the text beside it says what it shows.
 */
export function SpriteArt({ art, className }: { art: ArtRef; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${art.width} ${art.height}`}
      width={art.width}
      height={art.height}
      className={cn('block h-auto w-full', className)}
    >
      <use href={`${art.sprite}#${art.id}`} />
    </svg>
  )
}
