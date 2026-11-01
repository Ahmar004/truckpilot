import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // A background gradient between the two accent shades keeps the ink at AA (UIi 6.7).
        primary:
          'bg-gradient-to-br from-accent to-accent-hover text-accent-ink hover:-translate-y-px hover:shadow-card-hover hover:brightness-110',
        secondary:
          'border border-border bg-surface text-text hover:-translate-y-px hover:shadow-card-hover',
        outline: 'border border-border-strong text-text hover:bg-surface-hover',
        ghost: 'text-text-muted hover:bg-surface-hover hover:text-text',
        destructive: 'bg-danger text-bg hover:brightness-110',
      },
      size: { sm: 'h-9 px-4 text-sm', default: 'h-10 px-5 text-sm', lg: 'h-11 px-6 text-base' },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof button>

/** Every button is `type="button"` unless it is a form's submit (UIi 6.13). */
export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(button({ variant, size }), className)} {...props} />
}
