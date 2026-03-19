import { NavLink } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { LuLogOut } from 'react-icons/lu'
import type { IconType } from 'react-icons'

interface AppLayoutProps {
  userEmail: string
  userName: string
  navLinks: {
    to: string
    label: string
    icon: IconType
  }[]
  onSignOut: () => Promise<void>
}

export const AppLayout = ({
  userEmail,
  userName,
  navLinks,
  onSignOut,
  children,
}: PropsWithChildren<AppLayoutProps>) => {
  return (
    <div className="min-h-screen bg-app-pattern text-ink">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[270px_1fr]">
        <aside className="border-b border-border bg-surface/95 p-5 backdrop-blur lg:border-b-0 lg:border-r">
          <div className="mb-8 space-y-2">
            <p className="font-heading text-xs uppercase tracking-[0.24em] text-muted">
              Finance Command
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink">
              My Financial Organization
            </h1>
          </div>

          <nav className="mb-8 grid gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 border px-3 py-2 text-sm transition ${
                      isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-ink hover:border-primary/40 hover:text-primary'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <div className="space-y-3 border border-border bg-white/70 p-3 text-xs">
            <p className="truncate text-ink">{userName}</p>
            <p className="truncate text-ink">{userEmail}</p>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex w-full items-center justify-center gap-2 border border-primary/40 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/10"
            >
              <LuLogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </aside>

        <main className="p-4 md:p-7">{children}</main>
      </div>
    </div>
  )
}
