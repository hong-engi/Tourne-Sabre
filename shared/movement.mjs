export const tickMs = 1000 / 30
export const swordStep = Math.PI / 30
export const movementKeys = Object.freeze({ w: 1, s: 2, a: 4, d: 8 })
export const movementMask = movementKeys.w | movementKeys.s | movementKeys.a | movementKeys.d
export const mapSize = 3000

function bound(coordinate) {
  const edge = Math.max(-mapSize, Math.min(mapSize, coordinate))
  return edge + (coordinate - edge) / 1.3
}

export function movePlayer(position, velocity, keys) {
  velocity.x += Number(Boolean(keys & movementKeys.d)) - Number(Boolean(keys & movementKeys.a))
  velocity.y += Number(Boolean(keys & movementKeys.s)) - Number(Boolean(keys & movementKeys.w))
  position.x = bound(position.x + velocity.x)
  position.y = bound(position.y + velocity.y)
  velocity.x -= velocity.x / 15
  velocity.y -= velocity.y / 15
}
