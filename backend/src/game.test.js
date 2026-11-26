import assert from 'node:assert/strict'
import test from 'node:test'
import { Game } from './game.js'
import { Player, swordHits } from './object.js'
import { movementKeys, swordStep } from '../../shared/movement.mjs'
import SpatialGrid from '../../shared/spatialGrid.mjs'

test('sword collision matches the rendered rectangle, including after rotation', () => {
  const player = new Player('one', 'One')
  const target = (x, y, r = 12) => ({ pos: { x, y }, r })
  assert.equal(swordHits(player.swordHitbox(), target(29, -90)), true)
  assert.equal(swordHits(player.swordHitbox(), target(33, -90)), false)
  assert.equal(swordHits(player.swordHitbox(), target(28, -147)), true)
  assert.equal(swordHits(player.swordHitbox(), target(31, -149)), false)

  player.sw_angle = -Math.PI / 2
  assert.equal(swordHits(player.swordHitbox(), target(90, 29)), true)
  assert.equal(swordHits(player.swordHitbox(), target(0, -90)), false)
})

test('the snapshot acknowledges the latest valid input after simulation', () => {
  const game = new Game()
  const initial = game.join('one', 'One')
  assert.equal(initial.items.length, 1000)
  assert.equal(new Set(initial.items.map(item => item._id)).size, 1000)
  game.setInput('one', { keys: movementKeys.d, seq: 2 })
  game.setInput('one', { keys: movementKeys.a, seq: 1 })
  game.setInput('one', { keys: 16, seq: 3 })
  assert.equal(game.snapshot().players[0].inputSeq, -1)

  game.step()
  const [player] = game.snapshot().players
  assert.equal(player.x, 1)
  assert.equal(player.y, 0)
  assert.equal(player.inputSeq, 2)
})

test('a collected item moves between grid cells and keeps its ID', t => {
  const game = new Game()
  game.join('one', 'One')
  const [item] = game.items
  item.pos = { x: 0, y: 0 }
  item.xp = 10
  game.itemGrid = new SpatialGrid(128)
  game.itemGrid.add(item)
  t.mock.method(item, 'respawn', () => { item.pos = { x: 2000, y: -2000 } })

  const { changedItems } = game.step()
  assert.deepEqual(changedItems.map(({ _id, x, y }) => ({ _id, x, y })),
    [{ _id: item.id, x: 2000, y: -2000 }])
  assert.deepEqual([...game.itemGrid.nearby({ x: 0, y: 0 }, 40)], [])
  assert.deepEqual([...game.itemGrid.nearby(item.pos, 40)], [item])
  assert.equal(game.players.get('one').player.xp, 10)
})

test('simultaneous lethal hits remove both players on the same tick', () => {
  const game = new Game()
  game.itemGrid = new SpatialGrid(128)
  game.join('one', 'One')
  game.join('two', 'Two')
  const first = game.players.get('one').player
  const second = game.players.get('two').player
  second.pos = { x: 95, y: 0 }
  first.sw_angle = -Math.PI / 2 + swordStep
  second.sw_angle = -3 * Math.PI / 2 + swordStep
  first.hp = 6
  second.hp = 6

  assert.deepEqual(new Set(game.step().deaths), new Set(['one', 'two']))
  assert.equal(game.size, 0)
})
