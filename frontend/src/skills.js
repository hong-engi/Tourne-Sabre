// Shared rules use CommonJS for the server; require also avoids CRA 4's
// production named-export check after Babel inserts ES helper imports.
const {modifiers,specFor,SKILLS:SKILL_DEFS,SPELLS,DEFAULT_SKILLS,DEFAULT_SPELLS}=require('./gameRules');
const {castBook,castClassic,recallTurret,bookWeapon,bookBlades}=require('./skillCasts');
// Q W E R hold any four different skills from SKILL_DEFS; D and F hold the
// two spells the player brought. Skill state is keyed by skill id, so an
// augment such as "찌르기 피해" follows the skill to whichever key it sits on.
export const SLOTS = [
  {code:'KeyQ',key:'Q'},{code:'KeyW',key:'W'},{code:'KeyE',key:'E'},{code:'KeyR',key:'R'},
  {code:'KeyD',key:'D',spell:true},{code:'KeyF',key:'F',spell:true},
];
export const SKILL_KEYS = SLOTS.slice(0,4);
export const SPELL_KEYS = SLOTS.slice(4);
const skillDef=id=>SKILL_DEFS.find(s=>s.id===id);
// The default bar, shown before the first status update.
export const SKILLS = DEFAULT_SKILLS.map((id,i)=>({...skillDef(id),...SKILL_KEYS[i],icon:id}));
// Reverse whips the blade through one full turn in the new direction within
// Q_SPIN_MS, then the blade keeps turning that way at its normal speed.
export const Q_SPIN_MS=300;
export const CLONE_MS=2000;
export function createSkills() {
  return {direction:1,facing:{x:0,y:-1},cooldowns:{},until:{},charges:1,reverseToken:0,pursuitUntil:0,thrustAngle:0,castAt:{},
    spellCooldowns:{},spellUntil:{},topCharge:0,bloodlust:[],clones:[],cloneSeq:0,orbAngle:0,bursts:[],events:[],
    wasThrusting:false,wasDashing:false,dash:null,turrets:[],turretSeq:0,boomerang:null,aftershock:null};
}
export function skillFor(player,code) {
  const slot=SKILL_KEYS.findIndex(k=>k.code===code);
  if (slot<0) return null;
  return skillDef((player.loadout||DEFAULT_SKILLS)[slot]) || null;
}
export function spellFor(player,code) {
  const slot=SPELL_KEYS.findIndex(k=>k.code===code);
  if (slot<0) return null;
  return SPELLS.find(s=>s.id===(player.spells||DEFAULT_SPELLS)[slot]) || null;
}
function cooldownOf(player,id) {return skillDef(id).cooldown*modifiers(player.augments).hasteCooldown;}
function durationOf(player,id) {
  const mod=modifiers(player.augments);
  if (id==='reverse') return Q_SPIN_MS;
  if (id==='giant') return mod.giantDuration;
  if (id==='turret') return skillDef(id).duration+(mod.turretTwin?3000:0);
  return skillDef(id).duration;
}
function recharge(player,now) {
  const s=player.skills,max=modifiers(player.augments).thrustCharges,cooldown=cooldownOf(player,'thrust');
  if (s.charges<max && now>=(s.cooldowns.thrust || 0)) {
    const count=1+Math.floor((now-(s.cooldowns.thrust || 0))/cooldown);
    s.charges=Math.min(max,s.charges+count);
    if(s.charges<max)s.cooldowns.thrust+=count*cooldown;
  }
}
function spawnClone(player,at,now) {
  const s=player.skills;
  s.cloneSeq=(s.cloneSeq+1)%1000;
  s.clones.push({id:s.cloneSeq,x:at.x,y:at.y,angle:player.sw_angle,until:now+CLONE_MS});
  if (s.clones.length>3) s.clones.shift();
}
// The blade angle whose blade points along a world direction.
const angleFacing=dir=>Math.atan2(-dir.x,-dir.y);
function castSpell(player,spell,now) {
  const s=player.skills,mod=modifiers(player.augments);
  // Expansion spells run through the shared skill book.
  if (specFor(spell.id)) return castBook(player,spell.id,now);
  if (now<(s.spellCooldowns[spell.id]||0)) return false;
  s.spellCooldowns[spell.id]=now+spell.cooldown;
  s.spellUntil[spell.id]=now+spell.duration+(spell.id==='ghost'&&mod.own.xD02?1200:0);
  castClassic(player,spell.id,now,{x:player.pos.x,y:player.pos.y});
  if (spell.id==='blink') {
    const from={x:player.pos.x,y:player.pos.y};
    player.pos.x+=s.facing.x*spell.distance;player.pos.y+=s.facing.y*spell.distance;
    if (player.bound) player.bound();
    s.lastBlink={from,to:{x:player.pos.x,y:player.pos.y},at:now};
    if (mod.blinkStrike) s.bursts.push({kind:'blinkStrike',x:player.pos.x,y:player.pos.y});
    if (mod.mirror) spawnClone(player,from,now);
  }
  return true;
}
// Returns the skill or spell id that was cast (so the caller can draw it or
// run network work such as the heal), or false when nothing was cast.
export function activate(player,code,now) {
  const s=player.skills;
  if (!s || player.hp<=0 || player.augmentMenuOpen) return false;
  const spell=spellFor(player,code);
  if (spell) return castSpell(player,spell,now)?spell.id:false;
  const skill=skillFor(player,code),mod=modifiers(player.augments);
  if (!skill) return false;
  const id=skill.id,at={x:player.pos.x,y:player.pos.y};
  if (specFor(id)) return castBook(player,id,now)?id:false;
  recharge(player,now);
  // X-R02: pressing the turret key while one stands calls it back.
  if (id==='turret' && now<(s.cooldowns.turret||0)) return recallTurret(player,now)?'turretRecall':false;
  if (id==='thrust') {
    if(!s.charges || now<(s.until.thrust || 0))return false;
    if(s.charges===mod.thrustCharges)s.cooldowns.thrust=now+cooldownOf(player,'thrust');
    s.charges--;
    s.thrustAngle=player.sw_angle;
  } else {
    if(now<(s.cooldowns[id] || 0))return false;
    s.cooldowns[id]=now+cooldownOf(player,id);
  }
  if ((id==='thrust'||id==='dash') && mod.pursuit) s.pursuitUntil=now+1500;
  castClassic(player,id,now,at);
  s.castAt[id]=now;
  s.until[id]=now+durationOf(player,id);
  if (id==='twinBlade') s.frenzyBonus=0;
  if (id==='reverse') {s.direction*=-1;s.reverseToken++;}
  if (id==='dash') s.dash={dir:{...s.facing},dist:skill.distance*mod.momentum,done:0,angle:angleFacing(s.facing)};
  if (id==='turret') {
    s.turretSeq=(s.turretSeq+1)%1000;
    const copy={pos:{...at},r:player.r,hp:player.hp,augments:player.augments,loadout:player.loadout,spells:player.spells,
      sw_angle:player.sw_angle,speed:{x:0,y:0},skills:createSkills(),stationary:true};
    copy.skills.direction=s.direction;
    // Ongoing weapon buffs also apply when a turret is placed mid-cast.
    for (const buff of ['giant','accel','twinBlade','reverse']) {
      copy.skills.until[buff]=s.until[buff];copy.skills.castAt[buff]=s.castAt[buff];
    }
    s.turrets.push({id:s.turretSeq,x:at.x,y:at.y,until:s.until.turret,copy});
    while (s.turrets.length>(mod.turretTwin?2:1)) s.turrets.shift();
  }
  if (id==='boomerang') {
    const dist=Math.min(650,skill.distance*mod.longThrow);
    s.boomerang={start:now,from:at,apex:{x:at.x+s.facing.x*dist,y:at.y+s.facing.y*dist},angle:player.sw_angle};
  }
  if (id==='slam') {
    s.bursts.push({kind:'slam',...at});
    if (mod.aftershock) s.aftershock={at:now+600,...at};
  }
  // A turret is a stationary copy of the skill caster, excluding recursive summons.
  if (id!=='turret') for (const t of s.turrets) {
    if (t.until<=now) continue;
    t.copy.augments=player.augments;t.copy.skills.facing={...s.facing};
    activate(t.copy,code,now);
  }
  return id;
}
export function addKills(player,count,now) {
  const s=player.skills,mod=modifiers(player.augments);
  if (!s || !count) return;
  for (const t of s.turrets) if (t.until>now) addKills(t.copy,count,now);
  // Frenzy: kills while the twin blade is out keep it out longer.
  if (mod.frenzy && now<(s.until.twinBlade||0)) {const add=Math.min(500*count,4000-(s.frenzyBonus||0));if(add>0){s.until.twinBlade+=add;s.frenzyBonus=(s.frenzyBonus||0)+add;}}
  if (!mod.bloodlust) return;
  s.bloodlust=s.bloodlust.filter(t=>t>now);
  for (let i=0;i<count;i++) s.bloodlust.push(now+4000);
  s.bloodlust=s.bloodlust.slice(-5);
}
export function updateWeapon(player,now,dt) {
  const s=player.skills,mod=modifiers(player.augments);
  recharge(player,now);
  const on=id=>now<(s.until[id] || 0);
  const giant=on('giant'),fast=on('accel'),thrust=on('thrust'),whirl=on('reverse'),dashing=on('dash')&&!!s.dash,twin=on('twinBlade');
  const ghost=now<(s.spellUntil.ghost||0),ignite=now<(s.spellUntil.ignite||0);
  const speed=player.speed?Math.hypot(player.speed.x,player.speed.y)*30:0;
  // Top: standing still winds the blade up to triple speed; moving unwinds it.
  s.topCharge=mod.top?Math.max(0,Math.min(1,s.topCharge+(speed<20?dt/2:-dt))):0;
  s.bloodlust=s.bloodlust.filter(t=>t>now);
  const book=bookWeapon(player,now,dt);
  player.skillSpeed=book.speed;player.cleansing=book.cleanse;
  const spinBoost=(1+.8*s.topCharge)*(1+.35*s.bloodlust.length)*book.spin;
  let length=mod.length*book.length;
  if (mod.runner) length*=1+.4*Math.min(1,speed/420);
  if (mod.cyclone && whirl) length*=2.5;
  player.sw_w=(giant?58:40)*mod.width;player.sw_h=(giant?165:100)*length;player.sw_r=65;
  player.attackMultiplier=thrust?2.4*mod.pierce:dashing?1.8*mod.momentumDamage:giant?1.4:1;
  player.sw_speed=(whirl?s.direction*Math.PI*2/(Q_SPIN_MS/1000):Math.PI*(fast?2.6:1)*s.direction*mod.spin*spinBoost)*(player.hazardSlow||1);
  if(thrust){
    const progress=1-(s.until.thrust-now)/skillDef('thrust').duration;
    player.sw_r+=Math.sin(progress*Math.PI)*155*mod.reach;
    player.sw_angle=s.thrustAngle;
  } else if (dashing) {
    // Dash: lunge along the facing direction while the blade sweeps across
    // the front, from one side to the other in the spin direction.
    const t=Math.min(1,1-(s.until.dash-now)/skillDef('dash').duration),travel=s.dash.dist*(1-(1-t)**2);
    if (!player.stationary) {player.pos.x+=s.dash.dir.x*(travel-s.dash.done);player.pos.y+=s.dash.dir.y*(travel-s.dash.done);}
    s.dash.done=travel;
    if (player.bound) player.bound();
    player.sw_angle=s.dash.angle+s.direction*(1.4-2.8*t);
    player.sw_r+=30*Math.sin(t*Math.PI);
  } else player.sw_angle=(player.sw_angle-player.sw_speed*dt)%(Math.PI*2);
  if (!dashing) s.dash=null;
  if (s.wasThrusting && !thrust && mod.mirror) spawnClone(player,player.pos,now);
  if (s.wasDashing && !dashing && mod.mirror) spawnClone(player,player.pos,now);
  s.wasThrusting=thrust;s.wasDashing=dashing;
  if (s.aftershock && now>=s.aftershock.at) {
    s.bursts.push({kind:'aftershock',x:s.aftershock.x,y:s.aftershock.y});
    s.events.push({type:'aftershock',x:s.aftershock.x,y:s.aftershock.y});
    s.aftershock=null;
  }
  player.combatState={giant,fast,thrust,whirl,ghost:ghost||book.phase,ignite,twin,dash:dashing,reverseToken:s.reverseToken};
  // Every blade drawn this frame; the server re-checks each one's hits.
  const blades=[{blade:'main',sw_angle:player.sw_angle,sw_r:player.sw_r,sw_w:player.sw_w,sw_h:player.sw_h,power:1}];
  // Extra swords around the player share the circle evenly with the main one.
  const around=[];
  if (twin) around.push({blade:'twin',sw_r:player.sw_r,sw_w:player.sw_w,sw_h:player.sw_h,power:1});
  if (mod.bladeStorm) for (let i=0;i<2;i++) around.push({blade:`storm-${i}`,sw_r:player.sw_r,sw_w:player.sw_w,sw_h:player.sw_h,power:1});
  if (mod.doubleEdge) around.push({blade:'back',sw_r:40,sw_w:player.sw_w*.8,sw_h:player.sw_h*.6,power:.8});
  around.forEach((b,i)=>blades.push({...b,sw_angle:player.sw_angle+(i+1)*Math.PI*2/(around.length+1)}));
  s.orbAngle=(s.orbAngle+dt*2.4*s.direction)%(Math.PI*2);
  for (let i=0;i<mod.orbs;i++) blades.push({blade:`orb-${i}`,sw_angle:s.orbAngle+i*Math.PI*2/mod.orbs,sw_r:52,sw_w:22,sw_h:22,power:.7});
  // Guardians: two swords on a wide ring, turning against the main sword.
  if (mod.guardians) for (let i=0;i<2;i++) blades.push({blade:`guard-${i}`,sw_angle:-s.orbAngle*.8+i*Math.PI,sw_r:150,sw_w:34,sw_h:80*mod.length,power:.8});
  s.clones=s.clones.filter(c=>c.until>now);
  for (const c of s.clones) {
    c.angle=(c.angle-Math.PI*2*s.direction*dt)%(Math.PI*2);
    blades.push({blade:`clone-${c.id}`,x:c.x,y:c.y,sw_angle:c.angle,sw_r:65,sw_w:40,sw_h:100*mod.length,power:.8});
  }
  s.turrets=s.turrets.filter(t=>t.until>now);
  for (const t of s.turrets) {
    const copy=t.copy;
    copy.augments=player.augments;copy.hp=player.hp;
    copy.skills.bloodlust=[...s.bloodlust];
    updateWeapon(copy,now,dt);
    // Dash reproduces the slash without moving the installed base.
    copy.pos.x=t.x;copy.pos.y=t.y;
    for (const blade of copy.blades) blades.push({...blade,
      blade:blade.blade==='main'?`turret-${t.id}`:`turret-${t.id}/${blade.blade}`,
      x:blade.x??t.x,y:blade.y??t.y,power:blade.power*.8});
    for (const burst of copy.skills.bursts.splice(0)) s.bursts.push({...burst,source:`turret-${t.id}`});
    s.events.push(...copy.skills.events.splice(0));
  }

  // Boomerang: a spinning blade centred on its own position flies out in world
  // space from where it was thrown to a fixed apex, then homes back to wherever
  // the player is now. Moving after the throw does not bend the outbound leg.
  if (s.boomerang) {
    const b=s.boomerang,t=(now-b.start)/skillDef('boomerang').duration;
    if (t>=1) s.boomerang=null;
    else {
      const k=Math.sin(Math.PI*Math.max(0,t)),base=t<.5?b.from:player.pos;
      b.angle=(b.angle-16*s.direction*dt)%(Math.PI*2);
      blades.push({blade:'boomerang',x:base.x+(b.apex.x-base.x)*k,y:base.y+(b.apex.y-base.y)*k,sw_angle:b.angle,
        sw_r:-(player.r||25),sw_w:40*mod.throwSize,sw_h:100*mod.throwSize,power:1.2});
    }
  }
  bookBlades(player,now,dt,blades);
  player.blades=blades;
}
// Same rectangle test the server uses, for client-only checks (harvest).
export function bladeTouches(blade,origin,r,circle) {
  const ox=blade.x??origin.x,oy=blade.y??origin.y;
  const dx=circle.x-ox,dy=circle.y-oy;
  const c=Math.cos(blade.sw_angle),s=Math.sin(blade.sw_angle);
  const x=c*dx-s*dy,y=s*dx+c*dy;
  const nx=Math.max(-blade.sw_w/2,Math.min(blade.sw_w/2,x));
  const center=-r-blade.sw_r;
  const ny=Math.max(center-blade.sw_h/2,Math.min(center+blade.sw_h/2,y));
  return (x-nx)**2+(y-ny)**2<=circle.r**2;
}
export function skillSnapshot(player,now) {
  recharge(player,now);
  const state=player.skills,mod=modifiers(player.augments);
  const skills=SKILL_KEYS.map(slot=>{
    const spec=skillFor(player,slot.code);
    const cooldown=cooldownOf(player,spec.id),duration=durationOf(player,spec.id);
    const activeRemaining=Math.max(0,(state.until[spec.id]||0)-now);
    const rechargeRemaining=Math.max(0,(state.cooldowns[spec.id]||0)-now);
    const remaining=spec.id==='thrust'&&state.charges?0:rechargeRemaining;
    const active=activeRemaining>0;
    return {code:slot.code,key:slot.key,id:spec.id,name:spec.name,icon:spec.id,cooldown,duration,remaining,rechargeRemaining,activeRemaining,active,
      state:active?'active':remaining>0?'cooldown':'ready',
      charges:spec.id==='thrust'&&mod.thrustCharges>1?state.charges:undefined,maxCharges:mod.thrustCharges};
  });
  const spells=SPELL_KEYS.map(slot=>{
    const spell=spellFor(player,slot.code);
    if (!spell) return null;
    const activeRemaining=Math.max(0,(state.spellUntil[spell.id]||0)-now);
    const remaining=Math.max(0,(state.spellCooldowns[spell.id]||0)-now);
    return {code:slot.code,key:slot.key,id:spell.id,name:spell.name,icon:spell.id,spell:spell.id,cooldown:spell.cooldown,duration:spell.duration,
      remaining,rechargeRemaining:remaining,activeRemaining,active:activeRemaining>0,
      state:activeRemaining>0?'active':remaining>0?'cooldown':'ready'};
  }).filter(Boolean);
  return [...skills,...spells];
}
