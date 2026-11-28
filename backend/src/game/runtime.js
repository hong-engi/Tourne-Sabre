const { EnemyArena } = require('./enemies');
const playerdb = require('../db/playerdb');
const progression = require('./progression');
const { playLog } = require('./playLog');
const rules = require('../../../frontend/src/gameRules');

const pvpArena = new EnemyArena(Math.random, { mode: 'pvp' });
const pveArenas = new Map();
let timer = null;
let ioRef = null;

function setIo(io) {
  ioRef = io;
}

function createPveArena(id) {
  const key = String(id);
  const a = new EnemyArena(Math.random, { mode: 'pve' });
  pveArenas.set(key, a);
  return a;
}

function removePveArena(id) {
  if (id == null) return;
  pveArenas.delete(String(id));
}

function arenaFor(id) {
  const p = id != null ? playerdb.get(id) : null;
  if (p && p.mode === 'pve') {
    return pveArenas.get(String(p._id)) || createPveArena(p._id);
  }
  return pvpArena;
}

function initPlayerMode(record, mode, now = Date.now()) {
  if (!record) return null;
  const target = mode === 'pvp' ? 'pvp' : 'pve';
  if (target === 'pvp') {
    removePveArena(record._id);
    record.mode = 'pvp';
    record.choosingAugment = false;
    record.stealthOrigin = { x: record.x, y: record.y };
    record.stealthUntil = now + rules.PVP_STEALTH_MS;
    record.pvpEnteredAt = now;
    record.pveCooldownUntil = now + rules.PVP_EXIT_COOLDOWN_MS;
    record.pveFreeUntil = 0;
  } else {
    record.mode = 'pve';
    record.stealthUntil = 0;
    record.stealthOrigin = null;
    record.pveCooldownUntil = 0;
    record.pveFreeUntil = 0;
    record.bossBuffUntil = 0;
    createPveArena(record._id);
  }
  return record;
}

function switchMode(id, targetMode, now = Date.now()) {
  const p = playerdb.get(id);
  if (!p || p.hp <= 0) throw new Error('플레이어를 찾을 수 없습니다.');
  const target = targetMode === 'pvp' ? 'pvp' : targetMode === 'pve' ? 'pve' : null;
  if (!target) throw new Error('잘못된 모드입니다.');
  if (p.mode === target) return p;

  if (target === 'pvp') {
    removePveArena(p._id);
    p.x = Math.round((Math.random() * 2 - 1) * 1600);
    p.y = Math.round((Math.random() * 2 - 1) * 1600);
    p.vx = 0;
    p.vy = 0;
    p.physicsX = 0;
    p.physicsY = 0;
    p.physicsVx = 0;
    p.physicsVy = 0;
    p.physicsSeq = (p.physicsSeq || 0) + 1;
    initPlayerMode(p, 'pvp', now);
    return p;
  }

  const locked = now < (p.pveCooldownUntil || 0) && now >= (p.pveFreeUntil || 0);
  if (locked) {
    const leftSec = Math.ceil((p.pveCooldownUntil - now) / 1000);
    throw new Error(`PvE 전환 대기 중입니다 (${leftSec}초 남음).`);
  }
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.physicsX = 0;
  p.physicsY = 0;
  p.physicsVx = 0;
  p.physicsVy = 0;
  p.physicsSeq = (p.physicsSeq || 0) + 1;
  initPlayerMode(p, 'pve', now);
  progression.ensureOfferSync(p._id);
  return p;
}

function reset() {
  pveArenas.clear();
  pvpArena.enemies = [];
  pvpArena.projectiles = [];
  pvpArena.hazards = [];
  pvpArena.blasts = [];
  pvpArena.posHistory = [];
  pvpArena.encounters.clear();
  pvpArena.bossKills = [];
  pvpArena.threatLevel = 1;
  pvpArena.seededMilestones = false;
  pvpArena.nextPvpEliteAt = 0;
  pvpArena.nextPvpBossAt = 0;
  pvpArena.startedAt = null;
}

