'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Contas' },
  { href: '/categories', label: 'Categorias' },
  { href: '/transactions', label: 'Transações' },
  { href: '/goals', label: 'Metas' },
  { href: '/reports', label: 'Relatórios' },
  { href: '/preferences', label: 'Preferências' },
]

export function AppShell({ title, subtitle, children, actions }) {
  const pathname = usePathname()

  return (
    <main className="app-shell">
      <section className="panel topbar">
        <div>
          <h1 className="topbar-title">api.financial-core :: site.financial</h1>
          <p className="topbar-subtitle">Sistema privado para gestão financeira pessoal.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span className="badge">
            <span className="dot" />
            sessão ativa
          </span>
          <LogoutButton />
        </div>
      </section>

      <section className="panel">
        <nav className="tabs">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`tab-link ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </section>

      <section className="panel page">
        <header className="page-header">
          <div>
            <h2 className="page-title">{title}</h2>
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="toolbar">{actions}</div> : null}
        </header>

        {children}
      </section>
    </main>
  )
}
