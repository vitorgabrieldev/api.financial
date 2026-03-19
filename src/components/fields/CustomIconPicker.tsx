import { createElement } from 'react'
import { LuCheck } from 'react-icons/lu'
import { getCategoryIcon } from '../../lib/icons'

interface IconOption {
  value: string
  label: string
}

interface CustomIconPickerProps {
  value: string
  options: IconOption[]
  disabled?: boolean
  onChange: (value: string) => void
}

export const CustomIconPicker = ({
  value,
  options,
  disabled,
  onChange,
}: CustomIconPickerProps) => {
  const currentOption =
    options.find((option) => option.value === value) ?? options[0] ?? null

  return (
    <div className={`grid gap-2 border border-border bg-white p-2 ${disabled ? 'opacity-60' : ''}`}>
      {currentOption ? (
        <div className="inline-flex items-center gap-2 border border-border/80 bg-[#f5ecec] px-2 py-1 text-xs text-muted">
          {createElement(getCategoryIcon(currentOption.value), {
            className: 'h-3.5 w-3.5',
          })}
          <span>{currentOption.label}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-2 md:grid-cols-6 xl:grid-cols-7">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              title={option.label}
              aria-label={`Selecionar ícone ${option.label}`}
              onClick={() => onChange(option.value)}
              className={`group relative inline-flex h-10 w-full cursor-pointer items-center justify-center border text-muted transition hover:border-primary hover:text-primary disabled:cursor-not-allowed ${
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-white'
              }`}
            >
              {createElement(getCategoryIcon(option.value), {
                className: 'h-4 w-4',
              })}
              {selected ? (
                <span className="absolute right-1 top-1 inline-flex h-3.5 w-3.5 items-center justify-center bg-primary text-white">
                  <LuCheck className="h-2.5 w-2.5" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
