import { createPublicHandler, jsonResponse } from '../core/http'
import { createOpenApiSpec } from '../core/openapi'

export default createPublicHandler(
  { methods: ['GET'] },
  async ({ res, url }) => {
    const spec = createOpenApiSpec(url.origin)
    jsonResponse(res, 200, spec)
  },
)

