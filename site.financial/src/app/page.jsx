import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { getServerSession } from '@/lib/session'

const modules = [
  'Dashboard consolidado',
  'Contas e saldos',
  'Categorias de receita e despesa',
  'Transações com filtro',
  'Metas financeiras',
  'Relatórios mensais',
  'Preferências de sessão',
]

export default async function HomePage() {
  const session = await getServerSession()

  if (session.accessToken) {
    redirect('/dashboard')
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <h1 className="page-title">api.financial-core :: site.financial</h1>
        <p className="page-subtitle">
          Frontend privado para organização financeira pessoal, consumindo o backend com
          camada server-side segura.
        </p>
      </section>

      <section className="panel">
        <div className="layout-2">
        <article className="card">
          <h2 className="page-title" style={{ fontSize: '1.05rem' }}>Acesso</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Faça login com a mesma conta usada no core para liberar o painel completo.
          </p>
          <div style={{ marginTop: 10 }}>
            <LoginForm />
          </div>
        </article>

        <article className="card">
          <h2 className="page-title" style={{ fontSize: '1.05rem' }}>Escopo inicial do sistema</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Estrutura entregue para visualizar planejamento e fluxo real de produto.
          </p>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>módulo</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((item, index) => (
                  <tr key={item}>
                    <td>{index + 1}</td>
                    <td>{item}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        </div>
      </section>
    </main>
  )
}
