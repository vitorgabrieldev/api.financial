import { API_CURRENT_VERSION } from '../core/changelog'
import { createPublicHandler, jsonResponse } from '../core/http'

export default createPublicHandler({ methods: ['GET'] }, async ({ res }) => {
  jsonResponse(res, 200, {
    name: 'Api Financial COre',
    version: `v${API_CURRENT_VERSION}`,
    healthcheck: '/api/health',
    docs: '/docs',
    openapi: '/api/openapi.json',
    changelog: '/api/changelog',
    endpoints: {
      auth_login: '/api/auth/login',
      auth_refresh: '/api/auth/refresh',
      auth_logout: '/api/auth/logout',
      version_v1: '/api/v1',
      version_v2: '/api/v2',
      preferences: '/api/v1/preferences',
      dashboard_summary: '/api/v1/dashboard/summary',
      accounts: '/api/v1/accounts',
      categories: '/api/v1/categories',
      goals: '/api/v1/goals',
      transactions: '/api/v1/transactions',
      reports_monthly: '/api/v1/reports/monthly',
      reports_categories: '/api/v1/reports/categories',
    },
  })
})