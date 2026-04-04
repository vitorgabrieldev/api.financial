# api.financial-core

Core financeiro API-first para centralizar suas informações de finanças pessoais e integrar com qualquer cliente (web, app mobile, automações e agentes AI).

## Stack

- TypeScript (Node.js)
- Vercel Functions (`api/*`)
- Supabase (Auth + Postgres + Storage)
- Zod para contratos/validação

## Arquitetura

- `api/`: endpoints HTTP da API
- `src/core/`: regras centrais (auth, permissões, validação, paginação, idempotência)
- `supabase/`: migrations e seed de banco
- `docs/`: documentação interativa estilo Swagger
- `sdk/`: OpenAPI exportado e SDK gerado para frontend

## Autenticação e Segurança

Todas as chamadas exigem API key:

- Header obrigatório: `X-API-Key: <API_KEY>`

Rotas de negócio exigem também token de usuário:

- Header: `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`

Fluxos de sessão:

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Importante:

- `SUPABASE_ANON_KEY` (publishable) não é JWT de usuário.
- O JWT correto é o `access_token` retornado pelo login/refresh.

## Erros Padronizados

Todos os erros seguem o formato:

```json
{
  "code": "TRANSACTIONS_LIST_FAILED",
  "error": "Mensagem legível",
  "details": null
}
```

Isso facilita tratar erros de forma estável no frontend.

## Paginação Cursor + Sort

As rotas de listagem (`accounts`, `categories`, `goals`, `transactions`) suportam:

- `limit`
- `offset`
- `cursor` (opaco)
- `sort`
- `order` (`asc` | `desc`)

Resposta:

```json
{
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1200,
    "sort": "created_at",
    "order": "desc",
    "has_more": true,
    "next_cursor": "..."
  }
}
```

## Idempotência

Rotas mutáveis autenticadas aceitam header opcional:

- `Idempotency-Key: <chave-unica>`

Se a mesma chave for reaproveitada com payload diferente na mesma rota/método, a API retorna conflito (`409`).

Para persistência de idempotência no banco, aplique a migration:

- `supabase/migrations/20260402010000_idempotency_requests.sql`

## Versionamento e Changelog

- `GET /api/v1` - metadados da versão estável
- `GET /api/v2` - status da próxima versão
- `GET /api/changelog` - histórico de releases

## Endpoints

Base local: `http://localhost:3000/api`

- `GET /api`
- `GET /api/health`
- `GET /api/changelog`
- `GET /api/openapi.json`
- `GET /api/v1`
- `GET /api/v2`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/v1/preferences`
- `PATCH /api/v1/preferences`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/accounts`
- `POST /api/v1/accounts`
- `GET /api/v1/accounts/:id`
- `PATCH /api/v1/accounts/:id`
- `DELETE /api/v1/accounts/:id`
- `GET /api/v1/categories`
- `POST /api/v1/categories`
- `GET /api/v1/categories/:id`
- `PATCH /api/v1/categories/:id`
- `DELETE /api/v1/categories/:id`
- `GET /api/v1/goals`
- `POST /api/v1/goals`
- `GET /api/v1/goals/:id`
- `PATCH /api/v1/goals/:id`
- `DELETE /api/v1/goals/:id`
- `GET /api/v1/transactions`
- `POST /api/v1/transactions`
- `GET /api/v1/transactions/:id`
- `PATCH /api/v1/transactions/:id`
- `DELETE /api/v1/transactions/:id`
- `GET /api/v1/reports/monthly`
- `GET /api/v1/reports/categories`

## Documentação Interativa

- URL local: `http://localhost:3000/docs`
- Login direto na docs (API key + email + senha)
- Persistência de credenciais em `localStorage`
- Execução de requests e preview de JSON de resposta

## SDK para Frontend

Geração automática baseada no OpenAPI:

```bash
npm run sdk:generate
```

Arquivos gerados em:

- `sdk/openapi.json`
- `sdk/generated/*`

## Variáveis de ambiente

Crie `.env.local` a partir de `.env.example`:

- `API_KEY` (obrigatória)
- `CORE_API_BASE_URL` (opcional para frontend local; default `http://localhost:3000`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (opcional)
- `CORS_ALLOW_ORIGIN` (default `*`)

Observação:
- também aceitamos aliases de ambiente (`NEXT_PUBLIC_*` e `VITE_*`) para compatibilidade com env exportado da Vercel.

## Rodando localmente

```bash
npm install
npm run dev
```

O `npm run dev` da raiz inicia:

- API local: `http://localhost:3000`
- Frontend local (`site.financial`): `http://localhost:4000`
- Ambos usando o mesmo `.env.local` da raiz.

Se quiser subir apenas a API:

```bash
npm run dev:api
```

## Qualidade

```bash
npm run lint
npm run typecheck
npm run test
```

## Deploy na Vercel

1. Importar repositório no Vercel
2. Configurar variáveis de ambiente de produção
3. Fazer deploy (CI/CD automático por commit)
4. Validar `/api/health` e `/docs` após deploy
