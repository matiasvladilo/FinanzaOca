import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import AsistenteBubble from './AsistenteBubble'

vi.mock('@/lib/session-client', () => ({
  getClientSession: () => ({ role: 'admin' }),
}))

vi.mock('next/image', () => ({
  default: () => <div />,
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

test('opens immersive chat as a modal dialog and restores focus after Escape', async () => {
  const user = userEvent.setup()
  render(<ChatHarness />)

  await user.click(screen.getByRole('button', { name: /abrir asistente/i }))
  const maximize = screen.getByRole('button', { name: /pantalla completa/i })
  await user.click(maximize)

  const dialog = screen.getByRole('dialog', { name: /asistente finanzasoca/i })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveFocus()

  await user.keyboard('{Shift>}{Tab}{/Shift}')
  expect(screen.getByPlaceholderText('Escribí tu pregunta…')).toHaveFocus()
  await user.keyboard('{Tab}')
  expect(screen.getByRole('button', { name: /minimizar/i })).toHaveFocus()

  await user.keyboard('{Escape}')
  expect(screen.getByRole('button', { name: /pantalla completa/i })).toHaveFocus()
})

test('restores focus to the bubble when immersive chat closes', async () => {
  const user = userEvent.setup()
  render(<ChatHarness />)

  await user.click(screen.getByRole('button', { name: /abrir asistente/i }))
  await user.click(screen.getByRole('button', { name: /pantalla completa/i }))
  await user.click(screen.getByRole('button', { name: /^cerrar$/i }))

  expect(screen.getByRole('button', { name: /abrir asistente/i })).toHaveFocus()
})

test('exposes the OCAI conversation actions through an accessible menu', async () => {
  const user = userEvent.setup()
  render(<ChatHarness />)

  await user.click(screen.getByRole('button', { name: /abrir asistente/i }))

  expect(screen.getByText('OCAI · Asistente FinanzasOca')).toBeVisible()
  expect(screen.getByRole('button', { name: /modo inmersivo/i })).toBeVisible()
  expect(screen.getByRole('button', { name: /^cerrar$/i })).toHaveAttribute('title', 'Cerrar')
  expect(screen.getByRole('button', { name: /enviar mensaje/i })).toHaveAttribute('title', 'Enviar mensaje')
  expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  expect(screen.getByRole('button', { name: /más acciones de ocai/i })).toHaveAttribute('title', 'Más acciones de OCAI')

  await user.click(screen.getByRole('button', { name: /más acciones de ocai/i }))
  expect(screen.getByRole('menu')).toBeVisible()
  expect(screen.getByRole('menuitem', { name: /nueva conversación/i })).toBeVisible()
  expect(screen.getByRole('menuitem', { name: /compartir chat/i })).toBeVisible()
})

test('cancelling a new conversation preserves messages and the draft', async () => {
  const user = userEvent.setup()
  render(<ChatHarness />)

  await user.click(screen.getByRole('button', { name: /abrir asistente/i }))
  await user.type(screen.getByPlaceholderText('Escribí tu pregunta…'), 'Mensaje a conservar')
  await user.click(screen.getByRole('button', { name: /enviar mensaje/i }))
  expect(await screen.findByText('Respuesta semilla')).toBeVisible()
  await user.type(screen.getByPlaceholderText('Escribí tu pregunta…'), 'Borrador a conservar')

  await user.click(screen.getByRole('button', { name: /más acciones de ocai/i }))
  await user.click(screen.getByRole('menuitem', { name: /nueva conversación/i }))
  expect(screen.getByRole('dialog', { name: /nueva conversación/i })).toBeVisible()
  await user.click(screen.getByRole('button', { name: /cancelar/i }))

  expect(screen.getByText('Respuesta semilla')).toBeVisible()
  expect(screen.getByPlaceholderText('Escribí tu pregunta…')).toHaveValue('Borrador a conservar')
})

test('confirming a new conversation clears messages and the draft', async () => {
  const user = userEvent.setup()
  render(<ChatHarness />)

  await user.click(screen.getByRole('button', { name: /abrir asistente/i }))
  await user.type(screen.getByPlaceholderText('Escribí tu pregunta…'), 'Mensaje a borrar')
  await user.click(screen.getByRole('button', { name: /enviar mensaje/i }))
  expect(await screen.findByText('Respuesta semilla')).toBeVisible()
  await user.type(screen.getByPlaceholderText('Escribí tu pregunta…'), 'Borrador a borrar')

  await user.click(screen.getByRole('button', { name: /más acciones de ocai/i }))
  await user.click(screen.getByRole('menuitem', { name: /nueva conversación/i }))
  await user.click(screen.getByRole('button', { name: /confirmar nueva conversación/i }))

  expect(screen.queryByText('Mensaje a borrar')).not.toBeInTheDocument()
  expect(screen.queryByText('Respuesta semilla')).not.toBeInTheDocument()
  expect(screen.getByPlaceholderText('Escribí tu pregunta…')).toHaveValue('')
})
