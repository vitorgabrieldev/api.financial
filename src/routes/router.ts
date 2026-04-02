import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
) => Promise<void> | void

type HandlerModule = { default: ApiHandler }

interface RouteDefinition {
  id: string
  pattern: RegExp
  params?: string[]
  load: () => Promise<ApiHandler>
}

interface ResolvedRoute {
  definition: RouteDefinition
  params: Record<string, string>
}

const handlerCache = new Map<string, Promise<ApiHandler>>()

const loadCachedHandler = (
  key: string,
  loadModule: () => Promise<HandlerModule>,
): Promise<ApiHandler> => {
  const cached = handlerCache.get(key)
  if (cached) {
    return cached
  }

  const pending = loadModule().then((module) => module.default)
  handlerCache.set(key, pending)
  return pending
}

const defineLoader = (
  key: string,
  loadModule: () => Promise<HandlerModule>,
): (() => Promise<ApiHandler>) => {
  return () => loadCachedHandler(key, loadModule)
}

const routeDefinitions: RouteDefinition[] = [
  {
    id: 'root',
    pattern: /^\/api$/,
    load: defineLoader('root', () => import('./index')),
  },
  {
    id: 'health',
    pattern: /^\/api\/health$/,
    load: defineLoader('health', () => import('./health')),
  },
  {
    id: 'changelog',
    pattern: /^\/api\/changelog$/,
    load: defineLoader('changelog', () => import('./changelog')),
  },
  {
    id: 'openapi',
    pattern: /^\/api\/openapi\.json$/,
    load: defineLoader('openapi', () => import('./openapi.json')),
  },
  {
    id: 'auth-login',
    pattern: /^\/api\/auth\/login$/,
    load: defineLoader('auth-login', () => import('./auth/login')),
  },
  {
    id: 'auth-refresh',
    pattern: /^\/api\/auth\/refresh$/,
    load: defineLoader('auth-refresh', () => import('./auth/refresh')),
  },
  {
    id: 'auth-logout',
    pattern: /^\/api\/auth\/logout$/,
    load: defineLoader('auth-logout', () => import('./auth/logout')),
  },
  {
    id: 'v1-meta',
    pattern: /^\/api\/v1$/,
    load: defineLoader('v1-meta', () => import('./v1/index')),
  },
  {
    id: 'v2-meta',
    pattern: /^\/api\/v2$/,
    load: defineLoader('v2-meta', () => import('./v2/index')),
  },
  {
    id: 'preferences',
    pattern: /^\/api\/v1\/preferences$/,
    load: defineLoader('preferences', () => import('./v1/preferences')),
  },
  {
    id: 'accounts-list',
    pattern: /^\/api\/v1\/accounts$/,
    load: defineLoader('accounts-list', () => import('./v1/accounts/index')),
  },
  {
    id: 'accounts-item',
    pattern: /^\/api\/v1\/accounts\/([^/]+)$/,
    params: ['id'],
    load: defineLoader('accounts-item', () => import('./v1/accounts/[id]')),
  },
  {
    id: 'categories-list',
    pattern: /^\/api\/v1\/categories$/,
    load: defineLoader('categories-list', () => import('./v1/categories/index')),
  },
  {
    id: 'categories-item',
    pattern: /^\/api\/v1\/categories\/([^/]+)$/,
    params: ['id'],
    load: defineLoader('categories-item', () => import('./v1/categories/[id]')),
  },
  {
    id: 'goals-list',
    pattern: /^\/api\/v1\/goals$/,
    load: defineLoader('goals-list', () => import('./v1/goals/index')),
  },
  {
    id: 'goals-item',
    pattern: /^\/api\/v1\/goals\/([^/]+)$/,
    params: ['id'],
    load: defineLoader('goals-item', () => import('./v1/goals/[id]')),
  },
  {
    id: 'transactions-list',
    pattern: /^\/api\/v1\/transactions$/,
    load: defineLoader('transactions-list', () => import('./v1/transactions/index')),
  },
  {
    id: 'transactions-item',
    pattern: /^\/api\/v1\/transactions\/([^/]+)$/,
    params: ['id'],
    load: defineLoader('transactions-item', () => import('./v1/transactions/[id]')),
  },
  {
    id: 'dashboard-summary',
    pattern: /^\/api\/v1\/dashboard\/summary$/,
    load: defineLoader('dashboard-summary', () => import('./v1/dashboard/summary')),
  },
  {
    id: 'reports-monthly',
    pattern: /^\/api\/v1\/reports\/monthly$/,
    load: defineLoader('reports-monthly', () => import('./v1/reports/monthly')),
  },
  {
    id: 'reports-categories',
    pattern: /^\/api\/v1\/reports\/categories$/,
    load: defineLoader('reports-categories', () => import('./v1/reports/categories')),
  },
]

