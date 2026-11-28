const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const playerdb = require('../db/playerdb');
const itemdb = require('../db/itemdb');
const progression = require('./progression');
const runtime = require('./runtime');
const GameObject = require('../object');

beforeEach(() => {
  playerdb.clear();
  itemdb.clear();
  itemdb.setOnChange(null);
  progression.clearTimers();
  runtime.arena.enemies = [];
  runtime.arena.projectiles = [];
  runtime.arena.hazards = [];
  runtime.arena.blasts = [];
  runtime.setIo(null);
});

test('itemdb seeds 1000 unique items in memory and emits single-item diffs on update', () => {
  const seeded = itemdb.seed(1000, () => GameObject.Item.randomItem());
  assert.equal(seeded.length, 1000);
  const patched = [];
  itemdb.setOnChange(row => patched.push(row));

  const target = seeded[0];
  const updated = itemdb.updateSync({ id: target._id, pos: { x: 123, y: -456 }, color: '#FFAAAA', xp: 9, r: 7 });
  assert.equal(updated._id, target._id);
  assert.equal(itemdb.get(target._id).x, 123);
  assert.equal(itemdb.get(target._id).y, -456);
  assert.equal(patched.length, 1);
  assert.deepEqual(patched[0], updated);
});

test('in-memory progression preserves physics ledger corrections, offers, choices, spells, and damage', () => {
  const p = playerdb.addSync({
    id: 'p1',
    name: 'Tester',
    pos: { x: 10, y: 20 },
    speed: { x: 0, y: 0 },
    hp: 100,
    hpmax: 100,
    xp: 0,
    lv: 1,
    spells: ['blink', 'heal'],
    loadout: ['reverse', 'giant', 'accel', 'thrust'],
  });
  assert.equal(p._id, 'p1');

  // Server applies knockback while client has not yet acked seq 1.
  playerdb.applyPhysicsCorrection({ id: 'p1', dx: 40, dy: -15, dvx: 90, dvy: 0 });
  assert.equal(p.physicsSeq, 1);

  // Client syncs old position with ack.x=0 and enough XP for Lv 3 (100 XP -> milestone offer).
  const synced = progression.syncSync({
    id: 'p1',
    pos: { x: 12, y: 20 },
    speed: { x: 1, y: 0 },
    sw_angle: 0.5,
    sw_r: 65,
    sw_w: 40,
    sw_h: 100,
    sw_speed: 0.1,
    xp: 100,
    physicsAck: { seq: 0, x: 0, y: 0, vx: 0, vy: 0 },
  });
  assert.equal(synced.x, 52, 'unacked physics dx preserved');
  assert.equal(synced.y, 5, 'unacked physics dy preserved');
  assert.equal(synced.vx, 4, 'unacked physics dvx/30 preserved');
  assert.equal(synced.lv, 3);
  assert.equal(synced.hpmax, 120);
  assert.equal(synced.hp, 120);
  assert.ok(synced.augmentOffer && synced.augmentOffer.options.length === 3);

  const firstOption = synced.augmentOffer.options[0];
  const chosen = progression.chooseSync('p1', firstOption);
  assert.deepEqual(chosen.augments, [firstOption]);
  assert.equal(chosen.augmentOffer, null);

  const dmg = progression.damageSync('p1', 30, 1000);
  assert.equal(dmg.before.hp - dmg.after.hp, 30);
  const healed = progression.castSpellSync('p1', 'heal', runtime.arena, 2000);
  assert.ok(healed.hp > dmg.after.hp);
});

test('runtime tick broadcasts one shared arena:state and a private arena:me per socket', () => {
  playerdb.addSync({ id: 'p1', name: 'One', pos: { x: 0, y: 0 }, speed: { x: 0, y: 0 }, hp: 100, hpmax: 100, xp: 0, lv: 1 });
  const broadcast = [];
  const emitted = [];
  const fakeSocket = {
    data: { pid: 'p1' },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
  const fakeIo = {
    engine: { clientsCount: 1 },
    volatile: { emit: (event, payload) => broadcast.push({ event, payload }) },
    sockets: { sockets: new Map([['s1', fakeSocket]]) },
  };
  runtime.setIo(fakeIo);
  runtime.tick(1000);

  assert.equal(broadcast.length, 1);
  assert.equal(broadcast[0].event, 'arena:state');
  assert.equal(broadcast[0].payload.players.length, 1);
  assert.equal(broadcast[0].payload.players[0]._id, 'p1');
  assert.equal(broadcast[0].payload.me, undefined, 'private record is not broadcast');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].event, 'arena:me');
  assert.equal(emitted[0].payload._id, 'p1');
  assert.equal(emitted[0].payload.hp, 100);
  runtime.tick(1050);
  assert.equal(emitted.length, 1, 'an unchanged record is not resent');
  playerdb.get('p1').hp = 80;
  runtime.tick(1100);
  assert.equal(emitted.length, 2);
  assert.equal(emitted[1].payload.hp, 80);
});

test('enemy snapshots leave server-only AI fields behind and round floats', () => {
  const { EnemyArena, SERVER_ONLY } = require('./enemies');
  const a = new EnemyArena(() => 0.37);
  const p = { _id: 'p', x: 0, y: 0, hp: 100, hpmax: 100, lv: 5, augments: [], r: 25 };
  for (let t = 1000; t < 6000; t += 50) a.step([p], t);
  const rows = a.snapshot(6000);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    for (const k of Object.keys(row)) assert.ok(!SERVER_ONLY.has(k), `${k} leaked`);
    for (const k of ['x', 'y', 'vx', 'vy']) assert.equal(row[k], Math.round(row[k] * 100) / 100);
  }
});

test('runtime handleAttack applies heal/shield outcomes directly in memory and returns updated record', () => {
  const p = playerdb.addSync({ id: 'p1', name: 'One', pos: { x: 0, y: 0 }, speed: { x: 0, y: 0 }, hp: 50, hpmax: 100, xp: 0, lv: 1 });
  p.augments = ['spoils'];
  const enemy = runtime.arena.spawn(p, 'stalker');
  enemy.x = 0;
  enemy.y = -110;
  enemy.hp = 1;

  const result = runtime.handleAttack({ id: 'p1', pos: { x: 0, y: 0 }, poses: [{ sw_angle: 0, sw_r: 65, sw_w: 40, sw_h: 100 }], bursts: [] }, 5000);
  assert.equal(result.shieldGained, 20);
  assert.equal(p.shield, 20);
  assert.ok(result.record && result.record.shield === 20);
});
