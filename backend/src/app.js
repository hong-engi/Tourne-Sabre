import express from 'express'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { Game } from './game.js'
import { compactStateProtocol } from '../../shared/gameProtocol.mjs'
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
const compactRoom = 'compact-players'
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
    const compact = payload.protocol === compactStateProtocol
    const isNewPlayer = !socket.rooms.has(room)
    const initialState = game.join(socket.id, name.trim(), compact)
    socket.join(room)
    if (compact) socket.join(compactRoom)
    else socket.leave(compactRoom)
    reply(initialState)
    if (isNewPlayer) socket.to(compactRoom).emit('game:profile', game.playerProfile(socket.id))
    gameTimer ??= setInterval(advanceGame, tickMs)
  })

  socket.on('game:input', (payload) => {
    game.setInput(socket.id, payload)
  })

  socket.on('disconnect', () => {
    const handle = game.leave(socket.id)
    if (handle !== undefined) io.to(compactRoom).emit('game:remove', [handle])
    stopWhenEmpty()
  })
})

function advanceGame() {
  const { changedItems, deaths, removedHandles, vitals } = game.step()
  for (const id of deaths) {
    const socket = io.sockets.sockets.get(id)
    if (socket) {
      socket.leave(room)
      socket.leave(compactRoom)
      socket.emit('game:death', { id, tick: game.tick })
    }
  }
  // Send the disposable frame while the transport can still accept it.
  const compactIds = io.sockets.adapter.rooms.get(compactRoom)
  if (game.size > (compactIds?.size ?? 0)) {
    io.to(room).except(compactRoom).volatile.emit('game:state', game.snapshot())
  }
  if (compactIds?.size) {
    const poses = game.poses()
    for (const id of compactIds) {
      io.sockets.sockets.get(id).volatile.emit('game:frame', [game.tick, poses, game.correction(id)])
    }
  }
  if (changedItems.length) io.to(room).emit('game:items', changedItems)
  if (removedHandles.length) io.to(compactRoom).emit('game:remove', removedHandles)
  if (vitals.length) io.to(compactRoom).emit('game:vitals', vitals)
  stopWhenEmpty()
}

server.listen(port, () => {
  console.log(`Listening on port ${server.address().port}`)
})
