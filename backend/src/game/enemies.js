const {modifiers,stats,CHARGE,chargeDestination,SPELLS,SKILLS,kitOf}=require('../../../frontend/src/gameRules');
const {CollisionWorld}=require('./collisions');
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
const BOMB_RADIUS=115,BOMB_FUSE_MS=900,SPIT_AIM_MS=550,SPIT_EVERY_MS=2300,SPIT_SPEED=260;
const TYPES = {
  spinner:  {r:24,hp:30,speed:62, xp:55,contact:13,unlock:1},
  charger:  {r:29,hp:45,speed:38, xp:80,contact:13,unlock:1},
  stalker:  {r:17,hp:20,speed:112,xp:35,contact:9, unlock:1},
  bomber:   {r:20,hp:24,speed:92, xp:45,contact:8, unlock:1},
  spitter:  {r:21,hp:30,speed:72, xp:50,contact:8, unlock:1},
  splitter: {r:30,hp:55,speed:48, xp:40,contact:12,unlock:1},
  mite:     {r:13,hp:12,speed:135,xp:12,contact:6, unlock:Infinity},
};
// Client-triggered area attacks. The server owns radius, damage and cooldown.
const BURSTS = {
  nova:{radius:300,power:7},
  blinkStrike:{radius:160,power:4},
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

function threatScale(level) {
  const n=Math.max(0,level-1);
  return {hp:1+.22*n,power:1+.12*n,speed:Math.min(1.35,1+.03*n),xp:1+.1*n};
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
function bladePoses(player) {
  const mod=modifiers(player.augments),kit=kitFor(player);
  const raw=Array.isArray(player.poses)?player.poses.slice(-400):[];
  const groups=new Map();
  for (const q of raw) {
    if (!q || !POSE_FIELDS.every(k=>Number.isFinite(q[k]))) continue;
    const blade=typeof q.blade==='string'?q.blade:'main';
    if (!bladeAllowed(blade,mod,kit)) continue;
    const kind=blade.split('-')[0];
    const pose={sw_angle:q.sw_angle,sw_r:q.sw_r,sw_w:q.sw_w,sw_h:q.sw_h,power:blade==='main'?1:BLADE_POWER[kind]||0};
    const placed=Number.isFinite(q.x)&&Number.isFinite(q.y)&&Math.hypot(q.x-player.x,q.y-player.y)<(kind==='turret'?1500:700);
    if (placed) {pose.x=q.x;pose.y=q.y;}
    else if (ANCHORED.has(kind)) continue;
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
    this.rewards = new Map();
    this.attackState = new Map();
    this.playerInfo = new Map();
    this.physics=new CollisionWorld();this.playerCorrections=[];
  }
  threat(now) {
    if (this.startedAt===null) return {level:1,elapsed:0};
    const elapsed=Math.max(0,now-this.startedAt);
    return {level:1+Math.floor(elapsed/THREAT_STEP_MS),elapsed};
  }
  spawn(player, type, now=this.lastTime ?? 0, at) {
    const spec = TYPES[type],level=this.threat(now).level,scale=threatScale(level);
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
    this.enemies.push(enemy);
    return enemy;
  }
  pickType(level) {
    const open=Object.entries(TYPES).filter(([,spec])=>spec.unlock<=level).map(([type])=>type);
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
    e.hp=Math.max(0,e.hp-amount);
    const r=this.reward(credit);
    if (r) r.hits.push({id:e.id,x:e.x,y:e.y,nx:info.nx||0,ny:info.ny||0,damage:amount,killed:e.hp===0,...info.flags});
    if (e.hp===0) this.onKilled(e,credit,now,info);
  }
  onKilled(e,credit,now,info={}) {
    const r=this.reward(credit);
    if (r) {r.xp+=e.xp;r.kills++;if (info.thrust) r.thrustKills++;}
    const killer=credit&&this.playerInfo.get(credit),mod=killer?modifiers(killer.augments):null;
    if (e.type==='bomber') this.explode(e,now,{hurtPlayers:false,credit});
    if (mod && mod.wildfire && e.burnUntil>now) for (const other of this.enemies)
      if (other!==e && other.hp>0 && !(other.burnUntil>now) && Math.hypot(other.x-e.x,other.y-e.y)<140) this.burn(other,e.burnBy,e.burnDamage,now);
    if (e.type==='splitter') for (const side of [-1,1]) {
      const mite=this.spawn(null,'mite',now,{x:e.x+side*18,y:e.y+side*10});
      mite.vx=side*120;mite.vy=0;
    }
    if (mod && mod.chainReaction) {
      const amount=Math.round(stats(killer.lv||1,killer.augments).damage*mod.damageScale*2);
      if (r) r.hits.push({id:`${e.id}-chain`,x:e.x,y:e.y,damage:0,burst:'corpse'});
      for (const other of [...this.enemies]) if (other!==e && other.hp>0 && Math.hypot(other.x-e.x,other.y-e.y)<130+other.r) this.damageEnemy(other,amount,credit,{flags:{shock:true}},now);
    }
    if (mod && mod.corpseBomb>0) {
      const amount=Math.round(e.hpmax*mod.corpseBomb);
      if (r) r.hits.push({id:e.id,x:e.x,y:e.y,damage:0,burst:'corpse'});
      for (const other of this.enemies) if (other!==e && other.hp>0 && Math.hypot(other.x-e.x,other.y-e.y)<120) this.damageEnemy(other,amount,credit,{flags:{shock:true}},now);
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
      if (Math.hypot(p.x-e.x,p.y-e.y)<BOMB_RADIUS+(p.r||25) && this.tryHit(id,e.id,now)) damage.push({id,amount:this.outgoing(e,26*e.power,now)});
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
    if (!state) {state={token:0,charges:0,quakeAt:0,touching:new Map(),novaLevel:lv,burstAt:{},igniteUntil:0,aftershockUntil:0};this.attackState.set(id,state);}
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
        this.damageEnemy(target,50+10*(player.lv||1),id,{flags:{smite:true}},now);
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
    if (!living.length) {this.enemies = [];this.projectiles=[];this.blasts=[]; this.nextSpawn = now; this.startedAt=null; this.attackState.clear();this.physics.clear(); return [];}
    if (!players.length) {
      // Everyone is choosing an augment: freeze the room, including its clock.
      this.enemies.forEach(e=>{e.phaseUntil+=dt*1000;e.nextShot+=dt*1000;e.vx=0;e.vy=0;e.angularVelocity=0;});
      this.projectiles.forEach(s=>{s.until+=dt*1000;});
      this.nextSpawn+=dt*1000;if(this.startedAt!==null)this.startedAt+=dt*1000;
      return this.resolveContacts(living,now);
    }
    if (this.startedAt===null) this.startedAt=now;
    const {level}=this.threat(now);
    const cap=Math.min(36,7+players.length*3+2*(level-1));
    if (this.enemies.length < cap && now >= this.nextSpawn) {
      const player = players[Math.floor(this.random() * players.length)];
      if (!this.enemies.length) ['spinner','charger','stalker','spitter','bomber'].forEach(type => this.spawn(player, type, now));
      else {
        // Packs grow with the threat level.
        const pack=Math.min(cap-this.enemies.length,1+Math.floor(level/3)+(this.random()<.35?1:0));
        for (let i=0;i<pack;i++) this.spawn(player, this.pickType(level), now);
      }
      this.nextSpawn = now + Math.max(350,1100-70*(level-1));
    }
    const damage=[];
    this.enemies.forEach(e => {
      if (e.hp<=0) return;
      const p = players.reduce((best, p) => Math.hypot(p.x - e.x, p.y - e.y) < Math.hypot(best.x - e.x, best.y - e.y) ? p : best);
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist, ny = dy / dist;
      const slow=this.chronoSlow(e.x,e.y,players)*(now<(e.exhaustUntil||0)?EXHAUST_SLOW:1),speedScale=(e.speedScale||1)*slow,base=TYPES[e.type].speed*speedScale;
      e.angularVelocity=2.7*slow;
      e.angle += dt * 2.7*slow;
      if (dist > 1400) {
        const a = this.random() * Math.PI * 2;
        e.x = Math.max(-2850, Math.min(2850, p.x + Math.cos(a) * 600));
        e.y = Math.max(-2850, Math.min(2850, p.y + Math.sin(a) * 600));
        e.vx = 0; e.vy = 0; e.phase = 'hunt'; return;
      }
      if (e.type === 'charger') {
        if (e.phase === 'windup' && now >= e.phaseUntil) {e.phase = 'charge'; e.phaseUntil = now + CHARGE.duration;}
        else if (e.phase === 'charge' && now >= e.phaseUntil) {e.phase = 'recover'; e.phaseUntil = now + 1100;}
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
        const speed = e.phase === 'charge' ? CHARGE.speed : e.phase === 'hunt' ? base : 0;
        e.vx = (e.phase === 'charge' ? e.aimX : nx) * speed;
        e.vy = (e.phase === 'charge' ? e.aimY : ny) * speed;
      } else if (e.type === 'stalker') {
        const flank = Math.sin(now / 520 + Number(e.id.slice(3))) * .65;
        e.vx = (nx - ny * flank) * base;
        e.vy = (ny + nx * flank) * base;
      } else if (e.type === 'bomber') {
        if (e.phase === 'fuse' && now >= e.phaseUntil) {damage.push(...this.explode(e,now,{hurtPlayers:true,players}));return;}
        if (e.phase === 'hunt' && dist < 75+e.r) {e.phase='fuse';e.phaseUntil=now+BOMB_FUSE_MS;}
        const speed=e.phase==='fuse'?0:base;
        e.vx=nx*speed;e.vy=ny*speed;
      } else if (e.type === 'spitter') {
        if (e.phase === 'aim' && now >= e.phaseUntil) {
          this.projectiles.push({id:`s-${++this.sequence}`,owner:'enemy',sourceId:e.id,x:e.x+e.aimX*(e.r+6),y:e.y+e.aimY*(e.r+6),
            vx:e.aimX*SPIT_SPEED,vy:e.aimY*SPIT_SPEED,r:9,damage:this.outgoing(e,14*e.power,now),until:now+2600});
          e.phase='hunt';e.nextShot=now+SPIT_EVERY_MS;
        }
        if (e.phase === 'hunt' && now >= e.nextShot && dist < 560) {e.phase='aim';e.phaseUntil=now+SPIT_AIM_MS;e.aimX=nx;e.aimY=ny;}
        // Always face the target; the aim locks while winding up a shot.
        if (e.phase !== 'aim') {e.aimX=nx;e.aimY=ny;}
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
      } else if (e.type === 'splitter' || e.type === 'mite') {
        e.vx = nx * base; e.vy = ny * base;
      } else {
        const radial = dist < 150 ? -.4 : 1;
        e.vx = (nx * radial - ny * .55) * base;
        e.vy = (ny * radial + nx * .55) * base;
      }
      const staggered=now<(e.staggerUntil||0);
      if(staggered){
        e.moveVx=0;e.moveVy=0;e.vx=0;e.vy=0;e.recoveringMovement=true;
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
        const remaining=Math.hypot(e.chargeEndX-e.x,e.chargeEndY-e.y);
        const travel=Math.min(remaining,CHARGE.speed*slow*dt);
        e.x+=e.aimX*travel;e.y+=e.aimY*travel;
        if(travel>=remaining){e.x=e.chargeEndX;e.y=e.chargeEndY;e.phase='recover';e.phaseUntil=now+1100;e.vx=0;e.vy=0;}
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
    damage.push(...this.stepProjectiles(players,now,dt));
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
        damage.push({id,amount:this.outgoing(e,e.contact,now)});
      }
    }));
    return damage;
  }
  stepProjectiles(players,now,dt) {
    const damage=[];
    for (const s of this.projectiles) {
      const slow=s.owner==='enemy'?this.chronoSlow(s.x,s.y,players):1;
      s.x+=s.vx*dt*slow;s.y+=s.vy*dt*slow;
      if (s.owner==='enemy') {
        for (const p of players) {
          if (Math.hypot(p.x-s.x,p.y-s.y)>=(p.r||25)+s.r) continue;
          const id=String(p._id);
          if (this.tryHit(id,s.sourceId,now)) damage.push({id,amount:s.damage});
          s.until=0;break;
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
      if(!this.tryHit(event.id,event.sourceId,now))continue;
      const player=players.find(p=>String(p._id)===event.id),e=this.enemies.find(e=>e.id===event.sourceId);
      damage.push({id:event.id,amount:e?this.outgoing(e,event.amount,now):event.amount});
      const mod=player&&modifiers(player.augments);
      // Thorns hit back with a multiple of the player's own attack power.
      if(mod&&mod.thorns&&e)this.damageEnemy(e,Math.round(stats(player.lv||1,player.augments).damage*mod.thornsPower),event.id,{flags:{thorns:true}},now);
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
    const riposte=mod.riposte && now-(this.lastHurt.get(id) ?? -Infinity)<2000;
    const berserk=mod.berserk && player.hp<=(player.hpmax||100)/2;
    const blades=bladePoses(player);
    const alive=new Set(this.enemies.map(e=>e.id));
    for (const key of state.touching.keys()) if (!alive.has(key.split('|')[1])) state.touching.delete(key);
    const strike=(e,pose,blade)=>{
      const origin={x:pose.x??player.x,y:pose.y??player.y};
      const dx=e.x-origin.x,dy=e.y-origin.y,distance=Math.hypot(dx,dy)||1;
      const main=blade==='main';
      const localY=Math.sin(pose.sw_angle)*dx+Math.cos(pose.sw_angle)*dy;
      const tip=main && localY < -player.r-pose.sw_r-pose.sw_h*.15;
      let factor=main?(skill.thrust ? 2.4*mod.pierce : skill.dash ? 1.8*mod.momentumDamage : skill.giant ? 1.4 : 1):pose.power;
      // Copies of the player's sword (twin, turret) share the giant bonus.
      if (!main && skill.giant && /^(twin|turret|storm)/.test(blade)) factor*=1.4;
      if (mod.tip && tip) factor*=1.8;
      if (main && state.charges>0) {factor*=1.6;state.charges--;}
      if (berserk) factor*=1.8;
      if (riposte) factor*=2.5;
      let damage=Math.max(1,Math.round(base*factor));
      if (mod.guillotine && e.hp<=e.hpmax*.2) damage=e.hp;
      state.dealt=(state.dealt||0)+Math.min(damage,e.hp);
      const at={x:e.x,y:e.y};
      this.damageEnemy(e,damage,id,{nx:dx/distance,ny:dy/distance,thrust:main&&skill.thrust,flags:main?{}:{blade}},now);
      if (mod.knockback && e.hp>0) {e.pushVx=(e.pushVx||0)+dx/distance*700;e.pushVy=(e.pushVy||0)+dy/distance*700;e.staggerUntil=now+250;}
      // Dash slash launches what it hits.
      if (main && skill.dash && e.hp>0) {e.pushVx=(e.pushVx||0)+dx/distance*1300;e.pushVy=(e.pushVy||0)+dy/distance*1300;e.staggerUntil=now+450;}
      if (ignited && e.hp>0) this.burn(e,id,Math.round(base*.4),now);
      if (mod.lightning && this.random()<mod.lightningChance) {
        const targets=this.enemies.filter(o=>o!==e&&o.hp>0&&Math.hypot(o.x-at.x,o.y-at.y)<260)
          .sort((a,b)=>Math.hypot(a.x-at.x,a.y-at.y)-Math.hypot(b.x-at.x,b.y-at.y)).slice(0,3);
        for (const o of targets) this.damageEnemy(o,Math.max(1,Math.round(base*.8)),id,{flags:{lightning:true,fromX:at.x,fromY:at.y}},now);
      }
      if (main && mod.quake && skill.giant && tip && now>=state.quakeAt) {
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
        if (s.owner!=='enemy' || s.until<=now) continue;
        if (!poses.some(q=>swordHits({...player,...q,x:q.x??player.x,y:q.y??player.y},s))) continue;
        this.reward(id).hits.push({id:s.id,x:s.x,y:s.y,damage:0,deflect:true});
        if (mod.parry) Object.assign(s,{owner:'player',sourceId:id,vx:-s.vx*1.3,vy:-s.vy*1.3,damage:Math.round(base*3),until:now+2000,hitIds:[]});
        else s.until=0;
      }
    }
    for (const burst of Array.isArray(player.bursts)?player.bursts.slice(0,4):[]) this.burst(player,state,mod,base,burst,now);
    this.enemies=this.enemies.filter(e=>e.hp>0);
    this.projectiles=this.projectiles.filter(s=>s.until>now);
    const result=this.rewards.get(id)||{hits:[],xp:0,kills:0,thrustKills:0};this.rewards.delete(id);
    const kills=result.kills;
    // Sword damage this request, for vampLord.
    const dealt=state.dealt||0;state.dealt=0;
    return {hits:result.hits,xp:result.xp,thrustKills:result.thrustKills,shieldGained:mod.spoils ? kills*20 : 0,
      heal:mod.vampireHeal*kills+(mod.vampLord?Math.round(dealt*.08):0)};
  }
  burst(player,state,mod,base,burst,now) {
    const spec=BURSTS[burst&&burst.kind];
    if (!spec || !Number.isFinite(burst.x) || !Number.isFinite(burst.y)) return;
    if (burst.kind==='slam') {
      if (!kitFor(player).includes('slam') || now<(state.burstAt.slam||0)) return;
      state.burstAt.slam=now+SKILLS.find(s=>s.id==='slam').cooldown*mod.hasteCooldown*.8;
      state.aftershockUntil=mod.aftershock?now+1500:0;
    } else if (burst.kind==='aftershock') {
      if (now>=state.aftershockUntil) return;
      state.aftershockUntil=0;
    } else if (!mod[burst.kind]) return;
    if (Math.hypot(burst.x-player.x,burst.y-player.y)>400) return;
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
      this.damageEnemy(e,Math.round(base*spec.power),id,{flags:{shock:true}},now);
      if (spec.push && e.hp>0) {const n=distance||1;e.pushVx=(e.pushVx||0)+dx/n*spec.push;e.pushVy=(e.pushVy||0)+dy/n*spec.push;e.staggerUntil=now+300;}
    }
  }
  snapshot() {return this.enemies.map(e => {const row={...e};delete row.name;return row;});}
  state(now) {
    return {enemies:this.snapshot(),
      projectiles:this.projectiles.map(({id,owner,x,y,vx,vy,r})=>({id,owner,x,y,vx,vy,r})),
      blasts:this.blasts.map(({id,x,y,r})=>({id,x,y,r})),threat:this.threat(now)};
  }
}
module.exports = {EnemyArena, swordHits, TYPES, THREAT_STEP_MS, threatScale, BLADE_POWER};
