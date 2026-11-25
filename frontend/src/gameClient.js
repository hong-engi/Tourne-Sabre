import { io } from 'socket.io-client'
import { Pos, PredictedMovement } from './object.js'

const tickMs = 1000 / 30
const interpolationMs = 100
const swordStep = Math.PI / 30
const keyBits = new Map([['w', 1], ['s', 2], ['a', 4], ['d', 8]])

function playerFromState(state) {
  return { ...state, id: state._id, pos: new Pos(state.x, state.y) }
}

function interpolatePlayer(before, after, fraction) {
  const turn = after.sw_angle - before.sw_angle
  const shortestTurn = Math.atan2(Math.sin(turn), Math.cos(turn))
  return {
    ...after,
    pos: new Pos(
      before.x + (after.x - before.x) * fraction,
      before.y + (after.y - before.y) * fraction
    ),
    sw_angle: before.sw_angle + shortestTurn * fraction,
  }
}

export default class GameClient {
  constructor() {
    this.reset()
  }

  connect(reportStatus) {
    const socket = io(process.env.REACT_APP_GAME_SERVER || undefined, {
      transports: ['websocket'],
    })
    this.socket = socket
    this.reportStatus = reportStatus
    socket.on('connect', () => this.status('ready'))
    socket.on('connect_error', () => this.status('connecting', 'Connecting to game server…'))
    socket.on('disconnect', () => {
      const wasPlaying = this.id !== null
      this.reset()
      this.status('connecting', wasPlaying ? 'Connection lost. Rejoin when connected.' : '')
      if (!socket.active) socket.connect()
    })
    socket.on('game:state', snapshot => this.receiveState(snapshot))
    socket.on('game:items', items => {
      if (this.id !== null) this.receiveItems(items)
    })
    socket.on('game:death', ({ id }) => {
      if (id !== this.id) return
      this.reset()
      this.status('ready', 'You died. Enter to play again.')
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      this.socket = null
      this.reset()
    }
  }

  status(phase, message = '') {
    this.reportStatus({ phase, message })
  }

  reset() {
    this.id = null
    this.joinAttempt = null
    this.items = new Map()
    this.snapshots = []
    this.keys = 0
    this.seq = 0
    this.local = null
    this.authoritative = null
    this.correction = new Pos(0, 0)
  }

  join(name) {
    const socket = this.socket
    if (!socket?.connected || this.joinAttempt || this.id !== null) return
    const attempt = {}
    this.joinAttempt = attempt
    this.status('joining')
    socket.timeout(4000).emit('game:join', { name }, (timeout, result) => {
      if (this.socket !== socket || this.joinAttempt !== attempt || !socket.connected) return
      this.joinAttempt = null
      if (timeout || result?.error || !result?.id) {
        this.status('ready', result?.error || 'Join timed out. Try again.')
        return
      }

      this.id = result.id
      this.receiveItems(result.items)
      this.receiveState(result)
      this.status('playing')
    })
  }

  receiveItems(items) {
    for (const item of items) {
      this.items.set(item._id, { ...item, pos: new Pos(item.x, item.y) })
    }
  }

  setKey(key, pressed) {
    const bit = keyBits.get(key.toLowerCase())
    if (!bit || this.id === null) return
    this.setKeys(pressed ? this.keys | bit : this.keys & ~bit)
  }

  setKeys(keys) {
    if (keys === this.keys || !this.socket?.connected || this.id === null) return
    this.advance(performance.now())
    this.keys = keys
    this.socket.emit('game:input', { keys, seq: ++this.seq })
  }

  receiveState({ tick, players }) {
    if (this.id === null) return
    const previous = this.snapshots[this.snapshots.length - 1]
    if (previous && previous.tick >= tick) return
    const now = performance.now()
    const byId = new Map(players.map(player => [player._id, playerFromState(player)]))
    const own = byId.get(this.id)
    if (!own) return

    this.advance(now)
    if (!this.local || this.local.pos.dist(own.pos) > 200) {
      this.local = new PredictedMovement(own.pos, new Pos(own.vx, own.vy))
      this.lastStep = now
      this.correction = new Pos(0, 0)
    } else if (own.inputSeq === this.seq || this.seq === 0) {
      // Keep recent local input visible until the server has applied it.
      this.correction = own.pos.addv(this.local.pos, -1)
    }

    this.authoritative = own
    this.authoritativeAt = now
    this.snapshots.push({ tick, at: now, byId })
    if (this.snapshots.length > 8) this.snapshots.shift()
  }

  advance(now) {
    if (!this.local) return
    if (now - this.lastStep > 250) this.lastStep = now
    while (now - this.lastStep >= tickMs) {
      const dx = Number(Boolean(this.keys & 8)) - Number(Boolean(this.keys & 4))
      const dy = Number(Boolean(this.keys & 2)) - Number(Boolean(this.keys & 1))
      this.local.step(dx, dy)
      this.lastStep += tickMs

      // Spread small server corrections over several prediction steps.
      this.local.pos.move(this.correction.x * 0.25, this.correction.y * 0.25)
      this.correction.x *= 0.75
      this.correction.y *= 0.75
    }
  }

  renderState(now) {
    if (!this.local) return { me: null, players: [], items: this.items.values() }
    this.advance(now)
    const fraction = Math.min(1, (now - this.lastStep) / tickMs)
    const me = {
      ...this.authoritative,
      pos: this.local.pos.addv(this.local.speed, fraction),
      sw_angle: this.authoritative.sw_angle -
        swordStep * Math.min(3, (now - this.authoritativeAt) / tickMs),
    }

    const renderAt = now - interpolationMs
    while (this.snapshots.length > 1 && this.snapshots[1].at <= renderAt) {
      this.snapshots.shift()
    }
    const [before, after] = this.snapshots
    const players = []
    const latest = this.snapshots[this.snapshots.length - 1]
    for (const [id, player] of before.byId) {
      if (id === this.id || !latest.byId.has(id)) continue
      const next = after?.byId.get(id)
      if (!next || renderAt <= before.at) {
        players.push(player)
      } else {
        players.push(interpolatePlayer(player, next, (renderAt - before.at) / (after.at - before.at)))
      }
    }

    return { me, players, items: this.items.values() }
  }
}
