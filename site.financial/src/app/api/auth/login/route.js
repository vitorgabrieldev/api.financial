import { NextResponse } from 'next/server'
import { coreFetch } from '@/lib/core-api'
import { setSessionCookies } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  let body

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', error: 'Body JSON inválido.' },
      { status: 400 },
    )
  }

  const result = await coreFetch({
    path: '/api/auth/login',
    method: 'POST',
    body,
  })

  if (!result.ok) {
    const payload =
      typeof result.payload === 'string'
        ? { code: 'AUTH_LOGIN_FAILED', error: result.payload }
        : result.payload

    return NextResponse.json(payload, { status: result.status })
  }

  const session = result.payload?.data

  if (!session?.access_token) {
    return NextResponse.json(
      { code: 'AUTH_LOGIN_FAILED', error: 'Sessão inválida no login.' },
      { status: 401 },
    )
  }

  const response = NextResponse.json({
    data: {
      user: session.user ?? null,
      expires_at: session.expires_at ?? null,
    },
  })

  setSessionCookies(response, session)
  return response
}
