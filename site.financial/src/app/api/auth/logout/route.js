import { NextResponse } from 'next/server'
import { coreFetch } from '@/lib/core-api'
import { clearSessionCookies, readSessionFromRequest } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const session = readSessionFromRequest(request)

  if (session.accessToken) {
    await coreFetch({
      path: '/api/auth/logout',
      method: 'POST',
      body: {
        access_token: session.accessToken,
        scope: 'global',
      },
      token: session.accessToken,
    }).catch(() => null)
  }

  const response = NextResponse.json({ data: { revoked: true } })
  clearSessionCookies(response)
  return response
}
