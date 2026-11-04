import { useState } from 'react'
import type { ReactNode } from 'react'
import { AccountMenu, DeleteAccountDialog } from '../components/AccountMenu'
import { useDeleteAccount } from '../hooks/useDeleteAccount'
import { useSession } from '../hooks/useSession'
import { useSignOut } from '../hooks/useSignOut'
import { useTheme } from '../hooks/useTheme'

/** Wires the account menu and the delete dialog to the session hooks; `fallback` shows while
 * signed out (the theme button, since the theme otherwise lives in the account menu). */
export function AccountControls({ fallback = null }: { fallback?: ReactNode }) {
  const { user } = useSession()
  const { theme, toggleTheme } = useTheme()
  const [deleting, setDeleting] = useState(false)
  const signOut = useSignOut()
  const deleteAccount = useDeleteAccount(() => setDeleting(false))

  if (!user) return <>{fallback}</>
  return (
    <>
      <AccountMenu
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={() => signOut.mutate()}
        onDeleteAccount={() => setDeleting(true)}
      />
      <DeleteAccountDialog
        open={deleting}
        onOpenChange={setDeleting}
        onConfirm={() => deleteAccount.mutate()}
        pending={deleteAccount.isPending}
      />
    </>
  )
}
