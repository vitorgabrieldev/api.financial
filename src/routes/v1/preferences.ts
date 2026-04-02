import { AppError } from '../../core/errors'
import {
  createAuthHandler,
  jsonResponse,
  parseJsonBody,
} from '../../core/http'
import { preferencesUpdateSchema } from '../../core/schemas'

export default createAuthHandler(
  { methods: ['GET', 'PATCH'] },
  async ({ req, res, supabase, userId }) => {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        throw new AppError(
          500,
          `Falha ao carregar preferências: ${error.message}`,
          undefined,
          'PREFERENCES_GET_FAILED',
        )
      }

      if (!data) {
        const { data: created, error: createError } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: userId,
            default_currency: 'BRL',
            locale: 'pt-BR',
            session_max_hours: 4,
          })
          .select('*')
          .single()

        if (createError) {
          throw new AppError(
            400,
            `Falha ao criar preferências iniciais: ${createError.message}`,
            undefined,
            'PREFERENCES_BOOTSTRAP_FAILED',
          )
        }

        jsonResponse(res, 200, { data: created })
        return
      }

      jsonResponse(res, 200, { data })
      return
    }

    const payload = preferencesUpdateSchema.parse(await parseJsonBody(req))

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        ...payload,
      })
      .select('*')
      .single()

    if (error) {
      throw new AppError(
        400,
        `Falha ao salvar preferências: ${error.message}`,
        undefined,
        'PREFERENCES_UPDATE_FAILED',
      )
    }

    jsonResponse(res, 200, { data })
  },
)
