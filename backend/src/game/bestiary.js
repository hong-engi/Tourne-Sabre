// New enemies (ENEMIES.md 01-35). EnemyArena owns the shared systems
// (hazards, parts, damage hooks, spawning); this file owns each type's stats
// and behaviour. Every big attack follows the same contract: an attack is
// announced by a hazard whose shape is drawn from armAt-windup until armAt,
// and only deals damage while armed.
const TAU=Math.PI*2;
const DEG=Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

// tier: normal (random spawns), elite/boss (threat-level encounters), part
// (pieces and summons that belong to another enemy: no XP, no kill effects).
// unlock: first threat level at which a normal type joins the spawn pool.
const SPECS={
  shellback: {r:26,hp:40,speed:45,xp:70,contact:12,unlock:2,mass:1.6},
  lancer:    {r:20,hp:28,speed:55,xp:60,contact:9, unlock:1},
  sickler:   {r:19,hp:24,speed:70,xp:55,contact:8, unlock:2},
  flea:      {r:16,hp:20,speed:80,xp:45,contact:8, unlock:1,mass:.7},
  shroom:    {r:24,hp:34,speed:35,xp:55,contact:10,unlock:3},
  lantern:   {r:22,hp:30,speed:95,xp:65,contact:8, unlock:3},
  leech:     {r:15,hp:22,speed:95,xp:0, contact:10,unlock:Infinity,mass:.6},
  bell:      {r:26,hp:44,speed:30,xp:70,contact:10,unlock:4,mass:2},
  banner:    {r:18,hp:18,speed:65,xp:50,contact:6, unlock:2},
  mender:    {r:19,hp:26,speed:78,xp:60,contact:6, unlock:4},
  brood:     {r:23,hp:36,speed:40,xp:65,contact:10,unlock:4},
  magnet:    {r:30,hp:60,speed:30,xp:85,contact:14,unlock:5,mass:2.4},
  seeder:    {r:21,hp:26,speed:45,xp:55,contact:8, unlock:3},
  roller:    {r:22,hp:30,speed:50,xp:60,contact:9, unlock:2},
  shotbug:   {r:20,hp:26,speed:60,xp:55,contact:8, unlock:3},
  hound:     {r:19,hp:26,speed:145,xp:55,contact:11,unlock:3},
  skeleton:  {r:23,hp:34,speed:32,xp:65,contact:12,unlock:4},
  salamander:{r:22,hp:32,speed:55,xp:60,contact:10,unlock:4},
  sculptor:  {r:21,hp:30,speed:40,xp:60,contact:8, unlock:5},
  herald:    {r:18,hp:22,speed:60,xp:50,contact:6, unlock:3},
  balloon:   {r:19,hp:24,speed:70,xp:60,contact:6, unlock:5},
  snail:     {r:22,hp:40,speed:32,xp:55,contact:9, unlock:3,mass:1.6},
  masker:    {r:19,hp:28,speed:60,xp:60,contact:10,unlock:5},
  // Elites
  warden:    {r:34,hp:150,speed:68,xp:300,contact:16,tier:'elite',mass:3},
  gatekeeper:{r:28,hp:110,speed:74,xp:180,contact:14,tier:'elite',mass:2.5},
  duelist:   {r:24,hp:130,speed:60,xp:280,contact:12,tier:'elite'},
  alchemist: {r:24,hp:140,speed:45,xp:280,contact:10,tier:'elite'},
  // Bosses
  swordsaint:{r:40,hp:520,speed:42,xp:1500,contact:18,tier:'boss',mass:6},
  rootcrown: {r:48,hp:560,speed:0, xp:1700,contact:16,tier:'boss',mass:60,fixed:true},
  forge:     {r:42,hp:560,speed:35,xp:1600,contact:18,tier:'boss',mass:6},
  stormray:  {r:40,hp:520,speed:70,xp:1600,contact:16,tier:'boss',mass:5},
  maestro:   {r:36,hp:520,speed:45,xp:1600,contact:14,tier:'boss',mass:5},
  crab:      {r:46,hp:600,speed:30,xp:1700,contact:18,tier:'boss',mass:8},
  centipede: {r:30,hp:620,speed:90,xp:1700,contact:16,tier:'boss',mass:6},
  // Parts and summons
  egg:       {r:12,hp:8, speed:0,xp:0,contact:0,tier:'part',mass:60,fixed:true},
  pillar:    {r:26,hp:25,speed:0,xp:0,contact:0,tier:'part',mass:60,fixed:true,blocksShots:true},
  balloonPart:{r:12,hp:6,speed:0,xp:0,contact:0,tier:'part',passThrough:true},
  decoy:     {r:19,hp:1, speed:60,xp:0,contact:0,tier:'part'},
  stake:     {r:14,hp:30,speed:0,xp:0,contact:0,tier:'part',mass:60,fixed:true},
  knot:      {r:22,hp:60,speed:0,xp:0,contact:0,tier:'part',mass:60,fixed:true},
  resobell:  {r:16,hp:30,speed:0,xp:0,contact:0,tier:'part',mass:60,fixed:true},
  cannon:    {r:16,hp:70,speed:0,xp:0,contact:0,tier:'part',passThrough:true},
  debris:    {r:24,hp:20,speed:0,xp:0,contact:0,tier:'part',mass:60,fixed:true,blocksShots:true},
  segment:   {r:24,hp:1, speed:0,xp:0,contact:14,tier:'part',passThrough:true,sharesHp:true},
  bannerFlag:{r:16,hp:20,speed:0,xp:0,contact:0, tier:'part',mass:60,fixed:true},
  forgeTurret:{r:16,hp:35,speed:0,xp:0,contact:0,tier:'part',mass:60,fixed:true},
};
// Timer fields shifted forward while the room is paused for augment choices.
const TIME_FIELDS=['phaseUntil','nextShot','nextAttack','nextSpecial','expireAt','hatchAt','regrowAt','exposedUntil',
  'leapAt','leapStart','arriveAt','cooledUntil','guardUntil','echoAt','vulnerableUntil','lootAt','blockFlashUntil','pulseAt','trailAt','thrustStart','tpAt'];
const ELITES=['warden','gatekeeper','duelist','alchemist'];
const BOSSES=['swordsaint','forge','maestro','rootcrown','stormray','crab','centipede'];
// Elite at threat 3, 8, 13...; boss at 5, 10, 15... (one each per room run).
function encounterFor(level){
  if (level>=5 && level%5===0) return {tier:'boss',type:BOSSES[(level/5-1)%BOSSES.length]};
  if (level>=3 && level%5===3) return {tier:'elite',type:ELITES[((level-3)/5)%ELITES.length]};
  return null;
}

function phase(e,name,ms,now){e.phase=name;e.phaseUntil=now+ms;}
function stop(e){e.vx=0;e.vy=0;}
function chase(e,c,k=1){e.vx=c.nx*c.base*k;e.vy=c.ny*c.base*k;}
function keepRange(e,c,want,band=80,strafe=.6){
  const radial=clamp((c.dist-want)/band,-1,1),s=Math.sin(c.now/1500+e.seed)*strafe;
  e.vx=(c.nx*radial-c.ny*s)*c.base;e.vy=(c.ny*radial+c.nx*s)*c.base;
}
function aimAt(e,c){e.aimX=c.nx;e.aimY=c.ny;e.facing=Math.atan2(c.ny,c.nx);}
// Turn toward the target at a limited rate (shellback, magnet golem).
function turnToward(e,c,rate){
  const want=Math.atan2(c.ny,c.nx),cur=e.facing??want;
  e.facing=cur+clamp(angleDiff(want,cur),-rate*c.dt,rate*c.dt);
  e.aimX=Math.cos(e.facing);e.aimY=Math.sin(e.facing);
}
function dmg(A,e,base,now){return A.outgoing(e,base*(e.power||1),now);}
// The windup → (active) → recover → hunt loop shared by most attackers.
function cycle(A,e,c,o){
  const now=c.now;
  if (e.phase==='windup'&&now>=e.phaseUntil) {o.strike&&o.strike();if (o.active) phase(e,'active',o.active,now);else phase(e,'recover',o.recover,now);}
  else if (e.phase==='active'&&now>=e.phaseUntil) phase(e,'recover',o.recover,now);
  else if (e.phase==='recover'&&now>=e.phaseUntil) {e.phase='hunt';e.nextAttack=now+(o.cooldown||0);}
  if (e.phase==='hunt'&&now>=(e.nextAttack||0)&&o.ready()) {
    phase(e,'windup',o.windup,now);e.targetId=String(c.p._id);o.start&&o.start();
  }
  return e.phase;
}

