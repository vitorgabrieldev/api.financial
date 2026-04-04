'use client'

import Link from 'next/link'

export function UnauthorizedBlock({ message }) {
  return (
    <div className="empty">
      <p className="status error">
        {message ?? 'Sessão inválida ou expirada. Faça login novamente.'}
      </p>
      <Link href="/" className="button primary" style={{ display: 'inline-block', width: 'auto', marginTop: 10 }}>
        Ir para login
      </Link>
    </div>
  )
}
