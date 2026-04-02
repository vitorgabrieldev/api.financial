import path from 'node:path'
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { routeApiRequest } from '../routes/router'

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
) => Promise<void> | void

const app = express()
const docsDir = path.join(process.cwd(), 'docs')

app.disable('x-powered-by')
app.use(express.json({ limit: '4mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/docs', express.static(docsDir))

const withHandler = (
  handler: ApiHandler,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(
        req as unknown as VercelRequest,
        res as unknown as VercelResponse,
      )
    } catch (error) {
      next(error)
    }
  }
}

app.all(/^\/api(?:\/.*)?$/, withHandler(routeApiRequest))

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  })
})

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next
  console.error(error)
  res.status(500).json({
    error: 'Erro interno inesperado no servidor de desenvolvimento.',
  })
})

const port = Number(process.env.PORT || 3000)

app.listen(port, () => {
  console.log(`Financial Core API (local dev) running at http://localhost:${port}`)
})
