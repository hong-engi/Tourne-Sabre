// Server half of the expansion skills, spells and augments (AUGMENT.md).
// Installed onto EnemyArena.prototype: every method runs with `this` = arena.
//
// The client owns movement, extra blades and its own cooldown display; it
// reports each cast as a burst {kind:'cast'|'recast', id, x,y (now), ox,oy
// (before moving), dx,dy (facing)}. The server re-checks the kit and a loose
// cooldown, then owns every number: zones, statuses, shields, heals, buffs.
const rules=require('../../../frontend/src/gameRules');
const {hazardTouches}=require('../../../frontend/src/hazardGeometry');
const {modifiers,stats,specFor,SKILLS,SPELLS}=rules;
const QWER=new Set(SKILLS.map(s=>s.id)),ALL=SKILLS.concat(SPELLS);
const def=id=>ALL.find(s=>s.id===id);
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const kitFor=p=>rules.kitOf({skills:p.loadout,spells:p.spells});
const H=p=>p.hpmax||100;
const SUMMON_POWER={turret:1.35};
// Extra blades the client may draw for the expansion. Power is server-owned.
const SK_BLADES={
  kingsMarch:{power:.65},giantBack:{power:.65},
  nebula:{power:.45},rainbow:{power:.6},heart:{power:.55},gate:{power:.35},
};

function zoneShape(z){return {kind:z.shape==='ring'?'circle':z.shape,x:z.x,y:z.y,r:z.r,angle:z.angle,length:z.len,width:z.w,spread:z.spread};}
function touches(z,e){
  if (!hazardTouches(zoneShape(z),e.x,e.y,e.r||20,0)) return false;
  if (z.ring) return Math.hypot(e.x-z.x,e.y-z.y)>z.r-z.ring-(e.r||20);
  return true;
}

