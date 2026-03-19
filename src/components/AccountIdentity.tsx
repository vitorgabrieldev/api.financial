import { useMemo, useState } from 'react'
import { LuLandmark } from 'react-icons/lu'
import type { Account } from '../types/finance'

interface AccountIdentityProps {
  account?: Pick<Account, 'name' | 'logo_url'> | null
  fallbackLabel?: string
  compact?: boolean
}

export const AccountIdentity = ({
  account,
  fallbackLabel = 'Conta removida',
  compact = false,
}: AccountIdentityProps) => {
  const [imageError, setImageError] = useState(false)
  const label = account?.name || fallbackLabel
  const logoUrl = account?.logo_url || null

  const wrapperClassName = useMemo(
    () =>
      compact
        ? 'inline-flex items-center gap-2'
        : 'inline-flex items-center gap-2.5',
    [compact],
  )

  const avatarClassName = compact
    ? 'inline-flex h-6 w-6 items-center justify-center border border-border bg-[#f2e6e6]'
    : 'inline-flex h-8 w-8 items-center justify-center border border-border bg-[#f2e6e6]'

  return (
    <span className={wrapperClassName}>
      {logoUrl && !imageError ? (
        <img
          src={logoUrl}
          alt={`Logo da conta ${label}`}
          className={avatarClassName}
          onError={() => setImageError(true)}
        />
      ) : (
        <span className={avatarClassName}>
          <LuLandmark className={compact ? 'h-3.5 w-3.5 text-muted' : 'h-4 w-4 text-muted'} />
        </span>
      )}
      <span className="text-ink">{label}</span>
    </span>
  )
}

