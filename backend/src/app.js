const express = require('express')
const http = require('http')
const path = require('path')
const { Server } = require('socket.io')
const { Game } = require('./game')

const port = process.env.PORT || 8080
const app = express()
app.use(express.static(path.join(__dirname, '../../frontend/build')))

const server = http.createServer(app)
const io = new Server(server, {
  transports: ['websocket'],
  maxHttpBufferSize: 16 * 1024,
})
const game = new Game()
const room = 'players'
const ticksPerSecond = 30
const ticksPerSnapshot = 2

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
  })

  socket.on('game:input', (payload) => {
    game.setInput(socket.id, payload)
  })

  socket.on('disconnect', () => {
    game.leave(socket.id)
  })
})

setInterval(() => {
  if (game.size === 0) return
  const { changedItems, deaths } = game.step()
  for (const id of deaths) {
    const socket = io.sockets.sockets.get(id)
    if (socket) {
      socket.leave(room)
      socket.emit('game:death', { id, tick: game.tick })
    }
  }
  if (changedItems.length) io.to(room).emit('game:items', changedItems)
  if (game.tick % ticksPerSnapshot === 0) {
    io.to(room).volatile.emit('game:state', game.snapshot())
  }
}, 1000 / ticksPerSecond)

server.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
