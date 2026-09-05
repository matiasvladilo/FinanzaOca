import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import AsistenteBubble from './AsistenteBubble'

vi.mock('@/lib/session-client', () => ({
  getClientSession: () => ({ role: 'admin' }),
}))

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

function ChatHarness() {
  return <AsistenteBubble />
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ ok: true, reply: 'Respuesta semilla' }) }))
  HTMLElement.prototype.scrollTo = vi.fn()
  HTMLElement.prototype.setPointerCapture = vi.fn()
  localStorage.clear()
})

test('preserves a seeded message and draft through immersive, minimize, close, and reopen', async () => {
  const user = userEvent.setup()
  render(<ChatHarness />)

  await user.click(screen.getByRole('button', { name: /abrir asistente/i }))
  const input = screen.getByPlaceholderText('Escribí tu pregunta…')
  await user.type(input, 'Mensaje semilla')
  await user.click(screen.getByRole('button', { name: /enviar mensaje/i }))
  expect(await screen.findByText('Respuesta semilla')).toBeVisible()

  await user.type(screen.getByPlaceholderText('Escribí tu pregunta…'), 'Borrador que debe sobrevivir')

  await user.click(screen.getByRole('button', { name: /pantalla completa/i }))
  expect(screen.getByText('Respuesta semilla')).toBeVisible()
  expect(screen.getByPlaceholderText('Escribí tu pregunta…')).toHaveValue('Borrador que debe sobrevivir')

  await user.keyboard('{Escape}')
  expect(screen.getByRole('button', { name: /pantalla completa/i })).toBeVisible()
  await user.click(screen.getByRole('button', { name: /pantalla completa/i }))
  await user.click(screen.getByRole('button', { name: /minimizar/i }))
  expect(screen.getByText('Respuesta semilla')).toBeVisible()
  expect(screen.getByPlaceholderText('Escribí tu pregunta…')).toHaveValue('Borrador que debe sobrevivir')

  await user.click(screen.getByRole('button', { name: /^cerrar$/i }))
  expect(screen.queryByText('Respuesta semilla')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /abrir asistente/i }))

  expect(screen.getByText('Respuesta semilla')).toBeVisible()
  expect(screen.getByPlaceholderText('Escribí tu pregunta…')).toHaveValue('Borrador que debe sobrevivir')
})
