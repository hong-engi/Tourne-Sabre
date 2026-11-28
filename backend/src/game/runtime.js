const { EnemyArena } = require('./enemies');
const playerdb = require('../db/playerdb');
const progression = require('./progression');
const { playLog } = require('./playLog');

const arena = new EnemyArena();
let timer = null;
let ioRef = null;

function setIo(io) {
  ioRef = io;
}

function handleAttack(body, now = Date.now()) {
  const stored = body && playerdb.get(body.id);
  const attacker = stored ? { ...stored } : null;
  const pos = (body && body.pos) || {};
  if (attacker && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
    attacker.x = pos.x;
    attacker.y = pos.y;
  }
  if (attacker) {
    attacker.poses = body.poses;
    attacker.bursts = body.bursts;
  }
  const result = arena.attack(attacker, now);
  if (attacker) {
    playLog.attack(attacker._id, result, now, arena.threat(now).level);
    const updated = progression.applyAttackOutcome(attacker._id, result, now);
    if (updated && (result.heal || result.hpCost || result.shield || result.shieldAdd || result.shieldGained)) {
      result.record = progression.playerRecord(updated);
    }
  }
  return result;
}

function tick(now = Date.now()) {
  const players = playerdb.listLiving();
  const connected = ioRef ? ioRef.engine.clientsCount : 0;
  // Save idle CPU when the arena is completely empty and nobody is connected.
  if (!players.length && !arena.enemies.length && !connected) return;

  const events = arena.step(players, now);
  playLog.tick(players, arena, now);

  for (const c of arena.playerCorrections) {
    playerdb.applyPhysicsCorrection(c);
  }
  const ledger = new Map(
    players.map(p => [
      String(p._id),
      {
        seq: p.physicsSeq || 0,
        x: p.physicsX || 0,
        y: p.physicsY || 0,
        vx: p.physicsVx || 0,
        vy: p.physicsVy || 0,
      },
    ])
  );
  arena.physicsLedger = ledger;

  for (const event of events) {
    const change = progression.damageSync(event.id, event.amount, now);
    if (change) playLog.damage(event.id, { source: event.source, raw: event.amount, ...change });
  }

  if (ioRef && connected > 0) {
    const shared = arena.state(now);
    shared.players = playerdb.list().map(progression.playerPublic);
    // One broadcast is encoded once for every client. Volatile drops stale
    // snapshots on slow links instead of letting them pile up.
    ioRef.volatile.emit('arena:state', shared);
    // The small private record goes out per socket, reliably (a volatile one
    // would be dropped behind the broadcast) and only when it changed.
    for (const socket of ioRef.sockets.sockets.values()) {
      const pid = socket.data && socket.data.pid;
      const me = pid && playerdb.get(pid);
      if (!me) continue;
      const record = progression.playerRecord(me);
      const key = JSON.stringify(record);
      if (socket.data.lastMe === key) continue;
      socket.data.lastMe = key;
      socket.emit('arena:me', record);
    }
  }
}

function start(io) {
  if (io) ioRef = io;
  if (timer) return;
  timer = setInterval(() => {
    try {
      tick(Date.now());
    } catch (err) {
      console.error('AI update failed:', err.message);
    }
  }, 50);
}

function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = { arena, start, stop, tick, setIo, handleAttack };
