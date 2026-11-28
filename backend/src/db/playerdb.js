const rules = require('../../../frontend/src/gameRules');

// In-memory store for active arena players. Live match state is ephemeral
// (cleared on restart), so keeping it in RAM avoids remote DB round-trips on
// every 50ms AI tick and player sync.
const players = new Map();

function createRecord(player) {
  const id = String(player.id ?? player._id);
  const hpmax = Number(player.hpmax) || 100;
  return {
    _id: id,
    name: player.name || '',
    x: Number(player.pos?.x ?? player.x) || 0,
    y: Number(player.pos?.y ?? player.y) || 0,
    vx: Number(player.speed?.x ?? player.vx) || 0,
    vy: Number(player.speed?.y ?? player.vy) || 0,
    r: Number(player.r) || 25,
    sw_angle: Number(player.sw_angle) || 0,
    sw_r: Number(player.sw_r) || 65,
    sw_w: Number(player.sw_w) || 40,
    sw_h: Number(player.sw_h) || 100,
    sw_speed: Number(player.sw_speed) || 0,
    physicsX: 0,
    physicsY: 0,
    physicsVx: 0,
    physicsVy: 0,
    physicsSeq: 0,
    intentVx: 0,
    intentVy: 0,
    attackMultiplier: Number(player.attackMultiplier) || 1,
    augments: Array.isArray(player.augments) ? [...player.augments] : [],
    augmentOffer: null,
    spells: rules.validSpells(player.spells),
    loadout: rules.validSkills(player.loadout),
    tierPity: { gold: 0, prismatic: 0 },
    shield: 0,
    shieldUntil: 0,
    invulnerableUntil: 0,
    reviveUsed: false,
    choosingAugment: false,
    skillState: {},
    hp: Number.isFinite(Number(player.hp)) ? Number(player.hp) : hpmax,
    hpmax,
    xp: Math.max(0, Number(player.xp) || 0),
    lv: Math.max(1, Number(player.lv) || 1),
    color: player.color || '#FFFFFF',
  };
}

function get(id) {
  if (id == null) return null;
  return players.get(String(id)) || null;
}

function list() {
  return [...players.values()];
}

function listLiving() {
  const out = [];
  for (const p of players.values()) {
    if (p.hp > 0) out.push(p);
  }
  return out;
}

function addSync(player) {
  const record = createRecord(player);
  players.set(record._id, record);
  return record;
}

function removeSync(id) {
  if (id == null) return false;
  return players.delete(String(id));
}

function clear() {
  players.clear();
}

function applyPhysicsCorrection(c) {
  const p = get(c.id);
  if (!p || !(p.hp > 0)) return null;
  p.x += c.dx;
  p.y += c.dy;
  p.vx += c.dvx / 30;
  p.vy += c.dvy / 30;
  p.physicsX += c.dx;
  p.physicsY += c.dy;
  p.physicsVx += c.dvx;
  p.physicsVy += c.dvy;
  p.physicsSeq += 1;
  return p;
}

// Legacy callback wrappers kept for REST routes and existing callers.
function getAll(callback) {
  if (callback) callback(list());
}

function add(player, callback) {
  const record = addSync(player);
  if (callback) callback(record);
}

function removeAll(callback) {
  clear();
  if (callback) callback();
}

function remove(id, callback) {
  removeSync(id);
  if (callback) callback();
}

function getOne(id, callback) {
  if (callback) callback(get(id));
}

function update(player, callback) {
  require('../game/progression')
    .sync(player)
    .then(row => callback && callback(row || null))
    .catch(err => {
      console.error(err.message);
      if (callback) callback(null);
    });
}

function damage(id, dhp, callback) {
  require('../game/progression')
    .damage(id, dhp)
    .then(change => callback && callback(change))
    .catch(err => {
      console.error(err.message);
      if (callback) callback();
    });
}

module.exports = {
  get,
  list,
  listLiving,
  addSync,
  removeSync,
  clear,
  applyPhysicsCorrection,
  getAll,
  add,
  remove,
  removeAll,
  getOne,
  update,
  damage,
};
