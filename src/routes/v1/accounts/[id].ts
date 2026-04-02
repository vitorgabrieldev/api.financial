import { AppError, NotFoundError } from '../../../core/errors'
import {
  createAuthHandler,
  jsonResponse,
  parseJsonBody,
} from '../../../core/http'
import { requireModulePermission } from '../../../core/permissions'
import {
  accountUpdateSchema,
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
      await requireModulePermission(supabase, userId, 'accounts', 'view')

      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        throw new AppError(
          500,
          `Falha ao carregar conta: ${error.message}`,
          undefined,
          'ACCOUNTS_GET_FAILED',
        )
      }

      if (!data) {
        throw new NotFoundError('Conta não encontrada.')
      }

      jsonResponse(res, 200, { data })
      return
    }

    if (req.method === 'PATCH') {
      await requireModulePermission(supabase, userId, 'accounts', 'edit')

      const payload = accountUpdateSchema.parse(await parseJsonBody(req))

      const { data, error } = await supabase
        .from('accounts')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', id)
        .select('*')
        .maybeSingle()

      if (error) {
        throw new AppError(
          400,
          `Falha ao atualizar conta: ${error.message}`,
          undefined,
          'ACCOUNTS_UPDATE_FAILED',
        )
      }

      if (!data) {
        throw new NotFoundError('Conta não encontrada.')
      }

      jsonResponse(res, 200, { data })
      return
    }

    await requireModulePermission(supabase, userId, 'accounts', 'delete')

    const { data, error } = await supabase
      .from('accounts')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      throw new AppError(
        400,
        `Falha ao excluir conta: ${error.message}`,
        undefined,
        'ACCOUNTS_DELETE_FAILED',
      )
    }

    if (!data) {
      throw new NotFoundError('Conta não encontrada.')
    }

    jsonResponse(res, 200, { deleted: true, id: data.id })
  },
)
