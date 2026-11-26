import { expect, test } from 'vitest'
import GameClient from './gameClient.js'

test('an item update replaces its old entry in the render grid', () => {
  const game = new GameClient()
  game.id = 'one'
  game.receiveState({
    tick: 1,
    players: [{ _id: 'one', x: 0, y: 0, vx: 0, vy: 0, sw_angle: 0 }],
  })
  game.receiveItems([{ _id: 'item', x: 10, y: 10, color: 'red', r: 5 }])
  expect(Array.from(game.renderState(performance.now()).items)).toHaveLength(1)

  game.receiveItems([{ _id: 'item', x: 2400, y: -2400, color: 'red', r: 5 }])
  expect(Array.from(game.renderState(performance.now()).items)).toHaveLength(0)
})
