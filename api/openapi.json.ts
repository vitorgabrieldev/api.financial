import { createPublicHandler, jsonResponse } from '../src/core/http'
import { createOpenApiSpec } from '../src/core/openapi'

export default createPublicHandler(
  { methods: ['GET'] },
  async ({ res, url }) => {
    const spec = createOpenApiSpec(url.origin)
    jsonResponse(res, 200, spec)
  },
)