const methods={
  skillInit(){
    this.zones=[];this.walls=[];this.decoys=[];this.knotUsed=this.knotUsed||new Set();
  },
  sk(state){
    if (!state.sk) state.sk={castAt:{},casts:[],guards:[],buffs:[],shots:[],marks:0,hot:null,record:null,parry:null,
      undyingUntil:0,anchor:null,trail:null,beat:null,recasts:{},hits:0,tipHits:0,sevenHits:0,kills:0,smallWins:0,
      distinct:[],icd:{},forge:0,last:{},pendingHeal:0,pendingShield:0,shieldSrc:null,refunds:[],flags:{}};
    return state.sk;
  },
  skillBase(player,mod,sk,now){
    let mult=1;
    for (const b of sk.buffs) if (b.until>now) mult+=b.dmg;
    for (const z of this.zones) if (z.banner&&z.owner===String(player._id)&&now<z.until&&near(z,player)<z.r) mult+=z.banner;
    return stats(player.lv||1,player.augments).damage*mod.damageScale*mult;
  },
  icd(sk,key,ms,now){if (now<(sk.icd[key]||0)) return false;sk.icd[key]=now+ms;return true;},
  // ----- casting -----
  castSkill(player,state,mod,burst,now){
    const id=String(player._id),sk=this.sk(state),kit=kitFor(player),spellId=burst.id;
    if (typeof spellId!=='string'||!kit.includes(spellId)) return;
    const d=def(spellId);if (!d) return;
    if (![burst.x,burst.y,burst.dx,burst.dy].every(Number.isFinite)) return;
    if (near(burst,player)>420) return;
    const recast=burst.kind==='recast';
    if (!recast) {
      const gap=d.cooldown*(QWER.has(spellId)?mod.hasteCooldown:1)*.6*(d.charges?0:1);
      if (now-(sk.castAt[spellId]??-Infinity)<gap) return;
      sk.castAt[spellId]=now;sk.recasts[spellId]=0;
      if (QWER.has(spellId)) {sk.casts.push({id:spellId,at:now});sk.casts=sk.casts.filter(c=>now-c.at<8000);}
      sk.lastCastAt=now;
    }
    const len=Math.hypot(burst.dx,burst.dy)||1,dx=burst.dx/len,dy=burst.dy/len;
    const origin=[burst.ox,burst.oy].every(Number.isFinite)&&Math.hypot(burst.ox-player.x,burst.oy-player.y)<700?{x:burst.ox,y:burst.oy}:{x:burst.x,y:burst.y};
    const ctx={player,id,state,sk,mod,now,dx,dy,pos:{x:burst.x,y:burst.y},origin,burst,base:this.skillBase(player,mod,sk,now)};
    if (sk.tipBuffUntil>now) {ctx.base*=1.35;sk.tipBuffUntil=0;}
    if (recast) return this.recastSkill(ctx,spellId);
    const spec=specFor(spellId,player.augments);
    if (spec) for (const f of spec.fx) this.applyFx(ctx,spellId,f,spec);
    this.castHooks(ctx,spellId,spec);
    this.castAugments(ctx,spellId,spec);
  },
  zoneAt(ctx,f){
    const {dx,dy,pos,origin}=ctx;
    let x=pos.x,y=pos.y;
    if (f.at==='origin') {x=origin.x;y=origin.y;}
    if (f.at==='point') {x+=dx*(f.off||0);y+=dy*(f.off||0);}
    if (f.at==='nearest') {
      const t=this.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-pos.x,e.y-pos.y)<(f.range||300)+e.r)
        .sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y))[0];
      if (!t) return null;
      return {x:t.x,y:t.y,target:t};
    }
    if (f.side) {x+=-dy*f.side;y+=dx*f.side;}
    return {x,y};
  },
  addZone(ctx,skill,f,extra){
    const at=this.zoneAt(ctx,f);if (!at) return null;
    const angle=Math.atan2(ctx.dy,ctx.dx)+(f.angle||0);
    const delay=f.delay||0,ticks=f.ticks||1,every=f.every||0;
    const z=Object.assign({id:`z-${++this.sequence}`,owner:ctx.id,skill,tag:f.tag,shape:f.shape,x:at.x,y:at.y,angle,len:f.len,w:f.w,r:f.r,spread:f.spread,ring:f.ring,
      born:ctx.now,armAt:ctx.now+delay,nextAt:ctx.now+delay,every,ticksLeft:ticks,until:ctx.now+Math.max(delay+every*(ticks-1)+250,f.last?delay+f.last:0),
      power:f.power||0,base:ctx.base,status:f.status,pull:f.pull,low:f.low,mark:f.mark,first:f.first,follow:f.follow,drift:f.drift,dirX:ctx.dx,dirY:ctx.dy,
      once:f.once,hitIds:new Set(),warn:f.warn,target:at.target},extra||{});
    this.zones.push(z);
    if (this.zones.length>400) this.zones.splice(0,this.zones.length-400);
    return z;
  },
  applyFx(ctx,skill,f,spec){
    const {player,sk,now,mod}=ctx,h=H(player);
    if (f.t==='hit') return this.addZone(ctx,skill,f);
    if (f.t==='shield') {this.giveShield(ctx,f.pct*h,f.ms,f.src);return;}
    if (f.t==='heal') {this.giveHeal(ctx,f.pct*h);return;}
    if (f.t==='hot') {sk.hot={pct:f.pct,last:f.last||f.pct,left:f.ticks,nextAt:now+1000,skill};return;}
    if (f.t==='guard') {sk.guards.push({dr:f.dr,until:now+f.ms,thorns:f.thorns||0,count:0,skill});return;}
    if (f.t==='parry') {sk.parry={until:now+f.ms,power:f.power,r:f.r,slow:f.slow,base:ctx.base};return;}
    if (f.t==='buff') {sk.buffs.push({dmg:f.dmg,steal:f.steal||0,until:now+f.ms});sk.buffs=sk.buffs.filter(b=>b.until>now);return;}
    if (f.t==='cost') {sk.hpCost=(sk.hpCost||0)+Math.floor((player.hp||0)*f.pct);return;}
    if (f.t==='shots') {sk.shots.push({r:f.r,until:now+f.ms,left:f.max,skill});return;}
    if (f.t==='wall') {
      const cx=ctx.pos.x+ctx.dx*f.off,cy=ctx.pos.y+ctx.dy*f.off,angle=Math.atan2(ctx.dy,ctx.dx)+Math.PI/2;
      this.walls.push({id:`w-${++this.sequence}`,owner:ctx.id,x:cx-Math.cos(angle)*f.len/2,y:cy-Math.sin(angle)*f.len/2,cx,cy,angle,len:f.len,w:30,until:now+f.ms,nx:ctx.dx,ny:ctx.dy});
      return;
    }
    if (f.t==='sanctum') {this.zones.push({id:`z-${++this.sequence}`,owner:ctx.id,skill,shape:'circle',x:ctx.pos.x,y:ctx.pos.y,r:f.r,born:now,armAt:now,until:now+f.ms,sanctum:{heal:f.heal,dr:f.dr},power:0,ticksLeft:0,hitIds:new Set()});return;}
    if (f.t==='record') {sk.record={until:now+f.ms,taken:0,share:f.share,max:f.max,base:ctx.base};return;}
    if (f.t==='undying') {sk.undyingUntil=now+f.ms;sk.oathSaved=false;sk.oathUntil=now+f.ms;return;}
    if (f.t==='anchor') {sk.anchor={x:ctx.pos.x,y:ctx.pos.y,until:now+f.ms};return;}
    if (f.t==='decoy') {this.decoys.push({id:`d-${++this.sequence}`,owner:ctx.id,x:ctx.pos.x,y:ctx.pos.y,r:f.r,until:now+f.ms});return;}
    if (f.t==='trail') {sk.trail={until:now+f.ms,r:f.r,last:f.last,power:f.power,base:ctx.base,lx:null,ly:null};return;}
    if (f.t==='beat') {sk.beat={until:now+f.ms,power:f.power,used:false,hits:0};return;}
    if (f.t==='banner') {this.zones.push({id:`z-${++this.sequence}`,owner:ctx.id,skill,shape:'circle',x:ctx.pos.x,y:ctx.pos.y,r:f.r,born:now,armAt:now,until:now+f.ms,banner:f.dmg,follow:!!(spec&&spec.follow),power:0,ticksLeft:0,hitIds:new Set()});return;}
    void mod;
  },
  giveShield(ctx,amount,ms,src){
    const sk=ctx.sk,h=H(ctx.player);
    sk.pendingShield=Math.min(.6*h,Math.max(sk.pendingShield||0,Math.round(amount)));
    sk.pendingShieldMs=Math.max(sk.pendingShieldMs||0,ms);
    if (src) {sk.shieldSrc=src;sk.shieldSrcUntil=ctx.now+ms;sk.shieldSrcAmount=amount;}
  },
  giveHeal(ctx,amount){
    const mod=ctx.mod,p=ctx.player;
    const factor=mod.healScale*(mod.brink&&p.hp<=H(p)*.3?1.25:1);
    ctx.sk.pendingHeal=(ctx.sk.pendingHeal||0)+Math.round(amount*factor);
  },
  // Hooks for the original abilities' exclusive augments and the combos.
  castHooks(ctx,skill,spec){
    const {mod,sk,now}=ctx,own=mod.own,f=(o)=>this.addZone(ctx,skill,o);
    if (skill==='reverse'&&own.xQ01) {
      const z=f({shape:'circle',at:'self',follow:true,r:170,delay:300,last:300,power:.8,tag:'afterSpin'});
      // The report is sent before the real blade reverses. The echo keeps
      // that original direction and starts from the completed turn's angle.
      z.spinDirection=ctx.burst.spinDirection===-1?-1:1;
      z.bladeAngle=Number.isFinite(ctx.burst.bladeAngle)?ctx.burst.bladeAngle:ctx.player.sw_angle||0;
    }
    if (skill==='dash'&&own.xE02) f({shape:'circle',at:'point',off:230*mod.momentum,r:130,delay:260,power:1,status:{slow:[.6,1000]}});
    if (skill==='blink'&&own.xD01) f({shape:'circle',at:'origin',r:60,ticks:5,every:200,once:true,power:1,last:1000,tag:'fold'});
    if (skill==='exhaust'&&own.xF03) {
      const t=this.enemies.filter(e=>e.hp>0&&near(e,ctx.pos)<300).sort((a,b)=>near(a,ctx.pos)-near(b,ctx.pos))[0];
      if (t) this.zones.push(Object.assign(f({shape:'circle',at:'self',r:180,ticks:4,every:500,power:0,status:{slow:[.65,600]},last:2000})||{},{x:t.x,y:t.y}));
    }
    if (skill==='crescent'&&own.combo1&&now-(sk.castAt.reverse??-Infinity)<1000) f({shape:'cone',at:'self',len:220,spread:100*Math.PI/180,angle:Math.PI,power:1});
    if (skill==='retreatGust'&&own.combo4&&now-(sk.parryAt||-Infinity)<2000) {
      const z=this.zones.filter(z=>z.owner===ctx.id&&z.skill==='retreatGust'&&z.born===now&&z.power>0);
      z.forEach(z=>{z.power*=1.6;});sk.parryAt=0;
    }
    if (skill==='freezeWave'&&own.combo11&&Number.isFinite(ctx.burst.ax)&&Number.isFinite(ctx.burst.ay)) {
      const z=f({shape:'circle',at:'self',r:160,power:0,status:{root:750,slow:[.55,2750]},tag:'freeze2'});
      if (z) {z.x=ctx.burst.ax;z.y=ctx.burst.ay;}
    }
    if (skill==='rewind'&&own.combo10&&this.icd(sk,'combo10',12000,now)) {
      for (const z of this.zones) if (z.sanctum&&z.owner===ctx.id&&now<z.until&&near(z,ctx.pos)<z.r) z.until+=2000;
    }
    if (skill==='bloodPact') sk.pactUntil=now+4000,sk.pactShield=0;
    if (skill==='bladeVeil') sk.veilUntil=now+4000;
    if (skill==='parryStance') sk.parryCast=now;
    if (skill==='markShot') sk.eyeAt=now;
    if (skill==='chainRush') {sk.rushHit=false;sk.rushStep=0;}
    if (skill==='iaido') {sk.iaido={x:ctx.pos.x,y:ctx.pos.y,angle:Math.atan2(ctx.dy,ctx.dx),hit:false};}
    if (spec&&spec.blades) {sk.activeUntil=sk.activeUntil||{};sk.activeUntil[skill]=now+spec.blades.ms;}
    if (skill==='giant') {sk.activeUntil=sk.activeUntil||{};sk.activeUntil.giant=now+mod.giantDuration;}
    // Shield sources whose breaking or expiry triggers something.
    if (skill==='barrier') {sk.shieldSrc='barrier';sk.shieldSrcUntil=now+3000;}
    if (spec&&spec.after) sk.afterSpeed=spec.after;
  },
  recastSkill(ctx,skill){
    const {sk,now,mod}=ctx,own=mod.own,cast=sk.castAt[skill]??-Infinity,f=(o)=>this.addZone(ctx,skill,o);
    const n=(sk.recasts[skill]||0);
    const within=ms=>now-cast<ms;
    if (skill==='iaido'&&own.xQ08&&n<1&&within(2000)&&sk.iaido&&sk.iaido.hit) {
      sk.recasts[skill]=1;
      this.zones.push({id:`z-${++this.sequence}`,owner:ctx.id,skill,shape:'line',x:sk.iaido.x+Math.cos(sk.iaido.angle)*320,y:sk.iaido.y+Math.sin(sk.iaido.angle)*320,
        angle:sk.iaido.angle+Math.PI,len:320,w:110,born:now,armAt:now,nextAt:now,every:0,ticksLeft:1,until:now+250,power:1.5,base:ctx.base,hitIds:new Set()});
    }
    if (skill==='swordWall'&&own.xW08&&n<1&&within(3000)) {
      sk.recasts[skill]=1;
      const w=this.walls.find(w=>w.owner===ctx.id&&now<w.until);
      if (w) {
        w.until=now;
        for (const s of [1,-1]) this.zones.push({id:`z-${++this.sequence}`,owner:ctx.id,skill,shape:'circle',x:w.cx+w.nx*60*s,y:w.cy+w.ny*60*s,r:120,born:now,armAt:now,nextAt:now,ticksLeft:1,until:now+250,power:1.2,base:ctx.base,hitIds:new Set()});
      }
    }
    if (skill==='chainRush'&&sk.rushHit&&within(2000*(n+1))&&n<(own.xE08?2:1)) {
      sk.recasts[skill]=n+1;sk.rushHit=false;
      f({shape:'line',at:'origin',len:n?140:180,w:80,power:n?.9:1.1});
    }
    if (skill==='beatWalk'&&within(3000)&&n<1) {sk.recasts[skill]=1;sk.beat={until:now+700,power:.6,used:false,hits:(sk.beat&&sk.beat.hits)||0,second:true};}
    if (skill==='markShot'&&within(3000)&&n<1) {
      sk.recasts[skill]=1;sk.eyeDashAt=now;
      if (own.xD05) f({shape:'line',at:'origin',len:Math.max(10,near(ctx.origin,ctx.pos)),w:60,ticks:4,every:500,power:0,status:{slow:[.6,600]},last:2000,tag:'snowPath'});
    }
    if (skill==='anchor'&&within(4000)&&n<1) {
      sk.recasts[skill]=1;
      if (own.xD06) f({shape:'circle',at:'self',r:150,power:1.6,tag:'ripple'});
    }
    if (skill==='turret'&&own.xR02&&n<1&&within(9000)&&Number.isFinite(ctx.burst.tx)&&Number.isFinite(ctx.burst.ty)) {
      sk.recasts[skill]=1;
      const tx=ctx.burst.tx,ty=ctx.burst.ty,angle=Math.atan2(ctx.pos.y-ty,ctx.pos.x-tx),len=Math.hypot(ctx.pos.x-tx,ctx.pos.y-ty);
      if (len<1500) this.zones.push({id:`z-${++this.sequence}`,owner:ctx.id,skill,shape:'line',x:tx,y:ty,angle,len,w:70,born:now,armAt:now,nextAt:now,ticksLeft:1,until:now+300,power:1.4,base:ctx.base,hitIds:new Set()});
    }
    if (skill==='bladeRain'&&own.xR06) for (const z of this.zones) if (z.owner===ctx.id&&z.tag==='rain') z.drift=0;
  },
  // Common/transcendent augments that react to any cast.
  castAugments(ctx,skill,spec){
    const {sk,now,mod,player}=ctx,own=mod.own,isQ=QWER.has(skill);
    const attackZones=this.zones.filter(z=>z.owner===ctx.id&&z.born===now&&z.power>0&&!z.copy);
    if (isQ&&attackZones.length) {
      let echo=0;
      if (own.timeSplitter) echo=.7;
      else if (own.echoArt&&this.icd(sk,'echoArt',8000,now)) echo=.45;
      if (echo) attackZones.forEach(z=>this.zones.push(Object.assign({},z,{id:`z-${++this.sequence}`,armAt:z.armAt+600,nextAt:z.nextAt+600,until:z.until+600,power:z.power*echo,hitIds:new Set(),copy:true})));
    }
    if (own.heatLeft&&rules.MOVERS.includes(skill)&&this.icd(sk,'heatLeft',2000,now))
      this.addZone(ctx,'heatLeft',{shape:'circle',at:'self',r:100,delay:500,power:1,warn:true});
    if (own.dawnForge&&isQ&&sk.forge>0&&this.icd(sk,'dawnForge',2000,now)) {
      const amount=sk.forge;sk.forge=0;
      this.zones.push({id:`z-${++this.sequence}`,owner:ctx.id,skill:'dawnForge',shape:'circle',x:ctx.pos.x,y:ctx.pos.y,r:220,born:now,armAt:now,nextAt:now,ticksLeft:1,until:now+300,power:1,base:amount,hitIds:new Set(),aug:true});
    }
    if (!isQ) return;
    const distinct=n=>ms=>new Set(sk.casts.filter(c=>now-c.at<ms).map(c=>c.id)).size>=n;
    if (own.fillGap&&distinct(2)(2000)&&this.icd(sk,'fillGap',6000,now)) this.giveShield(ctx,.08*H(player),3000);
    if (own.fourBreaths&&distinct(4)(6000)&&this.icd(sk,'fourBreaths',12000,now)) sk.refunds.push({longest:true,pct:.4});
    if (own.endlessDance&&distinct(3)(4000)&&this.icd(sk,'endlessDance',10000,now)) {
      sk.buffs.push({dmg:.25,steal:0,until:now+4000});sk.refunds.push({longest:true,ms:2000});sk.flags.dance=4000;
    }
    if (own.chaosConcert&&distinct(4)(8000)&&this.icd(sk,'chaosConcert',16000,now)) {
      for (let k=0;k<6;k++) {
        const a=k*Math.PI/3;
        this.zones.push({id:`z-${++this.sequence}`,owner:ctx.id,skill:'chaosConcert',shape:'line',x:ctx.pos.x,y:ctx.pos.y,angle:a,len:300,w:60,born:now,armAt:now,nextAt:now,ticksLeft:1,until:now+300,power:1,base:ctx.base,hitIds:new Set(),aug:true});
      }
      this.giveShield(ctx,.2*H(player),4000);sk.buffs.push({dmg:.3,steal:0,until:now+6000});
    }
    void spec;
  },
  // ----- zones, walls, decoys -----
  stepSkills(players,now,dt){
    const byId=new Map(players.map(p=>[String(p._id),p]));
    for (const z of this.zones) {
      const owner=byId.get(z.owner);
      if (z.follow&&owner) {z.x=owner.x;z.y=owner.y;}
      if (z.drift) {z.x+=z.dirX*z.drift*dt;z.y+=z.dirY*z.drift*dt;}
      if (!(z.ticksLeft>0)||now<z.nextAt) continue;
      z.ticksLeft--;z.nextAt+=z.every||0;
      this.fireZone(z,owner,now);
    }
    this.zones=this.zones.filter(z=>now<z.until);
    // Walls shove non-boss enemies out and eat enemy shots.
    for (const w of this.walls) {
      if (now>=w.until) continue;
      const h={kind:'line',x:w.x,y:w.y,angle:w.angle,length:w.len,width:w.w};
      for (const e of this.enemies) {
        if (!(e.hp>0)||e.tier==='boss'||!hazardTouches(h,e.x,e.y,e.r,0)) continue;
        const side=Math.sign((e.x-w.cx)*w.nx+(e.y-w.cy)*w.ny)||1;
        e.x+=w.nx*side*(e.r+w.w/2)*.25;e.y+=w.ny*side*(e.r+w.w/2)*.25;e.pushVx=(e.pushVx||0)*.2;e.pushVy=(e.pushVy||0)*.2;
      }
      for (const s of this.projectiles) if (s.owner==='enemy'&&hazardTouches(h,s.x,s.y,s.r||8,0)) s.until=0;
    }
    this.walls=this.walls.filter(w=>now<w.until);
    this.decoys=this.decoys.filter(d=>now<d.until);
    // Personal projectile guards (W07, X-W12) and R11 slow-time.
    for (const p of players) {
      const id=String(p._id),state=this.attackState.get(id);if (!state||!state.sk) continue;
      const sk=state.sk,mod=modifiers(p.augments);
      for (const g of sk.shots) {
        if (now>=g.until||g.left<=0) continue;
        for (const s of this.projectiles) {
          if (g.left<=0||s.owner!=='enemy'||s.until<=now||Math.hypot(s.x-p.x,s.y-p.y)>g.r+(s.r||8)) continue;
          s.until=0;g.left--;
          if (mod.own.xW07&&g.skill==='mirrorShield') {
            const t=this.enemies.filter(e=>e.hp>0).sort((a,b)=>near(a,p)-near(b,p))[0];
            if (t&&near(t,p)<500) this.damageEnemy(t,Math.round(this.skillBase(p,mod,sk,now)*.8),id,{flags:{aug:'mirror'}},now);
          }
        }
      }
      sk.shots=sk.shots.filter(g=>now<g.until&&g.left>0);
      if (mod.own.xR11) for (const z of this.zones) if (z.owner===id&&z.tag==='garden'&&now<z.until)
        for (const s of this.projectiles) if (s.owner==='enemy'&&!s.slowedBy&&Math.hypot(s.x-z.x,s.y-z.y)<z.r) {s.vx*=.65;s.vy*=.65;s.slowedBy=z.id;}
      // T-06 devourer star pulses.
      if (mod.own.devourerStar&&this.icd(sk,'star',2000,now)) {
        const base=this.skillBase(p,mod,sk,now);
        this.enemies.filter(e=>e.hp>0&&near(e,p)<240+e.r).sort((a,b)=>near(a,p)-near(b,p)).slice(0,5).forEach(e=>{
          this.damageEnemy(e,Math.round(base*.9),id,{flags:{aug:'star'}},now);
          if (e.tier!=='boss'&&e.hp>0) {const d=near(e,p)||1;e.pushVx=(e.pushVx||0)+(p.x-e.x)/d*100;e.pushVy=(e.pushVy||0)+(p.y-e.y)/d*100;}
        });
      }
    }
    // Statuses: bleed ticks.
    for (const e of this.enemies) {
      if (e.hp<=0||!(e.bleedUntil>now)||now<e.bleedTick) continue;
      e.bleedTick+=1000;this.damageEnemy(e,e.bleedDamage,e.bleedBy,{flags:{bleed:true}},now);
    }
  },
  fireZone(z,owner,now){
    if (z.sanctum||z.banner) return;
    const hits=this.enemies.filter(e=>e.hp>0&&touches(z,e)&&!(z.once&&z.hitIds.has(e.id)));
    let list=hits;
    if (z.first&&hits.length) list=[hits.sort((a,b)=>Math.hypot(a.x-z.x,a.y-z.y)-Math.hypot(b.x-z.x,b.y-z.y))[0]];
    if (z.target) list=z.target.hp>0?[z.target]:[];
    const mod=owner?modifiers(owner.augments):null,state=owner?this.combatState(z.owner,owner.lv||1):null,sk=state?this.sk(state):null;
    for (const e of list) {
      z.hitIds.add(e.id);
      if (z.power>0) {
        let power=z.power;
        if (z.low&&e.hp<=e.hpmax*z.low[0]) power+=z.low[1];
        const amount=Math.max(1,Math.round(z.base*power*(e.exposedUntil>now?1.15:1)*(e.wireBy===z.owner&&e.wireUntil>now?1.15:1)));
        if (sk) sk.dealt=(sk.dealt||0)+Math.min(amount,e.hp);
        this.damageEnemy(e,amount,z.owner,{flags:Object.assign({skill:z.skill,fromX:z.x,fromY:z.y},z.aug||z.copy?{aug:z.skill}:{})},now);
        if (sk&&z.skill==='iaido'&&sk.iaido) sk.iaido.hit=true;
        if (sk&&z.skill==='chainRush') sk.rushHit=true;
      }
      if (z.status) this.applyStatus(e,z.status,now,z.owner,z.base);
      if (z.mark) this.applyMark(e,z.mark,z.owner,now,z.base);
      if (z.pull&&e.tier!=='boss') {
        const d=Math.hypot(z.x-e.x,z.y-e.y)||1;
        e.pushVx=(e.pushVx||0)+(z.x-e.x)/d*z.pull*1.5;e.pushVy=(e.pushVy||0)+(z.y-e.y)/d*z.pull*1.5;
        if (z.tag==='whirl') e.whirlAt=now;
        if (sk) sk.balanceReady=true;
      }
    }
    // Q05: both scars → root (X-Q05).
    if (mod&&mod.own.xQ05&&z.skill==='crossScar') for (const e of list) {
      e.crossHits=(e.crossCast===z.born?e.crossHits:0)+1;e.crossCast=z.born;
      if (e.crossHits>=2) this.applyStatus(e,{root:600},now,z.owner,z.base);
    }
    // Q07: three of the first four needles → stun (X-Q07).
    if (mod&&mod.own.xQ07&&z.skill==='needleRain') for (const e of list) {
      if (z.tag==='needle4') {if ((e.needleCast===z.born?e.needles:0)>=3) this.applyStatus(e,{stun:500},now,z.owner,z.base);}
      else {e.needles=(e.needleCast===z.born?e.needles:0)+1;e.needleCast=z.born;}
    }
  },
  applyStatus(e,st,now,by,base){
    const boss=e.tier==='boss';
    // Repeated hard control within 3s halves, then becomes a 30% slow.
    const hard=ms=>{
      e.ccCount=now-(e.ccAt||-Infinity)<3000?(e.ccCount||0)+1:1;e.ccAt=now;
      if (boss||e.ccCount>=3) {e.skSlow=Math.min(e.skSlow&&e.skSlowUntil>now?e.skSlow:1,.7);e.skSlowUntil=Math.max(e.skSlowUntil||0,now+ms);return 0;}
      return e.ccCount===2?ms/2:ms;
    };
    if (st.root) {const ms=hard(st.root);if (ms) {e.stunUntil=Math.max(e.stunUntil||0,now+ms);e.rootedBy=by;e.rootedUntil=now+ms;}}
    if (st.stun) {const ms=hard(st.stun);if (ms) e.stunUntil=Math.max(e.stunUntil||0,now+ms);}
    if (st.slow) {
      const f=st.slow[0];
      if (!(e.skSlowUntil>now)||f<e.skSlow) e.skSlow=f;
      e.skSlowUntil=Math.max(e.skSlowUntil||0,now+st.slow[1]);
    }
    if (st.burn) {
      const dmg=Math.max(1,Math.round(base*st.burn[0]));
      if (!(e.burnUntil>now)||dmg>=(e.burnDamage||0)) this.burn(e,by,dmg,now);
    }
    if (st.bleed) this.bleed(e,by,Math.max(1,Math.round(base*st.bleed[0])),now,st.bleed[1]);
  },
  bleed(e,by,dmg,now,ms=3000){
    if (!(e.bleedUntil>now)) e.bleedTick=now+1000;
    e.bleedUntil=now+ms;e.bleedBy=by;e.bleedDamage=Math.max(e.bleedUntil>now?e.bleedDamage||0:0,dmg);
  },
  applyMark(e,m,by,now,base){
    if (m.tag==='wire') {e.wireBy=by;e.wireUntil=now+m.ms;return;}
    if (m.tag==='eye') {const r=this.reward(by);if (r) r.marks=(r.marks||[]).concat([{id:e.id,x:e.x,y:e.y,tag:'eye'}]);return;}
    e.seal={by,until:now+m.ms,need:m.hits,hits:0,power:m.power,base};
  },
  skillSpeedFactor(e,now){
    if (e.stunUntil>now) return 0;
    return e.skSlowUntil>now?e.skSlow:1;
  },
  // Decoys draw non-boss enemies within range.
  decoyFor(e,now){
    if (e.tier) return null;
    for (const d of this.decoys) if (now<d.until&&Math.hypot(d.x-e.x,d.y-e.y)<d.r) return {_id:`decoy-${d.id}`,x:d.x,y:d.y,r:20,hp:1,decoy:true};
    return null;
  },
  // ----- incoming damage to players -----
  shapeIncoming(players,damage,now){
    const byId=new Map(players.map(p=>[String(p._id),p]));
    const out=[];
    for (const ev of damage) {
      const p=byId.get(String(ev.id));
      const state=p&&this.attackState.get(String(ev.id));
      if (!p||!state) {out.push(ev);continue;}
      const sk=this.sk(state),mod=modifiers(p.augments),own=mod.own,id=String(ev.id),h=H(p);
      let amount=ev.amount;
      // W02 parry window: block completely and counter.
      if (sk.parry&&now<sk.parry.until) {
        sk.parry.until=0;sk.parryAt=now;
        const pr=sk.parry;
        this.zones.push({id:`z-${++this.sequence}`,owner:id,skill:'parryStance',shape:'circle',x:p.x,y:p.y,r:pr.r,born:now,armAt:now,nextAt:now,ticksLeft:1,until:now+250,power:pr.power,base:pr.base,status:pr.slow?{slow:pr.slow}:null,hitIds:new Set()});
        continue;
      }
      let dr=0;
      for (const g of sk.guards) if (now<g.until) {
        dr=1-(1-dr)*(1-g.dr);
        if (g.thorns) {
          const e=this.enemies.find(x=>ev.source&&x.hp>0&&near(x,p)<200);
          if (e&&now>=(g.thornAt||0)) {
            g.thornAt=now+500;this.damageEnemy(e,Math.round(this.skillBase(p,mod,sk,now)*g.thorns),id,{flags:{thorns:true}},now);
            g.count++;if (own.xW09&&g.count%5===0&&(g.extended||0)<2000) {g.until+=500;g.extended=(g.extended||0)+500;}
          }
        }
      }
      for (const z of this.zones) if (z.sanctum&&z.owner===id&&now<z.until&&near(z,p)<z.r) dr=1-(1-dr)*(1-z.sanctum.dr);
      if (own.toughen&&now<(sk.toughUntil||0)) dr=1-(1-dr)*.92;
      dr=Math.min(rules.CAPS.damageReduction,dr);
      amount=amount*(1-dr);
      if (own.crisisSplit&&amount>=.15*h&&this.icd(sk,'crisis',8000,now)) amount*=.75;
      if (own.toughen&&this.icd(sk,'toughen',5000,now)) sk.toughUntil=now+2000;
      amount=Math.round(amount);
      const shield=p.shieldUntil>now?p.shield||0:0;
      const lethal=amount>=(p.hp||0)+shield;
      // Survival order: oath, life anchor, causal knot (immortal stays in resolveDamage).
      if (lethal&&now<sk.undyingUntil) {amount=Math.max(0,(p.hp||1)-1+shield);sk.oathSaved=true;}
      else if (lethal&&sk.anchor&&now<sk.anchor.until&&now>=(sk.saveLock||0)) {
        const a=sk.anchor;sk.anchor=null;sk.saveLock=now+10000;
        this.playerCorrections.push({id,dx:a.x-p.x,dy:a.y-p.y,dvx:0,dvy:0});
        amount=Math.max(0,(p.hp||1)-Math.round(.2*h)+shield);
        this.invulnerableUntil.set(id,now+500);
        if (own.xF11) sk.pendingShield=Math.max(sk.pendingShield||0,Math.round(.15*h)),sk.pendingShieldMs=2000;
      } else if (lethal&&own.causalKnot&&!this.knotUsed.has(id)&&now>=(sk.saveLock||0)) {
        this.knotUsed.add(id);sk.saveLock=now+10000;
        const trail=this.trails.get(id)||[],back=trail.find(t=>now-t.t<=3000)||{x:p.x,y:p.y};
        this.playerCorrections.push({id,dx:back.x-p.x,dy:back.y-p.y,dvx:0,dvy:0});
        amount=Math.max(0,(p.hp||1)-Math.round(.35*h)+shield);
        this.invulnerableUntil.set(id,now+1000);
      }
      // Shield breaks (W03 X, F02 X).
      if (shield>0&&amount>=shield&&sk.shieldSrc&&now<sk.shieldSrcUntil) {
        const base=this.skillBase(p,mod,sk,now);
        if (sk.shieldSrc==='veil'&&own.xW03) this.zones.push({id:`z-${++this.sequence}`,owner:id,skill:'bladeVeil',shape:'circle',x:p.x,y:p.y,r:150,born:now,armAt:now,nextAt:now,ticksLeft:1,until:now+250,power:1,base,hitIds:new Set(),aug:true});
        if (sk.shieldSrc==='barrier'&&own.xF02) this.enemies.filter(e=>e.hp>0&&near(e,p)<400).sort((a,b)=>near(a,p)-near(b,p)).slice(0,4).forEach(e=>this.damageEnemy(e,Math.round(base*.8),id,{flags:{aug:'barrierShard'}},now));
        sk.shieldSrc=null;
      }
      const hpLoss=Math.max(0,amount-shield);
      if (sk.record&&now<sk.record.until) sk.record.taken+=hpLoss;
      if (own.xW10) for (const z of this.zones) if (z.sanctum&&z.owner===id&&now<z.until&&near(z,p)<z.r) {
        z.lost=(z.lost||0)+hpLoss;
        while (z.lost>=.1*h&&(z.bells||0)<3) {z.lost-=.1*h;z.bells=(z.bells||0)+1;
          this.zones.push({id:`z-${++this.sequence}`,owner:id,skill:'sanctuary',shape:'circle',x:z.x,y:z.y,r:160,born:now,armAt:now,nextAt:now,ticksLeft:1,until:now+250,power:1.2,base:this.skillBase(p,mod,sk,now),hitIds:new Set(),aug:true});}
      }
      if (own.escape&&(p.hp||0)-hpLoss<.35*h&&(p.hp||0)>=.35*h&&this.icd(sk,'escape',20000,now))
        for (const e of this.enemies) if (e.hp>0&&near(e,p)<200+e.r) {
          this.applyStatus(e,{slow:[.3,1000]},now,id,0);
          if (e.tier!=='boss') {const d=near(e,p)||1;e.pushVx=(e.pushVx||0)+(e.x-p.x)/d*500;e.pushVy=(e.pushVy||0)+(e.y-p.y)/d*500;}
        }
      if (amount>0) out.push(Object.assign({},ev,{amount}));
    }
    return out;
  },
  // ----- per-attack bookkeeping -----
  // Extra multiplier and side effects for one sword strike. Returns the factor.
  strikeHooks(player,state,mod,e,ctx){
    const sk=this.sk(state),own=mod.own,now=ctx.now,id=String(player._id);
    let factor=1;
    for (const b of sk.buffs) if (b.until>now) factor+=b.dmg;
    for (const z of this.zones) if (z.banner&&z.owner===id&&now<z.until&&near(z,player)<z.r) factor+=z.banner;
    if (e.exposedUntil>now) factor*=1.15;
    if (e.wireBy===id&&e.wireUntil>now) factor*=1.15;
    if (ctx.main&&sk.beat&&now<sk.beat.until&&!sk.beat.used) {ctx.extra+=sk.beat.power;sk.beat.used=true;sk.beat.hits++;
      if (own.xE11&&sk.beat.second&&sk.beat.hits>=2) sk.refunds.push({id:'beatWalk',ms:2000});}
    if (own.weakSpot&&this.random()<.15) {factor*=1.5;e.exposedUntil=now+3000;}
    if (own.balance&&sk.balanceReady&&this.icd(sk,'balance',2000,now)) {sk.balanceReady=false;ctx.extra+=.4;}
    if (own.healToHarm&&sk.harmReady&&ctx.main) {sk.harmReady=false;ctx.extra+=2.5;}
    if (own.frostlet&&ctx.main&&this.icd(sk,'frostlet',2000,now)) this.applyStatus(e,{slow:[.8,800]},now,id,0);
    if (own.combo5&&ctx.main&&ctx.thrust&&now-(sk.eyeDashAt||-Infinity)<1000&&e.combo5!==sk.eyeDashAt) {e.combo5=sk.eyeDashAt;ctx.extra+=1.2;}
    if (own.xF08&&ctx.main&&e.rootedBy===id&&e.rootedUntil>now&&!e.iceBroken) {e.iceBroken=true;ctx.extra+=1.2;}
    if (own.xQ02&&ctx.main&&ctx.thrust&&ctx.tip) this.bleed(e,id,Math.round(ctx.base*.45),now,3000);
    if (own.glance&&ctx.main&&ctx.inner&&this.icd(sk,'glance',4000,now)) this.giveShield({sk,player,now},.04*H(player),2000);
    if (ctx.main&&ctx.tip&&own.tipWatch&&++sk.tipHits>=5) {sk.tipHits=0;sk.tipBuffUntil=now+4000;}
    if (own.kindling) {const k=e.kindle&&e.kindle.by===id?e.kindle:{by:id,n:0,at:0};k.n++;if (k.n>=4&&now>=k.at){k.n=0;k.at=now+4000;this.burn(e,id,Math.max(1,Math.round(ctx.base*.2)),now);}e.kindle=k;}
    if (own.xF04&&e.burnUntil>now&&state.igniteUntil>now) {const r=e.reignite&&e.reignite.by===id?e.reignite:{by:id,n:0,done:false};r.n++;if (r.n>=3&&!r.done){r.done=true;ctx.after.push(()=>this.damageEnemy(e,Math.round(ctx.base),id,{flags:{aug:'reignite'}},now));}e.reignite=r;}
    if (own.xE01&&ctx.skill.fast&&!sk.accelDone) {sk.accelSet=sk.accelSet||new Set();sk.accelSet.add(e.id);if (sk.accelSet.size>=3){sk.accelDone=true;sk.flags.accelPlus=800;}}
    if (!ctx.skill.fast) {sk.accelDone=false;sk.accelSet=null;}
    if (ctx.main) {
      sk.hits++;
      if (own.nebula&&sk.hits%8===0&&this.icd(sk,'nebula',5000,now)) {sk.nebulaUntil=now+3000;sk.flags.nebula=3000;}
      if (own.rainbowKing&&++sk.sevenHits>=7&&this.icd(sk,'rainbow',1500,now)) {
        sk.sevenHits=0;
        this.zones.push({id:`z-${++this.sequence}`,owner:id,skill:'rainbowKing',shape:'circle',x:e.x,y:e.y,r:150,born:now,armAt:now,nextAt:now,ticksLeft:1,until:now+300,power:1.6,base:ctx.base,hitIds:new Set(),aug:true});
      }
      sk.distinct=sk.distinct.filter(d=>now-d.at<1000);
      if (!sk.distinct.some(d=>d.id===e.id)) sk.distinct.push({id:e.id,at:now});
      if (own.turnEconomy&&new Set(sk.distinct.map(d=>d.id)).size>=5&&this.icd(sk,'turn',4000,now)) {sk.distinct=[];sk.refunds.push({longest:true,ms:1000});}
      if (own.outStep&&this.icd(sk,'outStep',2000,now)) sk.flags.outStep=1000;
    }
    // Q11 seal: three direct hits pop it.
    if (ctx.main&&e.seal&&e.seal.by===id&&e.seal.until>now&&++e.seal.hits>=e.seal.need) {
      const s=e.seal;e.seal=null;
      ctx.after.push(()=>{
        const amount=Math.round(s.base*s.power);
        this.damageEnemy(e,amount,id,{flags:{skill:'bloodSeal'}},now);
        if (own.xQ11) this.enemies.filter(o=>o!==e&&o.hp>0&&near(o,e)<120+o.r).forEach(o=>this.damageEnemy(o,Math.round(s.base),id,{flags:{aug:'seal'}},now));
        if (own.combo9&&now<(sk.pactUntil||0)) {const add=Math.min(.2*amount,.15*H(player)-(sk.pactShield||0));if (add>0){sk.pactShield=(sk.pactShield||0)+add;sk.shieldAdd=(sk.shieldAdd||0)+add;}}
      });
    }
    // R10 X: stored damage on survivors.
    if (e.stay&&e.stay.by===id&&e.stay.until>now) e.stay.stored+=ctx.base*.2;
    return factor;
  },
  // Everything a /enemy/attack response carries for the expansion.
  attackExtras(player,state,mod,result,now){
    const id=String(player._id),sk=this.sk(state),own=mod.own,h=H(player);
    const ctx={player,sk,mod,now,id};
    let heal=sk.pendingHeal||0;sk.pendingHeal=0;
    if (sk.hot&&sk.hot.left>0&&now>=sk.hot.nextAt) {
      sk.hot.left--;sk.hot.nextAt+=1000;
      const pct=sk.hot.left===0?sk.hot.last:sk.hot.pct;
      heal+=Math.round(pct*h*mod.healScale);
    }
    for (const z of this.zones) if (z.sanctum&&z.owner===id&&now<z.until&&near(z,player)<z.r&&now>=(z.healAt||0)) {z.healAt=now+1000;heal+=Math.round(z.sanctum.heal*h*mod.healScale);}
    if (sk.record&&now>=sk.record.until) {
      const r=sk.record;sk.record=null;
      const back=Math.min(r.taken*r.share,r.max*h)*mod.healScale;heal+=Math.round(back);
      if (own.xW11&&back>0) this.zones.push({id:`z-${++this.sequence}`,owner:id,skill:'timeShell',shape:'circle',x:player.x,y:player.y,r:180,born:now,armAt:now,nextAt:now,ticksLeft:1,until:now+250,power:1,base:Math.min(back*2,3*r.base),hitIds:new Set(),aug:true});
    }
    if (sk.oathUntil&&now>=sk.oathUntil) {if (sk.oathSaved&&own.xF09) heal+=Math.round(.12*h);sk.oathUntil=0;}
    if (own.tidy&&this.icd(sk,'tidy',8000,now)) heal+=Math.round(.02*h*mod.healScale);
    if (own.sheath&&now-(sk.lastCastAt||0)>=3000&&this.icd(sk,'sheath',6000,now)) this.giveShield(ctx,.06*h,3000);
    // Kill-driven commons.
    const kills=result.kills||0;
    if (kills) {
      if (own.spoilsOrb) {const n=Math.min(kills,2);if (this.icd(sk,'orbs',1000/Math.max(1,n),now)) heal+=Math.round(n*.02*h*mod.healScale);}
      if (own.smallWin) {sk.kills+=kills;while (sk.kills>=15&&sk.smallWins<10){sk.kills-=15;sk.smallWins++;heal+=5;}}
    }
    // Lifesteal from buffs (F07): direct 15%, damage over time a third.
    const steal=sk.buffs.filter(b=>b.until>now).reduce((m,b)=>Math.max(m,b.steal),0);
    if (steal&&sk.dealt) heal+=Math.min(Math.round(sk.dealt*steal),Math.round(.1*h));
    sk.dealt=0;
    // W06 X / F12 X: shield left at expiry turns into health.
    if (sk.shieldSrc&&now>=sk.shieldSrcUntil) {
      const left=player.shieldUntil>now-200?player.shield||0:0;
      if (sk.shieldSrc==='pact'&&own.xW06) heal+=Math.round(left*.7);
      if (sk.shieldSrc==='dawn'&&own.xF12) heal+=Math.min(Math.round(left*.5),Math.round(.1*h));
      sk.shieldSrc=null;
    }
    // X-W04 speed after iron stance, X-D07, etc. are client flags.
    if (heal>0) {
      if (own.healToHarm&&this.icd(sk,'harm',5000,now)) sk.harmReady=true;
      if (own.dawnForge) sk.forge=Math.min(4*this.skillBase(player,mod,sk,now),(sk.forge||0)+heal*2);
    }
    if (heal&&own.xF01) {/* overflow handled where hp is known (route) */}
    const extra={heal,shield:sk.pendingShield||0,shieldMs:sk.pendingShieldMs||0,shieldAdd:Math.round(sk.shieldAdd||0),hpCost:sk.hpCost||0,refunds:sk.refunds,flags:sk.flags};
    sk.pendingShield=0;sk.pendingShieldMs=0;sk.shieldAdd=0;sk.hpCost=0;sk.refunds=[];sk.flags={};
    return extra;
  },
  // Trails (E12) sample the player's position on each attack.
  sampleTrail(player,state,now){
    const sk=this.sk(state),t=sk.trail;if (!t||now>=t.until) return;
    if (t.lx!==null&&Math.hypot(player.x-t.lx,player.y-t.ly)<60) return;
    t.lx=player.x;t.ly=player.y;
    const crossed=modifiers(player.augments).own.xE12;
    this.zones.push({id:`z-${++this.sequence}`,owner:String(player._id),skill:'stormTrail',shape:'circle',x:player.x,y:player.y,r:t.r,born:now,armAt:now,nextAt:now,every:1000,ticksLeft:2,until:now+t.last,power:t.power*(crossed?1:1),base:t.base,hitIds:new Set()});
  },
  onSkillKill(e,credit,killer,mod,now,flags){
    if (!mod||!killer) return;
    const state=this.attackState.get(credit);if (!state) return;
    const sk=this.sk(state),own=mod.own;
    if (own.scarCollector&&(e.burnUntil>now||e.bleedUntil>now)&&this.icd(sk,'scar',500,now)) sk.pendingHeal=(sk.pendingHeal||0)+Math.round(.03*(killer.hpmax||100));
    if (own.xF10&&flags&&flags.burn&&e.burnUntil>now&&!e.spreadBurn) this.enemies.filter(o=>o!==e&&o.hp>0&&near(o,e)<160).slice(0,2).forEach(o=>{this.burn(o,credit,e.burnDamage,now);o.spreadBurn=true;});
    if (own.doom&&!(flags&&flags.aug)&&this.icd(sk,'doom',10000,now))
      this.zones.push({id:`z-${++this.sequence}`,owner:credit,skill:'doom',shape:'circle',x:e.x,y:e.y,r:240,born:now,armAt:now+1000,nextAt:now+1000,ticksLeft:1,until:now+1300,power:3.5,base:stats(killer.lv||1,killer.augments).damage*mod.damageScale,hitIds:new Set(),aug:true,warn:true});
    if (own.xD03&&flags&&flags.smite) sk.refunds.push({id:'smite',ms:3000});
  },
  skillBladeAllowed(blade,player,mod){
    const m=/^sk-([a-zA-Z]+)-\d+$/.exec(blade);if (!m) return null;
    const kind=m[1],state=this.attackState.get(String(player._id)),sk=state&&state.sk,now=this.lastTime??0,own=mod.own;
    const active=id=>sk&&sk.activeUntil&&now<(sk.activeUntil[id]||0)+500;
    if (kind==='kingsMarch') return active(kind)?SK_BLADES[kind].power*(kind==='kingsMarch'&&own.xR12?1.8:1):0;
    if (kind==='giantBack') return own.xW01&&active('giant')?.65:0;
    if (kind==='nebula') return own.nebula&&sk&&now<(sk.nebulaUntil||0)+500?.45:0;
    if (kind==='rainbow') return own.rainbowKing?.6:0;
    if (kind==='heart') return own.workshopHeart?.55:0;
    if (kind==='gate') return own.combo12?.35:0;
    return 0;
  },
};
// Turret blades gain T-04's bonus.
function install(Arena){Object.assign(Arena.prototype,methods);}
module.exports={install,SUMMON_POWER,SK_BLADES};
