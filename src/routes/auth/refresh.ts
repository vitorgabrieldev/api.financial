import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { serializeAuthSession } from '../../core/auth-session'
import { AppError } from '../../core/errors'
import { env } from '../../core/env'
import {
  createPublicHandler,
  jsonResponse,
  parseJsonBody,
} from '../../core/http'

const authRefreshSchema = z.object({
  refresh_token: z.string().trim().min(1),
})

const sharedAuthOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
}

export default createPublicHandler(
  { methods: ['POST'] },
  async ({ req, res }) => {
    const payload = authRefreshSchema.parse(await parseJsonBody(req))

    const supabase = createClient(
      env.supabaseUrl,
      env.supabaseAnonKey,
      sharedAuthOptions,
    )

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: payload.refresh_token,
    })

    if (error || !data.session?.access_token) {
      throw new AppError(
        401,
        error?.message || 'Falha ao renovar sessão do usuário.',
        undefined,
        'AUTH_REFRESH_FAILED',
      )
    }

    jsonResponse(res, 200, {
      data: {
        ...serializeAuthSession(data.session, data.user ?? data.session.user ?? null),
      },
    })
  },
)