const rewritePathParam = '__route_path'

const normalizedPathname = (rawPathname: string): string => {
  if (!rawPathname) {
    return '/'
  }

  if (rawPathname.length > 1 && rawPathname.endsWith('/')) {
    return rawPathname.slice(0, -1)
  }

  return rawPathname
}

const parseRequestUrl = (req: VercelRequest): URL => {
  const rawUrl = req.url ?? '/'
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return new URL(rawUrl)
  }

  const host = req.headers.host ?? 'localhost'
  const forwardedProto = req.headers['x-forwarded-proto']
  const firstForwarded = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto
  const fallbackProtocol =
    host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https'
  const protocol = (firstForwarded ?? fallbackProtocol).split(',')[0]?.trim() || fallbackProtocol

  return new URL(rawUrl, `${protocol}://${host}`)
}

export const resolveApiRoute = (pathname: string): ResolvedRoute | undefined => {
  const normalized = normalizedPathname(pathname)

  for (const definition of routeDefinitions) {
    const match = definition.pattern.exec(normalized)
    if (!match) {
      continue
    }

    const params: Record<string, string> = {}

    if (definition.params) {
      for (const [index, key] of definition.params.entries()) {
        const value = match[index + 1]
        if (value) {
          params[key] = decodeURIComponent(value)
        }
      }
    }

    return { definition, params }
  }

  return undefined
}

const routeCacheControl: Record<string, string> = {
  root: 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
  health: 'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
  changelog: 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600',
  openapi: 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600',
  'v1-meta': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
  'v2-meta': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
}

export const getCacheControlForRoute = (
  routeId: string,
  method?: string,
): string => {
  if ((method ?? 'GET').toUpperCase() !== 'GET') {
    return 'no-store'
  }

  return routeCacheControl[routeId] ?? 'no-store'
}

const setRouteParams = (
  req: VercelRequest,
  params: Record<string, string>,
): void => {
  if (Object.keys(params).length === 0) {
    return
  }

  const query = { ...(req.query as Record<string, string | string[]>) }

  for (const [key, value] of Object.entries(params)) {
    if (!query[key]) {
      query[key] = value
    }
  }

  req.query = query as VercelRequest['query']
}

export const routeApiRequest = async (
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> => {
  const runtimeUrl = parseRequestUrl(req)
  const rewrittenPath = runtimeUrl.searchParams.get(rewritePathParam)
  const effectivePath = rewrittenPath
    ? `/api/${rewrittenPath.replace(/^\/+/, '')}`
    : runtimeUrl.pathname

  if (runtimeUrl.searchParams.has(rewritePathParam)) {
    runtimeUrl.searchParams.delete(rewritePathParam)
    const query = runtimeUrl.searchParams.toString()
    req.url = query ? `${effectivePath}?${query}` : effectivePath

    const sanitizedQuery = { ...(req.query as Record<string, string | string[]>) }
    delete sanitizedQuery[rewritePathParam]
    req.query = sanitizedQuery as VercelRequest['query']
  }

  const resolved = resolveApiRoute(effectivePath)

  if (!resolved) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(404).json({
      code: 'NOT_FOUND',
      error: `Rota não encontrada: ${req.method ?? 'UNKNOWN'} ${effectivePath}`,
    })
    return
  }

  res.setHeader(
    'Cache-Control',
    getCacheControlForRoute(resolved.definition.id, req.method),
  )

  setRouteParams(req, resolved.params)
  const handler = await resolved.definition.load()
  await handler(req, res)
}
