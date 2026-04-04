import { cookies } from 'next/headers'

export const SESSION_COOKIES = {
  accessToken: 'fc_access_token',
  refreshToken: 'fc_refresh_token',
  expiresAt: 'fc_expires_at',
}

const isProd = process.env.NODE_ENV === 'production'

const normalizeCookieStore = async (storeLike) => {
  if (storeLike && typeof storeLike.then === 'function') {
    return await storeLike
  }
  return storeLike
}

export const readSessionFromRequest = (request) => {
  return {
    accessToken: request.cookies.get(SESSION_COOKIES.accessToken)?.value ?? '',
    refreshToken: request.cookies.get(SESSION_COOKIES.refreshToken)?.value ?? '',
    expiresAt: request.cookies.get(SESSION_COOKIES.expiresAt)?.value ?? '',
  }
}

export const getServerSession = async () => {
  const store = await normalizeCookieStore(cookies())

  return {
    accessToken: store.get(SESSION_COOKIES.accessToken)?.value ?? '',
    refreshToken: store.get(SESSION_COOKIES.refreshToken)?.value ?? '',
    expiresAt: store.get(SESSION_COOKIES.expiresAt)?.value ?? '',
  }
}

export const setSessionCookies = (response, session) => {
  const expiresAt = Number(session.expires_at ?? 0)
  const nowInSeconds = Math.floor(Date.now() / 1000)
  const maxAge = expiresAt > nowInSeconds ? expiresAt - nowInSeconds : 60 * 60 * 4

  response.cookies.set(SESSION_COOKIES.accessToken, session.access_token ?? '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge,
  })

  response.cookies.set(SESSION_COOKIES.refreshToken, session.refresh_token ?? '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  response.cookies.set(SESSION_COOKIES.expiresAt, String(session.expires_at ?? ''), {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export const clearSessionCookies = (response) => {
  response.cookies.set(SESSION_COOKIES.accessToken, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  response.cookies.set(SESSION_COOKIES.refreshToken, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  response.cookies.set(SESSION_COOKIES.expiresAt, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
