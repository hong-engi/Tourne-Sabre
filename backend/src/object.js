import { mapSize, movePlayer, swordStep } from '../../shared/movement.mjs'

const tau = 2 * Math.PI
const playerRadius = 25
export const maxItemRadius = 12

function randomColor() {
  const digit = () => '6789ABCDEF'[Math.floor(Math.random() * 10)]
  const brightest = Math.floor(Math.random() * 3)
  return '#' + [0, 1, 2].map(channel => channel === brightest ? 'FF' : digit() + digit()).join('')
}

export function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

export class Player {
  constructor(id, name, x = 0, y = 0) {
    this.id = id
    this.name = name
    this.pos = { x, y }
    this.speed = { x: 0, y: 0 }
    this.r = playerRadius
    this.sw_angle = 0
    this.sw_r = 65
    this.sw_w = 40
    this.sw_h = 100
    this.hp = 100
    this.hpmax = 100
    this.xp = 0
    this.lv = 1
    this.color = randomColor()
  }

  step(keys) {
    movePlayer(this.pos, this.speed, keys)
    this.sw_angle = (this.sw_angle - swordStep) % tau
  }

  swordHitbox() {
    const halfWidth = this.sw_w / 2
    const halfHeight = this.sw_h / 2
    const offset = this.r + this.sw_r
    return {
      pos: this.pos,
      halfWidth,
      halfHeight,
      offset,
      reach: offset + Math.hypot(halfWidth, halfHeight),
      sin: Math.sin(this.sw_angle),
      cos: Math.cos(this.sw_angle),
    }
  }

  canCollect(item) {
    return distanceSquared(this.pos, item.pos) <= (this.r + item.r) ** 2
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - amount)
  }

  addExperience(amount) {
    this.xp += amount
    this.r = Math.sqrt(playerRadius ** 2 + this.xp)
    if (this.xp > 50 * this.lv ** 2) {
      this.lv++
      this.hpmax += 25
      this.hp += 25
    }
  }
}

export function swordHits(sword, target) {
  if (distanceSquared(sword.pos, target.pos) > (sword.reach + target.r) ** 2) return false

  // Transform the target into the rectangle's coordinate space.
  const dx = target.pos.x - sword.pos.x
  const dy = target.pos.y - sword.pos.y
  const x = dx * sword.cos - dy * sword.sin
  const y = dx * sword.sin + dy * sword.cos + sword.offset
  const gapX = Math.max(0, Math.abs(x) - sword.halfWidth)
  const gapY = Math.max(0, Math.abs(y) - sword.halfHeight)
  return gapX ** 2 + gapY ** 2 < target.r ** 2
}

export class Item {
  constructor(id) {
    this.id = id
    this.respawn()
  }

  respawn() {
    this.pos = {
      x: Math.random() * (2 * mapSize) - mapSize,
      y: Math.random() * (2 * mapSize) - mapSize,
    }
    this.color = randomColor()
    this.xp = 1 + Math.floor(Math.random() * 16)
    this.r = 3 + Math.floor(Math.random() * (maxItemRadius - 2))
  }
}
