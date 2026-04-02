import type { VercelRequest, VercelResponse } from '@vercel/node'
import { routeApiRequest } from '../src/routes/router'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  await routeApiRequest(req, res)
}
