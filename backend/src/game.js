import { distanceSquared, Item, maxItemRadius, Player, swordHits } from './object.js'
import { movementMask } from '../../shared/movement.mjs'
import SpatialGrid from '../../shared/spatialGrid.mjs'

const itemCount = 1000
const spawnClearance = 225
const spawnPositions = [{ x: 0, y: 0 }]
for (const distance of [300, 600, 900]) {
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4
    spawnPositions.push({
      x: Math.round(distance * Math.cos(angle)),
      y: Math.round(distance * Math.sin(angle)),
    })
  }
}

// Keep subpixel precision without transmitting all floating-point digits.
const round = value => Math.round(value * 1000) / 1000

function playerState({ player, inputSeq }) {
  return {
    _id: player.id,
    name: player.name,
    x: round(player.pos.x),
    y: round(player.pos.y),
    vx: round(player.speed.x),
    vy: round(player.speed.y),
    r: round(player.r),
    sw_angle: round(player.sw_angle),
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

function profile(entry) {
  const { player, handle, spawnTick } = entry
  return {
    handle,
    spawnTick,
    _id: player.id,
    name: player.name,
    color: player.color,
    sw_r: player.sw_r,
    sw_w: player.sw_w,
    sw_h: player.sw_h,
    r: round(player.r),
    hp: player.hp,
    hpmax: player.hpmax,
    lv: player.lv,
  }
}

function itemState(item) {
  return {
    _id: item.id,
    x: round(item.pos.x),
    y: round(item.pos.y),
    color: item.color,
    r: item.r,
  }
}

export class Game {
  constructor() {
    this.tick = 0
    this.nextHandle = 1
    this.players = new Map()
    this.itemGrid = new SpatialGrid(128)
    this.items = Array.from({ length: itemCount }, (_, id) => {
      const item = new Item(String(id))
      this.itemGrid.add(item)
      return item
    })
  }

  get size() {
    return this.players.size
  }

  join(id, name, compact = false) {
    if (!this.players.has(id)) {
      const { x, y } = this.spawnPosition()
      this.players.set(id, {
        player: new Player(id, name, x, y),
        handle: this.nextHandle++,
        spawnTick: this.tick,
        keys: 0,
        seq: -1,
        inputSeq: -1,
      })
    }
    const items = this.items.map(itemState)
    if (compact) {
      return {
        id,
        items,
        profiles: Array.from(this.players.values(), profile),
        frame: [this.tick, this.poses(), this.correction(id)],
      }
    }
    return { id, ...this.snapshot(), items }
  }

  playerProfile(id) {
    return profile(this.players.get(id))
  }

  poses() {
    return Array.from(this.players.values(), ({ player, handle }) => [
      handle, round(player.pos.x), round(player.pos.y),
    ])
  }

  correction(id) {
    const { player, inputSeq } = this.players.get(id)
    return [round(player.speed.x), round(player.speed.y), inputSeq]
  }

  spawnPosition() {
    for (const position of spawnPositions) {
      let clear = true
      for (const { player } of this.players.values()) {
        if (distanceSquared(player.pos, position) < spawnClearance ** 2) {
          clear = false
          break
        }
      }
      if (clear) return position
    }
    return spawnPositions[0]
  }

  leave(id) {
    const handle = this.players.get(id)?.handle
    this.players.delete(id)
    return handle
  }

  setInput(id, payload) {
    const entry = this.players.get(id)
    if (!entry || !payload) return

    const { keys, seq } = payload
    if (!Number.isInteger(keys) || keys < 0 || keys > movementMask) return
    if (!Number.isSafeInteger(seq) || seq <= entry.seq) return
    entry.keys = keys
    entry.seq = seq
  }

  snapshot() {
    return { tick: this.tick, players: Array.from(this.players.values(), playerState) }
  }

  step() {
    this.tick++
    const changedItems = new Map()
    const changedPlayers = new Set()
    for (const entry of this.players.values()) {
      const { player, keys } = entry
      player.step(keys)
      entry.inputSeq = entry.seq

      // A respawn can update a cell being queried, so take the candidates first.
      const nearbyItems = Array.from(this.itemGrid.nearby(player.pos, player.r + maxItemRadius))
      for (const item of nearbyItems) {
        if (!player.canCollect(item)) continue
        this.itemGrid.remove(item)
        player.addExperience(item.xp)
        changedPlayers.add(entry)
        item.respawn()
        this.itemGrid.add(item)
        changedItems.set(item.id, itemState(item))
      }
    }

    const defeated = new Map()
    for (const attackerEntry of this.players.values()) {
      const attacker = attackerEntry.player
      const sword = attacker.swordHitbox()
      for (const targetEntry of this.players.values()) {
        const target = targetEntry.player
        if (target === attacker || target.hp === 0 || !swordHits(sword, target)) continue
        target.damage(attacker.lv + 5)
        changedPlayers.add(targetEntry)
        if (target.hp === 0) defeated.set(target.id, attackerEntry)
      }
    }

    // Remove defeated players after all attacks so same-tick hits can land.
    const removedHandles = []
    for (const [id, attackerEntry] of defeated) {
      removedHandles.push(this.leave(id))
      if (attackerEntry.player.hp > 0) {
        attackerEntry.player.addExperience(50)
        changedPlayers.add(attackerEntry)
      }
    }
    const vitals = []
    for (const { player, handle } of changedPlayers) {
      if (player.hp > 0) vitals.push([handle, round(player.r), player.hp, player.hpmax, player.lv])
    }
    return {
      changedItems: Array.from(changedItems.values()),
      deaths: Array.from(defeated.keys()),
      removedHandles,
      vitals,
    }
  }
}
