import { createPublicHandler, jsonResponse } from '../../core/http'

export default createPublicHandler({ methods: ['GET'] }, async ({ res }) => {
  jsonResponse(res, 200, {
    version: 'v2',
    status: 'planned',
    message:
      'A versão v2 ainda não está publicada. Continue usando /api/v1 em produção.',
  })
})
