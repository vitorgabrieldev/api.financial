import { AppError } from '../../../core/errors'
import {
  createAuthHandler,
  jsonResponse,
  parseJsonBody,
  queryToObject,
} from '../../../core/http'
import { buildPagination, resolvePagination } from '../../../core/pagination'
import { requireModulePermission } from '../../../core/permissions'
import {
  ACCOUNT_SORT_FIELDS,
  accountCreateSchema,
  accountListQuerySchema,
} from '../../../core/schemas'

const accountSortColumnMap: Record<(typeof ACCOUNT_SORT_FIELDS)[number], string> = {
  created_at: 'created_at',
  name: 'name',
  initial_balance: 'initial_balance',
}

export default createAuthHandler(
  { methods: ['GET', 'POST'] },
  async ({ req, res, supabase, userId, query }) => {
    if (req.method === 'GET') {
      await requireModulePermission(supabase, userId, 'accounts', 'list')

      const filters = accountListQuerySchema.parse(queryToObject(query))
      const pagination = resolvePagination({
        limit: filters.limit,
        offset: filters.offset,
        cursor: filters.cursor,
        sort: filters.sort,
        order: filters.order,
      })
      const sortColumn =
        accountSortColumnMap[pagination.sort as keyof typeof accountSortColumnMap]
      const ascending = pagination.order === 'asc'

      let dbQuery = supabase
        .from('accounts')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order(sortColumn, { ascending })
        .order('id', { ascending })

      if (!filters.include_archived) {
        dbQuery = dbQuery.eq('is_archived', false)
      }

      if (filters.search) {
        dbQuery = dbQuery.ilike('name', `%${filters.search}%`)
      }

      const from = pagination.offset
      const to = pagination.offset + pagination.limit - 1

      const { data, error, count } = await dbQuery.range(from, to)

      if (error) {
        throw new AppError(
          500,
          `Falha ao carregar contas: ${error.message}`,
          undefined,
          'ACCOUNTS_LIST_FAILED',
        )
      }

      const rows = data ?? []

      jsonResponse(res, 200, {
        data: rows,
        pagination: buildPagination({
          limit: pagination.limit,
          offset: pagination.offset,
          total: count ?? 0,
          currentCount: rows.length,
          sort: pagination.sort,
          order: pagination.order,
        }),
      })
      return
    }

    await requireModulePermission(supabase, userId, 'accounts', 'create')

    const payload = accountCreateSchema.parse(await parseJsonBody(req))

    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        ...payload,
      })
      .select('*')
      .single()

    if (error) {
      throw new AppError(
        400,
        `Falha ao criar conta: ${error.message}`,
        undefined,
        'ACCOUNTS_CREATE_FAILED',
      )
    }

    jsonResponse(res, 201, { data })
  },
)
