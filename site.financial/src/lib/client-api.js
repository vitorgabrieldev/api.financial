const normalizeCorePath = (path) => {
  if (!path) return '/api/core'

  if (path.startsWith('/api/core')) {
    return path
  }

  if (path.startsWith('/api/')) {
    return `/api/core/${path.slice(5)}`
  }

  if (path.startsWith('/')) {
    return `/api/core${path}`
  }

  return `/api/core/${path}`
}

const withQuery = (path, query) => {
  if (!query) return path

  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }

  const queryString = params.toString()
  if (!queryString) return path

  return `${path}?${queryString}`
}

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return await response.json().catch(() => ({}))
  }

  const text = await response.text().catch(() => '')
  return text ? { error: text } : {}
}

const toError = (response, payload) => {
  const error = new Error(
    payload?.error ?? payload?.message ?? `Falha HTTP ${response.status}`,
  )

  error.status = response.status
  error.payload = payload
  return error
}

const fetchOnce = async ({ path, method, body, query, signal }) => {
  const requestPath = withQuery(normalizeCorePath(path), query)
  const response = await fetch(requestPath, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal,
  })

  const payload = await parseResponse(response)
  return { response, payload }
}

export const coreRequest = async ({
  path,
  method = 'GET',
  body,
  query,
  signal,
  retryAuth = true,
}) => {
  const first = await fetchOnce({ path, method, body, query, signal })

  if (first.response.status === 401 && retryAuth) {
    const refresh = await fetch('/api/auth/refresh', {
      method: 'POST',
      cache: 'no-store',
    }).catch(() => null)

    if (refresh?.ok) {
      const second = await fetchOnce({
        path,
        method,
        body,
        query,
        signal,
      })

      if (!second.response.ok) {
        throw toError(second.response, second.payload)
      }

      return second.payload
    }
  }

  if (!first.response.ok) {
    throw toError(first.response, first.payload)
  }

  return first.payload
}

export const getErrorMessage = (error, fallback) => {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error.payload?.error) return String(error.payload.error)
  if (error.message) return String(error.message)
  return fallback
}

export const isUnauthorized = (error) => error?.status === 401
