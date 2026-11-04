import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import { cn } from '../../lib/cn'
import { ArrowRight } from './icons'

const pillLink = cva(
  'group inline-flex items-center gap-3 rounded-full font-bold transition-all duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-ink shadow-card hover:bg-accent-hover hover:shadow-card-hover',
        secondary:
          'border border-border bg-surface/70 text-text backdrop-blur-sm hover:border-accent/50 hover:bg-surface',
      },
      size: {
        sm: 'h-10 py-1 pr-1 pl-4 text-sm',
        default: 'h-12 py-1 pr-1 pl-5 text-base',
        lg: 'h-14 py-1 pr-1 pl-6 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

const roundArrow = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-1 group-focus-visible:translate-x-1',
  {
    variants: {
      tone: { inverse: 'bg-accent-ink text-accent', accent: 'bg-accent text-accent-ink' },
      size: { sm: 'size-8', default: 'size-10', lg: 'size-12' },
    },
    defaultVariants: { tone: 'accent', size: 'default' },
  },
)

type RoundArrowProps = VariantProps<typeof roundArrow> & { className?: string }

/** The round arrow disc at the end of a call to action (UIi 6.6). */
export function RoundArrow({ tone, size, className }: RoundArrowProps) {
  return (
    <span aria-hidden className={cn(roundArrow({ tone, size }), className)}>
      <ArrowRight weight="bold" className="size-1/2" />
    </span>
  )
}

type PillLinkProps = ComponentProps<typeof Link> &
  VariantProps<typeof pillLink> & { arrowClassName?: string }

/** The main call to action: a large pill link with a round arrow at the right end. */
export function PillLink({
  variant,
  size,
  className,
  arrowClassName,
  children,
  ...props
}: PillLinkProps) {
  return (
    <Link className={cn(pillLink({ variant, size }), className)} {...props}>
      {children}
      <RoundArrow
        tone={variant === 'secondary' ? 'accent' : 'inverse'}
        size={size ?? 'default'}
        className={arrowClassName}
      />
    </Link>
  )
}
