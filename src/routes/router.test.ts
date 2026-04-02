import { describe, expect, it } from 'vitest'
import {
  getCacheControlForRoute,
  resolveApiRoute,
} from './router'

describe('resolveApiRoute', () => {
  it('resolves root route with and without trailing slash', () => {
    expect(resolveApiRoute('/api')?.definition.id).toBe('root')
    expect(resolveApiRoute('/api/')?.definition.id).toBe('root')
  })

  it('resolves dynamic id routes and decodes params', () => {
    const accountRoute = resolveApiRoute('/api/v1/accounts/abc-123')
    expect(accountRoute?.definition.id).toBe('accounts-item')
    expect(accountRoute?.params.id).toBe('abc-123')

    const categoryRoute = resolveApiRoute('/api/v1/categories/food%20home')
    expect(categoryRoute?.definition.id).toBe('categories-item')
    expect(categoryRoute?.params.id).toBe('food home')
  })

  it('returns undefined for unknown paths', () => {
    expect(resolveApiRoute('/api/unknown')).toBeUndefined()
    expect(resolveApiRoute('/foo')).toBeUndefined()
  })
})

describe('getCacheControlForRoute', () => {
  it('uses edge caching only for selected GET routes', () => {
    expect(getCacheControlForRoute('root', 'GET')).toContain('s-maxage=300')
    expect(getCacheControlForRoute('health', 'GET')).toContain('s-maxage=30')
    expect(getCacheControlForRoute('accounts-list', 'GET')).toBe('no-store')
  })

  it('disables cache for non-GET methods', () => {
    expect(getCacheControlForRoute('root', 'POST')).toBe('no-store')
    expect(getCacheControlForRoute('health', 'PATCH')).toBe('no-store')
  })
})
