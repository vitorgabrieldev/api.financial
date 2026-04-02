import { AppError } from '../../../core/errors'
import {
  createAuthHandler,
  jsonResponse,
  queryToObject,
} from '../../../core/http'
import { requireModulePermission } from '../../../core/permissions'
import { reportQuerySchema } from '../../../core/schemas'

export default createAuthHandler(
  { methods: ['GET'] },
  async ({ res, supabase, userId, query }) => {
    await requireModulePermission(supabase, userId, 'reports', 'list')

    const filters = reportQuerySchema.parse(queryToObject(query))

    let dbQuery = supabase
      .from('monthly_report')
      .select('*')
      .eq('user_id', userId)
      .order('month_start', { ascending: false })

    if (filters.from) {
      dbQuery = dbQuery.gte('month_start', filters.from)
    }

    if (filters.to) {
      dbQuery = dbQuery.lte('month_start', filters.to)
    }

    const { data, error } = await dbQuery

    if (error) {
      throw new AppError(
        500,
        `Falha ao carregar relatório mensal: ${error.message}`,
        undefined,
        'REPORTS_MONTHLY_LIST_FAILED',
      )
    }

    jsonResponse(res, 200, { data: data ?? [] })
  },
)
