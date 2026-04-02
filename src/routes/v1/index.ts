import {
  API_CHANGELOG,
  API_CURRENT_VERSION,
} from '../../core/changelog'
import { createPublicHandler, jsonResponse } from '../../core/http'

const stableEntry = API_CHANGELOG.find((item) => item.version === API_CURRENT_VERSION)

export default createPublicHandler({ methods: ['GET'] }, async ({ res }) => {
  jsonResponse(res, 200, {
    version: 'v1',
    status: 'stable',
    openapi: '/api/openapi.json',
    changelog: '/api/changelog',
    latest_release: stableEntry ?? null,
  })
})
