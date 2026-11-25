const { Item, Player } = require('./object')

const itemCount = 1000
const cellSize = 128
const maxItemRadius = 12
const spawnClearance = 225
const swordRotation = 6 * Math.PI / 180

function playerState(player, inputSeq) {
  return {
    _id: player.id,
    name: player.name,
    x: player.pos.x,
    y: player.pos.y,
    vx: player.speed.x,
    vy: player.speed.y,
    r: player.r,
    sw_angle: player.sw_angle,
    sw_r: player.sw_r,
    sw_w: player.sw_w,
    sw_h: player.sw_h,
    hp: player.hp,
    hpmax: player.hpmax,
    lv: player.lv,
    color: player.color,
    inputSeq,
  }
}

function itemState(item) {
  return {
    _id: item.id,
    x: item.pos.x,
    y: item.pos.y,
    color: item.color,
    r: item.r,
  }
}

class Game {
  constructor() {
    this.tick = 0
    this.players = new Map()
    this.items = new Map()
    this.itemCells = new Map()
    while (this.items.size < itemCount) {
      const item = Item.randomItem()
      if (this.items.has(item.id)) continue
      this.items.set(item.id, item)
      this.addToCell(item)
    }
  }

  get size() {
    return this.players.size
  }

  join(id, name) {
    if (!this.players.has(id)) {
      const player = this.spawn(name)
      player.id = id
      this.players.set(id, { player, keys: 0, seq: -1, inputSeq: -1 })
    }
    return { id, ...this.snapshot(), items: Array.from(this.items.values(), itemState) }
  }

  spawn(name) {
    const isClear = (x, y) => {
      for (const { player } of this.players.values()) {
        if (Math.hypot(player.pos.x - x, player.pos.y - y) < spawnClearance) return false
      }
      return true
    }

    if (isClear(0, 0)) return new Player(name)
    for (const distance of [300, 600, 900]) {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4
        const x = Math.round(distance * Math.cos(angle))
        const y = Math.round(distance * Math.sin(angle))
        if (isClear(x, y)) return new Player(name, x, y)
      }
    }
    return new Player(name)
  }

  leave(id) {
    this.players.delete(id)
  }

  setInput(id, payload) {
    const entry = this.players.get(id)
    if (!entry || !payload) return

    const { keys, seq } = payload
    if (!Number.isInteger(keys) || keys < 0 || keys > 15) return
    if (!Number.isSafeInteger(seq) || seq <= entry.seq) return
    entry.keys = keys
    entry.seq = seq
  }

  snapshot() {
    return {
      tick: this.tick,
      players: Array.from(this.players.values(), ({ player, inputSeq }) => playerState(player, inputSeq)),
    }
  }

  step() {
    this.tick += 1
    const changedItems = new Map()
    for (const entry of this.players.values()) {
      const { player, keys } = entry
      const horizontal = Number(Boolean(keys & 8)) - Number(Boolean(keys & 4))
      const vertical = Number(Boolean(keys & 2)) - Number(Boolean(keys & 1))
      player.addSpeed(horizontal, vertical)
      player.move()
      player.sw_rot(swordRotation)
      entry.inputSeq = entry.seq

      for (const item of this.nearbyItems(player)) {
        if (!player.trytoeat(item)) continue
        this.removeFromCell(item)
        item.eaten(player)
        this.addToCell(item)
        changedItems.set(item.id, itemState(item))
      }
    }

    const hits = []
    for (const { player: attacker } of this.players.values()) {
      const reach = attacker.r + attacker.sw_r + Math.hypot(attacker.sw_w, attacker.sw_h) / 2
      for (const { player: target } of this.players.values()) {
        if (attacker === target || attacker.pos.dist(target.pos) > reach + target.r) continue
        if (attacker.trytohit(target)) hits.push({ attacker, target, damage: attacker.lv + 5 })
      }
    }

    const defeated = new Map()
    for (const { attacker, target, damage } of hits) {
      if (target.dead()) continue
      target.damage(damage)
      if (target.dead()) defeated.set(target.id, attacker)
    }
    for (const [id, attacker] of defeated) {
      this.leave(id)
      if (!attacker.dead()) attacker.xpup(50)
    }

    return { changedItems: Array.from(changedItems.values()), deaths: Array.from(defeated.keys()) }
  }

  nearbyItems(player) {
    const { x, y } = player.pos
    const radius = player.r + maxItemRadius
    const items = []
    for (let column = Math.floor((x - radius) / cellSize); column <= Math.floor((x + radius) / cellSize); column++) {
      for (let row = Math.floor((y - radius) / cellSize); row <= Math.floor((y + radius) / cellSize); row++) {
        const cell = this.itemCells.get(`${column},${row}`)
        if (cell) items.push(...cell)
      }
    }
    return items
  }

  cellKey(item) {
    return `${Math.floor(item.pos.x / cellSize)},${Math.floor(item.pos.y / cellSize)}`
  }

  addToCell(item) {
    const key = this.cellKey(item)
    let cell = this.itemCells.get(key)
    if (!cell) {
      cell = new Set()
      this.itemCells.set(key, cell)
    }
    cell.add(item)
  }

  removeFromCell(item) {
    const key = this.cellKey(item)
    const cell = this.itemCells.get(key)
    cell.delete(item)
    if (cell.size === 0) this.itemCells.delete(key)
  }
}

module.exports = { Game }
