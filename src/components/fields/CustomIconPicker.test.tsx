import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CustomIconPicker } from './CustomIconPicker'

describe('CustomIconPicker', () => {
  it('altera o ícone selecionado ao clicar em uma opção', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <CustomIconPicker
        value="LuTag"
        onChange={handleChange}
        options={[
          { value: 'LuTag', label: 'Tag' },
          { value: 'LuWallet', label: 'Carteira' },
        ]}
      />,
    )

    await user.click(screen.getByLabelText('Selecionar ícone Carteira'))

    expect(handleChange).toHaveBeenCalledWith('LuWallet')
  })
})

