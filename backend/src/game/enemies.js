const {modifiers,stats,chargeDestination,SPELLS,SKILLS,kitOf}=require('../../../frontend/src/gameRules');
const {CollisionWorld}=require('./collisions');
const bestiary=require('./bestiary');
const geometry=require('../../../frontend/src/hazardGeometry');
// A hit makes the player briefly immune to everything (GLOBAL_IFRAMES) and
// immune to that same enemy for longer (SOURCE_IFRAMES), so one monster
// pressed against the player cannot keep chaining hits.
const GLOBAL_IFRAMES=900,SOURCE_IFRAMES=1500;
// A blade resting on an enemy (thrust, slow spin) may strike again after this.
const REHIT_MS=900;
// Keep launch momentum separate from AI steering. Returning to pursuit takes
// roughly half a second after stagger, instead of resuming at full speed.
const PUSH_DRAG=5,MOVE_RECOVERY=4;
// Every THREAT_STEP_MS of a running room raises the threat level by one:
// tougher, harder-hitting, slightly faster enemies that spawn more often.
const THREAT_STEP_MS=40000;
const BOMB_RADIUS=115,BOMB_TRIGGER=40,BOMB_FUSE_MS=900,SPIT_AIM_MS=550,SPIT_EVERY_MS=2300,SPIT_SPEED=260,SPIT_FAST_SPEED=460;
const STALKER_RANGE=520,STALKER_RAMP_RATE=38,STALKER_MAX_EXTRA=400,STALKER_MAX_SPEED=520;
const SPLITTER_HOP_MS=950,SPLITTER_DRAG=1.9,SPLITTER_BURST=3.6;
const MITE_HOP_MS=380,MITE_DRAG=4.2,MITE_BURST=2.2;
const CHARGER_RUN_SECONDS=.9;
const TYPES = {
  spinner:  {r:24,hp:30,speed:62, xp:55,contact:13,unlock:1,mass:1.0},
  charger:  {r:29,hp:45,speed:38, xp:80,contact:13,unlock:1,mass:1.8},
  stalker:  {r:17,hp:20,speed:120,xp:35,contact:9, unlock:1,mass:.65},
  bomber:   {r:20,hp:24,speed:210,xp:45,contact:8, unlock:1,mass:.8},
  spitter:  {r:21,hp:30,speed:72, xp:50,contact:8, unlock:1,mass:.9},
  splitter: {r:30,hp:55,speed:48, xp:40,contact:12,unlock:1,mass:1.8},
  mite:     {r:13,hp:12,speed:185,xp:12,contact:6, unlock:Infinity,mass:.5},
  ...bestiary.SPECS,
};
// Client-triggered area attacks. The server owns radius, damage and cooldown.
const BURSTS = {
  nova:{radius:300,power:7},
  blinkStrike:{radius:140,power:2.5},
  slam:{radius:170,power:2.5,push:1000},
  aftershock:{radius:170,power:1.5,push:600},
};
// The server owns each extra blade's damage share; the client only says
// which blade drew which pose.
const BLADE_POWER={back:.8,orb:.7,clone:.8,twin:1,storm:1,guard:.8,turret:.8,boomerang:1.2};
// Blades that fly or stand apart from the player must say where they are.
const ANCHORED=new Set(['clone','turret','boomerang']);
const BURN_MS=3000,EXHAUST_SLOW=.4,EXHAUST_DAMAGE=.6;
const kitFor=player=>kitOf({skills:player.loadout,spells:player.spells});

// Threat grows without a ceiling: health and damage accelerate slightly
// (quadratic term) so long rooms keep getting harder; speed stays capped so
// telegraphs remain dodgeable.
function threatScale(level) {
  const n=Math.max(0,level-1);
  return {hp:1+.25*n+.012*n*n,power:1+.13*n+.006*n*n,speed:Math.min(1.35,1+.03*n),xp:1+.12*n};
}
// Spawning cadence for a threat level (also used by tests and ENEMIES.md).
function spawnPlan(level,players=1){
  const n=Math.max(0,level-1);
  return {cap:Math.min(48,7+players*3+2*n),interval:Math.max(260,1100-75*n),pack:1+Math.floor(level/3)};
}
// Transform a circle into the sword's local coordinates, then test against
// its actual rectangular envelope. This is also used by client-side players.
function swordHits(p, enemy) {
  const dx = enemy.x - p.x, dy = enemy.y - p.y;
  const c = Math.cos(p.sw_angle), s = Math.sin(p.sw_angle);
  const x = c * dx - s * dy, y = s * dx + c * dy;
  const nx = Math.max(-p.sw_w / 2, Math.min(p.sw_w / 2, x));
  const center = -p.r - p.sw_r;
  const ny = Math.max(center - p.sw_h / 2, Math.min(center + p.sw_h / 2, y));
  return (x - nx) ** 2 + (y - ny) ** 2 <= enemy.r ** 2;
}
// The client records every frame's pose of every blade it draws between
// attack requests. A blade is the main sword, the doubleEdge back blade, an
// orb, or a mirror clone; only blades the player's augments allow are kept.
const POSE_FIELDS=['sw_angle','sw_r','sw_w','sw_h'];
function bladeAllowed(blade,mod,kit=[]) {
  const copy=/^turret-\d+\/(.+)$/.exec(blade);
  if (copy) return kit.includes('turret') && copy[1]!=='main' && !copy[1].startsWith('turret') && bladeAllowed(copy[1],mod,kit);
  if (blade==='main') return true;
  if (blade==='back') return mod.doubleEdge;
  if (/^orb-\d+$/.test(blade)) return Number(blade.slice(4))<mod.orbs;
  if (/^clone-\d+$/.test(blade)) return mod.mirror;
  if (blade==='twin') return kit.includes('twinBlade');
  if (/^storm-[01]$/.test(blade)) return mod.bladeStorm;
  if (/^guard-[01]$/.test(blade)) return mod.guardians;
  if (/^turret-\d+$/.test(blade)) return kit.includes('turret');
  if (blade==='boomerang') return kit.includes('boomerang');
  return false;
}
function bladePoses(player,arena) {
  const mod=modifiers(player.augments),kit=kitFor(player);
  const raw=Array.isArray(player.poses)?player.poses.slice(-400):[];
  const groups=new Map();
  for (const q of raw) {
    if (!q || !POSE_FIELDS.every(k=>Number.isFinite(q[k]))) continue;
    const blade=typeof q.blade==='string'?q.blade:'main';
    // Expansion blades (sk-<kind>-n): the skill engine owns their power.
    if (blade.startsWith('sk-')) {
      const power=arena&&arena.skillBladeAllowed(blade,player,mod);
      if (!power) continue;
      const pose={sw_angle:q.sw_angle,sw_r:q.sw_r,sw_w:Math.min(60,q.sw_w),sw_h:Math.min(120,q.sw_h),power};
      if (Number.isFinite(q.x)&&Number.isFinite(q.y)&&Math.hypot(q.x-player.x,q.y-player.y)<700) {pose.x=q.x;pose.y=q.y;}
      if (!groups.has(blade)) groups.set(blade,[]);
      groups.get(blade).push(pose);
      continue;
    }
    if (!bladeAllowed(blade,mod,kit)) continue;
    const turret=blade.startsWith('turret-'),local=blade.includes('/')?blade.split('/')[1]:blade;
    const kind=local.split('-')[0];
    const pose={sw_angle:q.sw_angle,sw_r:q.sw_r,sw_w:q.sw_w,sw_h:q.sw_h,power:turret?.8*(local.startsWith('turret-')?1:BLADE_POWER[kind]||0):blade==='main'?1:BLADE_POWER[kind]||0};
    const placed=Number.isFinite(q.x)&&Number.isFinite(q.y)&&Math.hypot(q.x-player.x,q.y-player.y)<(turret?(blade.includes('/')?2200:1500):700);
    if (placed) {pose.x=q.x;pose.y=q.y;}
    else if (turret || ANCHORED.has(kind)) continue;
    if (!groups.has(blade)) groups.set(blade,[]);
    groups.get(blade).push(pose);
  }
  if (!groups.has('main')) groups.set('main',[{sw_angle:player.sw_angle,sw_r:player.sw_r,sw_w:player.sw_w,sw_h:player.sw_h,power:1}]);
  // Fill in-between steps so a fast spin or a thrust cannot skip an enemy.
  for (const [blade,poses] of groups) {
    const out=[];
    poses.forEach((q,i)=>{
      const prev=poses[i-1];
      if (prev && prev.x===q.x && prev.y===q.y) {
        const turn=Math.atan2(Math.sin(q.sw_angle-prev.sw_angle),Math.cos(q.sw_angle-prev.sw_angle));
        const steps=Math.min(6,Math.ceil(Math.max(Math.abs(turn)/.1,Math.abs(q.sw_r-prev.sw_r)/15)));
        for (let k=1;k<steps;k++) {const f=k/steps;out.push({...q,sw_angle:prev.sw_angle+turn*f,sw_r:prev.sw_r+(q.sw_r-prev.sw_r)*f});}
      }
      out.push(q);
    });
    groups.set(blade,out);
  }
  return groups;
}

