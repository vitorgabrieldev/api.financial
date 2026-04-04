const normalizePath = (path) => {
  if (!path) return '/api'
  if (path.startsWith('/api')) return path
  if (path.startsWith('/')) return `/api${path}`
  return `/api/${path}`
}

const resolveCoreApiBaseUrl = () => {
  const fromEnv =
    process.env.CORE_API_BASE_URL ??
    process.env.API_BASE_URL

  if (fromEnv) return fromEnv

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000'
  }

  throw new Error(
    'CORE_API_BASE_URL não configurada (use .env.local da raiz do projeto).',
  )
}

const resolveCoreApiKey = () => {
  const key =
    process.env.CORE_API_KEY ??
    process.env.API_KEY

  if (key) return key

  throw new Error(
    'CORE_API_KEY/API_KEY não configurada (use .env.local da raiz do projeto).',
  )
}

const buildUrl = (path, searchParams) => {
  const baseUrl = resolveCoreApiBaseUrl()

  const normalizedPath = normalizePath(path)
  const url = new URL(normalizedPath, baseUrl)

  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.set(key, value)
    }
  }

  return url
}

export const coreFetch = async ({
  path,
  method = 'GET',
  body,
  token,
  searchParams,
  headers,
}) => {
  const apiKey = resolveCoreApiKey()

  const url = buildUrl(path, searchParams)
  const requestHeaders = new Headers(headers ?? {})

  requestHeaders.set('X-API-Key', apiKey)
  requestHeaders.set('Accept', 'application/json')

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  const hasBody = body !== undefined
  if (hasBody) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: hasBody ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json() : await response.text()

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    payload,
  }
}
