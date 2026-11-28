const Player=require('../models/player');
const rules=require('../../../frontend/src/gameRules');
const healTimes=new Map();
const kit=p=>({skills:p.loadout,spells:p.spells});
async function damage(id,amount,now=Date.now()) {
  for (let retry=0;retry<4;retry++) {
    const p=await Player.findById(id).lean(); if (!p) return;
    const change=rules.resolveDamage(p,Math.max(0,Number(amount)||0),now);
    const result=await Player.updateOne({_id:id,hp:p.hp,shield:p.shield || 0,reviveUsed:!!p.reviveUsed},{$set:change});
    // before/after feed the play log (actual HP lost after shield/augments).
    if (result.matchedCount) return {before:{hp:p.hp,hpmax:p.hpmax,shield:p.shieldUntil>now?p.shield||0:0,reviveUsed:!!p.reviveUsed},after:{...change,hpmax:p.hpmax}};
  }
}
async function sync(body) {
  const p=await Player.findById(body.id).lean(); if (!p || p.hp<=0) return;
  const xp=Math.max(0,Number(body.xp)||0), lv=rules.levelForXp(xp);
  const hpmax=rules.stats(lv,p.augments).hpmax;
  const ack=body.physicsAck||{};
  const correction=(field,seen)=>({$subtract:[{$ifNull:[`$${field}`,0]},Number(seen)||0]});
  const coordinate=(value,offset,seen)=>({$max:[-2975,{$min:[2975,{$add:[Number(value)||0,correction(offset,seen)]}]}]});
  // Apply against the current ledger inside MongoDB: a concurrent physics tick
  // cannot be overwritten by an older client position/update response.
  await Player.updateOne({_id:p._id,hp:{$gt:0}},[{$set:{
    x:coordinate(body.pos.x,'physicsX',ack.x),y:coordinate(body.pos.y,'physicsY',ack.y),r:25,
    vx:{$add:[body.speed.x,{$divide:[correction('physicsVx',ack.vx),30]}]},
    vy:{$add:[body.speed.y,{$divide:[correction('physicsVy',ack.vy),30]}]},
    intentVx:body.impactIntent?.x??body.speed.x*30,intentVy:body.impactIntent?.y??body.speed.y*30,
    sw_angle:body.sw_angle,sw_r:body.sw_r,sw_w:body.sw_w,sw_h:body.sw_h,sw_speed:body.sw_speed,
    skillState:body.combatState||{},choosingAugment:!!body.augmentMenuOpen,xp,lv,
    hp:{$min:[hpmax,{$add:['$hp',{$max:[0,{$subtract:[hpmax,'$hpmax']}]}]}]},hpmax,
  }}]);
  return await ensureOffer(p._id);
}
// Offers are rolled on the server so the client cannot pick freely. A new one
// appears whenever a milestone is owed and none is open.
async function ensureOffer(id) {
  const p=await Player.findById(id).lean();
  if (!p || p.hp<=0 || p.augmentOffer || (p.augments||[]).length>=rules.offerCount(p.lv)) return p;
  const offer=rules.rollOffer(p.augments,Math.random,kit(p),p.tierPity,p.lv||1);
  if (!offer) return p;
  return await Player.findOneAndUpdate({_id:id,augmentOffer:null},{$set:{augmentOffer:offer,tierPity:rules.nextPity(p.tierPity,offer.tier,{level:p.lv||1})}},{new:true}).lean() || p;
}
async function choose(id,augment) {
  const p=await ensureOffer(id);
  if (!p || p.hp<=0 || !rules.canChoose(p.augments,p.lv,augment,p.augmentOffer)) throw new Error('지금 제시된 증강 중에서 골라 주세요.');
  const augments=[...p.augments,augment];
  const hpmax=rules.stats(p.lv,augments).hpmax;
  // Max health can drop (glass cannon); never let a pick kill the player.
  const result=await Player.findOneAndUpdate({_id:id,augments:p.augments},[{$set:{augments,hpmax,augmentOffer:null,
    hp:{$max:[1,{$min:[hpmax,{$add:['$hp',hpmax-p.hpmax]}]}]}}}], {new:true}).lean();
  if (!result) throw new Error('선택 상태가 바뀌었습니다. 다시 선택해 주세요.');
  return await ensureOffer(id);
}
async function reroll(id,index) {
  const p=await ensureOffer(id);
  if (!p || !p.augmentOffer) throw new Error('다시 뽑을 증강이 없습니다.');
  const offer=rules.rerollOffer(p.augments,p.augmentOffer,Number(index),Math.random,kit(p));
  if (!offer) throw new Error((p.augmentOffer.rerolled||[])[index]?'이 증강은 이미 다시 뽑았습니다.':'바꿔 줄 증강이 남아 있지 않습니다.');
  const result=await Player.findOneAndUpdate({_id:id,augmentOffer:p.augmentOffer},{$set:{augmentOffer:offer}},{new:true}).lean();
  if (!result) throw new Error('선택 상태가 바뀌었습니다. 다시 시도해 주세요.');
  return result;
}
// D/F spells with a server-side effect. The server checks the player brought
// the spell and owns its cooldown; blink and ghost stay on the client.
const spellTimes=new Map();
async function castSpell(id,spellId,arena) {
  const p=await Player.findById(id).lean();
  const spell=rules.SPELLS.find(s=>s.id===spellId);
  if (!p || p.hp<=0 || !spell || !rules.validSpells(p.spells).includes(spellId)) throw new Error('그 주문을 사용할 수 없습니다.');
  const now=Date.now(),key=`${id}|${spellId}`;
  if (now<(spellTimes.get(key)||0)) throw new Error(`${spell.name} 주문이 아직 준비되지 않았습니다.`);
  spellTimes.set(key,now+spell.cooldown*.9);
  if (spellTimes.size>2000) for (const [k,until] of spellTimes) if (until<now) spellTimes.delete(k);
  const mod=rules.modifiers(p.augments),healAmount=spell.amount*mod.healScale*(mod.brink&&p.hp<=(p.hpmax||100)*.3?1.25:1);
  // X-F01: half of the overheal becomes a 3s shield (up to 12% max health).
  if (spellId==='heal'&&mod.own.xF01) {
    const over=Math.max(0,p.hp+Math.round(p.hpmax*healAmount)-p.hpmax),bonus=Math.min(Math.round(over*.5),Math.round(p.hpmax*.12));
    if (bonus>0) await Player.updateOne({_id:id,hp:{$gt:0}},{$set:{shield:Math.max(p.shieldUntil>now?p.shield||0:0,bonus),shieldUntil:Math.max(p.shieldUntil||0,now+3000)}});
  }
  if (spellId==='heal') return await Player.findOneAndUpdate({_id:id,hp:{$gt:0}},[{$set:{hp:{$min:['$hpmax',{$add:['$hp',{$round:[{$multiply:['$hpmax',healAmount]}]}]}]}}}],{new:true}).lean();
  if (spellId==='barrier') {
    const active={$cond:[{$gt:['$shieldUntil',now]},'$shield',0]};
    return await Player.findOneAndUpdate({_id:id,hp:{$gt:0}},[{$set:{shield:{$max:[active,{$round:[{$multiply:['$hpmax',spell.amount]}]}]},
      shieldUntil:{$max:['$shieldUntil',now+spell.duration]}}}],{new:true}).lean();
  }
  if (arena) arena.castSpell(p,spellId,now);
  return p;
}
async function pickupHeal(id) {
  if (!id) return;
  const now=Date.now();
  if (now-(healTimes.get(id)||0)<400) return;
  const p=await Player.findById(id).lean();
  if (!p || p.hp<=0 || !rules.modifiers(p.augments).absorb) return;
  healTimes.set(id,now);
  if (healTimes.size>1000) healTimes.clear();
  await Player.updateOne({_id:id,hp:{$gt:0}},[{$set:{hp:{$min:['$hpmax',{$add:['$hp',Math.max(1,Math.round(2*rules.modifiers(p.augments).healScale))]}]}}}]);
}
module.exports={damage,sync,choose,reroll,ensureOffer,castSpell,pickupHeal};
