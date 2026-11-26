import express from 'express'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { Game } from './game.js'
import { tickMs } from '../../shared/movement.mjs'

const port = Number(process.env.PORT ?? 8080)
const app = express()
app.use(express.static(fileURLToPath(new URL('../../frontend/build/', import.meta.url))))

const server = createServer(app)
const io = new Server(server, {
  transports: ['websocket'],
  maxHttpBufferSize: 16 * 1024,
})
const game = new Game()
const room = 'players'
let gameTimer

function stopWhenEmpty() {
  if (game.size > 0) return
  clearInterval(gameTimer)
  gameTimer = undefined
}

io.on('connection', (socket) => {
  socket.on('game:join', (payload, reply) => {
    if (typeof reply !== 'function') return

    const name = payload?.name
    if (typeof name !== 'string' || name.length > 40) {
      reply({ error: 'Enter a name with up to 40 characters.' })
      return
    }
    const initialState = game.join(socket.id, name.trim())
    socket.join(room)
    reply(initialState)
    gameTimer ??= setInterval(advanceGame, tickMs)
  })

  socket.on('game:input', (payload) => {
    game.setInput(socket.id, payload)
  })

  socket.on('disconnect', () => {
    game.leave(socket.id)
    stopWhenEmpty()
  })
})

function advanceGame() {
  const { changedItems, deaths } = game.step()
  for (const id of deaths) {
    const socket = io.sockets.sockets.get(id)
    if (socket) {
      socket.leave(room)
      socket.emit('game:death', { id, tick: game.tick })
    }
  }
  if (changedItems.length) io.to(room).emit('game:items', changedItems)
  if (game.size > 0) io.to(room).volatile.emit('game:state', game.snapshot())
  stopWhenEmpty()
}

server.listen(port, () => {
  console.log(`Listening on port ${server.address().port}`)
})
