import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PICK_STATUS, PLACE_SEARCH_DEBOUNCE_MS, TRIP_FIELD, UNIT_SYSTEM } from '../lib/constants'
import { useForecastSlider } from '../features/planner/useForecastSlider'
import { usePlaceSearch, PLACE_SEARCH_STATUS } from '../features/planner/usePlaceSearch'
import { usePlacePick } from '../features/planner/usePlacePick'
import { buildPlanRequest, isAbort, usePlanTrip } from '../features/planner/usePlanTrip'
import { useUpdatePlan } from '../features/planner/useUpdatePlan'
import { useDeleteAccount } from './useDeleteAccount'
import { useSession } from './useSession'
import { useSignIn } from './useSignIn'
import { useSignOut } from './useSignOut'
import { ToastContext } from './useToast'
import type { ShowToast } from './useToast'

type Reply = { status?: number; body?: unknown }

const showToast = vi.fn<ShowToast>()
let client: QueryClient
let calls: { path: string; method: string; headers: Headers; body: string | undefined }[]
let replies: Record<string, Reply>

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={showToast}>
        <MemoryRouter>{children}</MemoryRouter>
      </ToastContext.Provider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  calls = []
  replies = { '/api/csrf': { body: { csrf_token: 'tok' } } }
  showToast.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit = {}) => {
      const key = path.split('?')[0]
      calls.push({
        path,
        method: init.method ?? 'GET',
        headers: new Headers(init.headers),
        body: init.body as string | undefined,
      })
      const reply = replies[key] ?? { status: 404, body: { code: 'not_found' } }
      return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200 })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useSession', () => {
  it('returns the signed-in user', async () => {
    replies['/api/me'] = { body: { user: { email: 'a@b.c' } } }
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.user).toEqual({ email: 'a@b.c' }))
    expect(result.current.isSignedOut).toBe(false)
  })

  it('treats 401 not_signed_in as signed out, not as an error', async () => {
    replies['/api/me'] = { status: 401, body: { code: 'not_signed_in' } }
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSignedOut).toBe(true))
    expect(result.current.isError).toBe(false)
    expect(result.current.user).toBeUndefined()
  })

  it('reports other failures as an error', async () => {
    replies['/api/me'] = { status: 500, body: {} }
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.isSignedOut).toBe(false)
  })
})

describe('sign-in, sign-out and delete', () => {
  it('sign-in posts the credential with a CSRF header and caches the user', async () => {
    replies['/api/auth/google'] = { body: { user: { email: 'a@b.c' } } }
    const { result } = renderHook(() => useSignIn(), { wrapper: Wrapper })
    await act(() => result.current.mutateAsync('cred'))
    const post = calls.find((c) => c.path === '/api/auth/google')
    expect(post?.headers.get('X-CSRFToken')).toBe('tok')
    expect(JSON.parse(post?.body ?? '{}')).toEqual({ credential: 'cred' })
    expect(client.getQueryData(['session'])).toEqual({ user: { email: 'a@b.c' } })
  })

  it('sign-in failure leaves the cache empty', async () => {
    replies['/api/auth/google'] = { status: 401, body: { code: 'sign_in_failed' } }
    const { result } = renderHook(() => useSignIn(), { wrapper: Wrapper })
    await act(async () => {
      await result.current.mutateAsync('bad').catch(() => undefined)
    })
    expect(client.getQueryData(['session'])).toBeUndefined()
  })

  it('sign-out clears the cache and shows a toast', async () => {
    replies['/api/auth/sign-out'] = { body: {} }
    client.setQueryData(['session'], { user: { email: 'a@b.c' } })
    const { result } = renderHook(() => useSignOut(), { wrapper: Wrapper })
    await act(() => result.current.mutateAsync())
    expect(client.getQueryData(['session'])).toBeUndefined()
    expect(showToast).toHaveBeenCalledWith('Signed out')
  })

  it('delete calls onDeleted and toasts on success', async () => {
    replies['/api/account/delete'] = { body: {} }
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useDeleteAccount(onDeleted), { wrapper: Wrapper })
    await act(() => result.current.mutateAsync())
    expect(onDeleted).toHaveBeenCalledOnce()
    expect(showToast).toHaveBeenCalledWith('Account deleted')
  })

  it('delete failure toasts and does not call onDeleted', async () => {
    replies['/api/account/delete'] = { status: 500, body: {} }
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useDeleteAccount(onDeleted), { wrapper: Wrapper })
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined)
    })
    expect(onDeleted).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith("Couldn't delete your account. Try again.")
  })
})

