const RATE_CACHE_KEY = 'mfo.fx-cache-v1'
const CACHE_TTL_MS = 30 * 60 * 1000

interface CachedRate {
  rate: number
  fetchedAt: number
}

type CacheRecord = Record<string, CachedRate>

const readCache = (): CacheRecord => {
  const raw = window.localStorage.getItem(RATE_CACHE_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as CacheRecord
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeCache = (cache: CacheRecord): void => {
  window.localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(cache))
}

const cacheKey = (from: string, to: string): string =>
  `${from.toUpperCase()}_${to.toUpperCase()}`

export const getExchangeRate = async (
  from: string,
  to: string,
): Promise<number> => {
  const source = from.toUpperCase()
  const target = to.toUpperCase()

  if (source === target) return 1

  const key = cacheKey(source, target)
  const cache = readCache()
  const cached = cache[key]

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate
  }

  const response = await fetch(
    `https://api.frankfurter.app/latest?from=${source}&to=${target}`,
  )

  if (!response.ok) {
    throw new Error('Falha ao buscar taxa de câmbio.')
  }

  const payload = (await response.json()) as { rates?: Record<string, number> }
  const rate = payload.rates?.[target]

  if (!rate || Number.isNaN(rate)) {
    throw new Error('Taxa de câmbio indisponível para a moeda selecionada.')
  }

  cache[key] = { rate, fetchedAt: Date.now() }
  writeCache(cache)

  return rate
}
