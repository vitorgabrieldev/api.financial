import { useEffect, type PropsWithChildren } from 'react'
import { LuX } from 'react-icons/lu'

interface AppModalProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  maxWidthClassName?: string
}

export const AppModal = ({
  open,
  title,
  subtitle,
  onClose,
  maxWidthClassName = 'max-w-3xl',
  children,
}: PropsWithChildren<AppModalProps>) => {
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/35"
      />

      <section
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${maxWidthClassName} max-h-[90vh] overflow-auto border border-border bg-surface p-4 shadow-soft md:p-5`}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg font-semibold tracking-tight text-ink">
              {title}
            </h3>
            {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center border border-border text-muted transition hover:border-primary/40 hover:text-primary"
          >
            <LuX className="h-4 w-4" />
          </button>
        </header>

        {children}
      </section>
    </div>
  )
}

