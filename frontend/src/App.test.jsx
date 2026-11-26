import { act, fireEvent, render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { io } from 'socket.io-client'
import App from './App.jsx'

vi.mock('socket.io-client', () => ({ io: vi.fn() }))
vi.mock('./Canvas.jsx', () => ({ default: () => null }))

test('joins through the socket and returns to name entry on death', () => {
  const handlers = new Map()
  const socket = {
    connected: true,
    on: (event, handler) => handlers.set(event, handler),
    timeout: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  }
  socket.timeout.mockReturnValue(socket)
  io.mockReturnValue(socket)

  render(<App />)
  expect(screen.getByRole('button', { name: 'ENTER' })).toBeDisabled()
  act(() => handlers.get('connect')())

  fireEvent.change(screen.getByLabelText('Enter name'), { target: { value: 'P1' } })
  fireEvent.click(screen.getByRole('button', { name: 'ENTER' }))
  expect(socket.emit).toHaveBeenCalledWith('game:join', { name: 'P1', protocol: 2 }, expect.any(Function))

  const reply = socket.emit.mock.calls[0][2]
  act(() => reply(null, {
    id: 'p1',
    tick: 0,
    players: [{ _id: 'p1', name: 'P1', x: 0, y: 0, vx: 0, vy: 0, sw_angle: 0 }],
    items: [],
  }))
  expect(screen.queryByRole('button', { name: 'ENTER' })).toBeNull()

  act(() => handlers.get('game:death')({ id: 'p1' }))
  expect(screen.getByRole('status')).toHaveTextContent('You died')
  expect(screen.getByRole('button', { name: 'ENTER' })).toBeEnabled()
})
