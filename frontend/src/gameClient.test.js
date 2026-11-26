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

test('a later compact frame decodes after dropped frames and reliable profile changes', () => {
  const game = new GameClient()
  game.id = 'one'
  game.profiles.set(1, { handle: 1, _id: 'one', spawnTick: 0, name: 'One', hp: 100 })
  game.profiles.set(2, { handle: 2, _id: 'two', spawnTick: 8, name: 'Two', hp: 100 })

  game.receiveFrame([10, [[1, 0, 0], [2, 300, 0]], [0, 0, -1]])
  game.receiveVitals([[2, 26, 80, 100, 1]])
  game.receiveFrame([14, [[1, 3, 0], [2, 305, 0]], [1, 0, 3]])

  const [initial, latest] = game.snapshots
  expect(initial.byId.get('two').hp).toBe(100)
  expect(latest.byId.get('two')).toMatchObject({ hp: 80, x: 305, name: 'Two' })
  expect(latest.byId.get('two').sw_angle).toBeCloseTo(-Math.PI / 5)
  expect(latest.byId.get('two').inputSeq).toBeUndefined()
  expect(latest.byId.get('one')).toMatchObject({ x: 3, vx: 1, inputSeq: 3 })

  game.profiles.delete(2)
  game.receiveFrame([15, [[1, 4, 0]], [1, 0, 3]])
  expect(game.renderState(performance.now()).players).toHaveLength(0)
})
