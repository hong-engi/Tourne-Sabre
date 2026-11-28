const playerdb = require('../db/playerdb');
const rules = require('../../../frontend/src/gameRules');

const healTimes = new Map();
const spellTimes = new Map();
const kit = p => ({ skills: p.loadout, spells: p.spells });
const clampCoord = v => Math.max(-2975, Math.min(2975, v));

const wire = v => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);

function playerPublic(p) {
  if (!p) return null;
  return {
    _id: p._id,
    name: p.name,
    x: wire(p.x),
    y: wire(p.y),
    vx: wire(p.vx),
    vy: wire(p.vy),
    r: p.r,
    sw_angle: wire(p.sw_angle),
    sw_r: p.sw_r,
    sw_w: p.sw_w,
    sw_h: p.sw_h,
    sw_speed: p.sw_speed,
    hp: p.hp,
    hpmax: p.hpmax,
    lv: p.lv,
    color: p.color,
  };
}

function playerRecord(p) {
  if (!p) return null;
  return {
    _id: p._id,
    lv: p.lv,
    hp: p.hp,
    hpmax: p.hpmax,
    shield: p.shield,
    shieldUntil: p.shieldUntil,
    reviveUsed: p.reviveUsed,
    invulnerableUntil: p.invulnerableUntil,
    augments: p.augments,
    augmentOffer: p.augmentOffer,
    physicsSeq: p.physicsSeq,
    physicsX: p.physicsX,
    physicsY: p.physicsY,
    physicsVx: p.physicsVx,
    physicsVy: p.physicsVy,
  };
}

function damageSync(id, amount, now = Date.now()) {
  const p = playerdb.get(id);
  if (!p) return undefined;
  const change = rules.resolveDamage(p, Math.max(0, Number(amount) || 0), now);
  const before = {
    hp: p.hp,
    hpmax: p.hpmax,
    shield: p.shieldUntil > now ? p.shield || 0 : 0,
    reviveUsed: !!p.reviveUsed,
  };
  Object.assign(p, change);
  return { before, after: { ...change, hpmax: p.hpmax } };
}

function ensureOfferSync(id) {
  const p = playerdb.get(id);
  if (!p || p.hp <= 0 || p.augmentOffer || (p.augments || []).length >= rules.offerCount(p.lv)) return p;
  const offer = rules.rollOffer(p.augments, Math.random, kit(p), p.tierPity, p.lv || 1);
  if (!offer) return p;
  p.augmentOffer = offer;
  p.tierPity = rules.nextPity(p.tierPity, offer.tier, { level: p.lv || 1 });
  return p;
}

function syncSync(body) {
  if (!body) return null;
  const p = playerdb.get(body.id ?? body._id);
  if (!p || p.hp <= 0) return null;
  const xp = Math.max(0, Number(body.xp) || 0);
  const lv = rules.levelForXp(xp);
  const hpmax = rules.stats(lv, p.augments).hpmax;
  const ack = body.physicsAck || {};
  const dx = (p.physicsX || 0) - (Number(ack.x) || 0);
  const dy = (p.physicsY || 0) - (Number(ack.y) || 0);
  const dvx = (p.physicsVx || 0) - (Number(ack.vx) || 0);
  const dvy = (p.physicsVy || 0) - (Number(ack.vy) || 0);
  const speedX = Number(body.speed?.x) || 0;
  const speedY = Number(body.speed?.y) || 0;

  p.x = clampCoord((Number(body.pos?.x) || 0) + dx);
  p.y = clampCoord((Number(body.pos?.y) || 0) + dy);
  p.r = 25;
  p.vx = speedX + dvx / 30;
  p.vy = speedY + dvy / 30;
  p.intentVx = Number.isFinite(body.impactIntent?.x) ? body.impactIntent.x : speedX * 30;
  p.intentVy = Number.isFinite(body.impactIntent?.y) ? body.impactIntent.y : speedY * 30;
  p.sw_angle = body.sw_angle;
  p.sw_r = body.sw_r;
  p.sw_w = body.sw_w;
  p.sw_h = body.sw_h;
  p.sw_speed = body.sw_speed;
  p.skillState = body.combatState || {};
  // The augment picker pauses only a solo run; with other players alive the
  // room keeps going so nobody can hide in the menu during PvP.
  p.choosingAugment = !!body.augmentMenuOpen && !playerdb.listLiving().some(o => o._id !== p._id);
  p.xp = xp;
  p.lv = lv;
  p.hp = Math.min(hpmax, p.hp + Math.max(0, hpmax - p.hpmax));
  p.hpmax = hpmax;
  return ensureOfferSync(p._id);
}

function chooseSync(id, augment) {
  const p = ensureOfferSync(id);
  if (!p || p.hp <= 0 || !rules.canChoose(p.augments, p.lv, augment, p.augmentOffer)) {
    throw new Error('지금 제시된 증강 중에서 골라 주세요.');
  }
  const prevHpmax = p.hpmax;
  p.augments = [...p.augments, augment];
  const hpmax = rules.stats(p.lv, p.augments).hpmax;
  p.hpmax = hpmax;
  p.augmentOffer = null;
  // Max health can drop (glass cannon); never let a pick kill the player.
  p.hp = Math.max(1, Math.min(hpmax, p.hp + hpmax - prevHpmax));
  return ensureOfferSync(id);
}

