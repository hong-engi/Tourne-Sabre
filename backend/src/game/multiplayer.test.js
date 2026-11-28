const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const playerdb = require('../db/playerdb');
const progression = require('./progression');
const runtime = require('./runtime');
const { createServer } = require('../app');

let ioClient = null;
try {
  ioClient = require(path.join(__dirname, '../../../frontend/node_modules/socket.io-client'));
} catch (err) {
  ioClient = null;
}

const join = (id, mode = 'pve') => ({ id, name: id, mode, pos: { x: 0, y: 0 }, speed: { x: 0, y: 0 }, hp: 100, hpmax: 100, xp: 0, lv: 1 });
const sync = (id, open) => ({ id, pos: { x: 0, y: 0 }, speed: { x: 0, y: 0 }, xp: 0, augmentMenuOpen: open });

beforeEach(() => {
  playerdb.clear();
  progression.clearTimers();
  runtime.reset();
});

test('the augment picker pauses solo PvE but never PvP', () => {
  playerdb.addSync(join('a', 'pve'));
  assert.equal(progression.syncSync(sync('a', true)).choosingAugment, true, 'solo PvE: paused');
  playerdb.addSync(join('b', 'pvp'));
  assert.equal(progression.syncSync(sync('b', true)).choosingAugment, false, 'PvP: never pauses');
  assert.throws(() => progression.chooseSync('b', 'vitality'), /PvP/);
});

test('mode switching: PvE->PvP anytime with 5s stealth + 5m cooldown, PvP->PvE unlocked by boss kill', () => {
  const p = playerdb.addSync(join('m1', 'pve'));
  runtime.initPlayerMode(p, 'pve', 1000);
  assert.equal(p.mode, 'pve');

  runtime.switchMode('m1', 'pvp', 2000);
  assert.equal(p.mode, 'pvp');
  assert.equal(p.stealthUntil, 7000);
  assert.equal(p.pveCooldownUntil, 302000);
  assert.throws(() => runtime.switchMode('m1', 'pve', 10000), /대기 중/);

  // Boss last-hit grants 50% missing HP heal, 10s shield, 30s buff, and 30s free PvE switch.
  p.hp = 40;
  progression.applyBossKillReward('m1', 10000);
  assert.equal(p.hp, 70);
  assert.equal(p.shield, 50);
  assert.equal(p.shieldUntil, 20000);
  assert.equal(p.bossBuffUntil, 40000);
  assert.equal(p.pveFreeUntil, 40000);

  runtime.switchMode('m1', 'pve', 15000);
  assert.equal(p.mode, 'pve');
  assert.equal(p.stealthUntil, 0);
});

function listen(options) {
  const { server, io } = createServer(options);
  return new Promise(resolve => server.listen(0, () => resolve({ server, io, url: `http://127.0.0.1:${server.address().port}` })));
}
const connect = url => new Promise((resolve, reject) => {
  const s = ioClient(url, { transports: ['websocket'], reconnection: false, forceNew: true });
  s.once('connect', () => resolve(s));
  s.once('connect_error', reject);
});
const ask = (s, event, payload) => new Promise(resolve => s.emit(event, payload, resolve));
const wait = ms => new Promise(r => setTimeout(r, ms));
async function close({ server, io }, ...sockets) {
  sockets.forEach(s => s.close());
  io.close();
  await new Promise(r => server.close(r));
}

test('a dropped socket keeps its player through the grace period and can reclaim it', { skip: !ioClient && 'socket.io-client not installed' }, async () => {
  const ctx = await listen({ reconnectGraceMs: 200 });
  const first = await connect(ctx.url);
  assert.equal((await ask(first, 'player:join', join('p1'))).ok, true);
  playerdb.get('p1').augments = ['spoils'];
  first.close();
  await wait(50);
  assert.ok(playerdb.get('p1'), 'still present right after the drop');
  const again = await connect(ctx.url);
  assert.deepEqual(await ask(again, 'newplayer', 'p1'), { known: true });
  await wait(300);
  assert.deepEqual(playerdb.get('p1').augments, ['spoils'], 'reclaimed player survives past the grace period');
  again.close();
  await wait(300);
  assert.equal(playerdb.get('p1'), null, 'removed once the grace period expires');
  await close(ctx);
});

test('a client the server forgot is told to rejoin and keeps its progress', { skip: !ioClient && 'socket.io-client not installed' }, async () => {
  const ctx = await listen({ reconnectGraceMs: 0 });
  const s = await connect(ctx.url);
  assert.deepEqual(await ask(s, 'newplayer', 'ghost'), { known: false });
  const missing = new Promise(resolve => s.once('player:missing', resolve));
  s.emit('player:sync', sync('ghost', false));
  await missing;
  const res = await ask(s, 'player:join', { ...join('ghost'), lv: 4, xp: 200, hp: 70, augments: ['spoils'], rejoin: true });
  assert.equal(res.ok, true);
  assert.deepEqual(playerdb.get('ghost').augments, ['spoils']);
  assert.equal(playerdb.get('ghost').hp, 70);
  assert.ok(res.players.some(p => p._id === 'ghost'), 'visible to everyone again');
  await close(ctx, s);
});

test('over a real socket each tick delivers the shared state and the private record', { skip: !ioClient && 'socket.io-client not installed' }, async () => {
  const ctx = await listen({ reconnectGraceMs: 0 });
  const s = await connect(ctx.url);
  const got = { state: 0, me: [] };
  s.on('arena:state', () => got.state++);
  s.on('arena:me', row => got.me.push(row));
  await ask(s, 'player:join', join('p9'));
  runtime.setIo(ctx.io);
  for (let i = 0; i < 4; i++) {
    if (i === 2) playerdb.get('p9').hp = 60;
    runtime.tick(1000 + i * 50);
    await wait(30);
  }
  runtime.setIo(null);
  assert.ok(got.state >= 2, 'broadcast states arrive');
  assert.deepEqual(got.me.map(r => r.hp), [100, 60], 'record arrives once, then on change');
  await close(ctx, s);
});
