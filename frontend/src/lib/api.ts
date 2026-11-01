import { CLIENT_ERROR_CODE, ERROR_CODE } from './constants'
import type { ApiErrorCode, ErrorBody } from './types'

const DEFAULT_TIMEOUT_MS = 30_000
const CSRF_PATH = '/api/csrf'
const CSRF_HEADER = 'X-CSRFToken'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly service?: ErrorBody['service']
  readonly retryAfterMin?: number
  readonly fields?: Record<string, string>

  constructor(
    code: ApiErrorCode,
    options: {
      status?: number
      service?: ErrorBody['service']
      retryAfterMin?: number
      fields?: Record<string, string>
    } = {},
  ) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.status = options.status ?? 0
    this.service = options.service
    this.retryAfterMin = options.retryAfterMin
    this.fields = options.fields
  }
}

// Kept in memory only: never in storage or a readable cookie (CLAUDE.md, Secrets).
let csrfToken: string | null = null
// One token fetch at a time: two requests with no token yet share it instead of racing.
let csrfPending: Promise<string> | null = null

/** Forget the token. Call after sign-in and sign-out, when the server issues a new one. */
export function resetCsrfToken(): void {
  csrfToken = null
  csrfPending = null
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Sent as JSON. */
  json?: unknown
  timeoutMs?: number
}

function isErrorBody(value: unknown): value is ErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string'
  )
}

/** Combine the caller's signal (query cancel) with a timeout. */
function withTimeout(signal: AbortSignal | null | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

async function send<T>(path: string, options: RequestOptions, token?: string): Promise<T> {
  const { json, timeoutMs = DEFAULT_TIMEOUT_MS, signal, headers: extraHeaders, ...init } = options
  const headers = new Headers(extraHeaders)
  if (json !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set(CSRF_HEADER, token)

  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers,
      body: json === undefined ? undefined : JSON.stringify(json),
      credentials: 'same-origin',
      signal: withTimeout(signal, timeoutMs),
    })
  } catch (error) {
    if (signal?.aborted) throw error // the caller cancelled: let the abort pass through
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new ApiError(timedOut ? CLIENT_ERROR_CODE.TIMEOUT : CLIENT_ERROR_CODE.NETWORK)
  }

  let data: unknown = null
  const text = await response.text().catch(() => '')
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    if (isErrorBody(data)) {
      throw new ApiError(data.code, {
        status: response.status,
        service: data.service,
        retryAfterMin: data.retry_after_min,
        fields: data.fields,
      })
    }
    throw new ApiError(CLIENT_ERROR_CODE.BAD_RESPONSE, { status: response.status })
  }
  return data as T
}

// Not tied to one caller's signal: another request may be waiting on the same fetch.
function fetchCsrfToken(): Promise<string> {
  csrfPending ??= send<{ csrf_token: string }>(CSRF_PATH, { method: 'GET' })
    .then((body) => {
      csrfToken = body.csrf_token
      return csrfToken
    })
    .finally(() => {
      csrfPending = null
    })
  return csrfPending
}

/**
 * One request to the Django API. Adds the CSRF header on anything that changes state;
 * on `csrf_failed` it fetches a new token and retries once.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  if (SAFE_METHODS.has(method)) return send<T>(path, { ...options, method })

  const token = csrfToken ?? (await fetchCsrfToken())
  try {
    return await send<T>(path, { ...options, method }, token)
  } catch (error) {
    if (error instanceof ApiError && error.code === ERROR_CODE.CSRF_FAILED) {
      const fresh = await fetchCsrfToken()
      return send<T>(path, { ...options, method }, fresh)
    }
    throw error
  }
}
