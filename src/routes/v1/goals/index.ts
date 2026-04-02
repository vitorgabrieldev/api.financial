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
  GOAL_SORT_FIELDS,
  goalCreateSchema,
  goalListQuerySchema,
} from '../../../core/schemas'

const goalSortColumnMap: Record<(typeof GOAL_SORT_FIELDS)[number], string> = {
  created_at: 'created_at',
  name: 'name',
  target_amount: 'target_amount',
  current_amount: 'current_amount',
  status: 'status',
}

export default createAuthHandler(
  { methods: ['GET', 'POST'] },
  async ({ req, res, supabase, userId, query }) => {
    if (req.method === 'GET') {
      await requireModulePermission(supabase, userId, 'goals', 'list')

      const filters = goalListQuerySchema.parse(queryToObject(query))
      const pagination = resolvePagination({
        limit: filters.limit,
        offset: filters.offset,
        cursor: filters.cursor,
        sort: filters.sort,
        order: filters.order,
      })
      const sortColumn =
        goalSortColumnMap[pagination.sort as keyof typeof goalSortColumnMap]
      const ascending = pagination.order === 'asc'

      let dbQuery = supabase
        .from('goals')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order(sortColumn, { ascending })
        .order('id', { ascending })

      if (filters.status) {
        dbQuery = dbQuery.eq('status', filters.status)
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
          `Falha ao carregar metas: ${error.message}`,
          undefined,
          'GOALS_LIST_FAILED',
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

    await requireModulePermission(supabase, userId, 'goals', 'create')

    const payload = goalCreateSchema.parse(await parseJsonBody(req))

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        ...payload,
      })
      .select('*')
      .single()

    if (error) {
      throw new AppError(
        400,
        `Falha ao criar meta: ${error.message}`,
        undefined,
        'GOALS_CREATE_FAILED',
      )
    }

    jsonResponse(res, 201, { data })
  },
)
