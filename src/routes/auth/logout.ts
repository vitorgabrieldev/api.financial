import { z } from 'zod'
import { AppError, UnauthorizedError } from '../../core/errors'
import { env } from '../../core/env'
import {
  createPublicHandler,
  jsonResponse,
  parseJsonBody,
} from '../../core/http'

const authLogoutSchema = z.object({
  access_token: z.string().trim().min(1).optional(),
  scope: z.enum(['global', 'local']).default('global'),
})

const readBearerTokenFromHeader = (authorization: string | string[] | undefined): string => {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization
  if (!raw || !raw.startsWith('Bearer ')) {
    throw new UnauthorizedError('Access token não informado para logout.')
  }

  const token = raw.slice('Bearer '.length).trim()
  if (!token) {
    throw new UnauthorizedError('Access token não informado para logout.')
  }

  return token
}

export default createPublicHandler(
  { methods: ['POST'] },
  async ({ req, res }) => {
    const payload = authLogoutSchema.parse(await parseJsonBody(req))
    const accessToken =
      payload.access_token?.trim() ||
      readBearerTokenFromHeader(req.headers.authorization)

    const endpoint = new URL('/auth/v1/logout', env.supabaseUrl)
    endpoint.searchParams.set('scope', payload.scope)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new AppError(
        response.status,
        body || 'Falha ao encerrar sessão no Supabase.',
        undefined,
        'AUTH_LOGOUT_FAILED',
      )
    }

    jsonResponse(res, 200, {
      data: {
        revoked: true,
        scope: payload.scope,
      },
    })
  },
)
