const mapSize = 3000

export class Pos {
  constructor(x, y) {
    this.x = x
    this.y = y
  }

  dist(other) {
    return Math.hypot(this.x - other.x, this.y - other.y)
  }

  move(x, y) {
    this.x += x
    this.y += y
  }

  addv(other, scale = 1) {
    return new Pos(this.x + other.x * scale, this.y + other.y * scale)
  }
}

function bound(coordinate) {
  const edge = Math.max(-mapSize, Math.min(mapSize, coordinate))
  return edge + (coordinate - edge) / 1.3
}

export class PredictedMovement {
  constructor(position, velocity) {
    this.pos = new Pos(position.x, position.y)
    this.speed = new Pos(velocity.x, velocity.y)
  }

  step(horizontal, vertical) {
    this.speed.move(horizontal, vertical)
    this.pos.x = bound(this.pos.x + this.speed.x)
    this.pos.y = bound(this.pos.y + this.speed.y)
    this.speed.move(-this.speed.x / 15, -this.speed.y / 15)
  }
}
