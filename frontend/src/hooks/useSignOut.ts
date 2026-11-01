import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { request, resetCsrfToken } from '../lib/api'
import { AUTH_PATH, ROUTE_PATH } from '../lib/constants'
import { useToast } from './useToast'

/** End the session, forget everything cached, go home (design F11). */
export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const showToast = useToast()
  return useMutation({
    mutationFn: () => request<unknown>(AUTH_PATH.SIGN_OUT, { method: 'POST' }),
    onSuccess: () => {
      resetCsrfToken()
      navigate(ROUTE_PATH.HOME)
      queryClient.clear()
      showToast('Signed out')
    },
  })
}
