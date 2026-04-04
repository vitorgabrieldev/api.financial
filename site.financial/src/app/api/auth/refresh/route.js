import { NextResponse } from 'next/server'
import { coreFetch } from '@/lib/core-api'
import {
  readSessionFromRequest,
  setSessionCookies,
} from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const session = readSessionFromRequest(request)

  if (!session.refreshToken) {
    return NextResponse.json(
      { code: 'AUTH_REFRESH_MISSING', error: 'Refresh token ausente.' },
      { status: 401 },
    )
  }

  const result = await coreFetch({
    path: '/api/auth/refresh',
    method: 'POST',
    body: { refresh_token: session.refreshToken },
  })

  if (!result.ok) {
    const payload =
      typeof result.payload === 'string'
        ? { code: 'AUTH_REFRESH_FAILED', error: result.payload }
        : result.payload

    return NextResponse.json(payload, { status: result.status })
  }

  const nextSession = result.payload?.data

  if (!nextSession?.access_token) {
    return NextResponse.json(
      { code: 'AUTH_REFRESH_FAILED', error: 'Sessão inválida no refresh.' },
      { status: 401 },
    )
  }

  const response = NextResponse.json({
    data: {
      user: nextSession.user ?? null,
      expires_at: nextSession.expires_at ?? null,
    },
  })

  setSessionCookies(response, nextSession)
  return response
}
