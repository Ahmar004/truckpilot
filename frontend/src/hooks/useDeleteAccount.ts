import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { request, resetCsrfToken } from '../lib/api'
import { AUTH_PATH, ROUTE_PATH } from '../lib/constants'
import { useToast } from './useToast'
import { forgetSession } from './useSession'

/** Delete the account (design F13). On failure the caller keeps its dialog open. */
export function useDeleteAccount(onDeleted?: () => void) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const showToast = useToast()
  return useMutation({
    mutationFn: () => request<unknown>(AUTH_PATH.DELETE_ACCOUNT, { method: 'POST' }),
    onSuccess: () => {
      resetCsrfToken()
      onDeleted?.()
      navigate(ROUTE_PATH.HOME)
      forgetSession(queryClient)
      showToast('Account deleted')
    },
    onError: () => showToast("Couldn't delete your account. Try again."),
  })
}