// Debt cuts healing; Brink boosts it while at 30% health or lower.
function healFactor(player,mod) {
  return mod.healScale*(mod.brink && player.hp<=(player.hpmax||100)*.3?1.25:1);
}
// AI bookkeeping the client never reads (timers, internal targets, movement
// parts). It stays on the server so each 20Hz state stays small; telegraphs
// and shot paths are drawn by the client from phase/aim and velocity.
const SERVER_ONLY=new Set(['name','path','leapFromX','leapFromY','phaseUntil','nextAttack','speedScale','nextShot','moveVx','moveVy','pushVx','pushVy',
  'staggerUntil','hopVx','hopVy','nextHop','recoveringMovement','chargeElapsed','chargeFromX','chargeFromY','ramp','shotCount','leapToX','leapToY',
  'leapStart','tpAt','pulseAt','motherId','hatchAt','keepAfterParent','dashX','dashY','spiralR','fullHp','coreContact','trailAt','buildX','buildY',
  'nextSpecial','expireAt','launchPillarId','launchAngle','arriveAt','arriveX','arriveY','callCount','offsetSide','baseSpeedScale','stakeSide',
  'regrowAt','chainTurn','swapPending','orbTurn','brewing','brewDamage','planted','exposedUntil','summonerId','heat','sparkAt','featherAt',
  'gliding','attach','clawing','runEndX','runEndY','running']);
