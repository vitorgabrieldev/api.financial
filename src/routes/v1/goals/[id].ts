import { AppError, NotFoundError } from '../../../core/errors'
import {
  createAuthHandler,
  jsonResponse,
  parseJsonBody,
} from '../../../core/http'
import { requireModulePermission } from '../../../core/permissions'
import {
  goalUpdateSchema,
  idParamSchema,
} from '../../../core/schemas'

const readId = (value: string | string[] | undefined, requestUrl?: string): string => {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw) {
    return idParamSchema.parse({ id: raw }).id
  }

  const pathname = requestUrl
    ? new URL(requestUrl, 'http://localhost').pathname
    : ''
  const fallback = pathname.split('/').filter(Boolean).pop()
  return idParamSchema.parse({ id: fallback }).id
}

export default createAuthHandler(
  { methods: ['GET', 'PATCH', 'DELETE'] },
  async ({ req, res, supabase, userId }) => {
    const id = readId(req.query.id, req.url)

    if (req.method === 'GET') {
      await requireModulePermission(supabase, userId, 'goals', 'view')

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        throw new AppError(
          500,
          `Falha ao carregar meta: ${error.message}`,
          undefined,
          'GOALS_GET_FAILED',
        )
      }

      if (!data) {
        throw new NotFoundError('Meta não encontrada.')
      }

      jsonResponse(res, 200, { data })
      return
    }

    if (req.method === 'PATCH') {
      await requireModulePermission(supabase, userId, 'goals', 'edit')

      const payload = goalUpdateSchema.parse(await parseJsonBody(req))

      const { data, error } = await supabase
        .from('goals')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', id)
        .select('*')
        .maybeSingle()

      if (error) {
        throw new AppError(
          400,
          `Falha ao atualizar meta: ${error.message}`,
          undefined,
          'GOALS_UPDATE_FAILED',
        )
      }

      if (!data) {
        throw new NotFoundError('Meta não encontrada.')
      }

      jsonResponse(res, 200, { data })
      return
    }

    await requireModulePermission(supabase, userId, 'goals', 'delete')

    const { data, error } = await supabase
      .from('goals')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      throw new AppError(
        400,
        `Falha ao excluir meta: ${error.message}`,
        undefined,
        'GOALS_DELETE_FAILED',
      )
    }

    if (!data) {
      throw new NotFoundError('Meta não encontrada.')
    }

    jsonResponse(res, 200, { deleted: true, id: data.id })
  },
)
