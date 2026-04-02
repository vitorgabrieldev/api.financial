import {
  API_CHANGELOG,
  API_CURRENT_VERSION,
} from '../core/changelog'
import { createPublicHandler, jsonResponse } from '../core/http'

export default createPublicHandler({ methods: ['GET'] }, async ({ res }) => {
  jsonResponse(res, 200, {
    current_version: API_CURRENT_VERSION,
    data: API_CHANGELOG,
  })
})
