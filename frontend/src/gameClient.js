import { io } from 'socket.io-client'
import { compactStateProtocol } from '../../shared/gameProtocol.mjs'
import { tickMs, swordStep, movePlayer, movementKeys } from '../../shared/movement.mjs'
import SpatialGrid from '../../shared/spatialGrid.mjs'
import { itemViewRadius } from './mapdraw.js'

const interpolationMs = 2 * tickMs
const tau = 2 * Math.PI

function interpolatePlayer(before, after, fraction) {
  const turn = after.sw_angle - before.sw_angle
  const shortestTurn = Math.atan2(Math.sin(turn), Math.cos(turn))
  return {
    ...after,
    x: before.x + (after.x - before.x) * fraction,
    y: before.y + (after.y - before.y) * fraction,
    sw_angle: before.sw_angle + shortestTurn * fraction,
  }
}

export default class GameClient {
  constructor() {
    this.reset()
  }

  connect(reportStatus) {
    const socket = io(import.meta.env.REACT_APP_GAME_SERVER || undefined, {
      transports: ['websocket'],
    })
    this.socket = socket
    this.reportStatus = reportStatus
    socket.on('connect', () => this.status('ready'))
    socket.on('connect_error', () => this.status('connecting'))
    socket.on('disconnect', () => {
      const wasPlaying = this.id !== null
      this.reset()
      this.status('connecting', wasPlaying ? 'Connection lost. Rejoin when connected.' : '')
      if (!socket.active) socket.connect()
    })
    socket.on('game:state', snapshot => this.receiveState(snapshot))
    socket.on('game:frame', frame => this.receiveFrame(frame))
    socket.on('game:profile', profile => this.profiles.set(profile.handle, profile))
    socket.on('game:vitals', vitals => this.receiveVitals(vitals))
    socket.on('game:remove', handles => {
      for (const handle of handles) this.profiles.delete(handle)
    })
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
    this.profiles = new Map()
    this.itemGrid = new SpatialGrid(256)
    this.snapshots = []
    this.keys = 0
    this.seq = 0
    this.local = null
    this.authoritative = null
    this.correction = { x: 0, y: 0 }
  }

  join(name) {
    const socket = this.socket
    if (!socket?.connected || this.joinAttempt || this.id !== null) return
    const attempt = {}
    this.joinAttempt = attempt
    this.status('joining')
    socket.timeout(4000).emit('game:join', { name, protocol: compactStateProtocol }, (timeout, result) => {
      if (this.socket !== socket || this.joinAttempt !== attempt || !socket.connected) return
      this.joinAttempt = null
      if (timeout || result?.error || !result?.id) {
        this.status('ready', result?.error || 'Join timed out. Try again.')
        return
      }

      this.id = result.id
      this.receiveItems(result.items)
      if (result.frame) {
        for (const profile of result.profiles) this.profiles.set(profile.handle, profile)
        this.receiveFrame(result.frame)
      } else {
        this.receiveState(result)
      }
      this.status('playing')
    })
  }

  receiveItems(items) {
    for (const { _id, x, y, color, r } of items) {
      const existing = this.items.get(_id)
      if (existing) this.itemGrid.remove(existing)
      const item = { pos: { x, y }, color, r }
      this.items.set(_id, item)
      this.itemGrid.add(item)
    }
  }

  setKey(key, pressed) {
    const lower = key.toLowerCase()
    if (this.id === null || !Object.hasOwn(movementKeys, lower)) return
    const bit = movementKeys[lower]
    this.setKeys(pressed ? this.keys | bit : this.keys & ~bit)
  }

  setKeys(keys) {
    if (keys === this.keys || !this.socket?.connected || this.id === null) return
    this.advance(performance.now())
    this.keys = keys
    this.socket.emit('game:input', { keys, seq: ++this.seq })
  }

  receiveVitals(vitals) {
    for (const [handle, r, hp, hpmax, lv] of vitals) {
      const profile = this.profiles.get(handle)
      if (profile) Object.assign(profile, { r, hp, hpmax, lv })
    }
  }

  receiveFrame([tick, poses, correction]) {
    if (this.id === null) return
    const players = []
    for (const [handle, x, y] of poses) {
      const profile = this.profiles.get(handle)
      if (!profile) continue
      const player = {
        ...profile,
        x,
        y,
        sw_angle: (-swordStep * (tick - profile.spawnTick)) % tau,
      }
      if (player._id === this.id) {
        const [vx, vy, inputSeq] = correction
        Object.assign(player, { vx, vy, inputSeq })
      }
      players.push(player)
    }
    this.receiveState({ tick, players })
  }

  receiveState({ tick, players }) {
    if (this.id === null) return
    const previous = this.snapshots[this.snapshots.length - 1]
    if (previous && previous.tick >= tick) return
    const now = performance.now()
    const byId = new Map(players.map(player => [player._id, player]))
    const own = byId.get(this.id)
    if (!own) return

    this.advance(now)
    if (!this.local || (this.local.pos.x - own.x) ** 2 + (this.local.pos.y - own.y) ** 2 > 200 ** 2) {
      this.local = { pos: { x: own.x, y: own.y }, speed: { x: own.vx, y: own.vy } }
      this.lastStep = now
      this.correction = { x: 0, y: 0 }
    } else if (own.inputSeq === this.seq || this.seq === 0) {
      // Keep recent local input visible until the server has applied it.
      this.correction = { x: own.x - this.local.pos.x, y: own.y - this.local.pos.y }
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
      movePlayer(this.local.pos, this.local.speed, this.keys)
      this.lastStep += tickMs

      // Spread small server corrections over several prediction steps.
      this.local.pos.x += this.correction.x * 0.25
      this.local.pos.y += this.correction.y * 0.25
      this.correction.x *= 0.75
      this.correction.y *= 0.75
    }
  }

  renderState(now) {
    if (!this.local) return null
    this.advance(now)
    const fraction = Math.max(0, Math.min(1, (now - this.lastStep) / tickMs))
    const me = {
      ...this.authoritative,
      x: this.local.pos.x + this.local.speed.x * fraction,
      y: this.local.pos.y + this.local.speed.y * fraction,
      sw_angle: this.authoritative.sw_angle -
        swordStep * Math.max(0, Math.min(3, (now - this.authoritativeAt) / tickMs)),
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

    return { me, players, items: this.itemGrid.nearby(me, itemViewRadius) }
  }
}