describe('plan hooks', () => {
  it('buildPlanRequest returns null until the form is complete', () => {
    const base = {
      origin: null,
      destination: null,
      departureLocal: '2026-11-02T08:00',
      load: { value: null, unit: 'lb' },
      interval: 50,
      hos: null,
    }
    expect(buildPlanRequest(base as never)).toBeNull()
  })

  it('buildPlanRequest maps a complete form to the request body', () => {
    const form = {
      origin: { token: 'o' },
      destination: { token: 'd' },
      departureLocal: '2026-11-02T08:00',
      load: { value: 40000, unit: 'lb' },
      interval: 50,
      hos: null,
    }
    expect(buildPlanRequest(form as never)).toEqual({
      origin: 'o',
      destination: 'd',
      departure_local: '2026-11-02T08:00',
      load: { value: 40000, unit: 'lb' },
      interval: 50,
      hos: null,
    })
  })

  it('isAbort only matches AbortError', () => {
    expect(isAbort(new DOMException('x', 'AbortError'))).toBe(true)
    expect(isAbort(new Error('x'))).toBe(false)
  })

  it('usePlanTrip posts the body and returns the plan', async () => {
    replies['/api/plans'] = { body: { id: 'plan' } }
    const { result } = renderHook(() => usePlanTrip(), { wrapper: Wrapper })
    let plan: unknown
    await act(async () => {
      plan = await result.current.planTrip({ origin: 'o' } as never)
    })
    expect(plan).toEqual({ id: 'plan' })
    expect(calls.find((c) => c.path === '/api/plans')?.method).toBe('POST')
  })

  it('usePlanTrip cancel aborts the request in flight', async () => {
    let signal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string, init: RequestInit = {}) => {
        if (path === '/api/csrf') {
          return Promise.resolve(new Response(JSON.stringify({ csrf_token: 't' })))
        }
        signal = init.signal as AbortSignal
        return new Promise<Response>((_, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        })
      }),
    )
    const { result } = renderHook(() => usePlanTrip(), { wrapper: Wrapper })
    let outcome: unknown
    await act(async () => {
      const pending = result.current.planTrip({ origin: 'o' } as never).catch((e) => e)
      await waitFor(() => expect(signal).toBeDefined())
      result.current.cancel()
      outcome = await pending
    })
    expect(isAbort(outcome)).toBe(true)
  })

  it('useUpdatePlan posts to the update path', async () => {
    replies['/api/plans/update'] = { body: { id: 'updated' } }
    const { result } = renderHook(() => useUpdatePlan(), { wrapper: Wrapper })
    let plan: unknown
    await act(async () => {
      plan = await result.current.updatePlan({ bundle: 'b' } as never)
    })
    expect(plan).toEqual({ id: 'updated' })
  })
})

describe('usePlaceSearch', () => {
  it('stays idle under 2 characters and makes no request', () => {
    const { result } = renderHook(() => usePlaceSearch('a'), { wrapper: Wrapper })
    expect(result.current.status).toBe(PLACE_SEARCH_STATUS.IDLE)
    expect(calls).toHaveLength(0)
  })

  it('waits for the pause, then shows results', async () => {
    replies['/api/places'] = { body: { places: [{ token: 't', label: 'Dallas, TX' }] } }
    const { result, rerender } = renderHook(({ text }) => usePlaceSearch(text), {
      wrapper: Wrapper,
      initialProps: { text: '' },
    })
    rerender({ text: 'Dal' })
    expect(result.current.status).toBe(PLACE_SEARCH_STATUS.LOADING)
    expect(calls).toHaveLength(0)
    await waitFor(() => expect(result.current.status).toBe(PLACE_SEARCH_STATUS.RESULTS), {
      timeout: PLACE_SEARCH_DEBOUNCE_MS * 6,
    })
    expect(result.current.places).toHaveLength(1)
    expect(calls[0].path).toBe('/api/places?q=Dal')
  })

  it('reports empty, limit and error states', async () => {
    replies['/api/places'] = { body: { places: [] } }
    const empty = renderHook(() => usePlaceSearch('zzz'), { wrapper: Wrapper })
    await waitFor(() => expect(empty.result.current.status).toBe(PLACE_SEARCH_STATUS.EMPTY), {
      timeout: 2000,
    })

    replies['/api/places'] = {
      status: 429,
      body: { code: 'search_limited', retry_after_min: 7 },
    }
    const limited = renderHook(() => usePlaceSearch('limit'), { wrapper: Wrapper })
    await waitFor(() => expect(limited.result.current.status).toBe(PLACE_SEARCH_STATUS.LIMIT), {
      timeout: 2000,
    })
    expect(limited.result.current.retryAfterMin).toBe(7)

    replies['/api/places'] = { status: 502, body: { code: 'provider_unavailable' } }
    const failed = renderHook(() => usePlaceSearch('broken'), { wrapper: Wrapper })
    await waitFor(() => expect(failed.result.current.status).toBe(PLACE_SEARCH_STATUS.ERROR), {
      timeout: 2000,
    })
  })
})

