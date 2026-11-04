import { useState } from 'react'
import { AccountMenu, DeleteAccountDialog } from '../components/AccountMenu'
import { useDeleteAccount } from '../hooks/useDeleteAccount'
import { useSession } from '../hooks/useSession'
import { useSignOut } from '../hooks/useSignOut'

/** Wires the account menu and the delete dialog to the session hooks; nothing while signed out. */
export function AccountControls() {
  const { user } = useSession()
  const [deleting, setDeleting] = useState(false)
  const signOut = useSignOut()
  const deleteAccount = useDeleteAccount(() => setDeleting(false))

  if (!user) return null
  return (
    <>
      <AccountMenu
        user={user}
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