function rerollSync(id, index) {
  const p = ensureOfferSync(id);
  if (!p || !p.augmentOffer) throw new Error('다시 뽑을 증강이 없습니다.');
  const offer = rules.rerollOffer(p.augments, p.augmentOffer, Number(index), Math.random, kit(p));
  if (!offer) {
    throw new Error(
      (p.augmentOffer.rerolled || [])[index]
        ? '이 증강은 이미 다시 뽑았습니다.'
        : '바꿔 줄 증강이 남아 있지 않습니다.'
    );
  }
  p.augmentOffer = offer;
  return p;
}

// D/F spells with a server-side effect. The server checks the player brought
// the spell and owns its cooldown; blink and ghost stay on the client.
function castSpellSync(id, spellId, arena, now = Date.now()) {
  const p = playerdb.get(id);
  const spell = rules.SPELLS.find(s => s.id === spellId);
  if (!p || p.hp <= 0 || !spell || !rules.validSpells(p.spells).includes(spellId)) {
    throw new Error('그 주문을 사용할 수 없습니다.');
  }
  const key = `${id}|${spellId}`;
  if (now < (spellTimes.get(key) || 0)) throw new Error(`${spell.name} 주문이 아직 준비되지 않았습니다.`);
  spellTimes.set(key, now + spell.cooldown * 0.9);
  if (spellTimes.size > 2000) {
    for (const [k, until] of spellTimes) if (until < now) spellTimes.delete(k);
  }
  const mod = rules.modifiers(p.augments);
  const healAmount = spell.amount * mod.healScale * (mod.brink && p.hp <= (p.hpmax || 100) * 0.3 ? 1.25 : 1);
  // X-F01: half of the overheal becomes a 3s shield (up to 12% max health).
  if (spellId === 'heal' && mod.own.xF01) {
    const over = Math.max(0, p.hp + Math.round(p.hpmax * healAmount) - p.hpmax);
    const bonus = Math.min(Math.round(over * 0.5), Math.round(p.hpmax * 0.12));
    if (bonus > 0) {
      p.shield = Math.max(p.shieldUntil > now ? p.shield || 0 : 0, bonus);
      p.shieldUntil = Math.max(p.shieldUntil || 0, now + 3000);
    }
  }
  if (spellId === 'heal') {
    p.hp = Math.min(p.hpmax, p.hp + Math.round(p.hpmax * healAmount));
    return p;
  }
  if (spellId === 'barrier') {
    const active = p.shieldUntil > now ? p.shield || 0 : 0;
    p.shield = Math.max(active, Math.round(p.hpmax * spell.amount));
    p.shieldUntil = Math.max(p.shieldUntil || 0, now + spell.duration);
    return p;
  }
  if (arena) arena.castSpell(p, spellId, now);
  return p;
}

function pickupHealSync(id, now = Date.now()) {
  if (!id) return;
  if (now - (healTimes.get(id) || 0) < 400) return;
  const p = playerdb.get(id);
  if (!p || p.hp <= 0 || !rules.modifiers(p.augments).absorb) return;
  healTimes.set(id, now);
  if (healTimes.size > 1000) healTimes.clear();
  p.hp = Math.min(p.hpmax, p.hp + Math.max(1, Math.round(2 * rules.modifiers(p.augments).healScale)));
}

function applyAttackOutcome(id, result, now = Date.now()) {
  const p = playerdb.get(id);
  if (!p || !result) return null;
  if (result.heal && p.hp > 0) {
    p.hp = Math.min(p.hpmax, p.hp + result.heal);
  }
  // Expansion skills: blood costs never kill; shields keep the larger value
  // (60% max health cap), refills add onto the current shield.
  if (result.hpCost && p.hp > 0) {
    p.hp = Math.max(1, p.hp - result.hpCost);
  }
  if ((result.shield || result.shieldAdd) && p.hp > 0) {
    const active = p.shieldUntil > now ? p.shield || 0 : 0;
    const cap = Math.round((p.hpmax || 100) * 0.6);
    p.shield = Math.min(cap, Math.max(active, result.shield || 0) + (result.shieldAdd || 0));
    p.shieldUntil = Math.max(p.shieldUntil || 0, now + (result.shieldMs || (active ? 0 : 2000)));
  }
  if (result.shieldGained) {
    // Spoils stacks up to 80 but never shrinks a bigger shield (barrier).
    const active = p.shieldUntil > now ? p.shield || 0 : 0;
    p.shield = Math.max(active, Math.min(80, active + result.shieldGained));
    p.shieldUntil = Math.max(p.shieldUntil || 0, now + 5000);
  }
  return p;
}

function clearTimers() {
  healTimes.clear();
  spellTimes.clear();
}

// Async wrappers keep existing callers (.then / await) 100% compatible.
async function damage(id, amount, now = Date.now()) { return damageSync(id, amount, now); }
async function sync(body) { return syncSync(body); }
async function ensureOffer(id) { return ensureOfferSync(id); }
async function choose(id, augment) { return chooseSync(id, augment); }
async function reroll(id, index) { return rerollSync(id, index); }
async function castSpell(id, spellId, arena) { return castSpellSync(id, spellId, arena); }
async function pickupHeal(id) { return pickupHealSync(id); }

module.exports = {
  damage,
  damageSync,
  sync,
  syncSync,
  choose,
  chooseSync,
  reroll,
  rerollSync,
  ensureOffer,
  ensureOfferSync,
  castSpell,
  castSpellSync,
  pickupHeal,
  pickupHealSync,
  applyAttackOutcome,
  playerPublic,
  playerRecord,
  clearTimers,
};
