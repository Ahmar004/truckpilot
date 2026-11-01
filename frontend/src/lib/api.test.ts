import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request, resetCsrfToken } from './api'

let csrfFetches: number

beforeEach(() => {
  resetCsrfToken()
  csrfFetches = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/csrf') {
        csrfFetches += 1
        await new Promise((r) => setTimeout(r, 10))
        return new Response(JSON.stringify({ csrf_token: 'tok' }))
      }
      return new Response('{}')
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

describe('request', () => {
  it('two simultaneous changing requests share one CSRF fetch', async () => {
    await Promise.all([
      request('/api/a', { method: 'POST' }),
      request('/api/b', { method: 'POST' }),
    ])
    expect(csrfFetches).toBe(1)
  })

  it('reads need no token', async () => {
    await request('/api/me')
    expect(csrfFetches).toBe(0)
  })
})