function drainBossKills(targetArena, now) {
  if (!targetArena.bossKills || !targetArena.bossKills.length) return [];
  const killers = targetArena.bossKills.splice(0);
  for (const killerId of killers) {
    progression.applyBossKillReward(killerId, now);
  }
  return killers;
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
  const targetArena = arenaFor(body && body.id);
  const result = targetArena.attack(attacker, now);
  const killers = drainBossKills(targetArena, now);
  const attackerGotBoss = attacker && killers.includes(String(attacker._id));
  if (attacker) {
    playLog.attack(attacker._id, result, now, targetArena.threat(now).level);
    const updated = progression.applyAttackOutcome(attacker._id, result, now);
    if (updated && (attackerGotBoss || result.heal || result.hpCost || result.shield || result.shieldAdd || result.shieldGained)) {
      result.record = progression.playerRecord(updated);
    }
    if (attackerGotBoss) result.bossKill = true;
  }
  return result;
}

function applyArenaStep(targetArena, arenaPlayers, now) {
  const events = targetArena.step(arenaPlayers, now);
  playLog.tick(arenaPlayers, targetArena, now);

  for (const c of targetArena.playerCorrections) {
    playerdb.applyPhysicsCorrection(c);
  }
  targetArena.physicsLedger = new Map(
    arenaPlayers.map(p => [
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

  for (const event of events) {
    const change = progression.damageSync(event.id, event.amount, now);
    if (change) playLog.damage(event.id, { source: event.source, raw: event.amount, ...change });
  }
  drainBossKills(targetArena, now);
}

function filterStateForPlayer(state, me, range = 1600) {
  if (!state || !me) return state;
  const mx = me.x || 0;
  const my = me.y || 0;
  const inRange = (x, y, pad = 0) => Math.abs((x || 0) - mx) <= range + pad && Math.abs((y || 0) - my) <= range + pad;
  return {
    ...state,
    enemies: state.enemies.filter(e => e.tier === 'boss' || inRange(e.x, e.y, e.r || 0)),
    projectiles: state.projectiles.filter(s => inRange(s.x, s.y, 120)),
    hazards: state.hazards.filter(h => inRange(h.x, h.y, h.r || h.length || 0)),
    blasts: state.blasts.filter(b => inRange(b.x, b.y, b.r || 0)),
    skillZones: state.skillZones.filter(z => inRange(z.x, z.y, z.r || z.length || 0)),
    walls: state.walls.filter(w => inRange(w.x, w.y, w.length || 0)),
    decoys: state.decoys.filter(d => inRange(d.x, d.y)),
  };
}

function tick(now = Date.now()) {
  for (const id of pveArenas.keys()) {
    const p = playerdb.get(id);
    if (!p || p.mode !== 'pve' || p.hp <= 0) pveArenas.delete(id);
  }

  const players = playerdb.listLiving();
  const pvpPlayers = players.filter(p => p.mode === 'pvp');
  const pvePlayers = players.filter(p => p.mode !== 'pvp');
  const connected = ioRef ? ioRef.engine.clientsCount : 0;
  // Save idle CPU when all arenas are completely empty and nobody is connected.
  if (!players.length && !pvpArena.enemies.length && !pveArenas.size && !connected) return;

  if (pvpPlayers.length || pvpArena.enemies.length) {
    applyArenaStep(pvpArena, pvpPlayers, now);
  }
  for (const p of pvePlayers) {
    applyArenaStep(arenaFor(p._id), [p], now);
  }

  if (ioRef && connected > 0) {
    let pvpShared = null;
    for (const socket of ioRef.sockets.sockets.values()) {
      const pid = socket.data && socket.data.pid;
      const me = pid && playerdb.get(pid);
      if (!me || me.hp <= 0) continue;
      if (me.mode === 'pve') {
        const pveState = arenaFor(me._id).state(now);
        pveState.mode = 'pve';
        pveState.players = [progression.playerPublic(me, now)];
        (socket.volatile || socket).emit('arena:state', filterStateForPlayer(pveState, me));
      } else {
        if (!pvpShared) {
          pvpShared = pvpArena.state(now);
          pvpShared.mode = 'pvp';
          pvpShared.players = pvpPlayers
            .filter(p => !progression.isStealthed(p, now))
            .map(p => progression.playerPublic(p, now));
        }
        (socket.volatile || socket).emit('arena:state', filterStateForPlayer(pvpShared, me));
      }
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

module.exports = {
  arena: pvpArena,
  pvpArena,
  pveArenas,
  arenaFor,
  createPveArena,
  removePveArena,
  initPlayerMode,
  switchMode,
  reset,
  start,
  stop,
  tick,
  setIo,
  handleAttack,
  filterStateForPlayer,
};
