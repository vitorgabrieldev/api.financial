import { AppError, NotFoundError } from '../../../core/errors'
import {
  createAuthHandler,
  jsonResponse,
  parseJsonBody,
} from '../../../core/http'
import { requireModulePermission } from '../../../core/permissions'
import {
  categoryUpdateSchema,
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
      await requireModulePermission(supabase, userId, 'categories', 'view')

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        throw new AppError(
          500,
          `Falha ao carregar categoria: ${error.message}`,
          undefined,
          'CATEGORIES_GET_FAILED',
        )
      }

      if (!data) {
        throw new NotFoundError('Categoria não encontrada.')
      }

      jsonResponse(res, 200, { data })
      return
    }

    if (req.method === 'PATCH') {
      await requireModulePermission(supabase, userId, 'categories', 'edit')

      const payload = categoryUpdateSchema.parse(await parseJsonBody(req))

      const { data, error } = await supabase
        .from('categories')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', id)
        .select('*')
        .maybeSingle()

      if (error) {
        throw new AppError(
          400,
          `Falha ao atualizar categoria: ${error.message}`,
          undefined,
          'CATEGORIES_UPDATE_FAILED',
        )
      }

      if (!data) {
        throw new NotFoundError('Categoria não encontrada.')
      }

      jsonResponse(res, 200, { data })
      return
    }

    await requireModulePermission(supabase, userId, 'categories', 'delete')

    const { data, error } = await supabase
      .from('categories')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      throw new AppError(
        400,
        `Falha ao excluir categoria: ${error.message}`,
        undefined,
        'CATEGORIES_DELETE_FAILED',
      )
    }

    if (!data) {
      throw new NotFoundError('Categoria não encontrada.')
    }

    jsonResponse(res, 200, { deleted: true, id: data.id })
  },
)
