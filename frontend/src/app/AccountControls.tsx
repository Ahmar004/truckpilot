import { useState } from 'react'
import { AccountMenu, DeleteAccountDialog } from '../components/AccountMenu'
import { useDeleteAccount } from '../hooks/useDeleteAccount'
import { useSession } from '../hooks/useSession'
import { useSignOut } from '../hooks/useSignOut'
import { useTheme } from '../hooks/useTheme'

/** Wires the account menu and the delete dialog to the session hooks. */
export function AccountControls() {
  const { user } = useSession()
  const { theme, toggleTheme } = useTheme()
  const [deleting, setDeleting] = useState(false)
  const signOut = useSignOut()
  const deleteAccount = useDeleteAccount(() => setDeleting(false))

  if (!user) return null
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
