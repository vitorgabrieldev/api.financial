# site.financial

Frontend privado (Next.js) para consumo seguro do `api.financial-core`.

## Objetivo

- Renderizar interface web do sistema financeiro.
- Consumir o backend sem expor `CORE_API_KEY` no navegador.
- Manter sessão do usuário com cookies `httpOnly`.

## Stack

- Next.js (App Router)
- React
- Route Handlers como BFF (`/api/*` interno)

## Variáveis de ambiente

Rodando junto com a API no mesmo repositório, o frontend usa o `.env.local` da raiz.

Variáveis relevantes:

- `API_KEY` (ou `CORE_API_KEY`)
- `CORE_API_BASE_URL` (opcional no local; padrão `http://localhost:3000`)

`site.financial/.env.example` existe apenas para uso standalone.

## Rodar junto com a API (recomendado)

Na raiz do projeto principal:

```bash
npm run dev
```

Esse comando sobe:

- API local em `http://localhost:3000`
- Frontend em `http://localhost:4000`

Por padrão, o frontend aponta para a API local no `dev` da raiz.
Para sobrescrever a URL da API, use variável de ambiente:

```bash
CORE_API_BASE_URL=https://sua-api-de-homologacao.com npm run dev
```

## Segurança aplicada

- `CORE_API_KEY` usada apenas server-side.
- Login via `/api/auth/login` (BFF) e cookies `httpOnly`.
- Proxy seguro via `/api/core/[...path]` para chamadas autenticadas do frontend.
- Browser nunca recebe segredo do backend.

## Rotas web iniciais

- `/` login
- `/dashboard`
- `/accounts`
- `/transactions`
- `/goals`
- `/reports`
- `/preferences`
