import path from 'node:path'
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { routeApiRequest } from '../routes/router.js'
import { authenticateToken } from '../core/supabase.js'

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
) => Promise<void> | void

const app = express()
const docsDir = path.join(process.cwd(), 'docs')
const rootIndexFile = path.join(process.cwd(), 'index.html')
const frontendSessionCookie = 'fc_access_token'

app.disable('x-powered-by')
app.use(express.json({ limit: '4mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/docs', express.static(docsDir))

const readCookie = (cookieHeader: string | undefined, key: string): string => {
  if (!cookieHeader) return ''

  const segments = cookieHeader.split(';')
  for (const segment of segments) {
    const [rawName, ...rawValue] = segment.trim().split('=')
    if (rawName !== key) continue
    return decodeURIComponent(rawValue.join('=') ?? '')
  }

  return ''
}

app.get('/', async (req: Request, res: Response) => {
  const accessToken = readCookie(req.headers.cookie, frontendSessionCookie)

  if (!accessToken) {
    res.status(401).json({
      code: 'UNAUTHORIZED_HOME',
      error: 'Não autorizado. Faça login no frontend para acessar esta página.',
    })
    return
  }

  try {
    await authenticateToken(accessToken)
    res.sendFile(rootIndexFile)
  } catch {
    res.status(401).json({
      code: 'UNAUTHORIZED_HOME',
      error: 'Sessão inválida ou expirada. Faça login novamente no frontend.',
    })
  }
})

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