const AI={
  // 01 Shellback: a front shield that turns slowly; flank it or bait the bash.
  shellback(A,e,c){
    if (e.phase==='hunt') turnToward(e,c,1.1);
    cycle(A,e,c,{windup:700,recover:1000,cooldown:900,ready:()=>c.dist<130,
      start:()=>A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:120,width:56,armAt:c.now+700,until:c.now+850,damage:dmg(A,e,16,c.now)})});
    e.guarding=e.phase!=='recover';
    if (e.phase==='hunt') chase(e,c);else stop(e);
  },
  // 02 Lancer: stops at mid range, thrusts in a locked line, long recovery.
  lancer(A,e,c){
    cycle(A,e,c,{windup:450,active:360,recover:850,cooldown:600,ready:()=>c.dist<280,
      start:()=>{aimAt(e,c);A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:270,width:26,armAt:c.now+450,until:c.now+810,damage:dmg(A,e,18,c.now),bar:true});},
      strike:()=>{e.thrustStart=c.now;}});
    if (e.phase==='hunt') {keepRange(e,c,220,70,.4);aimAt(e,c);} else stop(e);
  },
  // 03 Sickler: the sickle flies out, pierces, and zips back along the same line.
  sickler(A,e,c){
    cycle(A,e,c,{windup:600,active:1390,recover:500,cooldown:1200,ready:()=>c.dist<420,
      start:()=>{aimAt(e,c);A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:340,width:24,armAt:c.now+600,until:c.now+600,damage:0,telegraph:true,bar:true});},
      strike:()=>A.addShot(e,{kind:'sickle',x:e.x+e.aimX*(e.r+8),y:e.y+e.aimY*(e.r+8),vx:e.aimX*340,vy:e.aimY*340,r:11,
        damage:dmg(A,e,13,c.now),until:c.now+1390,returnAt:c.now+950,returnSpeed:2.2,pierce:true})});
    e.unarmed=e.phase==='active';
    if (e.phase==='hunt') {keepRange(e,c,320,90);aimAt(e,c);} else stop(e);
  },
  // 04 Flea: marks the landing spot, leaps there smoothly, sits stunned after landing.
  flea(A,e,c){
    const now=c.now;
    if (e.phase==='leap') {
      const dur=Math.max(.05,(e.phaseUntil-e.leapStart)/1000);
      if (now>=e.phaseUntil) {
        e.x=e.leapToX;e.y=e.leapToY;stop(e);
        e.airborne=false;e.passThrough=false;phase(e,'recover',750,now);
      } else {
        e.vx=(e.leapToX-e.leapFromX)/dur;e.vy=(e.leapToY-e.leapFromY)/dur;
      }
      return;
    }
    if (e.phase==='recover'&&now>=e.phaseUntil) {e.phase='hunt';e.nextAttack=now+900;}
    if (e.phase==='windup'&&now>=e.phaseUntil) {
      e.phase='leap';e.leapStart=now;e.phaseUntil=now+550;e.airborne=true;e.passThrough=true;
      e.leapFromX=e.x;e.leapFromY=e.y;
      e.vx=(e.leapToX-e.leapFromX)/.55;e.vy=(e.leapToY-e.leapFromY)/.55;
      return;
    }
    // Only one flea per player is in the air or crouching at a time.
    const busy=A.enemies.some(o=>o!==e&&o.type==='flea'&&o.targetId===String(c.p._id)&&(o.phase==='windup'||o.phase==='leap'));
    if (e.phase==='hunt'&&now>=(e.nextAttack||0)&&c.dist<330&&!busy) {
      phase(e,'windup',350,now);e.targetId=String(c.p._id);e.leapToX=c.p.x;e.leapToY=c.p.y;aimAt(e,c);
      A.addHazard(e,{kind:'circle',x:c.p.x,y:c.p.y,r:58,armAt:now+900,until:now+1000,damage:dmg(A,e,14,now)});
    }
    if (e.phase==='hunt') {keepRange(e,c,200,80,.9);if (Math.hypot(e.vx,e.vy)>1) e.facing=Math.atan2(e.vy,e.vx);} else stop(e);
  },
  // 05 Crack shroom: plants large long-lived poison patches and teleports away.
  shroom(A,e,c){
    cycle(A,e,c,{windup:900,recover:700,cooldown:2600,ready:()=>c.dist<280&&A.hazardCount(e.id)<3,
      start:()=>A.addHazard(e,{kind:'circle',x:e.x,y:e.y,r:165,armAt:c.now+900,until:c.now+9900,damage:1,tick:true,tickMs:250,poison:true}),
      strike:()=>{
        e.tpFromX=e.x;e.tpFromY=e.y;e.tpAt=c.now;
        const curA=Math.atan2(e.y-c.p.y,e.x-c.p.x),side=A.random()<.5?1:-1;
        const a=curA+side*(1.5+A.random()*1.0),d=220+A.random()*80;
        e.x=clamp(c.p.x+Math.cos(a)*d,-2850,2850);e.y=clamp(c.p.y+Math.sin(a)*d,-2850,2850);
      }});
    if (e.phase==='hunt') chase(e,c);else stop(e);
  },
  // 06 Lantern jelly: shell closed (armoured) / open (pulse + 4-way volley, then exposed).
  lantern(A,e,c){
    const now=c.now;
    if (e.pulseAt&&now>=e.pulseAt) {
      e.pulseAt=0;
      const baseA=Math.atan2(c.ny,c.nx);
      for (let i=0;i<4;i++) {
        const a=baseA+i*Math.PI/2;
        A.addShot(e,{kind:'lantern',x:e.x+Math.cos(a)*(e.r+6),y:e.y+Math.sin(a)*(e.r+6),vx:Math.cos(a)*240,vy:Math.sin(a)*240,r:9,damage:dmg(A,e,11,now),until:now+2400});
      }
    }
    if (!e.phaseUntil||now>=e.phaseUntil) {
      if (e.phase==='open') phase(e,'closed',2200,now);
      else {
        phase(e,'open',1700,now);
        e.pulseAt=now+550;
        A.addHazard(e,{kind:'circle',x:e.x,y:e.y,r:135,armAt:now+550,until:now+700,damage:dmg(A,e,12,now)});
      }
    }
    e.armor=e.phase==='open'?1.5:.3;
    const s=Math.sin(now/900+e.seed);
    if (e.phase==='open') stop(e);else {e.vx=(c.nx*clamp((c.dist-150)/80,-1,1)-c.ny*s)*c.base;e.vy=(c.ny*clamp((c.dist-150)/80,-1,1)+c.nx*s)*c.base;}
  },
  // 07 Orbit leech: circles at a fixed radius, then lunges inward and out.
  leech(A,e,c){
    const now=c.now;e.spin=e.spin||(e.seed%2<1?1:-1);
    if (e.phase==='lunge') {e.vx=e.aimX*620;e.vy=e.aimY*620;if (now>=e.phaseUntil) phase(e,'recover',700,now);return;}
    if (e.phase==='windup'&&now>=e.phaseUntil) {phase(e,'lunge',300,now);return;}
    if (e.phase==='recover'&&now>=e.phaseUntil) {e.phase='hunt';e.nextAttack=now+2200;}
    if (e.phase==='hunt'&&now>=(e.nextAttack||0)&&c.dist<230) {
      phase(e,'windup',500,now);aimAt(e,c);e.targetId=String(c.p._id);
      A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:190,width:32,armAt:now+500,until:now+500,damage:0,telegraph:true,arrow:true});
    }
    if (e.phase==='hunt'||e.phase==='recover') {
      const radial=clamp((c.dist-170)/60,-1,1);
      e.vx=(c.nx*radial-c.ny*e.spin)*c.base;e.vy=(c.ny*radial+c.nx*e.spin)*c.base;
    } else stop(e);
  },
  // 08 Bell ringer: an expanding ring with two opposite gaps fixed from the first warning.
  bell(A,e,c){
    const ringing=A.enemies.some(o=>o!==e&&o.type==='bell'&&o.phase==='windup');
    cycle(A,e,c,{windup:1200,recover:1600,cooldown:3200,ready:()=>c.dist<460&&!ringing,
      start:()=>A.addHazard(e,{kind:'ring',x:e.x,y:e.y,from:40,to:540,band:28,gapAngle:A.random()*TAU,gapSize:75*DEG,gapCount:2,
        armAt:c.now+1200,until:c.now+2350,damage:dmg(A,e,15,c.now)})});
    if (e.phase==='hunt') chase(e,c,.8);else stop(e);
  },
  // 09 Banner bearer: trails allies; its aura speeds their movement and attacks.
  banner(A,e,c){
    const ally=A.enemies.filter(o=>o!==e&&o.hp>0&&!o.part&&o.type!=='banner')
      .sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0];
    if (!ally) {keepRange(e,c,320);return;}
    // Stay behind the ally, on the far side from the player.
    const bx=ally.x-c.nx*70,by=ally.y-c.ny*70,dx=bx-e.x,dy=by-e.y,d=Math.hypot(dx,dy)||1;
    const k=clamp(d/60,0,1.2);e.vx=dx/d*c.base*k;e.vy=dy/d*c.base*k;
  },
  bannerFlag(A,e,c){stop(e);if (c.now>=e.expireAt) {e.hp=0;e.silent=true;}},
  // 10 Mender: stitches the most hurt nearby ally; any hit cuts the thread.
  mender(A,e,c){
    const now=c.now;
    if (e.phase==='mend') {
      const target=A.enemies.find(o=>o.id===e.linkId&&o.hp>0);
      if (!target) {e.phase='hunt';e.linkId=null;e.nextAttack=now+1500;}
      else if (now>=e.phaseUntil) {target.hp=Math.min(target.hpmax,target.hp+Math.round(target.hpmax*.3));e.phase='hunt';e.linkId=null;e.nextAttack=now+3500;}
      stop(e);return;
    }
    if (now>=(e.nextAttack||0)) {
      const hurt=A.enemies.filter(o=>o!==e&&o.hp>0&&o.hp<o.hpmax*.85&&!o.part&&!o.tier&&o.type!=='mender'&&Math.hypot(o.x-e.x,o.y-e.y)<480)
        .sort((a,b)=>a.hp/a.hpmax-b.hp/b.hpmax)[0];
      if (hurt) {phase(e,'mend',1000,now);e.linkId=hurt.id;stop(e);return;}
    }
    keepRange(e,c,440,100,.75);
  },
  // 11 Broodmother: lays eggs (max 3 eggs + hatchlings alive per mother).
  brood(A,e,c){
    const kids=A.enemies.filter(o=>o.hp>0&&o.motherId===e.id).length;
    cycle(A,e,c,{windup:600,recover:300,cooldown:3200,ready:()=>kids<3&&c.dist<500,
      strike:()=>{const egg=A.spawnPart(e,'egg',{x:e.x-c.nx*(e.r+14),y:e.y-c.ny*(e.r+14)},c.now);egg.motherId=e.id;egg.hatchAt=c.now+2200;egg.keepAfterParent=true;}});
    if (e.phase==='hunt') keepRange(e,c,260,90,.5);else stop(e);
  },
  egg(A,e,c){
    stop(e);
    if (c.now>=e.hatchAt) {
      e.hp=0;e.silent=true;
      const kid=A.spawn(null,'leech',c.now,{x:e.x,y:e.y});
      kid.xp=0;
      kid.motherId=e.motherId;
    }
  },
  // 13 Magnet golem: telegraphed strong pull cone, then a wide close slam.
  magnet(A,e,c){
    const now=c.now;
    if (e.phase==='pull'&&now>=e.phaseUntil) {
      phase(e,'windup',800,now);
      A.addHazard(e,{kind:'circle',x:e.x,y:e.y,r:155,armAt:now+800,until:now+950,damage:dmg(A,e,20,now)});
    }
    if (e.phase==='windup'&&now>=e.phaseUntil) phase(e,'recover',1100,now);
    if (e.phase==='recover'&&now>=e.phaseUntil) {e.phase='hunt';e.nextAttack=now+4500;}
    if (e.phase==='hunt') turnToward(e,c,1.4);
    if (e.phase==='hunt'&&now>=(e.nextAttack||0)&&c.dist<360) {
      phase(e,'pull',1700,now);e.targetId=String(c.p._id);
      A.addHazard(e,{kind:'cone',x:e.x,y:e.y,angle:e.facing,length:380,spread:70*DEG,armAt:now+800,until:now+1700,damage:0,effect:'pull',force:500});
    }
    if (e.phase==='hunt') chase(e,c);else stop(e);
  },
  // 14 Seeder: throws seeds far out that become wide one-shot spike traps where they land.
  seeder(A,e,c){
    cycle(A,e,c,{windup:700,recover:900,cooldown:2400,ready:()=>c.dist<540&&A.hazardCount(e.id)<6,
      start:()=>aimAt(e,c),
      strike:()=>{for (const off of [-.32,0,.32]) {
        const a=e.facing+off;
        A.addShot(e,{kind:'seed',x:e.x,y:e.y,vx:Math.cos(a)*360,vy:Math.sin(a)*360,r:9,damage:dmg(A,e,8,c.now),until:c.now+1150,
          land:{kind:'circle',r:68,arm:700,last:6000,damage:dmg(A,e,14,c.now),once:true,trap:true}});
      }}});
    if (e.phase==='hunt') {keepRange(e,c,360,90);aimAt(e,c);} else stop(e);
  },
  // 21 Scrap roller: rolls a wheel that re-aims and rolls toward the player 3-4 times.
  roller(A,e,c){
    const own=A.projectiles.some(s=>s.sourceId===e.id&&s.owner==='enemy');
    cycle(A,e,c,{windup:700,recover:1000,cooldown:1800,ready:()=>c.dist<480&&!own,
      start:()=>{aimAt(e,c);A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:240,width:34,armAt:c.now+700,until:c.now+700,damage:0,telegraph:true,arrow:true});},
      strike:()=>{
        const extra=2+(A.random()<.5?1:0);
        A.addShot(e,{kind:'wheel',x:e.x+e.aimX*(e.r+18),y:e.y+e.aimY*(e.r+18),vx:e.aimX*300,vy:e.aimY*300,r:18,damage:dmg(A,e,15,c.now),
          until:c.now+5600,pauseAt:c.now+700,rollsLeft:extra,pierce:true,batted:true});
      }});
    if (e.phase==='hunt') {keepRange(e,c,330,90,.4);aimAt(e,c);} else stop(e);
  },
  // 22 Glass shotbug: a five-shard fan (big strong center shard) + evasive dash.
  shotbug(A,e,c){
    const now=c.now;
    cycle(A,e,c,{windup:650,active:260,recover:700,cooldown:1400,ready:()=>c.dist<520,
      start:()=>{aimAt(e,c);for (const off of [-28,-14,0,14,28]) A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing+off*DEG,length:340,width:off===0?14:6,armAt:now+650,until:now+650,damage:0,telegraph:true});},
      strike:()=>{
        for (const off of [-28,-14,0,14,28]) {
          const a=e.facing+off*DEG,center=off===0;
          A.addShot(e,{kind:'glass',x:e.x+Math.cos(a)*(e.r+6),y:e.y+Math.sin(a)*(e.r+6),vx:Math.cos(a)*(center?320:280),vy:Math.sin(a)*(center?320:280),
            r:center?15:8,damage:dmg(A,e,center?20:11,now),until:now+2400});
        }
        const side=A.random()<.5?1:-1,da=Math.atan2(-c.ny,-c.nx)+side*.9;
        e.dashX=Math.cos(da);e.dashY=Math.sin(da);
      }});
    if (e.phase==='active') {e.vx=(e.dashX||0)*480;e.vy=(e.dashY||0)*480;}
    else if (e.phase==='hunt') {keepRange(e,c,320,90);aimAt(e,c);}
    else stop(e);
  },
  // 23 Track hound: circles the player in a tightening spiral, then lunges with a bleeding bite.
  hound(A,e,c){
    const now=c.now;
    e.spin=e.spin||(e.seed%2<1?1:-1);
    if (e.spiralR==null) e.spiralR=Math.max(160,Math.min(300,c.dist));
    if (e.phase==='lunge') {
      e.vx=e.aimX*560;e.vy=e.aimY*560;
      if (now>=e.phaseUntil) {e.spiralR=260;e.spin=-e.spin;phase(e,'recover',650,now);}
      return;
    }
    if (e.phase==='windup'&&now>=e.phaseUntil) {phase(e,'lunge',240,now);return;}
    if (e.phase==='recover'&&now>=e.phaseUntil) {e.phase='hunt';e.nextAttack=now+1100;}
    if (e.phase==='hunt'&&now>=(e.nextAttack||0)&&c.dist<135) {
      phase(e,'windup',400,now);aimAt(e,c);e.targetId=String(c.p._id);
      A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:140,width:32,armAt:now+400,until:now+640,damage:dmg(A,e,10,now),arrow:true,bleed:true});
      stop(e);return;
    }
    if (e.phase==='hunt') {
      e.spiralR=Math.max(55,e.spiralR-42*c.dt);
      const radial=clamp((c.dist-e.spiralR)/55,-1,1),tx=c.nx*radial-c.ny*e.spin,ty=c.ny*radial+c.nx*e.spin,n=Math.hypot(tx,ty)||1;
      e.vx=tx/n*c.base;e.vy=ty/n*c.base;e.facing=Math.atan2(e.vy,e.vx);
    } else stop(e);
  },
  // 24 Reassembling skeleton: wide sweeping arm slash; core is a short finish window.
  skeleton(A,e,c){
    const now=c.now;
    if (e.phase==='core') {
      stop(e);
      if (now>=e.phaseUntil) {e.phase='hunt';e.reassembled=true;e.r=SPECS.skeleton.r;e.hp=e.hpmax=Math.round(e.fullHp*.5);e.contact=e.coreContact;}
      return;
    }
    cycle(A,e,c,{windup:900,active:450,recover:950,cooldown:1500,ready:()=>c.dist<160,
      start:()=>{aimAt(e,c);A.addHazard(e,{kind:'cone',x:e.x,y:e.y,angle:e.facing,length:155,spread:140*DEG,armAt:now+900,until:now+1350,damage:dmg(A,e,15,now),sweep:true});}});
    if (e.phase==='hunt') chase(e,c);else stop(e);
  },
  // 25 Furnace salamander: long-burning fire cone (DoT) + narrow fading fire trail.
  salamander(A,e,c){
    const now=c.now;
    cycle(A,e,c,{windup:800,active:900,recover:1000,cooldown:2400,ready:()=>c.dist<230,
      start:()=>{aimAt(e,c);A.addHazard(e,{kind:'cone',x:e.x,y:e.y,angle:e.facing,length:220,spread:75*DEG,armAt:now+800,until:now+5800,damage:dmg(A,e,3,now),tick:true,dot:true,fire:true});}});
    if (e.phase==='hunt') {
      keepRange(e,c,155,60,.45);aimAt(e,c);
      if (now>=(e.trailAt||0)) {
        e.trailAt=now+320;
        A.addHazard(e,{kind:'circle',x:e.x,y:e.y,r:22,armAt:now,until:now+2800,damage:dmg(A,e,2,now),tick:true,dot:true,fire:true});
      }
    } else stop(e);
  },
  // 26 Mud sculptor: raises heavy breakable pillars and can hurl an existing pillar at the player.
  sculptor(A,e,c){
    const now=c.now,pillars=A.enemies.filter(o=>o.hp>0&&o.parentId===e.id&&o.type==='pillar');
    if (e.phase==='launch'&&now>=e.phaseUntil) {
      const target=A.byId(e.launchPillarId);
      if (target) {
        target.hp=0;target.silent=true;
        A.addShot(e,{kind:'mud',x:target.x,y:target.y,vx:Math.cos(e.launchAngle)*360,vy:Math.sin(e.launchAngle)*360,r:24,damage:dmg(A,e,18,now),until:now+2200});
      }
      e.launchPillarId=null;phase(e,'recover',700,now);e.nextSpecial=now+4200;
      stop(e);return;
    }
    if (e.phase==='launch') {stop(e);return;}
    if (e.phase==='hunt'&&pillars.length&&now>=(e.nextSpecial||0)&&c.dist<520) {
      const p=pillars[0],dx=c.p.x-p.x,dy=c.p.y-p.y,a=Math.atan2(dy,dx);
      e.launchPillarId=p.id;e.launchAngle=a;
      phase(e,'launch',650,now);
      A.addHazard(e,{kind:'line',x:p.x,y:p.y,angle:a,length:340,width:44,armAt:now+650,until:now+650,damage:0,telegraph:true,arrow:true});
      stop(e);return;
    }
    cycle(A,e,c,{windup:1000,recover:600,cooldown:3500,ready:()=>pillars.length<2&&c.dist<450,
      start:()=>{
        const a=Math.atan2(c.ny,c.nx)+(A.random()-.5)*1.4,d=Math.min(c.dist*.5,160);
        e.buildX=e.x+Math.cos(a)*d;e.buildY=e.y+Math.sin(a)*d;
        A.addHazard(e,{kind:'circle',x:e.buildX,y:e.buildY,r:26,armAt:now+1000,until:now+1000,damage:0,marker:true});
      },
      strike:()=>{
        const blocked=[...A.enemies].some(o=>o.hp>0&&Math.hypot(o.x-e.buildX,o.y-e.buildY)<o.r+28)||A.lastPlayers.some(p=>Math.hypot(p.x-e.buildX,p.y-e.buildY)<(p.r||25)+28);
        if (!blocked) {const p=A.spawnPart(e,'pillar',{x:e.buildX,y:e.buildY},now);p.expireAt=now+11000;if (!e.nextSpecial) e.nextSpecial=now+2200;}
      }});
    if (e.phase==='hunt') keepRange(e,c,280,90,.5);else stop(e);
  },
  pillar(A,e,c){stop(e);if (c.now>=e.expireAt) {e.hp=0;e.silent=true;}},
  debris(A,e,c){stop(e);if (c.now>=e.expireAt) {e.hp=0;e.silent=true;}},
  // 27 Beacon herald: repeatable 1.5s signal; summons 2 random non-boss enemies (low chance for elites).
  herald(A,e,c){
    const now=c.now;
    if (e.phase==='signal') {
      stop(e);
      if (now>=e.phaseUntil) {
        e.phase='hunt';e.nextAttack=now+9000;
        const a=Math.atan2(e.y-c.p.y,e.x-c.p.x),x=clamp(c.p.x+Math.cos(a)*520,-2850,2850),y=clamp(c.p.y+Math.sin(a)*520,-2850,2850);
        e.arriveAt=now+1300;e.arriveX=x;e.arriveY=y;
        A.addHazard(e,{kind:'circle',x,y,r:60,armAt:now+1300,until:now+1300,damage:0,marker:true});
      }
      return;
    }
    if (e.arriveAt&&now>=e.arriveAt) {
      e.arriveAt=0;
      e.callCount=(e.callCount||0)+1;
      const count=Math.min(5,1+e.callCount);
      const normals=Object.keys(SPECS).filter(t=>!SPECS[t].tier&&t!=='herald'&&t!=='leech').concat(['spinner','charger','stalker','bomber','spitter','splitter']);
      for (let i=0;i<count;i++) {
        const a=i*TAU/count,d=count>1?34:0;
        const pick=A.random()<.1?ELITES[Math.floor(A.random()*ELITES.length)]:normals[Math.floor(A.random()*normals.length)];
        A.spawn(c.p,pick,now,{x:clamp(e.arriveX+Math.cos(a)*d,-2850,2850),y:clamp(e.arriveY+Math.sin(a)*d,-2850,2850)});
      }
    }
    if (!e.arriveAt&&now>=(e.nextAttack||0)&&c.dist<480) {phase(e,'signal',1500,now);return;}
    keepRange(e,c,360,90,.6);
  },
  // 28 Balloon porter: drops one arcing bomb per balloon; popped balloons slow it.
  balloon(A,e,c){
    const now=c.now,balloons=A.enemies.filter(o=>o.hp>0&&o.parentId===e.id).length;
    e.speedScale=(e.baseSpeedScale||1)*(balloons?1+.25*balloons:.6);
    e.passThrough=balloons>0;e.airborne=balloons>0;
    if (now>=(e.nextAttack||0)&&balloons&&c.dist<420) {
      e.nextAttack=now+2600;
      for (let i=0;i<balloons;i++) {
        const a=A.random()*TAU,d=40+A.random()*60;
        A.addHazard(e,{kind:'circle',x:c.p.x+Math.cos(a)*d,y:c.p.y+Math.sin(a)*d,fromX:e.x,fromY:e.y,r:56,armAt:now+900+i*350,until:now+1050+i*350,damage:dmg(A,e,14,now),bomb:true});
      }
    }
    if (balloons) keepRange(e,c,180,80,.8);else chase(e,c);
  },
  // 29 Frost snail: leaves a wide frost trail and lobs large frost patches at the player.
  snail(A,e,c){
    const now=c.now;
    if (now>=(e.nextAttack||0)) {e.nextAttack=now+220;A.addHazard(e,{kind:'circle',x:e.x,y:e.y,r:68,armAt:now,until:now+4500,damage:0,effect:'slow',force:.7,frost:true});}
    if (now>=(e.nextSpecial||0)&&c.dist<460) {
      e.nextSpecial=now+4200;
      const travel=Math.max(400,Math.min(1100,c.dist/300*1000));
      A.addShot(e,{kind:'frost',x:e.x,y:e.y,vx:c.nx*300,vy:c.ny*300,r:10,damage:0,until:now+travel,
        land:{kind:'circle',r:120,arm:0,last:5500,damage:0,effect:'slow',force:.7,frost:true}});
    }
    chase(e,c);
  },
  // 30 Mask decoy: two upright dummies mimic it; they turn ghostly and freeze while the real one stabs.
  masker(A,e,c){
    const now=c.now,decoys=A.enemies.filter(o=>o.hp>0&&o.parentId===e.id).length;
    if (!decoys&&now>=(e.nextSpecial||0)) {
      e.nextSpecial=now+9000;
      for (const side of [-1,1]) {const d=A.spawnPart(e,'decoy',{x:e.x-c.ny*side*60,y:e.y+c.nx*side*60},now);d.offsetSide=side;}
    }
    cycle(A,e,c,{windup:600,recover:800,cooldown:1500,ready:()=>c.dist<160,
      start:()=>{aimAt(e,c);A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:160,width:24,armAt:now+600,until:now+720,damage:dmg(A,e,16,now),bar:true});}});
    if (e.phase==='hunt') {chase(e,c);aimAt(e,c);} else stop(e);
  },
  decoy(A,e,c){
    const boss=A.byId(e.parentId);
    if (!boss) return;
    e.revealed=boss.phase==='windup';
    if (boss.phase==='windup') {stop(e);return;}
    // Shadow the real one from the side, at its speed.
    const tx=boss.x-c.ny*e.offsetSide*70,ty=boss.y+c.nx*e.offsetSide*70,dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1;
    const k=clamp(d/40,0,1.6);e.vx=dx/d*c.base*k+(boss.vx||0)*.6;e.vy=dy/d*c.base*k+(boss.vy||0)*.6;e.aimX=boss.aimX;e.aimY=boss.aimY;
  },

  // 15 Chain warden: rapidly plants stakes, whips waving chains between them, and slams close players.
  warden(A,e,c){
    const now=c.now,stakes=A.enemies.filter(o=>o.hp>0&&o.parentId===e.id&&o.type==='stake');
    if (now<(e.vulnerableUntil||0)) e.armor=1.5;else e.armor=1;
    if (now>=(e.regrowAt||0)) {
      if (stakes.length>=4) {stakes[0].hp=0;stakes[0].silent=true;}
      const side=(e.stakeSide=-(e.stakeSide||1));
      const a=Math.atan2(c.ny,c.nx)+side*(.8+A.random()*.6),d=150+A.random()*90;
      A.spawnPart(e,'stake',{x:clamp(c.p.x+Math.cos(a)*d,-2850,2850),y:clamp(c.p.y+Math.sin(a)*d,-2850,2850)},now);
      e.regrowAt=now+(stakes.length<2?1800:3500);
    }
    cycle(A,e,c,{windup:750,active:600,recover:650,cooldown:1350,ready:()=>c.dist<600&&(stakes.length>0||c.dist<150),
      start:()=>{
        if (c.dist<145) {
          A.addHazard(e,{kind:'circle',x:e.x,y:e.y,r:135,armAt:now+600,until:now+760,damage:dmg(A,e,20,now),chain:true});
          return;
        }
        if (stakes.length>=2) {
          const s1=stakes[(e.chainTurn=(e.chainTurn||0)+1)%stakes.length],s2=stakes[(e.chainTurn+1)%stakes.length];
          const dx=s2.x-s1.x,dy=s2.y-s1.y;
          A.addHazard(e,{kind:'line',x:s1.x,y:s1.y,angle:Math.atan2(dy,dx),length:Math.hypot(dx,dy),width:44,armAt:now+750,until:now+1350,damage:dmg(A,e,18,now),chain:true,anchorId:s1.id});
        }
        const s=stakes[(e.chainTurn||0)%stakes.length],dx=s.x-e.x,dy=s.y-e.y;
        A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:Math.atan2(dy,dx),length:Math.hypot(dx,dy),width:40,armAt:now+750,until:now+1350,damage:dmg(A,e,18,now),chain:true,anchorId:s.id});
      }});
    if (e.phase==='hunt') keepRange(e,c,200,90,.55);else stop(e);
  },
  // 16 Twin gatekeepers: one guards (shielded) while the other slams + shockwave; then swap. Enrages if twin dies.
  gatekeeper(A,e,c){
    const now=c.now,twin=A.byId(e.pairId),solo=!twin;
    e.enraged=solo;
    if (solo) e.role='attack';
    if (e.role==='guard') {e.armor=.35;chase(e,c,.9);return;}
    e.armor=e.phase==='recover'?1.35:1;
    cycle(A,e,c,{windup:solo?650:800,recover:solo?850:1050,cooldown:solo?200:300,ready:()=>c.dist<460&&!(twin&&twin.phase==='windup'),
      start:()=>{
        const tx=c.p.x,ty=c.p.y,arm=now+(solo?650:800);
        A.addHazard(e,{kind:'circle',x:tx,y:ty,r:130,armAt:arm,until:arm+160,damage:dmg(A,e,22,now)});
        const baseA=Math.atan2(c.ny,c.nx);
        for (let i=0;i<4;i++) A.addHazard(e,{kind:'line',x:tx,y:ty,angle:baseA+i*Math.PI/2,length:240,width:32,armAt:arm+140,until:arm+300,damage:dmg(A,e,16,now)});
      }});
    if (e.phase==='recover') e.swapPending=true;
    else if (e.phase==='hunt'&&e.swapPending) {e.swapPending=false;if (twin) {e.role='guard';twin.role='attack';twin.nextAttack=now+300;}}
    if (e.phase==='hunt') chase(e,c,solo?1.35:1);else stop(e);
  },
  // 17 Mirror duelist: records the player's spot and sword angle, then an
  // echo slashes along that angle one second later.
  duelist(A,e,c){
    const now=c.now;
    e.armor=e.phase==='record'?1.4:1;
    if (e.phase==='record'&&now>=e.phaseUntil) {phase(e,'recover',900,now);}
    else if (e.phase==='recover'&&now>=e.phaseUntil) {e.phase='hunt';e.nextAttack=now+1600;}
    if (e.phase==='hunt'&&now>=(e.nextAttack||0)&&c.dist<500) {
      phase(e,'record',500,now);e.targetId=String(c.p._id);
      // The player's blade points along -y rotated by sw_angle.
      const a=Math.atan2(-Math.cos(c.p.sw_angle||0),-Math.sin(c.p.sw_angle||0));
      A.addHazard(e,{kind:'line',x:c.p.x-Math.cos(a)*40,y:c.p.y-Math.sin(a)*40,fromX:c.p.x,fromY:c.p.y,angle:a,length:190,width:44,armAt:now+1000,until:now+1150,damage:dmg(A,e,18,now),echo:true,bar:true});
    }
    if (e.phase==='hunt') keepRange(e,c,240,80,.8);else stop(e);
  },
  // 18 Orbit alchemist: a slim closing ring with a fixed exit + steady RGB potion orbs slightly off-aim.
  alchemist(A,e,c){
    const now=c.now;
    if (e.phase==='windup'&&(e.brewDamage||0)>=e.hpmax*.18) {
      e.brewDamage=0;A.cancelHazards(e.id);phase(e,'recover',1800,now);
    }
    if (now>=(e.nextSpecial||0)&&c.dist<540&&e.phase!=='recover') {
      e.nextSpecial=now+950;
      const kinds=['potionG','potionR','potionB'];
      const kind=kinds[(e.orbTurn=(e.orbTurn||0)+1)%3];
      const a=Math.atan2(c.ny,c.nx)+(A.random()-.5)*.45;
      A.addShot(e,{kind,x:e.x+Math.cos(a)*(e.r+8),y:e.y+Math.sin(a)*(e.r+8),vx:Math.cos(a)*265,vy:Math.sin(a)*265,r:10,damage:dmg(A,e,12,now),until:now+2400});
    }
    cycle(A,e,c,{windup:1600,active:1700,recover:1200,cooldown:3000,ready:()=>c.dist<420,
      start:()=>{e.brewDamage=0;A.addHazard(e,{kind:'ring',x:c.p.x,y:c.p.y,from:280,to:30,band:20,gapAngle:A.random()*TAU,gapSize:80*DEG,armAt:now+1600,until:now+3300,damage:dmg(A,e,16,now)});}});
    e.brewing=e.phase==='windup';
    if (e.phase==='hunt') keepRange(e,c,300,90,.6);else stop(e);
  },

  // 19 Clocktower swordmaster: upright boss with 5 sword-skill patterns (reverse spin, giant thrust, blade waves, slam+ring, dash slash).
  swordsaint(A,e,c){
    const now=c.now,enraged=e.hp<e.hpmax*.5,rest=enraged?.75:1;
    e.blade=e.blade||{r:70,dir:1,speed:1.4};
    if (!e.phaseUntil) phase(e,'slow',4200*rest,now);
    if (e.phase==='dash') {
      e.vx=e.aimX*680;e.vy=e.aimY*680;
      if (now>=e.phaseUntil) phase(e,'recover',1100*rest,now);
    } else if (now>=e.phaseUntil) {
      if (e.phase==='slow') {
        e.pattern=((e.pattern||0)+1)%4;
        aimAt(e,c);e.targetId=String(c.p._id);
        if (e.pattern===1) {
          // Pattern 1: Telegraphed reverse spin into fast spin.
          phase(e,'reverse',900,now);
          A.addHazard(e,{kind:'circle',x:e.x,y:e.y,r:195,armAt:now+900,until:now+900,damage:0,telegraph:true});
        } else if (e.pattern===2) {
          // Pattern 2: Crescent blade waves (3-way, 5-way enraged).
          phase(e,'waveWindup',750,now);
          const fan=enraged?[-36,-18,0,18,36]:[-24,0,24];
          for (const off of fan) A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing+off*DEG,length:380,width:20,armAt:now+750,until:now+750,damage:0,telegraph:true,bar:true});
        } else if (e.pattern===3) {
          // Pattern 3: Giant blade slam + shockwave ring with 2 gaps.
          phase(e,'slamWindup',900,now);
          A.addHazard(e,{kind:'circle',x:e.x,y:e.y,r:180,armAt:now+900,until:now+1080,damage:dmg(A,e,24,now)});
          A.addHazard(e,{kind:'ring',x:e.x,y:e.y,from:80,to:400,band:30,gapAngle:A.random()*TAU,gapSize:75*DEG,gapCount:2,armAt:now+1050,until:now+1950,damage:dmg(A,e,18,now)});
        } else {
          // Pattern 4: Dash slash with arrow telegraph.
          phase(e,'dashWindup',800,now);
          A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:340,width:64,armAt:now+800,until:now+1280,damage:dmg(A,e,22,now),arrow:true});
        }
      }
      else if (e.phase==='reverse') {e.blade.dir*=-1;phase(e,'fast',3600*rest,now);}
      else if (e.phase==='fast') {
        // Follow fast reverse spin with Giant Sword Thrust.
        phase(e,'windup',850,now);aimAt(e,c);e.targetId=String(c.p._id);
        A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:360,width:46,armAt:now+850,until:now+1080,damage:dmg(A,e,28,now),bar:true});
      }
      else if (e.phase==='windup') {
        A.addShot(e,{kind:'sabreWave',x:e.x+e.aimX*(e.r+24),y:e.y+e.aimY*(e.r+24),vx:e.aimX*1100,vy:e.aimY*1100,r:20,damage:0,until:now+310,pierce:true});
        phase(e,'recover',1300*rest,now);
      }
      else if (e.phase==='waveWindup') {
        const fan=enraged?[-36,-18,0,18,36]:[-24,0,24];
        for (const off of fan) {
          const a=e.facing+off*DEG;
          A.addShot(e,{kind:'sabreWave',x:e.x+Math.cos(a)*(e.r+18),y:e.y+Math.sin(a)*(e.r+18),vx:Math.cos(a)*460,vy:Math.sin(a)*460,r:16,damage:dmg(A,e,18,now),until:now+1300});
        }
        phase(e,'recover',1000*rest,now);
      }
      else if (e.phase==='slamWindup') phase(e,'recover',1300*rest,now);
      else if (e.phase==='dashWindup') phase(e,'dash',480,now);
      else phase(e,'slow',4200*rest,now);
    }
    const spinning=e.phase==='slow'||e.phase==='fast'||e.phase==='dash';
    e.blade.r+=((spinning?76:30)-e.blade.r)*Math.min(1,c.dt*5);
    e.blade.speed=e.phase==='slow'?1.5:e.phase==='fast'?2.6:e.phase==='dash'?3.4:e.phase==='reverse'?.4:0;
    e.angularVelocity=e.blade.speed*e.blade.dir;
    e.angle=(e.angle||0)+c.dt*e.angularVelocity;
    e.sword=spinning||e.phase==='reverse'?{sw_r:e.blade.r,sw_w:28,sw_h:enraged?185:155}:null;
    if (e.phase==='slow'||e.phase==='fast') keepRange(e,c,150,60,.55);else if (e.phase!=='dash') stop(e);
  },
  // 31 Forgemaster: attacks build heat; at three it vents, then cools exposed.
  forge(A,e,c){
    const now=c.now,enraged=e.hp<e.hpmax*.5;e.heat=e.heat||0;
    e.armor=e.phase==='cooled'?1.6:1;
    if (e.sparkAt&&now>=e.sparkAt) {
      e.sparkAt=0;
      for (let i=-3;i<=3;i++) {const a=e.facing+i*11*DEG;A.addShot(e,{kind:'spark',x:e.x+Math.cos(a)*(e.r+6),y:e.y+Math.sin(a)*(e.r+6),vx:Math.cos(a)*220,vy:Math.sin(a)*220,r:9,damage:dmg(A,e,14,now),until:now+2600});}
    }
    if (e.phase!=='hunt'&&now<e.phaseUntil) {stop(e);return;}
    if (e.phase==='vent') {phase(e,'cooled',4000,now);e.heat=0;stop(e);return;}
    if (e.phase!=='hunt') {const wasCooled=e.phase==='cooled';e.phase='hunt';e.nextAttack=now+(wasCooled?600:1300);}
    if (e.phase==='hunt'&&now>=(e.nextAttack||0)&&c.dist<520) {
      aimAt(e,c);e.targetId=String(c.p._id);
      if (e.heat>=3) {
        phase(e,'vent',1900,now);
        A.addHazard(e,{kind:'cone',x:e.x,y:e.y,angle:e.facing,length:380,spread:55*DEG,armAt:now+1000,until:now+1900,damage:dmg(A,e,26,now),tick:true,fire:true});
        return;
      }
      e.heat++;
      if (e.heat%2) {
        // Anvil: a slam on the target plus two sideways flame lines.
        const strikes=enraged?2:1;
        for (let i=0;i<strikes;i++) {
          const x=c.p.x+(i?c.nx*90:0),y=c.p.y+(i?c.ny*90:0),arm=now+1000+i*500;
          A.addHazard(e,{kind:'circle',x,y,r:90,armAt:arm,until:arm+150,damage:dmg(A,e,24,now)});
          for (const side of [-1,1]) A.addHazard(e,{kind:'line',x,y,angle:Math.atan2(c.nx*side,-c.ny*side),length:260,width:30,armAt:arm+150,until:arm+400,damage:dmg(A,e,16,now),fire:true});
        }
        phase(e,'windup',1200+(strikes-1)*500,now);
      } else {
        phase(e,'windup',900,now);
        e.sparkAt=now+700;
        const turrets=A.enemies.filter(o=>o.hp>0&&o.parentId===e.id&&o.type==='forgeTurret');
        if (turrets.length<2) {
          const a=e.facing+(turrets.length?1:-1)*1.1,t=A.spawnPart(e,'forgeTurret',{x:clamp(e.x+Math.cos(a)*120,-2850,2850),y:clamp(e.y+Math.sin(a)*120,-2850,2850)},now);
          t.expireAt=now+14000;t.nextShot=now+1200;
        }
      }
    }
    if (e.phase==='hunt') keepRange(e,c,200,80,.4);else stop(e);
  },
  forgeTurret(A,e,c){
    stop(e);
    if (c.now>=e.expireAt) {e.hp=0;e.silent=true;return;}
    if (c.now>=(e.nextShot||0)&&c.dist<520) {
      e.nextShot=c.now+1700;
      A.addShot(e,{kind:'spark',x:e.x+c.nx*(e.r+6),y:e.y+c.ny*(e.r+6),vx:c.nx*260,vy:c.ny*260,r:8,damage:dmg(A,e,10,c.now),until:c.now+2200});
    }
  },
  // 33 Echo maestro: drum circles repeat once in the same places; breaking
  // the resonance bell cancels pending echoes and stuns the maestro.
  maestro(A,e,c){
    const now=c.now,enraged=e.hp<e.hpmax*.5;
    e.armor=now<(e.vulnerableUntil||0)?1.5:1;
    if (e.phase==='stunned') {stop(e);if (now>=e.phaseUntil) {e.phase='hunt';e.nextAttack=now+800;}return;}
    if (e.phase!=='hunt'&&now<e.phaseUntil) {stop(e);return;}
    if (e.phase!=='hunt') {e.phase='hunt';e.nextAttack=now+1200;}
    if (now>=(e.nextAttack||0)&&c.dist<560) {
      e.pattern=((e.pattern||0)+1)%3;e.targetId=String(c.p._id);
      if (e.pattern===1) {
        const n=enraged?3:2;
        for (let i=0;i<n;i++) {
          const a=A.random()*TAU,d=i?60+A.random()*90:0,x=c.p.x+Math.cos(a)*d,y=c.p.y+Math.sin(a)*d;
          A.addHazard(e,{kind:'circle',x,y,r:70,armAt:now+1000+i*250,until:now+1150+i*250,damage:dmg(A,e,20,now),beat:1});
          A.addHazard(e,{kind:'circle',x,y,r:70,armAt:now+2200+i*250,until:now+2350+i*250,damage:dmg(A,e,20,now),beat:2,echo:true});
        }
        phase(e,'windup',2600,now);
      } else if (e.pattern===2) {
        const a=A.random()*Math.PI,gap=Math.floor(A.random()*4);let k=0;
        for (let i=0;i<4;i++) {
          if (i===gap) continue;
          const off=(i-1.5)*95,x=c.p.x-Math.sin(a)*off-Math.cos(a)*260,y=c.p.y+Math.cos(a)*off-Math.sin(a)*260;
          A.addHazard(e,{kind:'line',x,y,angle:a,length:520,width:90,armAt:now+900+k*300,until:now+1050+k*300,damage:dmg(A,e,18,now)});k++;
        }
        phase(e,'windup',2000,now);
      } else {
        const bell=A.spawnPart(e,'resobell',{x:e.x+c.nx*-80,y:e.y+c.ny*-80},now);bell.expireAt=now+3200;
        // The echo the bell will release if it is left alone.
        for (let i=0;i<3;i++) {const a=i*TAU/3+A.random();A.addHazard(e,{kind:'circle',x:c.p.x+Math.cos(a)*90,y:c.p.y+Math.sin(a)*90,r:80,armAt:now+3200,until:now+3350,damage:dmg(A,e,20,now),echo:true,bellId:bell.id});}
        phase(e,'windup',3400,now);
      }
    }
    if (e.phase==='hunt') keepRange(e,c,260,90,.6);else stop(e);
  },
  resobell(A,e,c){stop(e);if (c.now>=e.expireAt) {e.hp=0;e.silent=true;}},
  // 20 Root crown: three knots armour the core; root lines erupt in sequence.
  rootcrown(A,e,c){
    const now=c.now,knots=A.enemies.filter(o=>o.hp>0&&o.parentId===e.id&&o.type==='knot');
    stop(e);
    if (!e.planted) {
      e.planted=true;
      for (let i=0;i<3;i++) {const a=i*TAU/3;A.spawnPart(e,'knot',{x:e.x+Math.cos(a)*170,y:e.y+Math.sin(a)*170},now);}
    }
    if (!knots.length&&!e.exposedUntil) {e.exposedUntil=now+5000;e.regrowAt=now+9000;}
    if (e.regrowAt&&now>=e.regrowAt) {
      e.exposedUntil=0;e.regrowAt=0;
      for (let i=0;i<3;i++) {const a=i*TAU/3+.5;A.spawnPart(e,'knot',{x:e.x+Math.cos(a)*170,y:e.y+Math.sin(a)*170},now);}
    }
    e.armor=now<(e.exposedUntil||0)?1.6:1-.2*knots.length;
    if (now>=(e.nextAttack||0)) {
      e.nextAttack=now+(e.hp<e.hpmax*.5?2600:3400);
      const lines=e.hp<e.hpmax*.5?2:1;
      for (let l=0;l<lines;l++) {
        const a=Math.atan2(c.p.y-e.y,c.p.x-e.x)+(l?.45:0);
        for (let i=0;i<7;i++) {
          const d=e.r+30+i*70;
          A.addHazard(e,{kind:'circle',x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d,r:40,armAt:now+900+i*140+l*500,until:now+1050+i*140+l*500,damage:dmg(A,e,18,now),root:true});
        }
      }
    }
    if (now>=(e.nextSpecial||0)) {
      e.nextSpecial=now+12000;
      const guards=A.enemies.filter(o=>o.summonerId===e.id&&o.hp>0).length;
      for (let i=guards;i<3;i++) {const g=A.spawn(c.p,'leech',now);g.summonerId=e.id;g.xp=0;}
    }
  },
  // 32 Storm ray: wind lanes, feather volleys, and a long glide then rest.
  stormray(A,e,c){
    const now=c.now,enraged=e.hp<e.hpmax*.5;
    e.armor=e.phase==='rest'?1.4:1;
    if (e.featherAt&&now>=e.featherAt) {
      e.featherAt=0;
      for (const off of [-24,0,24]) {const a=e.facing+off*DEG;A.addShot(e,{kind:'feather',x:e.x+Math.cos(a)*(e.r+6),y:e.y+Math.sin(a)*(e.r+6),vx:Math.cos(a)*240,vy:Math.sin(a)*240,r:10,damage:dmg(A,e,14,now),until:now+2800});}
    }
    if (e.phase==='glide') {e.vx=e.aimX*720;e.vy=e.aimY*720;if (now>=e.phaseUntil) phase(e,'rest',3000,now);return;}
    if (e.phase==='windup'&&e.gliding&&now>=e.phaseUntil) {e.gliding=false;phase(e,'glide',720,now);return;}
    if (e.phase!=='hunt'&&now<e.phaseUntil) {stop(e);return;}
    if (e.phase!=='hunt') {e.phase='hunt';e.nextAttack=now+1000;}
    if (now>=(e.nextAttack||0)&&c.dist<620) {
      e.pattern=((e.pattern||0)+1)%3;aimAt(e,c);e.targetId=String(c.p._id);
      if (e.pattern===1) {
        const a=enraged?Math.atan2(c.ny,c.nx)+(A.random()<.5?1:-1)*Math.PI/2:Math.atan2(-c.ny,-c.nx)+Math.PI/2;
        A.addHazard(e,{kind:'line',x:c.p.x-Math.cos(a)*450,y:c.p.y-Math.sin(a)*450,angle:a,length:900,width:200,armAt:now+900,until:now+3900,damage:0,effect:'wind',force:200,wind:true});
        phase(e,'windup',1500,now);
      } else if (e.pattern===2) {
        e.featherAt=now+700;phase(e,'windup',1200,now);
      } else {
        A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:520,width:76,armAt:now+1000,until:now+1720,damage:dmg(A,e,22,now),arrow:true});
        e.gliding=true;phase(e,'windup',1000,now);
      }
    }
    if (e.phase==='hunt') keepRange(e,c,280,90,.8);else stop(e);
  },
  // 34 Crab fortress: two breakable cannons, debris cover, a claw sweep.
  crab(A,e,c){
    const now=c.now,enraged=e.hp<e.hpmax*.5;
    if (!e.armed) {e.armed=true;for (const side of [-1,1]) {const g=A.spawnPart(e,'cannon',{x:e.x,y:e.y},now);g.attach={angle:side*Math.PI/2,dist:40};}}
    const cannons=A.enemies.filter(o=>o.hp>0&&o.parentId===e.id&&o.type==='cannon');
    e.armor=e.phase==='exposed'?1.5:1;
    if (e.phase==='hunt') turnToward(e,c,.9);
    if (e.phase!=='hunt'&&now<e.phaseUntil) {stop(e);return;}
    if (e.phase==='windup'&&e.clawing) {e.clawing=false;phase(e,'exposed',4000,now);stop(e);return;}
    if (e.phase!=='hunt') {e.phase='hunt';e.nextAttack=now+900;}
    if (now>=(e.nextAttack||0)&&c.dist<600) {
      e.pattern=((e.pattern||0)+1)%3;e.targetId=String(c.p._id);
      if (e.pattern===1&&cannons.length) {
        cannons.forEach((g,i)=>{for (let k=0;k<(enraged?2:1);k++) {
          const a=A.random()*TAU,d=k?120:A.random()*60,arm=now+1100+i*500+k*300;
          A.addHazard(e,{kind:'circle',x:c.p.x+Math.cos(a)*d,y:c.p.y+Math.sin(a)*d,r:72,armAt:arm,until:arm+150,damage:dmg(A,e,22,now),bomb:true});
        }});
        phase(e,'windup',1400+cannons.length*500,now);
      } else if (e.pattern===2) {
        for (const side of [-1,1]) {const d=A.spawnPart(e,'debris',{x:clamp(e.x+(c.nx*.5-c.ny*side)*200,-2850,2850),y:clamp(e.y+(c.ny*.5+c.nx*side)*200,-2850,2850)},now);d.expireAt=now+9000;}
        phase(e,'windup',800,now);
      } else {
        if (c.dist>260) {e.pattern=0;chase(e,c);return;}
        A.addHazard(e,{kind:'cone',x:e.x,y:e.y,angle:e.facing,length:200,spread:120*DEG,armAt:now+900,until:now+1050,damage:dmg(A,e,26,now)});
        e.clawing=true;phase(e,'windup',1100,now);
      }
    }
    if (e.phase==='hunt') chase(e,c);else stop(e);
  },
  // 35 Iron centipede king: body segments follow the head's exact path.
  centipede(A,e,c){
    const now=c.now,enraged=e.hp<e.hpmax*.5;
    if (!e.body) {
      e.body=[];e.path=[{x:e.x,y:e.y}];
      for (let i=0;i<5;i++) {const s=A.spawnPart(e,'segment',{x:e.x,y:e.y},now);s.index=i;s.contact=Math.round(SPECS.segment.contact*(e.power||1));e.body.push(s.id);}
    }
    e.armor=e.phase==='coil'?1.4:1;
    if (e.phase==='run') {
      const d=Math.hypot(e.runEndX-e.x,e.runEndY-e.y),step=420*c.dt;
      if (d<=step) {e.x=e.runEndX;e.y=e.runEndY;stop(e);phase(e,'coil',enraged?2200:3000,now);}
      else {e.vx=(e.runEndX-e.x)/d*420;e.vy=(e.runEndY-e.y)/d*420;}
      return;
    }
    if (e.phase==='windup'&&e.running&&now>=e.phaseUntil) {e.running=false;e.phase='run';e.passThrough=true;return;}
    if (e.phase!=='hunt'&&now<e.phaseUntil) {stop(e);return;}
    if (e.phase!=='hunt') {e.phase='hunt';e.passThrough=false;e.nextAttack=now+1200;}
    if (now>=(e.nextAttack||0)&&c.dist<650) {
      e.pattern=((e.pattern||0)+1)%2;aimAt(e,c);e.targetId=String(c.p._id);
      if (e.pattern===1) {
        const len=Math.min(700,c.dist+260),ex=clamp(e.x+e.aimX*len,-2900,2900),ey=clamp(e.y+e.aimY*len,-2900,2900);
        e.runEndX=ex;e.runEndY=ey;e.running=true;
        A.addHazard(e,{kind:'line',x:e.x,y:e.y,angle:e.facing,length:Math.hypot(ex-e.x,ey-e.y),width:64,armAt:now+1100,until:now+1100+len/420*1000+500,damage:dmg(A,e,22,now),arrow:true});
        phase(e,'windup',1100,now);
      } else {
        const side=A.random()<.5?1:-1;
        e.body.map(id=>A.byId(id)).filter(Boolean).forEach((s,i)=>{
          const a=Math.atan2(e.y-s.y,e.x-s.x)+side*Math.PI/2;
          A.addHazard(e,{kind:'circle',x:s.x+Math.cos(a)*55,y:s.y+Math.sin(a)*55,r:46,armAt:now+900+i*180,until:now+1050+i*180,damage:dmg(A,e,18,now)});
        });
        phase(e,'windup',1100+5*180,now);
      }
    }
    if (e.phase==='hunt') chase(e,c,.8);else stop(e);
  },
};
// Parts that follow their parent each tick (after the parent moved).
function followParent(A,e,now){
  const parent=A.byId(e.parentId);
  if (!parent) return;
  if (e.type==='balloonPart') {
    e.x=parent.x+e.side*20;e.y=parent.y-parent.r-14;e.vx=parent.vx;e.vy=parent.vy;
  } else if (e.type==='cannon') {
    const a=(parent.facing||0)+e.attach.angle;e.x=parent.x+Math.cos(a)*e.attach.dist;e.y=parent.y+Math.sin(a)*e.attach.dist;e.vx=parent.vx;e.vy=parent.vy;e.facing=parent.facing;
  } else if (e.type==='segment') {
    const path=parent.path,gap=46*(e.index+1);
    let need=gap,prev={x:parent.x,y:parent.y};
    for (let i=path.length-1;i>=0;i--) {
      const q=path[i],d=Math.hypot(q.x-prev.x,q.y-prev.y);
      if (d>=need) {const t=need/d;e.x=prev.x+(q.x-prev.x)*t;e.y=prev.y+(q.y-prev.y)*t;e.facing=Math.atan2(prev.y-q.y,prev.x-q.x);return;}
      need-=d;prev=q;
    }
    e.x=prev.x;e.y=prev.y;
  }
}
function recordPath(e){
  if (!e.path) return;
  const last=e.path[e.path.length-1];
  if (!last||Math.hypot(last.x-e.x,last.y-e.y)>6) e.path.push({x:e.x,y:e.y});
  if (e.path.length>120) e.path.splice(0,e.path.length-120);
}
// Spawn-time setup for types that bring parts or partners.
function onSpawn(A,e,player,now){
  e.seed=Number(String(e.id).replace(/\D/g,''))||0;
  if (e.type==='balloon') {
    e.baseSpeedScale=e.speedScale;
    for (const side of [-1,1]) {const b=A.spawnPart(e,'balloonPart',{x:e.x+side*20,y:e.y-e.r-14},now);b.side=side;}
  }
  if (e.type==='skeleton') {e.fullHp=e.hpmax;e.coreContact=e.contact;}
  if (e.type==='gatekeeper'&&!A.spawningTwin&&player) {
    A.spawningTwin=true;
    const twin=A.spawn(player,'gatekeeper',now,{x:e.x+70,y:e.y});
    A.spawningTwin=false;
    e.pairId=twin.id;twin.pairId=e.id;e.role='attack';twin.role='guard';twin.twinB=true;
  }
  if (e.type==='hound') e.facing=0;
}
// Damage hooks: return the amount that actually lands.
function onDamage(A,e,amount,info,now){
  if (e.type==='shellback'&&e.guarding&&Number.isFinite(info.nx)&&(info.nx||info.ny)) {
    // info.n points from the attacker to the enemy: a frontal hit opposes facing.
    const facing=e.facing??0,dot=-(Math.cos(facing)*info.nx+Math.sin(facing)*info.ny);
    if (dot>Math.cos(60*DEG)) {info.flags={...(info.flags||{}),blocked:true};e.blockFlashUntil=now+260;return 0;}
  }
  if (e.type==='hound'&&amount>0) {e.spiralR=Math.min(280,(e.spiralR||180)+90);}
  if (e.type==='mender'&&e.phase==='mend') {e.phase='hunt';e.linkId=null;e.nextAttack=now+3000;e.staggerUntil=now+300;}
  if (e.type==='herald'&&e.phase==='signal') {e.phase='hunt';e.nextAttack=now+3000;e.staggerUntil=now+500;A.cancelHazards(e.id);}
  if (e.type==='alchemist'&&e.phase==='windup') e.brewDamage=(e.brewDamage||0)+amount;
  if (e.armor!=null&&e.armor!==1) return Math.max(1,Math.round(amount*e.armor));
  return amount;
}
// Returning true keeps the enemy alive (it changes form instead).
function onLethal(A,e,overkill,now){
  if (e.type==='skeleton'&&!e.reassembled&&e.phase!=='core') {
    const core=12-overkill;
    if (core<=0) return false;
    e.phase='core';e.phaseUntil=now+2200;e.hp=core;e.hpmax=12;e.r=14;e.contact=0;A.cancelHazards(e.id);stop(e);
    return true;
  }
  return false;
}
function onPartKilled(A,parent,part,now){
  if (parent.type==='warden'&&part.type==='stake') {parent.staggerUntil=now+1500;parent.vulnerableUntil=now+3000;A.cancelHazards(parent.id,h=>h.anchorId===part.id);}
  if (parent.type==='maestro'&&part.type==='resobell'&&!part.silent) {
    A.cancelHazards(parent.id,h=>h.bellId===part.id||h.echo&&h.armAt>now);
    phase(parent,'stunned',3000,now);parent.vulnerableUntil=now+3000;
  }
  if (parent.type==='crab'&&part.type==='cannon') parent.staggerUntil=now+600;
}
module.exports={SPECS,AI,TIME_FIELDS,ELITES,BOSSES,encounterFor,onSpawn,onDamage,onLethal,onPartKilled,followParent,recordPath,angleDiff};
