import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { THEME } from '../lib/constants'
import type { Theme } from '../lib/constants'
import type { SessionUser } from '../lib/types'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { Moon, Sun } from './ui/icons'

type AccountMenuProps = {
  user: SessionUser
  theme: Theme
  onToggleTheme: () => void
  onSignOut: () => void
  onDeleteAccount: () => void
}

const ITEM_CLASS =
  'text-text hover:bg-surface-hover data-[highlighted]:bg-surface-hover flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-bold outline-none select-none'

/** Round account button and its menu (design 2.3). */
export function AccountMenu({
  user,
  theme,
  onToggleTheme,
  onSignOut,
  onDeleteAccount,
}: AccountMenuProps) {
  const initial = user.name.trim().charAt(0).toUpperCase() || '?'
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Account menu"
        className="bg-accent text-accent-ink grid size-10 place-items-center rounded-full text-base font-extrabold active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {initial}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="bg-surface border-border shadow-card-hover z-50 w-64 max-w-[calc(100vw-1rem)] rounded-lg border p-2"
        >
          <div className="px-3 py-2">
            <p className="text-text truncate font-extrabold">{user.name}</p>
            <p className="text-text-muted truncate text-sm">{user.email}</p>
          </div>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item className={ITEM_CLASS} onSelect={onToggleTheme}>
            {theme === THEME.DARK ? (
              <Sun aria-hidden className="size-5" />
            ) : (
              <Moon aria-hidden className="size-5" />
            )}
            {theme === THEME.DARK ? 'Switch to light theme' : 'Switch to dark theme'}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={ITEM_CLASS} onSelect={onSignOut}>
            Sign out
          </DropdownMenu.Item>
          <DropdownMenu.Item className={ITEM_CLASS} onSelect={onDeleteAccount}>
            Delete my account
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

type DeleteAccountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}

/** Confirm pop-up for deleting the account (design F13). Esc cancels; Enter submits. */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: DeleteAccountDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete your account?"
      description="This removes your name, email, Google ID and usage records from Truck Pilot. You can sign in again later as a new user."
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!pending) onConfirm()
        }}
      >
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? 'Deleting...' : 'Delete account'}
        </Button>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </form>
    </Dialog>
  )
}
