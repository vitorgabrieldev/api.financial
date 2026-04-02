import { AppError } from '../../../core/errors'
import {
  createAuthHandler,
  jsonResponse,
  queryToObject,
} from '../../../core/http'
import { requireModulePermission } from '../../../core/permissions'
import { categoryReportQuerySchema } from '../../../core/schemas'

export default createAuthHandler(
  { methods: ['GET'] },
  async ({ res, supabase, userId, query }) => {
    await requireModulePermission(supabase, userId, 'reports', 'list')

    const filters = categoryReportQuerySchema.parse(queryToObject(query))

    let dbQuery = supabase
      .from('category_report')
      .select('*')
      .eq('user_id', userId)
      .order('month_start', { ascending: false })

    if (filters.from) {
      dbQuery = dbQuery.gte('month_start', filters.from)
    }

    if (filters.to) {
      dbQuery = dbQuery.lte('month_start', filters.to)
    }

    if (filters.kind) {
      dbQuery = dbQuery.eq('kind', filters.kind)
    }

    if (filters.category_id) {
      dbQuery = dbQuery.eq('category_id', filters.category_id)
    }

    const { data, error } = await dbQuery

    if (error) {
      throw new AppError(
        500,
        `Falha ao carregar relatório por categoria: ${error.message}`,
        undefined,
        'REPORTS_CATEGORIES_LIST_FAILED',
      )
    }

    jsonResponse(res, 200, { data: data ?? [] })
  },
)