describe('usePlacePick', () => {
  const joliet = { label: 'Joliet, IL 60432, USA', tz: 'America/Chicago', token: 't' }

  it('turns a map point into the picked place for the field and ends picking', async () => {
    replies['/api/places/reverse'] = { body: { place: joliet } }
    const onPicked = vi.fn()
    const { result } = renderHook(() => usePlacePick(onPicked), { wrapper: Wrapper })
    expect(result.current.field).toBeNull()
    act(() => result.current.start(TRIP_FIELD.DESTINATION))
    expect(result.current.field).toBe(TRIP_FIELD.DESTINATION)
    expect(result.current.status).toBe(PICK_STATUS.WAITING)
    act(() => result.current.pickAt(41.5250049, -88.08172))
    await waitFor(() => expect(onPicked).toHaveBeenCalledWith(TRIP_FIELD.DESTINATION, joliet))
    expect(result.current.field).toBeNull()
    expect(calls.at(-1)?.path).toBe('/api/places/reverse?lat=41.525&lon=-88.08172')
  })

  it('stays in picking with a note when the point is not in the US or Canada', async () => {
    replies['/api/places/reverse'] = { body: { place: null } }
    const onPicked = vi.fn()
    const { result } = renderHook(() => usePlacePick(onPicked), { wrapper: Wrapper })
    act(() => result.current.start(TRIP_FIELD.ORIGIN))
    act(() => result.current.pickAt(30, -60))
    await waitFor(() => expect(result.current.status).toBe(PICK_STATUS.OUTSIDE))
    expect(result.current.field).toBe(TRIP_FIELD.ORIGIN)
    expect(onPicked).not.toHaveBeenCalled()
  })

  it('shows the search limit and provider errors and keeps picking', async () => {
    replies['/api/places/reverse'] = {
      status: 429,
      body: { code: 'search_limited', retry_after_min: 7 },
    }
    const { result } = renderHook(() => usePlacePick(vi.fn()), { wrapper: Wrapper })
    act(() => result.current.start(TRIP_FIELD.ORIGIN))
    act(() => result.current.pickAt(41, -88))
    await waitFor(() => expect(result.current.status).toBe(PICK_STATUS.LIMIT))
    expect(result.current.retryAfterMin).toBe(7)
    replies['/api/places/reverse'] = { status: 502, body: { code: 'provider_unavailable' } }
    act(() => result.current.pickAt(41, -88))
    await waitFor(() => expect(result.current.status).toBe(PICK_STATUS.ERROR))
    expect(result.current.field).toBe(TRIP_FIELD.ORIGIN)
  })

  it('cancels with Esc or cancel()', () => {
    const { result } = renderHook(() => usePlacePick(vi.fn()), { wrapper: Wrapper })
    act(() => result.current.start(TRIP_FIELD.ORIGIN))
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(result.current.field).toBeNull()
    act(() => result.current.start(TRIP_FIELD.ORIGIN))
    act(() => result.current.cancel())
    expect(result.current.field).toBeNull()
  })
})

describe('useForecastSlider', () => {
  const setup = (hour: number, onChange = vi.fn()) => ({
    onChange,
    ...renderHook(() => useForecastSlider(null, null, hour, UNIT_SYSTEM.IMPERIAL, onChange)),
  })

  it('clamps the hour to 0-48', () => {
    expect(setup(99).result.current.hour).toBe(48)
    expect(setup(-5).result.current.hour).toBe(0)
    expect(setup(3.6).result.current.hour).toBe(4)
  })

  it('setHour clamps what it reports', () => {
    const { result, onChange } = setup(10)
    result.current.setHour(70)
    expect(onChange).toHaveBeenCalledWith(48)
  })

  it('Page Up and Page Down move by 6 hours', () => {
    const { result, onChange } = setup(10)
    const event = (key: string) =>
      ({ key, preventDefault: vi.fn(), stopPropagation: vi.fn() }) as never
    result.current.onKeyDownCapture(event('PageUp'))
    expect(onChange).toHaveBeenLastCalledWith(16)
    result.current.onKeyDownCapture(event('PageDown'))
    expect(onChange).toHaveBeenLastCalledWith(4)
    onChange.mockClear()
    result.current.onKeyDownCapture(event('ArrowRight'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
