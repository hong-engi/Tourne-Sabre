import { MapState, compactPlayerSync } from './map';
import { Player } from './object';
import { createSkills } from './skills';

function createMockSocket() {
  const listeners = new Map();
  const sent = [];
  return {
    connected: true,
    sent,
    on(event, fn) {
      listeners.set(event, fn);
    },
    emit(event, payload, ack) {
      sent.push({ event, payload, ack });
    },
    trigger(event, data) {
      const fn = listeners.get(event);
      if (fn) fn(data);
    },
  };
}

test('compactPlayerSync strips heavy local-only fields like swordPoses and skills', () => {
  const p = new Player('Hero');
  p.skills = createSkills();
  p.swordPoses = Array.from({ length: 100 }, () => ({ sw_angle: 1 }));
  p.blades = [{ blade: 'main', sw_angle: 0 }];
  p.lastPvpHit = { other: 123 };

  const compact = compactPlayerSync(p);
  expect(compact.id).toBe(p.id);
  expect(compact.pos).toEqual({ x: p.pos.x, y: p.pos.y });
  expect(compact.swordPoses).toBeUndefined();
  expect(compact.blades).toBeUndefined();
  expect(compact.skills).toBeUndefined();
  expect(compact.lastPvpHit).toBeUndefined();
});

test('MapState applies items:init and incremental items:patch in place', () => {
  const state = new MapState();
  const socket = createMockSocket();
  state.attachSocket(socket);

  socket.trigger('items:init', [
    { _id: 'i1', x: 10, y: 20, color: '#FFAAAA', xp: 5, r: 6 },
    { _id: 'i2', x: 30, y: 40, color: '#AAFFAA', xp: 8, r: 7 },
  ]);
  expect(state.itemList).toHaveLength(2);

  socket.trigger('items:patch', [{ _id: 'i1', x: 500, y: -300, color: '#AAAAFF', xp: 12, r: 9 }]);
  expect(state.itemList).toHaveLength(2);
  expect(state.itemList[0]).toEqual({ _id: 'i1', x: 500, y: -300, color: '#AAAAFF', xp: 12, r: 9 });
});

test('MapState streams player:sync and enemy:attack over WebSocket and preserves pending level-up HP', async () => {
  const state = new MapState();
  const socket = createMockSocket();
  state.attachSocket(socket);

  const p = new Player('Hero');
  p.skills = createSkills();
  state.setActivePlayer(p);

  // Local level-up to Lv 2 (hp: 110, hpmax: 110).
  p.xpup(40);
  expect(p.lv).toBe(2);
  expect(p.hp).toBe(110);

  // In-flight arena:state still from Lv 1 (hp: 100, hpmax: 100) must not drop HP to 100.
  socket.trigger('arena:state', {
    enemies: [{ id: 'e1', type: 'stalker', x: 100, y: 0, hp: 30, hpmax: 30, r: 18 }],
    players: [{ _id: p.id, name: p.name, x: 0, y: 0, vx: 0, vy: 0, r: 25, hp: 100, hpmax: 100, lv: 1 }],
    projectiles: [],
    hazards: [],
    blasts: [],
    threat: { level: 1, elapsed: 5000 },
    me: { _id: p.id, lv: 1, hp: 100, hpmax: 100, augments: [], shield: 0, shieldUntil: 0, physicsSeq: 0 },
  });
  expect(p.hp).toBe(110);
  expect(state.enemyList).toHaveLength(1);
  expect(state.playerList).toHaveLength(1);

  // sync() emits player:sync over WebSocket at 50ms cadence.
  state.sync(p, 100);
  state.sync(p, 120);
  expect(socket.sent.filter(m => m.event === 'player:sync')).toHaveLength(1);
  state.sync(p, 160);
  expect(socket.sent.filter(m => m.event === 'player:sync')).toHaveLength(2);

  // attackEnemies() sends enemy:attack via ack and applies result.record.
  let received = null;
  state.attackEnemies(p, r => { received = r; }, 200);
  const atk = socket.sent.find(m => m.event === 'enemy:attack');
  expect(atk).toBeDefined();
  atk.ack({
    hits: [{ id: 'e1', damage: 12, killed: false }],
    xp: 0,
    record: { _id: p.id, lv: 2, hp: 108, hpmax: 110, augments: [], shield: 20, shieldUntil: Date.now() + 5000, physicsSeq: 0 },
  });
  await Promise.resolve();
  expect(received.hits).toHaveLength(1);
  expect(p.hp).toBe(108);
  expect(p.shield).toBe(20);
});
