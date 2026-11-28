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
  runtime.reset();
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

test('runtime tick broadcasts pvp arena:state and isolated pve arena:state per socket', () => {
  const p = playerdb.addSync({ id: 'p1', name: 'One', mode: 'pve', pos: { x: 0, y: 0 }, speed: { x: 0, y: 0 }, hp: 100, hpmax: 100, xp: 0, lv: 1 });
  runtime.initPlayerMode(p, 'pve', 1000);
  const emitted = [];
  const fakeSocket = {
    data: { pid: 'p1' },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
  const fakeIo = {
    engine: { clientsCount: 1 },
    volatile: { emit: () => {} },
    sockets: { sockets: new Map([['s1', fakeSocket]]) },
  };
  runtime.setIo(fakeIo);
  runtime.tick(1000);

  const states = emitted.filter(e => e.event === 'arena:state');
  const mes = emitted.filter(e => e.event === 'arena:me');
  assert.equal(states.length, 1);
  assert.equal(states[0].payload.mode, 'pve');
  assert.equal(states[0].payload.players.length, 1);
  assert.equal(states[0].payload.players[0]._id, 'p1');
  assert.equal(mes.length, 1);
  assert.equal(mes[0].payload._id, 'p1');
  assert.equal(mes[0].payload.hp, 100);
  runtime.tick(1050);
  assert.equal(emitted.filter(e => e.event === 'arena:me').length, 1, 'an unchanged record is not resent');
  playerdb.get('p1').hp = 80;
  runtime.tick(1100);
  const mesAfter = emitted.filter(e => e.event === 'arena:me');
  assert.equal(mesAfter.length, 2);
  assert.equal(mesAfter[1].payload.hp, 80);
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
  const p = playerdb.addSync({ id: 'p1', name: 'One', mode: 'pve', pos: { x: 0, y: 0 }, speed: { x: 0, y: 0 }, hp: 50, hpmax: 100, xp: 0, lv: 1 });
  runtime.initPlayerMode(p, 'pve', 5000);
  p.augments = ['spoils'];
  const enemy = runtime.arenaFor('p1').spawn(p, 'stalker');
  enemy.x = 0;
  enemy.y = -110;
  enemy.hp = 1;

  const result = runtime.handleAttack({ id: 'p1', pos: { x: 0, y: 0 }, poses: [{ sw_angle: 0, sw_r: 65, sw_w: 40, sw_h: 100 }], bursts: [] }, 5000);
  assert.equal(result.shieldGained, 20);
  assert.equal(p.shield, 20);
  assert.ok(result.record && result.record.shield === 20);
});

test('attack windups carry remaining and total time for the client countdown', () => {
  const { EnemyArena } = require('./enemies');
  const a = new EnemyArena(() => 0.37);
  const p = { _id: 'p', x: 0, y: 0, hp: 1e6, hpmax: 1e6, lv: 5, augments: [], r: 25 };
  a.step([p], 1000);
  a.enemies = [];
  a.nextSpawn = Infinity;
  const e = a.spawn(p, 'charger', 1000, { x: 200, y: 0 });
  const seen = [];
  for (let t = 1050; t < 8000 && seen.length < 3; t += 50) {
    a.nextSpawn = Infinity;
    a.step([p], t);
    const row = a.snapshot(t).find(r => r.id === e.id);
    if (row && row.phase === 'windup') seen.push(row);
    else assert.equal(row && row.phaseLeft, undefined, 'no countdown outside a warning');
  }
  assert.equal(seen.length, 3, 'charger winds up');
  assert.ok(seen.every(r => r.phaseTotal === seen[0].phaseTotal), 'total stays fixed through the windup');
  assert.ok(seen[0].phaseLeft > seen[1].phaseLeft && seen[1].phaseLeft > seen[2].phaseLeft, 'remaining time counts down');
});

test('back-to-back attacks 50ms apart both register hits and moving poses hit at earlier positions', () => {
  const { EnemyArena } = require('./enemies');
  const a = new EnemyArena(() => 0.37);
  const p = { _id: 'p1', x: 0, y: 0, hp: 100, hpmax: 100, lv: 5, augments: [], r: 25, sw_angle: 0, sw_r: 65, sw_w: 40, sw_h: 100 };
  const e1 = a.spawn(p, 'stalker', 1000, { x: 0, y: -110 });
  const e2 = a.spawn(p, 'stalker', 1000, { x: 300, y: -110 });
  e1.hp = 100;
  e2.hp = 100;

  const r1 = a.attack({ ...p, poses: [{ blade: 'main', x: 0, y: 0, sw_angle: 0, sw_r: 65, sw_w: 40, sw_h: 100 }] }, 1050);
  assert.equal(r1.hits.length, 1);

  // 50ms later, player has moved to x=500, but earlier pose at x=300 still hits e2.
  const r2 = a.attack({ ...p, x: 500, y: 0, poses: [{ blade: 'main', x: 300, y: 0, sw_angle: 0, sw_r: 65, sw_w: 40, sw_h: 100 }] }, 1100);
  assert.equal(r2.hits.length, 1);
  assert.equal(r2.hits[0].id, e2.id);
});

test('lag compensation hits a fast enemy using its ~100ms-ago recorded position', () => {
  const { EnemyArena } = require('./enemies');
  const a = new EnemyArena(() => 0.37);
  const p = { _id: 'p1', x: 0, y: 0, hp: 1e6, hpmax: 1e6, lv: 5, augments: [], r: 25, sw_angle: 0, sw_r: 65, sw_w: 40, sw_h: 100 };
  const e = a.spawn(p, 'stalker', 1000, { x: 0, y: -110 });
  e.hp = 100;
  a.step([p], 1000);
  // Move enemy out of sword reach by 1100ms, keeping its 1000ms position in posHistory.
  e.x = 400;
  e.y = -110;
  a.posHistory.push({ t: 1000, pos: new Map([[e.id, { x: 0, y: -110 }]]) });
  const res = a.attack({ ...p, poses: [{ blade: 'main', x: 0, y: 0, sw_angle: 0, sw_r: 65, sw_w: 40, sw_h: 100 }] }, 1100);
  assert.equal(res.hits.length, 1);
  assert.equal(res.hits[0].id, e.id);
});

test('snapshot omits unused enemy fields and default values', () => {
  const { EnemyArena } = require('./enemies');
  const a = new EnemyArena(() => 0.37);
  const p = { _id: 'p1', x: 0, y: 0, hp: 100, hpmax: 100, lv: 5, augments: [], r: 25 };
  const e = a.spawn(p, 'stalker', 1000, { x: 100, y: 0 });
  e.tier = 'normal';
  e.armor = 1;
  e.angularVelocity = 2.7;
  e.aimX = 0;
  e.aimY = 0;
  const [row] = a.snapshot(1000);
  for (const dropped of ['level', 'xp', 'power', 'contact', 'seed', 'armor', 'angularVelocity', 'aimX', 'aimY', 'tier']) {
    assert.equal(row[dropped], undefined, `${dropped} should be omitted`);
  }
  assert.equal(row.phase, 'hunt', 'phase is preserved');
});

test('runtime skips lobby sockets and filters out-of-range non-boss enemies', () => {
  const p = playerdb.addSync({ id: 'p1', name: 'One', mode: 'pve', pos: { x: 0, y: 0 }, speed: { x: 0, y: 0 }, hp: 100, hpmax: 100, xp: 0, lv: 1 });
  runtime.initPlayerMode(p, 'pve', 1000);

  const lobbyEmitted = [];
  const playerEmitted = [];
  const fakeIo = {
    engine: { clientsCount: 2 },
    sockets: {
      sockets: new Map([
        ['lobby', { data: { pid: null }, emit: (e, d) => lobbyEmitted.push({ e, d }) }],
        ['player', { data: { pid: 'p1' }, emit: (e, d) => playerEmitted.push({ e, d }) }],
      ]),
    },
  };
  runtime.setIo(fakeIo);
  runtime.tick(1000);

  assert.equal(lobbyEmitted.length, 0, 'lobby socket receives no arena:state');
  assert.ok(playerEmitted.some(x => x.e === 'arena:state'));

  const filtered = runtime.filterStateForPlayer({
    enemies: [
      { id: 'near', x: 200, y: 0, r: 20 },
      { id: 'far', x: 2500, y: 0, r: 20 },
      { id: 'boss', x: 2500, y: 0, r: 40, tier: 'boss' },
    ],
    projectiles: [{ id: 's1', x: 100, y: 0 }, { id: 's2', x: 2500, y: 0 }],
    hazards: [],
    blasts: [],
    skillZones: [],
    walls: [],
    decoys: [],
  }, p);
  assert.deepEqual(filtered.enemies.map(e => e.id), ['near', 'boss']);
  assert.deepEqual(filtered.projectiles.map(s => s.id), ['s1']);
});
