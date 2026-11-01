import { useId } from 'react'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

type InputProps = Omit<ComponentProps<'input'>, 'id'> & {
  /** Every input has a visible label (UIi 6.13). */
  label: string
  id?: string
  hint?: string
  error?: string
}

/** Labelled text input. Put it inside a real `<form>` so Enter submits and Esc cancels. */
export function Input({ label, id, hint, error, className, ...props }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const noteId = `${inputId}-note`
  const note = error ?? hint
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-text text-sm font-bold">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          'border-border bg-surface text-text placeholder:text-text-faint h-9 rounded border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50',
          error && 'border-danger',
          className,
        )}
        {...props}
      />
      {note && (
        <p id={noteId} className={cn('text-xs', error ? 'text-danger' : 'text-text-muted')}>
          {note}
        </p>
      )}
    </div>
  )
}
