'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LogoutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const onLogout = async () => {
    try {
      setPending(true)
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/')
      router.refresh()
      setPending(false)
    }
  }

  return (
    <button type="button" className="button secondary" onClick={onLogout} disabled={pending}>
      {pending ? 'Encerrando...' : 'Sair'}
    </button>
  )
}
