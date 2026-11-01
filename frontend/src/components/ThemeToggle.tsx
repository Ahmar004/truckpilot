import { THEME } from '../lib/constants'
import type { Theme } from '../lib/constants'
import { Moon, Sun } from './ui/icons'

type ThemeToggleProps = {
  theme: Theme
  onToggle: () => void
}

/**
 * Sun or moon button. The icon comes from the dark: variant, so the prerendered markup is the
 * same for both themes and hydration never mismatches (design 3.5).
 */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === THEME.DARK ? 'Switch to light theme' : 'Switch to dark theme'}
      className="text-text-muted hover:bg-surface-hover hover:text-text grid size-10 place-items-center rounded-full transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Moon aria-hidden className="size-5 dark:hidden" />
      <Sun aria-hidden className="hidden size-5 dark:block" />
    </button>
  )
}
