// Client half of the expansion skills, spells and augments (AUGMENT.md).
// The client owns its own body (moves, speed, extra blades it draws) and the
// cooldown display; every cast is reported to the server as a burst, and the
// server owns damage, statuses, shields and heals (backend skillEngine.js).
const {modifiers,specFor,SKILLS,SPELLS,MOVERS}=require('./gameRules');

const QWER=new Set(SKILLS.map(s=>s.id));
const defOf=id=>SKILLS.find(s=>s.id===id)||SPELLS.find(s=>s.id===id);
let world={enemies:[]};
// frameUpdater hands us the latest enemy snapshot for targeted moves.
export function setWorld(enemies){world.enemies=enemies||[];}

export function bookState(s){
  if(!s.book)s.book={buffs:[],blades:{},recast:{},moves:null,history:[],gates:null,anchor:null,mark:null,charges:{},
    chargeAt:{},garden:null,banner:null,fortressUntil:0,cleanseUntil:0,phaseUntil:0,dances:0,heartAt:0,lastShield:0};
  return s.book;
}
const facing=s=>{const f=s.facing||{x:0,y:-1},l=Math.hypot(f.x,f.y)||1;return {x:f.x/l,y:f.y/l};};
function pushBurst(player,kind,id,extra,from){
  const s=player.skills,f=facing(s);
  s.bursts.push({kind,id,x:player.pos.x,y:player.pos.y,ox:from?from.x:player.pos.x,oy:from?from.y:player.pos.y,dx:f.x,dy:f.y,...(extra||{})});
}
function teleport(player,x,y){player.pos.x=x;player.pos.y=y;if(player.bound)player.bound();}
function nearestEnemy(player,range){
  let best=null,bd=Infinity;
  for(const e of world.enemies){if(!(e.hp>0))continue;const d=Math.hypot(e.x-player.pos.x,e.y-player.pos.y);if(d<range+(e.r||0)&&d<bd){bd=d;best=e;}}
  return best;
}
// Start a move. Returns false when it needs a target and has none.
function startMove(player,move,now){
  const s=player.skills,b=bookState(s),f=facing(s),at={x:player.pos.x,y:player.pos.y};
  if(!move)return true;
  if(move.kind==='dash'){b.moves={dir:f,dist:move.dist,done:0,start:now,ms:move.ms||150};return true;}
  if(move.kind==='blink'){teleport(player,at.x+f.x*move.dist,at.y+f.y*move.dist);return true;}
  if(move.kind==='nearest'){
    const t=nearestEnemy(player,move.range);if(!t)return false;
    const dx=t.x-at.x,dy=t.y-at.y,d=Math.hypot(dx,dy)||1,go=Math.max(0,d-move.stop-(t.r||0));
    teleport(player,at.x+dx/d*go,at.y+dy/d*go);s.facing={x:dx/d,y:dy/d};return true;
  }
  if(move.kind==='turret'){
    const t=(s.turrets||[]).filter(t=>t.until>now&&Math.hypot(t.x-at.x,t.y-at.y)<move.range).sort((a,c)=>Math.hypot(a.x-at.x,a.y-at.y)-Math.hypot(c.x-at.x,c.y-at.y))[0];
    if(t){
      teleport(player,t.x,t.y);
      if(modifiers(player.augments).own.xE09){t.x=at.x;t.y=at.y;t.until+=1000;}
    } else teleport(player,at.x+f.x*move.dist,at.y+f.y*move.dist);
    return true;
  }
  if(move.kind==='rewind'){
    const back=b.history.find(h=>now-h.t<=3000);
    if(!back||now-b.history[0].t<3000)return false;
    teleport(player,back.x,back.y);return true;
  }
  if(move.kind==='gate'){b.gates={a:{...at},b:{x:at.x+f.x*move.dist,y:at.y+f.y*move.dist},until:now+move.ms,reuseAt:now+300};return true;}
  return true;
}
function applyBuffs(player,spec,now){
  const b=bookState(player.skills);
  if(spec.speed)b.buffs.push({speed:spec.speed[0],until:now+spec.speed[1]});
  if(spec.spin)b.buffs.push({spin:spec.spin[0],until:now+spec.spin[1]});
  if(spec.length){b.buffs.push({length:spec.length[0],until:now+spec.length[1]});b.fortressUntil=now+spec.length[1];b.fortressAt=now;}
  if(spec.phase)b.phaseUntil=Math.max(b.phaseUntil,now+spec.phase);
  if(spec.cleanse)b.cleanseUntil=Math.max(b.cleanseUntil,now+spec.cleanse);
  if(spec.after)b.after={mult:spec.after[0],ms:spec.after[1],at:now+(spec.speed?spec.speed[1]:defOf(spec.id).duration||0)};
  if(spec.blades)b.blades[spec.id]={...spec.blades,until:now+spec.blades.ms,angle:0};
  if(spec.garden)b.garden={x:player.pos.x,y:player.pos.y,r:spec.garden.r,rate:spec.garden.rate,until:now+spec.garden.ms};
  if(spec.banner)b.banner={x:player.pos.x,y:player.pos.y,r:spec.banner.r,until:now+spec.banner.ms,follow:!!spec.follow};
}
// Cast an expansion skill or spell. Returns true when it went off.
export function castBook(player,id,now){
  const s=player.skills,spec=specFor(id,player.augments);
  if(!spec||player.stationary)return false;
  const b=bookState(s),mod=modifiers(player.augments),isQ=QWER.has(id),cds=isQ?s.cooldowns:s.spellCooldowns;
  const cooldown=spec.cooldown*(isQ?mod.hasteCooldown:1);
  // Recast inside the window instead of a new cast.
  const r=b.recast[id];
  if(r&&now<r.until&&r.left>0){
    r.left--;
    const from={x:player.pos.x,y:player.pos.y},extra={};
    if(id==='chainRush'||id==='beatWalk'){b.moves={dir:facing(s),dist:id==='chainRush'&&r.left===0&&(spec.recasts||1)>1?140:spec.move.dist,done:0,start:now,ms:150};}
    if(id==='markShot'&&b.mark&&now-b.mark.at<3000){
      const dx=b.mark.x-from.x,dy=b.mark.y-from.y,d=Math.hypot(dx,dy)||1,go=Math.max(0,d-70);
      teleport(player,from.x+dx/d*go,from.y+dy/d*go);
    }
    if(id==='anchor'&&b.anchor){teleport(player,b.anchor.x,b.anchor.y);b.anchor=null;}
    pushBurst(player,'recast',id,extra,from);
    return true;
  }
  // Charges (spare blink): refill one at a time.
  if(spec.charges){
    const max=spec.charges;
    if(b.charges[id]===undefined)b.charges[id]=max;
    while(b.charges[id]<max&&now>=(b.chargeAt[id]||0)&&b.chargeAt[id]){b.charges[id]++;b.chargeAt[id]=b.charges[id]<max?b.chargeAt[id]+cooldown:0;}
    if(b.charges[id]<=0)return false;
    b.charges[id]--;
    if(!b.chargeAt[id])b.chargeAt[id]=now+cooldown;
    cds[id]=b.charges[id]>0?0:b.chargeAt[id];
    // X-D09: the last charge gives a shield (server) and refills faster.
  } else {
    if(now<(cds[id]||0))return false;
  }
  const from={x:player.pos.x,y:player.pos.y};
  if(!startMove(player,spec.move,now))return false;
  if(!spec.charges)cds[id]=now+cooldown;
  (isQ?s.until:s.spellUntil)[id]=now+(spec.duration||0);
  s.castAt[id]=now;
  applyBuffs(player,spec,now);
  if(id==='anchor')b.anchor=from;
  if(spec.recast)b.recast[id]={until:now+spec.recast,left:spec.recasts||1};
  if(id==='iaido'||id==='swordWall'||id==='chainRush')b.recast[id]=spec.recast?b.recast[id]:null;
  const extra={};
  if(id==='freezeWave'&&b.anchor)Object.assign(extra,{ax:b.anchor.x,ay:b.anchor.y});
  pushBurst(player,'cast',id,extra,from);
  return true;
}
// Report casts of the original abilities so server-side augment hooks run,
// and handle their recasts (X-R02 turret recall).
// Only augments that react to casts need these reports.
const CAST_HOOKS=['xQ01','xE02','xD01','xF03','combo1','combo4','fillGap','fourBreaths','endlessDance','chaosConcert','echoArt','timeSplitter','heatLeft','sheath','dawnForge','tipWatch'];
export function castClassic(player,id,now,from){
  if(player.stationary)return;
  const own=modifiers(player.augments).own;
  if(!CAST_HOOKS.some(k=>own[k]))return;
  pushBurst(player,'cast',id,id==='reverse'?{bladeAngle:player.sw_angle,spinDirection:player.skills.direction}:{},from);
}
export function recallTurret(player,now){
  const s=player.skills,mod=modifiers(player.augments);
  if(!mod.own.xR02||player.stationary)return false;
  const b=bookState(s),t=(s.turrets||[]).filter(t=>t.until>now).slice(-1)[0];
  if(!t||b.recalled===t.id)return false;
  b.recalled=t.id;t.until=now;
  pushBurst(player,'recast','turret',{tx:t.x,ty:t.y});
  return true;
}
// Per-frame: moves, buffs, gates, history; returns multipliers for the
// sword and whether the body is phasing.
export function bookWeapon(player,now,dt){
  const s=player.skills,b=bookState(s),mod=modifiers(player.augments);
  b.history.push({x:player.pos.x,y:player.pos.y,t:now});
  while(b.history.length&&now-b.history[0].t>3500)b.history.shift();
  if(b.moves){
    const m=b.moves,t=Math.min(1,(now-m.start)/m.ms),travel=m.dist*(1-(1-t)**2);
    if(!player.stationary){player.pos.x+=m.dir.x*(travel-m.done);player.pos.y+=m.dir.y*(travel-m.done);if(player.bound)player.bound();}
    m.done=travel;if(t>=1)b.moves=null;
  }
  b.buffs=b.buffs.filter(x=>x.until>now);
  let speed=1,spin=1,length=1;
  for(const x of b.buffs){if(x.speed)speed*=x.speed;if(x.spin)spin=Math.max(spin,x.spin);if(x.length)length=Math.max(length,x.length);}
  // W12: losing the fortress shield ends the longer blade.
  if(b.fortressUntil>now&&now-b.fortressAt>400&&!(player.shield>0)){b.fortressUntil=0;b.buffs=b.buffs.filter(x=>!x.length);length=1;}
  if(b.after&&now>=b.after.at&&now<b.after.at+b.after.ms)speed*=b.after.mult;
  if(b.outStepUntil>now)speed*=1.12;
  if(b.danceUntil>now)spin*=1.6;
  if(b.banner&&now<b.banner.until){
    if(b.banner.follow){b.banner.x=player.pos.x;b.banner.y=player.pos.y;}
    if(Math.hypot(player.pos.x-b.banner.x,player.pos.y-b.banner.y)<b.banner.r)speed*=1.15;
  }
  // R11: cooldowns recover 25% faster inside the garden.
  if(b.garden&&now<b.garden.until&&Math.hypot(player.pos.x-b.garden.x,player.pos.y-b.garden.y)<b.garden.r)
    for(const id of Object.keys(s.cooldowns))if(QWER.has(id)&&s.cooldowns[id]>now)s.cooldowns[id]-=dt*1000*(b.garden.rate-1);
  // D12 gates.
  if(b.gates&&now<b.gates.until&&now>=b.gates.reuseAt&&!player.stationary){
    const g=b.gates;
    for(const [from,to] of [[g.a,g.b],[g.b,g.a]])if(Math.hypot(player.pos.x-from.x,player.pos.y-from.y)<32){
      teleport(player,to.x,to.y);g.reuseAt=now+3000;
      if(mod.own.combo12&&now<((b.blades.kingsMarch||{}).until||0))b.gateBlades={x:from.x,y:from.y,until:now+1500};
      break;
    }
  }
  // T-04: every 8s a pair of small dolls for 3s.
  if(mod.own.workshopHeart&&now>=b.heartAt){b.heartAt=now+8000;b.blades.heart={count:2,r:110,w:30,h:64,power:.55,born:now,duration:3000,until:now+3000,speed:1.6};}
  if(b.nebulaUntil>now)b.blades.nebula={count:2,r:95,w:20,h:46,power:.45,until:b.nebulaUntil,speed:2.6};
  if(mod.own.rainbowKing)b.blades.rainbow={count:3,r:0,w:34,h:80,power:.6,until:now+1000,speed:0,rainbow:true};
  const phase=now<b.phaseUntil;
  const cleanse=now<b.cleanseUntil;
  return {speed,spin,length,phase,cleanse};
}
// Extra blades for this frame (after the main sword's pose is known).
export function bookBlades(player,now,dt,blades){
  const s=player.skills,b=bookState(s),mod=modifiers(player.augments);
  for(const kind of Object.keys(b.blades)){
    const o=b.blades[kind];
    if(!(o.until>now)){delete b.blades[kind];continue;}
    o.angle=(o.angle+dt*(o.speed||2)*(s.direction||1))%(Math.PI*2);
    for(let i=0;i<o.count;i++){
      if(o.rainbow){
        // T-01: three rainbow swords share the circle with the main one.
        const a=player.sw_angle+(i+1)*Math.PI*2/(o.count+1)+Math.PI/(o.count+1);
        blades.push({blade:`sk-rainbow-${i}`,sw_angle:a,sw_r:player.sw_r,sw_w:player.sw_w*.85,sw_h:player.sw_h*.8,power:o.power,rainbow:true});
        continue;
      }
      const wobble=o.wobble?Math.sin(now/400+i)*45:0,orbit=o.r+wobble;
      blades.push({blade:`sk-${kind}-${i}`,sw_angle:o.angle+i*Math.PI*2/o.count,sw_r:Math.max(0,orbit-(player.r||25)-o.h/2),sw_w:o.w,sw_h:o.h,power:o.power,
        ...(kind==='heart'?{born:o.born,until:o.until,duration:o.duration||3000,doll:true}:{})});
    }
  }
  // X-W01: a back blade while giant.
  if(mod.own.xW01&&now<(s.until.giant||0))blades.push({blade:'sk-giantBack-0',sw_angle:player.sw_angle+Math.PI,sw_r:player.sw_r,sw_w:player.sw_w,sw_h:player.sw_h*.7,power:.65});
  if(b.gateBlades&&now<b.gateBlades.until)for(let i=0;i<5;i++)
    blades.push({blade:`sk-gate-${i}`,x:b.gateBlades.x,y:b.gateBlades.y,sw_angle:now/150+i*Math.PI*2/5,sw_r:10,sw_w:20,sw_h:46,power:.35});
}
// Server answers to an attack request.
export function applyBookResult(player,result,now){
  const s=player.skills;if(!s||!result)return;
  const b=bookState(s),mod=modifiers(player.augments);
  const longest=()=>{let best=null;for(const id of (player.loadout||[]))if((s.cooldowns[id]||0)>now&&(!best||s.cooldowns[id]>s.cooldowns[best]))best=id;return best;};
  for(const r of result.refunds||[]){
    const id=r.longest?longest():r.id;if(!id)continue;
    const cds=QWER.has(id)?s.cooldowns:s.spellCooldowns,left=Math.max(0,(cds[id]||0)-now);
    cds[id]=now+Math.max(0,left-(r.ms||left*(r.pct||0)));
  }
  const f=result.flags||{};
  if(f.nebula)b.nebulaUntil=now+f.nebula;
  if(f.dance)b.danceUntil=now+f.dance;
  if(f.outStep)b.outStepUntil=now+f.outStep;
  if(f.knotUsed)b.knotUsed=true;
  if(f.accelPlus&&now<(s.until.accel||0))s.until.accel+=f.accelPlus;
  for(const m of result.marks||[])if(m.tag==='eye')b.mark={x:m.x,y:m.y,at:now};
  // X-Q03: boomerang hits on the way back shave its cooldown.
  if(mod.own.xQ03&&s.boomerang){
    const back=(result.hits||[]).filter(h=>h.blade==='boomerang'&&h.damage>0).length;
    if(back&&now-s.boomerang.start>450){const give=Math.min(back*250,1000-(b.boomerangRefund||0));if(give>0){s.cooldowns.boomerang-=give;b.boomerangRefund=(b.boomerangRefund||0)+give;}}
  }
  if(!s.boomerang)b.boomerangRefund=0;
  // X-E03: sidestepping through a body refunds a second.
  void MOVERS;
}
// Snapshot info for the HUD (charges / recast windows).
export function bookSnapshot(player,id,now){
  const b=player.skills&&player.skills.book;if(!b)return {};
  const r=b.recast[id];
  return {charges:b.charges[id],recastRemaining:r&&now<r.until&&r.left>0?r.until-now:0};
}
// Local visuals the client draws for its own book objects.
export function bookVisuals(player,now){
  const b=player.skills&&player.skills.book;if(!b)return [];
  const out=[];
  if(b.gates&&now<b.gates.until)out.push({kind:'gate',x:b.gates.a.x,y:b.gates.a.y},{kind:'gate',x:b.gates.b.x,y:b.gates.b.y});
  if(b.anchor)out.push({kind:'anchor',x:b.anchor.x,y:b.anchor.y});
  if(b.garden&&now<b.garden.until)out.push({kind:'garden',x:b.garden.x,y:b.garden.y,r:b.garden.r});
  if(b.banner&&now<b.banner.until)out.push({kind:'banner',x:b.banner.x,y:b.banner.y,r:b.banner.r});
  if(modifiers(player.augments).own.causalKnot&&!b.knotUsed&&b.history.length>1&&now-b.history[0].t>=400){
    const back=b.history.find(h=>now-h.t<=3000)||b.history[0];
    out.push({kind:'causalGhost',x:back.x,y:back.y,ready:now-b.history[0].t>=2800,trail:b.history.filter((_,i)=>i%6===0)});
  }
  return out;
}
