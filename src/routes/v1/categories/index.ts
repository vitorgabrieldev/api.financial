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
  CATEGORY_SORT_FIELDS,
  categoryCreateSchema,
  categoryListQuerySchema,
} from '../../../core/schemas'

const categorySortColumnMap: Record<(typeof CATEGORY_SORT_FIELDS)[number], string> = {
  name: 'name',
  kind: 'kind',
  created_at: 'created_at',
}

export default createAuthHandler(
  { methods: ['GET', 'POST'] },
  async ({ req, res, supabase, userId, query }) => {
    if (req.method === 'GET') {
      await requireModulePermission(supabase, userId, 'categories', 'list')

      const filters = categoryListQuerySchema.parse(queryToObject(query))
      const pagination = resolvePagination({
        limit: filters.limit,
        offset: filters.offset,
        cursor: filters.cursor,
        sort: filters.sort,
        order: filters.order,
      })
      const sortColumn =
        categorySortColumnMap[pagination.sort as keyof typeof categorySortColumnMap]
      const ascending = pagination.order === 'asc'

      let dbQuery = supabase
        .from('categories')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order(sortColumn, { ascending })
        .order('id', { ascending })

      if (filters.kind) {
        dbQuery = dbQuery.eq('kind', filters.kind)
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
          `Falha ao carregar categorias: ${error.message}`,
          undefined,
          'CATEGORIES_LIST_FAILED',
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

    await requireModulePermission(supabase, userId, 'categories', 'create')

    const payload = categoryCreateSchema.parse(await parseJsonBody(req))

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        ...payload,
      })
      .select('*')
      .single()

    if (error) {
      throw new AppError(
        400,
        `Falha ao criar categoria: ${error.message}`,
        undefined,
        'CATEGORIES_CREATE_FAILED',
      )
    }

    jsonResponse(res, 201, { data })
  },
)