// Two decimals are plenty on screen and halve the size of every float.
const wire=v=>typeof v==='number'&&!Number.isInteger(v)?Math.round(v*100)/100:v;
class EnemyArena {
  constructor(random = Math.random) {
    this.random = random;
    this.enemies = [];
    this.projectiles = [];
    this.blasts = [];
    this.sequence = 0;
    this.lastTime = null;
    this.nextSpawn = 0;
    this.startedAt = null;
    this.lastAttack = new Map();
    this.invulnerableUntil = new Map();
    this.sourceImmunity = new Map();
    this.lastHurt = new Map();
    this.thornsAt = new Map();
    this.rewards = new Map();
    this.attackState = new Map();
    this.playerInfo = new Map();
    this.physics=new CollisionWorld();this.playerCorrections=[];this.skillInit();
    this.hazards=[];this.trails=new Map();this.bleeds=new Map();this.lastPlayers=[];this.encounters=new Set();this.attackSerial=0;
  }
  byId(id){return id?this.enemies.find(e=>e.id===id&&e.hp>0):null;}
  // A telegraphed area attack. Drawn from creation until armAt, then deals
  // damage (once per player, or repeatedly with tick) until `until`.
  addHazard(e,h){
    const hazard={id:`h-${++this.sequence}`,sourceId:e.id,sourceType:e.type,born:this.lastTime??0,hitIds:[],damage:0,...h};
    this.hazards.push(hazard);return hazard;
  }
  hazardCount(sourceId){return this.hazards.filter(h=>h.sourceId===sourceId&&h.damage>0).length;}
  // Drop a source's hazards that have not fired yet (or those matching `which`).
  cancelHazards(sourceId,which){
    const now=this.lastTime??0;
    this.hazards=this.hazards.filter(h=>h.sourceId!==sourceId||(which?!which(h):h.armAt<=now&&!h.marker));
  }
  addShot(e,shot){const s={id:`s-${++this.sequence}`,owner:'enemy',sourceId:e.id,sourceType:e.type,...shot};this.projectiles.push(s);return s;}
  spawnPart(parent,type,at,now){
    const part=this.spawn(null,type,now,at);
    part.parentId=parent.id;part.part=true;part.xp=0;part.power=parent.power;
    return part;
  }
  trailPoint(playerId,at){
    const trail=this.trails.get(playerId);
    if (!trail||!trail.length) return null;
    for (let i=trail.length-1;i>=0;i--) if (trail[i].t<=at) return trail[i];
    return trail[0];
  }
  hazardTouches(h,x,y,r,now){
    if (h.kind==='cone'&&h.sweep&&now>=h.armAt&&h.until>h.armAt) {
      const f=Math.max(0,Math.min(1,(now-h.armAt)/(h.until-h.armAt)));
      const a=h.angle-h.spread/2+h.spread*f;
      return geometry.hazardTouches({...h,angle:a,spread:34*Math.PI/180},x,y,r,0);
    }
    return geometry.hazardTouches(h,x,y,r,h.kind==='ring'?geometry.ringRadius(h,now-h.armAt,h.until-h.armAt):0);
  }
  stepHazards(players,now){
    const damage=[];
    for (const h of this.hazards) {
      if (!(h.damage>0)||now<h.armAt||now>h.until) continue;
      for (const p of players) {
        const id=String(p._id);
        if (!h.tick&&h.hitIds.includes(id)) continue;
        if (!this.hazardTouches(h,p.x,p.y,p.r||25,now)) continue;
        if (h.dot) {this.applyDot(id,`${h.sourceType}:burn`,h.damage,500,1600,now);continue;}
        if (h.poison && h.tick) {
          h.tickAt=h.tickAt||{};
          if (now<(h.tickAt[id]||0)) continue;
          h.tickAt[id]=now+(h.tickMs||250);
          damage.push({id,amount:h.damage,source:`${h.sourceType}:poison`});
          continue;
        }
        if (!this.tryHit(id,h.tick?h.id:h.sourceId,now)) continue;
        h.hitIds.push(id);damage.push({id,amount:h.damage,source:`${h.sourceType}:hazard`});
        if (h.bleed) this.applyBleed(id,Math.max(2,Math.round(h.damage*.3)),now);
        if (h.once) h.until=0;
      }
    }
    this.hazards=this.hazards.filter(h=>now<=h.until);
    return damage;
  }
  applyDot(playerId,source,tickDamage,everyMs,durationMs,now){
    const key=`${playerId}|${source}`,cur=this.bleeds.get(key);
    if (cur) {cur.damage=Math.max(cur.damage,tickDamage);cur.until=Math.max(cur.until,now+durationMs);}
    else this.bleeds.set(key,{id:playerId,source,damage:tickDamage,every:everyMs,nextAt:now+everyMs,until:now+durationMs});
  }
  applyBleed(playerId,tickDamage,now){
    this.applyDot(playerId,'hound:bleed',tickDamage,750,3050,now);
  }
  stepBleeds(players,now){
    const out=[],alive=new Set(players.map(p=>String(p._id)));
    for (const [key,b] of this.bleeds) {
      if (!alive.has(b.id)||now>=b.until) {this.bleeds.delete(key);continue;}
      if (now>=b.nextAt) {b.nextAt+=b.every;out.push({id:b.id,amount:b.damage,source:b.source});}
    }
    return out;
  }
  threat(now) {
    if (this.startedAt===null) return {level:1,elapsed:0};
    const elapsed=Math.max(0,now-this.startedAt);
    return {level:1+Math.floor(elapsed/THREAT_STEP_MS),elapsed};
  }
  spawn(player, type, now=this.lastTime ?? 0, at) {
    const spec = TYPES[type],level=this.threat(now).level,scale=threatScale(level);
    if (!spec) throw new Error(`unknown enemy type ${type}`);
    let spawnX,spawnY;
    if (at) {spawnX=at.x;spawnY=at.y;}
    else {
      const angle = this.random() * Math.PI * 2;
      const distance = 440 + this.random() * 180;
      for(let attempt=0;attempt<24;attempt++){
        const a=angle+attempt*2.399963;
        spawnX=Math.max(-2850,Math.min(2850,player.x+Math.cos(a)*(distance+attempt*2)));
        spawnY=Math.max(-2850,Math.min(2850,player.y+Math.sin(a)*(distance+attempt*2)));
        if(this.enemies.every(e=>Math.hypot(e.x-spawnX,e.y-spawnY)>e.r+spec.r+8))break;
      }
    }
    const hp=Math.round(spec.hp*scale.hp);
    const enemy = {id: `ai-${++this.sequence}`, type, level,
      x:spawnX,y:spawnY,
      vx: 0, vy: 0, r: spec.r, hp, hpmax: hp, xp: Math.round(spec.xp*scale.xp),
      power: scale.power, speedScale: scale.speed, contact: Math.round(spec.contact*scale.power),
      angle: 0, phase: 'hunt', phaseUntil: 0, aimX: 0, aimY: 0, chargeEndX:null,chargeEndY:null,
      nextShot: now + 1200 + this.random()*800};
    if (spec.tier) enemy.tier=spec.tier;
    if (spec.mass) enemy.mass=spec.mass;
    if (spec.passThrough) enemy.passThrough=true;
    if (bestiary.AI[type]) enemy.nextAttack=now+600+this.random()*900;
    this.enemies.push(enemy);
    if (bestiary.AI[type]) bestiary.onSpawn(this,enemy,player,now);
    return enemy;
  }
  // Random spawns draw from normal types unlocked at this threat level.
  pickType(level,exclude=[]) {
    const open=Object.entries(TYPES).filter(([type,spec])=>!spec.tier&&spec.unlock<=level&&!exclude.includes(type)).map(([type])=>type);
    return open[Math.floor(this.random()*open.length)];
  }
  reward(playerId) {
    if (!playerId) return null;
    let r=this.rewards.get(playerId);
    if (!r) {r={hits:[],xp:0,kills:0,thrustKills:0};this.rewards.set(playerId,r);}
    return r;
  }
  // The single place enemies take damage, so every kill (sword, thorns,
  // explosions, reflected shots) splits, explodes and pays XP the same way.
  damageEnemy(e,amount,credit,info={},now=this.lastTime ?? 0) {
    if (!e || e.hp<=0 || amount<=0) return;
    // Centipede segments share the head's health; one blade pass that crosses
    // several segments still lands only once.
    if (TYPES[e.type].sharesHp) {
      const head=this.byId(e.parentId);
      if (!head) return;
      const key=`${this.attackSerial}|${info.flags&&info.flags.blade||'main'}|${credit}`;
      if (head.lastShared===key&&info.sweep) return;
      head.lastShared=key;
      return this.damageEnemy(head,amount,credit,info,now);
    }
    if (bestiary.AI[e.type]) amount=bestiary.onDamage(this,e,amount,info,now);
    if (e.type==='stalker'&&amount>0) e.ramp=0;
    if (e.hp-amount<=0&&bestiary.AI[e.type]&&bestiary.onLethal(this,e,amount-e.hp,now)) {
      const r=this.reward(credit);
      if (r) r.hits.push({id:e.id,x:e.x,y:e.y,nx:info.nx||0,ny:info.ny||0,damage:amount,killed:false,...info.flags});
      return;
    }
    e.hp=Math.max(0,e.hp-amount);
    const r=this.reward(credit);
    if (r) r.hits.push({id:e.id,x:e.x,y:e.y,nx:info.nx||0,ny:info.ny||0,damage:amount,killed:e.hp===0,...info.flags});
    if (e.hp===0) this.onKilled(e,credit,now,info);
  }
  onKilled(e,credit,now,info={}) {
    // Unfired attacks die with their owner; its parts collapse with it.
    this.cancelHazards(e.id, e.type==='bell' ? ()=>true : undefined);
    for (const other of this.enemies) if (other.parentId===e.id&&other.hp>0&&!other.keepAfterParent) {other.hp=0;other.silent=true;}
    if (e.part) {
      const parent=this.byId(e.parentId);
      if (parent) bestiary.onPartKilled(this,parent,e,now);
      return;
    }
    if (e.type==='banner') {
      const flag=this.spawn(null,'bannerFlag',now,{x:e.x,y:e.y});
      flag.part=true;flag.xp=0;flag.expireAt=now+10000;
    }
    const r=this.reward(credit);
    if (r&&e.loot) r.xp+=e.loot;
    if (r) {r.xp+=e.xp;r.kills++;if (info.thrust) r.thrustKills++;}
    const killer=credit&&this.playerInfo.get(credit),mod=killer?modifiers(killer.augments):null;
    if (e.type==='bomber') this.explode(e,now,{hurtPlayers:false,credit});
    this.onSkillKill(e,credit,killer,mod,now,info.flags);
    if (mod && mod.wildfire && e.burnUntil>now) for (const other of this.enemies)
      if (other!==e && other.hp>0 && !(other.burnUntil>now) && Math.hypot(other.x-e.x,other.y-e.y)<140) this.burn(other,e.burnBy,e.burnDamage,now);
    if (e.type==='splitter') {
      const count=3+(this.random()<.5?1:0),baseA=this.random()*Math.PI*2;
      for (let i=0;i<count;i++) {
        const a=baseA+i*Math.PI*2/count,cx=Math.cos(a),sy=Math.sin(a);
        const mite=this.spawn(null,'mite',now,{x:e.x+cx*18,y:e.y+sy*18});
        mite.phase='dash';mite.phaseUntil=now+240;mite.aimX=cx;mite.aimY=sy;
      }
    }
    // Augment blasts never start a fresh blast, except chainReaction's one
    // half-strength second generation.
    const flags=info.flags||{},generated=!!(flags.aug||flags.lightning);
    if (mod && mod.chainReaction && (!generated || flags.aug==='chain1')) {
      const second=flags.aug==='chain1';
      const amount=Math.round(stats(killer.lv||1,killer.augments).damage*mod.damageScale*(second?.9:1.8));
      if (r) r.hits.push({id:`${e.id}-chain`,x:e.x,y:e.y,damage:0,burst:'corpse'});
      for (const other of [...this.enemies]) if (other!==e && other.hp>0 && Math.hypot(other.x-e.x,other.y-e.y)<130+other.r) this.damageEnemy(other,amount,credit,{flags:{shock:true,aug:second?'chain2':'chain1'}},now);
    }
    if (mod && mod.corpseBomb>0 && !generated) {
      const cap=stats(killer.lv||1,killer.augments).damage*mod.damageScale*3;
      const amount=Math.round(Math.min(e.hpmax*mod.corpseBomb,cap));
      if (r) r.hits.push({id:e.id,x:e.x,y:e.y,damage:0,burst:'corpse'});
      for (const other of this.enemies) if (other!==e && other.hp>0 && Math.hypot(other.x-e.x,other.y-e.y)<120) this.damageEnemy(other,amount,credit,{flags:{shock:true,aug:'corpse'}},now);
    }
  }
  explode(e,now,{hurtPlayers,credit,players=[]}) {
    e.hp=0;e.phase='exploded';
    const r=this.reward(credit);
    if (r) r.hits.push({id:e.id,x:e.x,y:e.y,damage:0,burst:'bomb'});
    this.blasts.push({id:`b-${++this.sequence}`,x:e.x,y:e.y,r:BOMB_RADIUS,at:now});
    for (const other of this.enemies) if (other!==e && other.hp>0 && Math.hypot(other.x-e.x,other.y-e.y)<BOMB_RADIUS+other.r) this.damageEnemy(other,Math.round(30*e.power),credit,{flags:{shock:true}},now);
    if (!hurtPlayers) return [];
    const damage=[];
    for (const p of players) {
      const id=String(p._id);
      if (Math.hypot(p.x-e.x,p.y-e.y)<BOMB_RADIUS+(p.r||25) && this.tryHit(id,e.id,now)) damage.push({id,amount:this.outgoing(e,26*e.power,now),source:'bomber:blast'});
    }
    return damage;
  }
  // Exhausted enemies hit softer.
  outgoing(e,amount,now) {return Math.round(amount*(now<(e.exhaustUntil||0)?EXHAUST_DAMAGE:1));}
  burn(e,by,damage,now) {
    if (!(e.burnUntil>now)) e.burnTick=now+1000;
    e.burnUntil=now+BURN_MS;e.burnBy=by;e.burnDamage=Math.max(1,damage);
  }
  combatState(id,lv=1) {
    let state=this.attackState.get(id);
    if (!state) {state={token:0,charges:0,quakeAt:0,lightningAt:0,lastHitAt:-Infinity,accent:new Map(),stormHits:0,stormAt:0,regenAt:0,riposteHurt:null,riposteAt:0,vampWindow:0,vampHealed:0,touching:new Map(),novaLevel:lv,burstAt:{},igniteUntil:0,aftershockUntil:0};this.attackState.set(id,state);}
    return state;
  }
  // Server half of the D/F spells (heal and barrier live in progression).
  castSpell(player,spellId,now) {
    const id=String(player._id),spell=SPELLS.find(s=>s.id===spellId);
    if (!spell) return;
    if (spellId==='ignite') this.combatState(id,player.lv).igniteUntil=now+spell.duration;
    if (spellId==='exhaust') for (const e of this.enemies)
      if (e.hp>0 && Math.hypot(e.x-player.x,e.y-player.y)<spell.radius+e.r) e.exhaustUntil=now+spell.duration;
    if (spellId==='smite') {
      const target=this.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-player.x,e.y-player.y)<spell.radius+e.r)
        .sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
      if (target) {
        this.playerInfo.set(id,{augments:player.augments||[],lv:player.lv||1});
        const low=modifiers(player.augments).own.xD03&&target.hp<=target.hpmax*.4?1.4:1;
        this.damageEnemy(target,Math.round((50+10*(player.lv||1))*low),id,{flags:{smite:true}},now);
        this.enemies=this.enemies.filter(e=>e.hp>0);
      }
    }
  }
  chronoSlow(x,y,players) {
    for (const p of players) {
      if (!modifiers(p.augments).chrono || p.hp>(p.hpmax||100)*.35) continue;
      if (Math.hypot(p.x-x,p.y-y)<380) return .4;
    }
    return 1;
  }
  step(players, now) {
    this.playerCorrections=[];
    this.blasts=this.blasts.filter(b=>now-b.at<700);
    const living=players.filter(p=>p.hp>0);
    living.forEach(p=>this.playerInfo.set(String(p._id),{augments:p.augments||[],lv:p.lv||1}));
    players = living.filter(p => !p.choosingAugment);
    const dt = this.lastTime === null ? .1 : Math.min(.15, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const alive = new Set(players.map(p => String(p._id)));
    for (const id of this.lastAttack.keys()) if (!alive.has(id)) {this.lastAttack.delete(id);this.attackState.delete(id);}
    for (const id of this.invulnerableUntil.keys()) if (!alive.has(id)) this.invulnerableUntil.delete(id);
    for (const id of this.rewards.keys()) if (!living.some(p=>String(p._id)===id)) this.rewards.delete(id);
    for (const id of this.playerInfo.keys()) if (!living.some(p=>String(p._id)===id)) this.playerInfo.delete(id);
    for (const [key,until] of this.sourceImmunity) if (until<=now || !alive.has(key.split('|')[0])) this.sourceImmunity.delete(key);
    if (!living.length) {this.enemies = [];this.projectiles=[];this.blasts=[];this.hazards=[];this.zones=[];this.walls=[];this.decoys=[];this.trails.clear();this.bleeds.clear();this.encounters.clear(); this.nextSpawn = now; this.startedAt=null; this.attackState.clear();this.physics.clear(); return [];}
    this.lastPlayers=living;
    if (!players.length) {
      // Everyone is choosing an augment: freeze the room, including its clock.
      const shift=dt*1000;
      this.enemies.forEach(e=>{for (const k of ['nextShot','nextHop',...bestiary.TIME_FIELDS]) if (e[k]) e[k]+=shift;e.vx=0;e.vy=0;e.angularVelocity=0;});
      this.projectiles.forEach(s=>{s.until+=shift;if (s.returnAt) s.returnAt+=shift;if (s.landAt) s.landAt+=shift;if (s.pauseAt) s.pauseAt+=shift;if (s.launchAt) s.launchAt+=shift;});
      this.hazards.forEach(h=>{h.armAt+=shift;h.until+=shift;h.born+=shift;});
      this.nextSpawn+=dt*1000;if(this.startedAt!==null)this.startedAt+=dt*1000;
      return this.resolveContacts(living,now);
    }
    if (this.startedAt===null) this.startedAt=now;
    const {level}=this.threat(now);
    const plan=spawnPlan(level,players.length);
    // Elites and bosses arrive once per threat milestone. While a boss is up,
    // regular spawns thin out so its patterns stay readable.
    const encounter=bestiary.encounterFor(level);
    if (encounter&&!this.encounters.has(level)) {
      this.encounters.add(level);
      const player=players[Math.floor(this.random()*players.length)];
      const a=this.random()*Math.PI*2,d=encounter.tier==='boss'?520:460;
      this.spawn(player,encounter.type,now,{x:Math.max(-2800,Math.min(2800,player.x+Math.cos(a)*d)),y:Math.max(-2800,Math.min(2800,player.y+Math.sin(a)*d))});
    }
    const bossUp=this.enemies.some(e=>e.tier==='boss'&&e.hp>0);
    const regular=this.enemies.filter(e=>!e.part).length,cap=bossUp?Math.ceil(plan.cap*.45):plan.cap;
    if (regular < cap && now >= this.nextSpawn) {
      const player = players[Math.floor(this.random() * players.length)];
      if (!this.enemies.length) ['spinner','charger','stalker','spitter','bomber'].forEach(type => this.spawn(player, type, now));
      else {
        // Packs grow with the threat level; stalkers always arrive in packs (3-5, occasionally 10).
        const pack=Math.min(cap-regular,plan.pack+(this.random()<.35?1:0));
        for (let i=0;i<pack;i++) {
          const picked=this.pickType(level);
          if (picked==='stalker') {
            const swarm=this.random()<.12?10:3+Math.floor(this.random()*3);
            const limit=Math.min(swarm,Math.max(3,cap-this.enemies.filter(e=>!e.part).length+(swarm===10?6:0)));
            const lead=this.spawn(player,'stalker',now);
            for (let k=1;k<limit;k++) {
              const a=k*2.399963,d=28+k*7;
              this.spawn(player,'stalker',now,{x:Math.max(-2850,Math.min(2850,lead.x+Math.cos(a)*d)),y:Math.max(-2850,Math.min(2850,lead.y+Math.sin(a)*d))});
            }
          } else this.spawn(player, picked, now);
        }
      }
      this.nextSpawn = now + plan.interval*(bossUp?2.5:1);
    }
    // Hounds follow where each player was about a second ago.
    for (const p of players) {
      const id=String(p._id),trail=this.trails.get(id)||[];
      trail.push({x:p.x,y:p.y,t:now});
      while (trail.length&&now-trail[0].t>2500) trail.shift();
      this.trails.set(id,trail);
    }
    const hasted=new Set();
    for (const b of this.enemies) if ((b.type==='banner'||b.type==='bannerFlag')&&b.hp>0)
      for (const o of this.enemies) if (o!==b&&!o.part&&o.hp>0&&Math.hypot(o.x-b.x,o.y-b.y)<220) hasted.add(o.id);
    const damage=[];
    this.enemies.forEach(e => {
      if (e.hp<=0) return;
      // A committed attack keeps its target until it resolves.
      const locked=e.phase!=='hunt'&&e.targetId&&players.find(q=>String(q._id)===e.targetId);
      const p = locked || this.decoyFor(e,now) || players.reduce((best, p) => Math.hypot(p.x - e.x, p.y - e.y) < Math.hypot(best.x - e.x, best.y - e.y) ? p : best);
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist, ny = dy / dist;
      const slow=this.chronoSlow(e.x,e.y,players)*(now<(e.exhaustUntil||0)?EXHAUST_SLOW:1)*this.skillSpeedFactor(e,now),speedScale=(e.speedScale||1)*slow*(hasted.has(e.id)?1.3:1),base=TYPES[e.type].speed*speedScale;
      e.hasted=hasted.has(e.id);
      if (e.hasted) {
        const bonus=dt*300;
        if (e.nextAttack>now) e.nextAttack=Math.max(now,e.nextAttack-bonus);
        if (e.nextShot>now) e.nextShot=Math.max(now,e.nextShot-bonus);
        if (e.phase==='recover'&&e.phaseUntil>now) e.phaseUntil=Math.max(now,e.phaseUntil-bonus);
      }
      if (e.type!=='swordsaint') {e.angularVelocity=2.7*slow;e.angle += dt * 2.7*slow;}
      const spec=TYPES[e.type],ctx={p,dx,dy,dist,nx,ny,base,now,dt,players,slow};
      if (dist > 1400 && !e.part && !spec.fixed && !e.tier) {
        const a = this.random() * Math.PI * 2;
        e.x = Math.max(-2850, Math.min(2850, p.x + Math.cos(a) * 600));
        e.y = Math.max(-2850, Math.min(2850, p.y + Math.sin(a) * 600));
        e.vx = 0; e.vy = 0; e.phase = 'hunt'; return;
      }
      if (spec.fixed) {
        e.vx=0;e.vy=0;
        if (bestiary.AI[e.type]) bestiary.AI[e.type](this,e,ctx);
        return;
      } else if (bestiary.AI[e.type]) {
        bestiary.AI[e.type](this,e,ctx);
        if (e.hp<=0) return;
      } else if (e.parentId&&!TYPES[e.type].unlock) {
        e.vx=0;e.vy=0;
      } else if (e.type === 'charger') {
        if (e.phase === 'windup' && now >= e.phaseUntil) {
          e.phase = 'charge'; e.phaseUntil = now + CHARGER_RUN_SECONDS*1000;
          e.chargeElapsed=0;e.chargeFromX=e.x;e.chargeFromY=e.y;
        }
        else if (e.phase === 'recover' && now >= e.phaseUntil) e.phase = 'hunt';
        if (e.phase === 'hunt' && dist < 430) {
          e.phase = 'windup'; e.phaseUntil = now + 850; e.aimX = nx; e.aimY = ny;
        }
        if(e.phase==='windup'){
          const end=chargeDestination(e.x,e.y,e.aimX,e.aimY);e.chargeEndX=end.x;e.chargeEndY=end.y;
        }
        if(e.phase==='charge'){
          const distance=Math.hypot(e.chargeEndX-e.x,e.chargeEndY-e.y);
          if(distance>0){e.aimX=(e.chargeEndX-e.x)/distance;e.aimY=(e.chargeEndY-e.y)/distance;}
        }
        const speed = e.phase === 'charge' ? Math.hypot(e.vx,e.vy) : e.phase === 'hunt' ? base : 0;
        e.vx = (e.phase === 'charge' ? e.aimX : nx) * speed;
        e.vy = (e.phase === 'charge' ? e.aimY : ny) * speed;
      } else if (e.type === 'stalker') {
        if (dist < STALKER_RANGE) e.ramp = Math.min(STALKER_MAX_EXTRA, (e.ramp || 0) + dt * STALKER_RAMP_RATE);
        else e.ramp = Math.max(0, (e.ramp || 0) - dt * 120);
        const speed = Math.min(STALKER_MAX_SPEED, (TYPES.stalker.speed + (e.ramp || 0)) * speedScale);
        const flank = Math.sin(now / 520 + Number(e.id.slice(3))) * .65;
        const norm = Math.hypot(1, flank);
        e.vx = (nx - ny * flank) / norm * speed;
        e.vy = (ny + nx * flank) / norm * speed;
      } else if (e.type === 'bomber') {
        if (e.phase === 'fuse' && now >= e.phaseUntil) {damage.push(...this.explode(e,now,{hurtPlayers:true,players}));return;}
        if (e.phase === 'hunt' && dist < BOMB_TRIGGER+e.r) {e.phase='fuse';e.phaseUntil=now+BOMB_FUSE_MS;}
        const speed=e.phase==='fuse'?0:base;
        e.vx=nx*speed;e.vy=ny*speed;
      } else if (e.type === 'spitter') {
        // Always track the player's angle, including while aiming.
        e.aimX=nx;e.aimY=ny;
        const charged=(e.shotCount||0)%3===2;
        e.charged=charged;
        if (e.phase === 'aim' && now >= e.phaseUntil) {
          const speed=charged?SPIT_FAST_SPEED:SPIT_SPEED;
          this.projectiles.push({id:`s-${++this.sequence}`,owner:'enemy',sourceId:e.id,x:e.x+e.aimX*(e.r+6),y:e.y+e.aimY*(e.r+6),
            vx:e.aimX*speed,vy:e.aimY*speed,r:9,kind:charged?'spitRed':undefined,sourceType:'spitter:shot',damage:this.outgoing(e,(charged?24:14)*e.power,now),until:now+2600});
          e.shotCount=(e.shotCount||0)+1;
          e.charged=e.shotCount%3===2;
          e.phase='hunt';e.nextShot=now+SPIT_EVERY_MS;
        }
        if (e.phase === 'hunt' && now >= e.nextShot && dist < 560) {e.phase='aim';e.phaseUntil=now+SPIT_AIM_MS;}
        // Hold a firing distance and circle, steering smoothly: the wanted
        // velocity changes continuously and the actual one eases toward it,
        // so the spitter never snaps between backing off, stopping and closing in.
        let tx=0,ty=0;
        if (e.phase !== 'aim') {
          const radial=Math.max(-1,Math.min(1,(dist-300)/90)),strafe=Math.sin(now/1600+Number(e.id.slice(3)))*.8;
          tx=(nx*radial-ny*strafe)*base;ty=(ny*radial+nx*strafe)*base;
        }
        const ease=Math.min(1,dt*(e.phase==='aim'?8:4));
        e.moveVx=(e.moveVx||0)+(tx-(e.moveVx||0))*ease;e.moveVy=(e.moveVy||0)+(ty-(e.moveVy||0))*ease;
        e.vx=e.moveVx;e.vy=e.moveVy;
      } else if (e.type === 'splitter') {
        if (e.recoveringMovement) {
          e.hopVx=0;e.hopVy=0;e.nextHop=0;
          e.vx = nx * base; e.vy = ny * base;
        } else {
          if (!e.nextHop || now >= e.nextHop) {
            e.hopVx = nx * base * SPLITTER_BURST; e.hopVy = ny * base * SPLITTER_BURST;
            e.nextHop = now + SPLITTER_HOP_MS;
          } else {
            const hopDecay = Math.exp(-SPLITTER_DRAG * dt);
            e.hopVx = (e.hopVx || 0) * hopDecay; e.hopVy = (e.hopVy || 0) * hopDecay;
          }
          e.vx = e.hopVx; e.vy = e.hopVy;
        }
      } else if (e.type === 'mite') {
        if (e.phase === 'dash' && now < e.phaseUntil) {
          e.vx = e.aimX * 420 * slow; e.vy = e.aimY * 420 * slow;
        } else {
          if (e.phase === 'dash') {e.phase = 'hunt';e.nextHop = 0;}
          if (e.recoveringMovement) {
            e.hopVx=0;e.hopVy=0;e.nextHop=0;
            e.vx = nx * base; e.vy = ny * base;
          } else {
            if (!e.nextHop || now >= e.nextHop) {
              e.hopVx = nx * base * MITE_BURST; e.hopVy = ny * base * MITE_BURST;
              e.nextHop = now + MITE_HOP_MS;
            } else {
              const hopDecay = Math.exp(-MITE_DRAG * dt);
              e.hopVx = (e.hopVx || 0) * hopDecay; e.hopVy = (e.hopVy || 0) * hopDecay;
            }
            e.vx = e.hopVx; e.vy = e.hopVy;
          }
        }
      } else if (e.type === 'spinner') {
        // Aim the blade's next sweep at the player, rather than retreating
        // before the shorter sword can reach. Match its world-space geometry.
        const ahead=e.angle+.25*e.angularVelocity;
        const reach=e.r+42,tx=p.x+Math.sin(ahead)*reach,ty=p.y+Math.cos(ahead)*reach;
        const ex=tx-e.x,ey=ty-e.y,d=Math.hypot(ex,ey)||1;
        const speed=base*Math.min(1,d/30),ease=1-Math.exp(-5*dt);
        e.moveVx=(e.moveVx||0)+(ex/d*speed-(e.moveVx||0))*ease;
        e.moveVy=(e.moveVy||0)+(ey/d*speed-(e.moveVy||0))*ease;
        e.vx=e.moveVx;e.vy=e.moveVy;
      } else {
        const radial = dist < 150 ? -.4 : 1;
        e.vx = (nx * radial - ny * .55) * base;
        e.vy = (ny * radial + nx * .55) * base;
      }
      const staggered=now<(e.staggerUntil||0);
      if(staggered){
        e.moveVx=0;e.moveVy=0;e.hopVx=0;e.hopVy=0;e.nextHop=0;e.vx=0;e.vy=0;e.recoveringMovement=true;
        // A launched charger must follow the impulse too, rather than its
        // fixed charge endpoint overriding the knockback displacement.
        if(e.type==='charger'&&e.phase==='charge'){
          e.phase='recover';e.phaseUntil=Math.max(now+300,e.staggerUntil);
        }
      }else if(e.recoveringMovement){
        // Spitters already steer through moveVx/moveVy above.
        if(e.type!=='spitter'){
          const ease=1-Math.exp(-MOVE_RECOVERY*dt);
          e.moveVx+=(e.vx-e.moveVx)*ease;e.moveVy+=(e.vy-e.moveVy)*ease;
          if(Math.hypot(e.vx,e.vy)>0&&Math.hypot(e.vx-e.moveVx,e.vy-e.moveVy)<.5)e.recoveringMovement=false;
          e.vx=e.moveVx;e.vy=e.moveVy;
        }else e.recoveringMovement=false;
      }
      const pushX=e.pushVx||0,pushY=e.pushVy||0,decay=Math.exp(-PUSH_DRAG*dt);
      e.pushVx=pushX*decay;e.pushVy=pushY*decay;
      // Integrate the decaying impulse over the whole tick; keep the velocity
      // at the tick's end in snapshots for client interpolation/extrapolation.
      const pushStep=(1-decay)/PUSH_DRAG;
      if(e.type==='charger'&&e.phase==='charge'){
        if(e.chargeElapsed==null){e.chargeElapsed=0;e.chargeFromX=e.x;e.chargeFromY=e.y;}
        e.chargeElapsed+=dt*slow;
        const u=Math.min(1,e.chargeElapsed/CHARGER_RUN_SECONDS),progress=u*u*(3-2*u);
        const dx=e.chargeEndX-e.chargeFromX,dy=e.chargeEndY-e.chargeFromY;
        // Smooth acceleration and braking preserve the advertised endpoint.
        e.x=e.chargeFromX+dx*progress;e.y=e.chargeFromY+dy*progress;
        const rate=6*u*(1-u)/CHARGER_RUN_SECONDS*slow;
        e.vx=dx*rate;e.vy=dy*rate;
        if(u>=1){e.x=e.chargeEndX;e.y=e.chargeEndY;e.phase='recover';e.phaseUntil=now+1100;e.vx=0;e.vy=0;}
      }else{
        e.x = Math.max(-2950, Math.min(2950, e.x + e.vx * dt + pushX*pushStep));
        e.y = Math.max(-2950, Math.min(2950, e.y + e.vy * dt + pushY*pushStep));
        e.vx+=e.pushVx;e.vy+=e.pushVy;
      }
      players.forEach(target=>{
        const pull=modifiers(target.augments);
        const distance=Math.hypot(target.x-e.x,target.y-e.y);
        if (pull.tempest && target.skillState?.fast && distance>30 && distance<260) {e.x+=(target.x-e.x)/distance*85*dt;e.y+=(target.y-e.y)/distance*85*dt;}
        // Gravity: a constant pull toward the player.
        if (pull.gravity && distance>target.r+e.r+10 && distance<320) {e.x+=(target.x-e.x)/distance*75*dt;e.y+=(target.y-e.y)/distance*75*dt;}
      });
    });
    for (const e of this.enemies) if (e.hp>0&&e.parentId) bestiary.followParent(this,e,now);
    for (const e of this.enemies) if (e.hp>0) bestiary.recordPath(e);
    damage.push(...this.stepProjectiles(players,now,dt));
    damage.push(...this.stepHazards(players,now));
    damage.push(...this.stepBleeds(players,now));
    this.stepSkills(players,now,dt);
    // Storm lord: every 2s, bolts on the three nearest enemies.
    for (const p of players) {
      const mod=modifiers(p.augments);
      if (!mod.stormLord) continue;
      const id=String(p._id),state=this.combatState(id,p.lv||1);
      if (now<(state.stormAt||0)) continue;
      state.stormAt=now+2000;
      const base=stats(p.lv||1,p.augments).damage*mod.damageScale;
      this.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<380+e.r)
        .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).slice(0,3)
        .forEach(e=>this.damageEnemy(e,Math.round(base*1.5),id,{flags:{lightning:true,fromX:p.x,fromY:p.y}},now));
    }
    for (const e of this.enemies) {
      if (e.hp<=0 || !(e.burnUntil>now) || now<e.burnTick) continue;
      e.burnTick+=1000;
      this.damageEnemy(e,e.burnDamage,e.burnBy,{flags:{burn:true}},now);
    }
    this.enemies=this.enemies.filter(e=>e.hp>0);
    damage.push(...this.resolveContacts(living,now));
    // Body collision damage is handled once by the solid-body solver. Only
    // the spinner's separate weapon can produce an additional contact here.
    this.enemies.forEach(e=>players.forEach(target=>{
      const id=String(target._id);
      if(e.type==='spinner'&&swordHits({x:e.x,y:e.y,r:e.r,sw_angle:e.angle,sw_r:42,sw_w:22,sw_h:70},{x:target.x,y:target.y,r:target.r})&&this.tryHit(id,e.id,now)){
        damage.push({id,amount:this.outgoing(e,e.contact,now),source:'spinner:blade'});
      }
      if(e.sword&&swordHits({x:e.x,y:e.y,r:e.r,sw_angle:e.angle,...e.sword},{x:target.x,y:target.y,r:target.r})&&this.tryHit(id,e.id,now)){
        damage.push({id,amount:this.outgoing(e,22*(e.power||1),now),source:`${e.type}:blade`});
      }
    }));
    return this.shapeIncoming(players,damage,now);
  }
  stepProjectiles(players,now,dt) {
    const damage=[];
    for (const s of this.projectiles) {
      const slow=s.owner==='enemy'?this.chronoSlow(s.x,s.y,players):1;
      // Ease through zero velocity when the boomerang starts its return.
      if(s.kind==='sickle'&&s.returnAt&&now>=s.returnAt){
        s.returnStart=s.returnAt;s.returnAt=0;s.outVx=s.vx;s.outVy=s.vy;
      }
      if(s.returnStart!=null){
        const t=Math.min(1,Math.max(0,(now-s.returnStart)/400)),k=t*t*(3-2*t);
        const factor=1-(1+(s.returnSpeed||1))*k;
        s.vx=s.outVx*factor;s.vy=s.outVy*factor;
        if(factor<0&&!s.returning){s.returning=true;s.hitIds=[];}
      }
      s.x+=s.vx*dt*slow;s.y+=s.vy*dt*slow;
      if (s.returnAt&&now>=s.returnAt) {const mult=s.returnSpeed||1;s.returnAt=0;s.vx=-s.vx*mult;s.vy=-s.vy*mult;s.hitIds=[];}
      // A roller wheel pauses, telegraphs a new arrow toward the nearest player, and rolls again.
      if (s.owner==='enemy'&&s.pauseAt&&now>=s.pauseAt) {
        s.pauseAt=0;s.vx=0;s.vy=0;
        const target=players.reduce((best,p)=>Math.hypot(p.x-s.x,p.y-s.y)<Math.hypot(best.x-s.x,best.y-s.y)?p:best);
        const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1;
        s.reaimX=dx/d;s.reaimY=dy/d;s.launchAt=now+450;
        const src=this.byId(s.sourceId)||{id:s.sourceId,type:s.sourceType||'roller'};
        this.addHazard(src,{kind:'line',x:s.x,y:s.y,angle:Math.atan2(dy,dx),length:240,width:34,armAt:now+450,until:now+450,damage:0,telegraph:true,arrow:true});
      }
      if (s.owner==='enemy'&&s.launchAt&&now>=s.launchAt) {
        s.launchAt=0;s.vx=s.reaimX*320;s.vy=s.reaimY*320;s.hitIds=[];
        s.rollsLeft=(s.rollsLeft||1)-1;
        if (s.rollsLeft>0) s.pauseAt=now+700;
        else s.until=Math.min(s.until,now+800);
      }
      // Pillars and debris stop enemy shots.
      if (s.owner==='enemy'&&this.enemies.some(e=>e.hp>0&&TYPES[e.type].blocksShots&&Math.hypot(e.x-s.x,e.y-s.y)<e.r+s.r)) {s.until=0;continue;}
      // Seeds and frost orbs that land unswatted become hazards where they land.
      if (s.land&&s.owner==='enemy'&&s.until>0&&now+50>=s.until) {
        const l=s.land,src=this.byId(s.sourceId)||{id:s.sourceId,type:s.sourceType};
        this.addHazard(src,{kind:l.kind,x:s.x,y:s.y,r:l.r,armAt:now+(l.arm||0),until:now+l.last,damage:l.damage,once:l.once,trap:l.trap,effect:l.effect,force:l.force,frost:l.frost});
        s.until=0;continue;
      }
      if (s.owner==='enemy') {
        if (!(s.damage>0)) continue;
        for (const p of players) {
          if (Math.hypot(p.x-s.x,p.y-s.y)>=(p.r||25)+s.r) continue;
          const id=String(p._id);
          if (s.pierce&&s.hitIds&&s.hitIds.includes(id)) continue;
          if (this.tryHit(id,s.sourceId,now)) {
            damage.push({id,amount:s.damage,source:s.sourceType||'shot'});
            if (s.pierce) {s.hitIds=s.hitIds||[];s.hitIds.push(id);}
          }
          if (!s.pierce) {s.until=0;break;}
        }
      } else {
        s.hitIds=s.hitIds||[];
        for (const e of this.enemies) {
          if (e.hp<=0 || s.hitIds.includes(e.id) || Math.hypot(e.x-s.x,e.y-s.y)>=e.r+s.r) continue;
          s.hitIds.push(e.id);
          this.damageEnemy(e,s.damage,s.sourceId,{flags:{deflect:true}},now);
        }
      }
    }
    this.projectiles=this.projectiles.filter(s=>now<s.until&&Math.abs(s.x)<3000&&Math.abs(s.y)<3000);
    return damage;
  }
  resolveContacts(players,now){
    const result=this.physics.resolve(players,this.enemies,now);
    this.playerCorrections=result.corrections;
    const damage=[];
    for(const event of result.events){
      if(!(event.amount>0)||!this.tryHit(event.id,event.sourceId,now))continue;
      const player=players.find(p=>String(p._id)===event.id),e=this.enemies.find(e=>e.id===event.sourceId);
      if(e&&e.type==='stalker')e.ramp=0;
      damage.push({id:event.id,amount:e?this.outgoing(e,event.amount,now):event.amount,source:e?`${e.type}:contact`:'contact'});
      const mod=player&&modifiers(player.augments);
      // Thorns hit back with a multiple of the player's own attack power.
      const thornsKey=`${event.id}|${e&&e.id}`;
      if(mod&&mod.thorns&&e&&now>=(this.thornsAt.get(thornsKey)||0)&&this.thornsAt.set(thornsKey,now+1000))this.damageEnemy(e,Math.round(stats(player.lv||1,player.augments).damage*mod.thornsPower),event.id,{flags:{thorns:true}},now);
    }
    this.enemies=this.enemies.filter(e=>e.hp>0);
    return damage;
  }
  tryHit(playerId,sourceId,now){
    const key=`${playerId}|${sourceId}`;
    if(now<(this.invulnerableUntil.get(playerId)||0)||now<(this.sourceImmunity.get(key)||0))return false;
    this.invulnerableUntil.set(playerId,now+GLOBAL_IFRAMES);this.sourceImmunity.set(key,now+SOURCE_IFRAMES);
    this.lastHurt.set(playerId,now);
    return true;
  }
  attack(player, now) {
    if (!player || player.hp<=0 || player.choosingAugment) return {hits:[],xp:0};
    const id=String(player._id), mod=modifiers(player.augments), skill=player.skillState || {};
    if (now-(this.lastAttack.get(id) ?? -Infinity)<150) return {hits:[],xp:0};
    this.lastAttack.set(id,now);
    this.playerInfo.set(id,{augments:player.augments||[],lv:player.lv||1});
    const state=this.combatState(id,player.lv||1),ignited=now<state.igniteUntil;
    if (mod.reverse && skill.reverseToken!==state.token) {state.token=skill.reverseToken;state.charges=5;}
    const base=stats(player.lv,player.augments).damage*mod.damageScale;
    // Riposte: the first main-blade hit within 3s of being hurt doubles, once
    // per hurt and at most every 3s.
    const hurtAt=this.lastHurt.get(id);
    let riposte=mod.riposte && hurtAt!==undefined && now-hurtAt<3000 && state.riposteHurt!==hurtAt && now>=state.riposteAt;
    const berserk=mod.berserk && player.hp<=(player.hpmax||100)/2;
    const brink=mod.brink && player.hp<=(player.hpmax||100)*.3;
    // First beat: the first main-blade hit after 3s without one.
    let firstBeat=mod.firstBeat && now-state.lastHitAt>=3000;
    const blades=bladePoses(player,this);this.attackSerial++;
    const alive=new Set(this.enemies.map(e=>e.id));
    for (const key of state.touching.keys()) if (!alive.has(key.split('|')[1])) state.touching.delete(key);
    const strike=(e,pose,blade)=>{
      const origin={x:pose.x??player.x,y:pose.y??player.y};
      const dx=e.x-origin.x,dy=e.y-origin.y,distance=Math.hypot(dx,dy)||1;
      const main=blade==='main',turret=/^turret-\d+$/.test(blade),caster=main||turret;
      const localY=Math.sin(pose.sw_angle)*dx+Math.cos(pose.sw_angle)*dy;
      const tip=caster && localY < -player.r-pose.sw_r-pose.sw_h*.15;
      let factor=caster?(turret?.8:1)*(skill.thrust ? 2.4*mod.pierce : skill.dash ? 1.8*mod.momentumDamage : skill.giant ? 1.4 : 1):pose.power;
      // Copies of the player's sword (twin, turret) share the giant bonus.
      if (!caster && skill.giant && /^(twin|storm)/.test(blade.split('/').pop())) factor*=1.4;
      if (mod.tip && tip) factor*=1.4;
      if (main && state.charges>0) {factor*=1.6;state.charges--;}
      if (berserk) factor*=1.5;
      if (brink) factor*=1.35;
      if (main && firstBeat) {factor*=1.5;firstBeat=false;}
      if (mod.critEdge && this.random()<.2) factor*=1.5;
      if (main) state.lastHitAt=now;
      if (riposte && main) {factor*=2;riposte=false;state.riposteHurt=hurtAt;state.riposteAt=now+3000;}
      const hook={now,main,tip,thrust:!!skill.thrust,inner:main&&localY>-player.r-pose.sw_r+pose.sw_h*.25,base,skill,extra:0,after:[]};
      factor*=this.strikeHooks(player,state,mod,e,hook);
      let damage=Math.max(1,Math.round(base*(factor+hook.extra)));
      if (mod.guillotine && e.hp<=e.hpmax*.12) damage=e.hp;
      state.dealt=(state.dealt||0)+Math.min(damage,e.hp);
      const at={x:e.x,y:e.y};
      this.damageEnemy(e,damage,id,{nx:dx/distance,ny:dy/distance,thrust:caster&&skill.thrust,sweep:true,flags:main?{}:{blade}},now);
      hook.after.forEach(fn=>fn());
      if (mod.accent) {
        const a=state.accent.get(e.id)||{count:0,readyAt:0};a.count++;
        if (a.count>=3 && now>=a.readyAt) {a.count=0;a.readyAt=now+3000;if (e.hp>0) this.damageEnemy(e,Math.round(base*1.2),id,{flags:{aug:'accent'}},now);}
        state.accent.set(e.id,a);
        if (state.accent.size>200) state.accent.clear();
      }
      if (mod.stormMath && ++state.stormHits>=10 && now>=state.stormAt) {
        state.stormHits=0;state.stormAt=now+3000;
        this.enemies.filter(o=>o.hp>0&&Math.hypot(o.x-at.x,o.y-at.y)<300)
          .sort((a,b)=>Math.hypot(a.x-at.x,a.y-at.y)-Math.hypot(b.x-at.x,b.y-at.y)).slice(0,4)
          .forEach(o=>this.damageEnemy(o,Math.round(base*1.4),id,{flags:{lightning:true,fromX:at.x,fromY:at.y}},now));
      }
      const invMass=TYPES[e.type].fixed?0:1/Math.max(.5,e.mass||TYPES[e.type].mass||1);
      if (mod.knockback && e.hp>0 && invMass>0) {e.pushVx=(e.pushVx||0)+dx/distance*700*invMass;e.pushVy=(e.pushVy||0)+dy/distance*700*invMass;e.staggerUntil=now+250;}
      // Dash slash launches what it hits (scaled by mass).
      if (caster && skill.dash && e.hp>0 && invMass>0) {e.pushVx=(e.pushVx||0)+dx/distance*1300*invMass;e.pushVy=(e.pushVy||0)+dy/distance*1300*invMass;e.staggerUntil=now+450;}
      if (ignited && e.hp>0) this.burn(e,id,Math.round(base*.4),now);
      if (mod.lightning && now>=state.lightningAt && this.random()<mod.lightningChance) {
        state.lightningAt=now+600;
        const targets=this.enemies.filter(o=>o!==e&&o.hp>0&&Math.hypot(o.x-at.x,o.y-at.y)<260)
          .sort((a,b)=>Math.hypot(a.x-at.x,a.y-at.y)-Math.hypot(b.x-at.x,b.y-at.y)).slice(0,3);
        for (const o of targets) this.damageEnemy(o,Math.max(1,Math.round(base*.6)),id,{flags:{lightning:true,fromX:at.x,fromY:at.y}},now);
      }
      if (caster && mod.quake && skill.giant && tip && now>=state.quakeAt) {
        state.quakeAt=now+600;
        this.reward(id).hits.push({id:e.id,x:at.x,y:at.y,damage:0,shockwave:true});
        this.enemies.forEach(other=>{
          if (other.id!==e.id && other.hp>0 && Math.hypot(other.x-at.x,other.y-at.y)<110) this.damageEnemy(other,Math.round(damage*.6),id,{flags:{shock:true}},now);
        });
      }
    };
    for (const [blade,poses] of blades) {
      // One hit per pass: an enemy is struck when this blade enters it, not
      // again while it stays inside the blade.
      for (const e of [...this.enemies]) {
        if (e.hp<=0) continue;
        const key=`${blade}|${e.id}`;
        let touching=state.touching.has(key),pose=null;
        for (const q of poses) {
          const hit=swordHits({...player,...q,x:q.x??player.x,y:q.y??player.y},e);
          if (hit&&!touching&&!pose) pose=q;
          touching=hit;
        }
        if (!touching) state.touching.delete(key);
        else if (pose||!state.touching.has(key)) state.touching.set(key,now);
        else if (now-state.touching.get(key)>=REHIT_MS) {pose=poses[poses.length-1];state.touching.set(key,now);}
        if (pose) strike(e,pose,blade);
      }
      // Blades swat enemy shots out of the air; with parry they fly back.
      for (const s of this.projectiles) {
        if (s.owner!=='enemy' || s.until<=now || (s.kind==='spitRed'||s.kind==='sickle')) continue;
        if (!poses.some(q=>swordHits({...player,...q,x:q.x??player.x,y:q.y??player.y},s))) continue;
        this.reward(id).hits.push({id:s.id,x:s.x,y:s.y,damage:0,deflect:true});
        if (s.batted) {
          // A batted wheel flies away from the player, whatever the blade's spin.
          const dx=s.x-player.x,dy=s.y-player.y,d=Math.hypot(dx,dy)||1;
          Object.assign(s,{owner:'player',sourceId:id,vx:dx/d*400,vy:dy/d*400,damage:Math.round(base*2.5),until:now+1500,hitIds:[],batted:false});
        }
        else if (mod.parry) Object.assign(s,{owner:'player',sourceId:id,vx:-s.vx*1.3,vy:-s.vy*1.3,damage:Math.round(base*3),until:now+2000,hitIds:[]});
        else s.until=0;
      }
    }
    for (const burst of Array.isArray(player.bursts)?player.bursts.slice(0,12):[]) {
      if (burst&&(burst.kind==='cast'||burst.kind==='recast')) this.castSkill(player,state,mod,burst,now);
      else this.burst(player,state,mod,base,burst,now);
    }
    this.sampleTrail(player,state,now);
    this.enemies=this.enemies.filter(e=>e.hp>0);
    this.projectiles=this.projectiles.filter(s=>s.until>now);
    const result=this.rewards.get(id)||{hits:[],xp:0,kills:0,thrustKills:0};this.rewards.delete(id);
    const kills=result.kills;
    // Sword damage this request, for vampLord.
    const dealt=state.dealt||0;state.dealt=0;
    // vampLord heals at most 10% max health per second.
    let lord=0;
    if (mod.vampLord) {
      if (now-state.vampWindow>=1000) {state.vampWindow=now;state.vampHealed=0;}
      lord=Math.max(0,Math.min(Math.round(dealt*.08),Math.round((player.hpmax||100)*.1)-state.vampHealed));
      state.vampHealed+=lord;
    }
    const extra=this.attackExtras(player,state,mod,result,now);
    return {hits:result.hits,xp:result.xp,thrustKills:result.thrustKills,shieldGained:mod.spoils ? kills*20 : 0,
      heal:Math.round((mod.vampireHeal*Math.min(kills,5)+lord+this.breathe(id,player,state,mod,now))*healFactor(player,mod))+extra.heal,
      shield:extra.shield,shieldMs:extra.shieldMs,shieldAdd:extra.shieldAdd,hpCost:extra.hpCost,refunds:extra.refunds,flags:extra.flags,marks:result.marks||[]};
  }
  // Breather: 1% max health per second once 6s pass without being hurt.
  breathe(id,player,state,mod,now) {
    if (!mod.breather) return 0;
    const calm=now-(this.lastHurt.get(id) ?? -Infinity)>=6000;
    if (!calm) {state.regenAt=0;return 0;}
    if (!state.regenAt) {state.regenAt=now;return 0;}
    const seconds=Math.floor((now-state.regenAt)/1000);
    if (seconds<1) return 0;
    state.regenAt+=seconds*1000;
    return Math.round((player.hpmax||100)*.01*Math.min(seconds,5));
  }
  burst(player,state,mod,base,burst,now) {
    const spec=BURSTS[burst&&burst.kind];
    if (!spec || !Number.isFinite(burst.x) || !Number.isFinite(burst.y)) return;
    const source=burst.source;
    let castState=state,origin=player,scale=1;
    if (source!==undefined) {
      if (!/^turret-\d+$/.test(source) || !kitFor(player).includes('turret') || !['slam','aftershock'].includes(burst.kind)) return;
      const poses=bladePoses(player).get(source);
      if (!poses || !poses.length) return;
      origin=poses[poses.length-1];scale=.8;
      state.turretBursts=state.turretBursts||new Map();
      if (!state.turretBursts.has(source)) state.turretBursts.set(source,{burstAt:{},aftershockUntil:0});
      castState=state.turretBursts.get(source);
    }
    // Validate before spending a source's cooldown or aftershock charge.
    if (Math.hypot(burst.x-origin.x,burst.y-origin.y)>(source?1:400)) return;
    if (burst.kind==='slam') {
      if (!kitFor(player).includes('slam') || now<(castState.burstAt.slam||0)) return;
      castState.burstAt.slam=now+SKILLS.find(s=>s.id==='slam').cooldown*mod.hasteCooldown*.8;
      castState.aftershockUntil=mod.aftershock?now+1500:0;
    } else if (burst.kind==='aftershock') {
      if (now>=castState.aftershockUntil) return;
      castState.aftershockUntil=0;
    } else if (!mod[burst.kind]) return;
    if (burst.kind==='nova') {if ((player.lv||1)<=state.novaLevel) return;state.novaLevel=player.lv;}
    if (burst.kind==='blinkStrike') {
      if (now<(state.burstAt.blinkStrike||0)) return;
      state.burstAt.blinkStrike=now+SPELLS.find(s=>s.id==='blink').cooldown*.8;
    }
    const id=String(player._id);
    this.reward(id).hits.push({id:burst.kind,x:burst.x,y:burst.y,damage:0,burst:burst.kind});
    for (const e of [...this.enemies]) {
      if (!(e.hp>0)) continue;
      const dx=e.x-burst.x,dy=e.y-burst.y,distance=Math.hypot(dx,dy);
      if (distance>=spec.radius+e.r) continue;
      const center=burst.kind==='slam'&&mod.own.xR03&&distance<70+e.r?1.6:1;
      this.damageEnemy(e,Math.round(base*spec.power*scale*center),id,{flags:{shock:true}},now);
      if (spec.push && e.hp>0 && !TYPES[e.type].fixed) {const n=distance||1,invM=1/Math.max(.5,e.mass||TYPES[e.type].mass||1);e.pushVx=(e.pushVx||0)+dx/n*spec.push*invM;e.pushVy=(e.pushVy||0)+dy/n*spec.push*invM;e.staggerUntil=now+300;}
    }
  }
  snapshot(now=this.lastTime??0) {return this.enemies.map(e => {
    const row={};
    // false/null read the same as missing on the client, so they are not sent.
    for (const k in e) if (!SERVER_ONLY.has(k)&&e[k]!==false&&e[k]!=null) row[k]=wire(e[k]);
    if (e.phase!=='charge') {delete row.chargeEndX;delete row.chargeEndY;}
    if ((e.type==='splitter'||e.type==='mite')&&e.nextHop) {
      const interval=e.type==='splitter'?SPLITTER_HOP_MS:MITE_HOP_MS;
      row.hopProgress=Math.max(0,Math.min(1,(now-e.nextHop+interval)/Math.min(420,interval)));
    }
    if (e.type==='bomber'&&e.phase==='fuse') {row.fuseLeft=Math.max(0,e.phaseUntil-now);row.fuseTotal=BOMB_FUSE_MS;}
    if (e.type==='shellback') row.blockFlash=now<(e.blockFlashUntil||0);
    if (e.type==='flea'&&e.phase==='leap'&&e.phaseUntil>e.leapStart) {
      const t=Math.max(0,Math.min(1,(now-e.leapStart)/(e.phaseUntil-e.leapStart)));
      row.leapArc=Math.sin(t*Math.PI);
      row.leapDir=e.vx<0?-1:1;
    }
    if (e.type==='egg'&&e.hatchAt) {row.hatchLeft=Math.max(0,e.hatchAt-now);row.hatchTotal=2200;}
    if (e.type==='shroom'&&e.tpAt&&now-e.tpAt<450) {
      row.tpFromX=e.tpFromX;row.tpFromY=e.tpFromY;row.tpProgress=(now-e.tpAt)/450;
    }
    return row;
  });}
  state(now) {
    return {enemies:this.snapshot(now),
      projectiles:this.projectiles.map(({id,owner,x,y,vx,vy,r,kind})=>({id,owner,x:wire(x),y:wire(y),vx:wire(vx),vy:wire(vy),r,kind})),
      // Hazard timing is relative (ms from now) so clients need no clock sync.
      hazards:this.hazards.map(h=>({id:h.id,kind:h.kind,x:h.x,y:h.y,r:h.r,angle:h.angle,length:h.length,width:h.width,spread:h.spread,
        from:h.from,to:h.to,band:h.band,gapAngle:h.gapAngle,gapSize:h.gapSize,gapCount:h.gapCount||1,armIn:h.armAt-now,left:h.until-now,total:h.armAt-h.born,
        harmful:h.damage>0||!!h.telegraph,bar:!!h.bar,arrow:!!h.arrow,sweep:!!h.sweep,bomb:!!h.bomb,fromX:h.fromX,fromY:h.fromY,effect:h.effect,force:h.force,style:h.fire?'fire':h.poison?'poison':h.frost?'frost':h.wind?'wind':h.trap?'trap':h.echo?'echo':h.chain?'chain':h.marker?'marker':null})),
      blasts:this.blasts.map(({id,x,y,r})=>({id,x,y,r})),threat:this.threat(now),
      // Player skill areas, drawn in the owner's colours (timing relative).
      skillZones:this.zones.filter(z=>z.power>0||z.status||z.pull||z.sanctum||z.banner).map(z=>({id:z.id,owner:z.owner,skill:z.skill,kind:z.shape,x:z.x,y:z.y,r:z.r,angle:z.angle,length:z.len,width:z.w,spread:z.spread,
        age:now-z.born,every:z.every,tag:z.tag,bladeAngle:z.bladeAngle,spinDirection:z.spinDirection,armIn:z.armAt-now,left:z.until-now,warn:!!z.warn,support:!!(z.sanctum||z.banner)})),
      walls:this.walls.map(w=>({id:w.id,owner:w.owner,x:w.x,y:w.y,angle:w.angle,length:w.len,width:w.w,left:w.until-now})),
      decoys:this.decoys.map(d=>({id:d.id,owner:d.owner,x:d.x,y:d.y,left:d.until-now})),
      physics:Object.fromEntries(this.physicsLedger||[])};
  }
}
require('./skillEngine').install(EnemyArena);
module.exports = {EnemyArena, SERVER_ONLY, swordHits, TYPES, THREAT_STEP_MS, threatScale, spawnPlan, BLADE_POWER};
