const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EnemyArena,swordHits} = require('./enemies');
const player = () => ({_id:'human',x:0,y:0,r:25,hp:100,lv:1,sw_angle:0,sw_r:65,sw_w:40,sw_h:100});
test('all three archetypes spawn near an active player and stop when the room empties',()=>{
  const arena=new EnemyArena(()=>.25); arena.step([player()],1000);
  assert.deepEqual(arena.enemies.map(e=>e.type),['spinner','charger','stalker','spitter','bomber']);
  assert.ok(arena.enemies.every(e=>Math.hypot(e.x,e.y)<700));
  arena.step([],1100); assert.equal(arena.enemies.length,0);
});
test('charger telegraphs, locks its aim, charges, then recovers',()=>{
  const arena=new EnemyArena(()=>0); const p=player();
  const e=arena.spawn(p,'charger'); e.x=250; e.y=0; arena.nextSpawn=Infinity;
  arena.step([p],1000); assert.equal(e.phase,'windup'); assert.equal(Math.abs(e.vx),0);
  p.y=200; arena.step([p],1900);
  assert.equal(e.phase,'charge'); assert.equal(e.aimY,0); assert.ok(e.vx<0);
  for(let now=1950;now<=2850;now+=50)arena.step([p],now); assert.equal(e.phase,'recover'); assert.equal(Math.abs(e.vx),0);
});
test('weapon attacks apply cooldown, award XP once, and remove dead enemies',()=>{
  const arena=new EnemyArena(()=>0); const p=player(); const e=arena.spawn(p,'stalker');
  e.x=0;e.y=-90;e.hp=10;
  const result=arena.attack(p,1000);
  assert.equal(result.xp,35);assert.equal(result.hits[0].killed,true);
  assert.equal(arena.enemies.length,0);assert.equal(arena.attack(p,1001).xp,0);
});
test('contact damage has per-player invulnerability and sword geometry follows size',()=>{
  const arena=new EnemyArena(()=>0);const p=player();const e=arena.spawn(p,'stalker');
  e.x=0;e.y=0;arena.nextSpawn=Infinity;
  assert.equal(arena.step([p],1000).length,1);
  assert.equal(arena.step([p],1100).length,0);
  e.x=0;e.y=0;assert.equal(arena.step([p],2000).length,0,'same enemy is still blocked');
  // Place it in contact without carrying the earlier launch velocity; this
  // assertion tests immunity expiry, independently of knockback travel.
  e.x=0;e.y=0;e.pushVx=0;e.pushVy=0;assert.equal(arena.step([p],2600).length,1);
  assert.equal(swordHits(p,{x:0,y:-180,r:5}),false);
  assert.equal(swordHits({...p,sw_h:190},{x:0,y:-180,r:5}),true);
});

test('charge destination stays fixed, remaining distance shrinks, and movement cannot overshoot',()=>{
  const arena=new EnemyArena(()=>0),p=player(),e=arena.spawn(p,'charger');
  e.x=250;e.y=0;arena.nextSpawn=Infinity;
  arena.step([p],1000);
  const end={x:e.chargeEndX,y:e.chargeEndY};
  assert.equal(Math.round(Math.hypot(end.x-e.x,end.y-e.y)),286);
  let previous=286;
  for(const now of [1900,2000,2100,2200,2300,2400,2500,2600,2700,2800]){
    arena.step([p],now);
    assert.equal(e.chargeEndX,end.x);assert.equal(e.chargeEndY,end.y);
    const distance=Math.hypot(end.x-e.x,end.y-e.y);
    assert.ok(distance<=previous);assert.ok(e.x>=end.x);
    previous=distance;
  }
  assert.equal(e.phase,'recover');assert.equal(e.x,end.x);assert.equal(e.y,end.y);
});
test('AI snapshots never expose monster name fields, including legacy state',()=>{
  const arena=new EnemyArena(()=>0);const e=arena.spawn(player(),'spinner');
  assert.equal(Object.hasOwn(e,'name'),false);
  e.name='legacy monster name';
  assert.equal(Object.hasOwn(arena.snapshot()[0],'name'),false);
});
test('body contact never moves the player server-side and monsters do not damage each other',()=>{
  const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;
  const a=arena.spawn(p,'spinner'),b=arena.spawn(p,'spinner');
  a.x=30;a.y=0;b.x=40;b.y=10;
  const events=arena.step([p],1000);
  assert.equal(p.x,0);assert.equal(p.y,0);
  assert.ok(Math.hypot(a.x,a.y)>=p.r+a.r);
  assert.equal(a.hp,a.hpmax);assert.equal(b.hp,b.hpmax);
  assert.ok(events.length<=1);
  assert.ok(arena.playerCorrections.every(c=>c.dx===0&&c.dy===0));
  assert.ok(arena.playerCorrections.some(c=>c.dvx<0));
});
test('a different enemy can hit after the short global window, the same one cannot',()=>{
  const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;
  const a=arena.spawn(p,'stalker'),b=arena.spawn(p,'stalker');
  a.x=0;a.y=0;b.x=-400;b.y=0;
  assert.equal(arena.step([p],1000).length,1);
  a.x=40;a.y=0;b.x=-40;b.y=0;
  assert.equal(arena.step([p],2000).length,1,'second enemy lands a hit');
  a.x=40;a.y=0;b.x=-400;b.y=0;
  assert.equal(arena.step([p],2200).length,0,'first enemy and global window both block');
});
test('a fast blade that passed an enemy between attack requests still hits it',()=>{
  const arena=new EnemyArena(()=>0),p=player();const e=arena.spawn(p,'charger');
  e.x=0;e.y=-110;arena.nextSpawn=Infinity;
  // Blade is now pointing away; the recorded poses swept straight through it.
  p.sw_angle=Math.PI;
  assert.equal(arena.attack({...p},1000).hits.length,0);
  const poses=[-1.2,1.2].map(a=>({sw_angle:a,sw_r:65,sw_w:40,sw_h:100}));
  assert.equal(arena.attack({...p,poses},1200).hits.length,1);
});
test('one blade pass hits an enemy once even across several attack requests',()=>{
  const arena=new EnemyArena(()=>0),p=player();const e=arena.spawn(p,'charger');e.hp=500;e.x=0;e.y=-110;
  const pose=a=>({sw_angle:a,sw_r:65,sw_w:40,sw_h:100});
  assert.equal(arena.attack({...p,poses:[pose(-.6),pose(-.3)]},1000).hits.length,1);
  assert.equal(arena.attack({...p,poses:[pose(0),pose(.3)]},1200).hits.length,0,'still inside the blade');
  assert.equal(arena.attack({...p,poses:[pose(1.5),pose(3)]},1400).hits.length,0,'blade left');
  assert.equal(arena.attack({...p,poses:[pose(-.9),pose(-.3)]},1600).hits.length,1,'next pass hits again');
});
test('threat rises with player level: higher-level spawns are tougher and hit harder',()=>{
  const arena=new EnemyArena(()=>0),p=player();arena.step([p],1000);
  const early=arena.spawn(p,'stalker',1000);
  p.lv=7;
  arena.step([p],2000);
  assert.equal(arena.threat(2000).level,4);
  const late=arena.spawn(p,'stalker',2000);
  assert.ok(late.hpmax>early.hpmax);assert.ok(late.contact>early.contact);assert.ok(late.xp>early.xp);
  arena.step([],2e6);assert.equal(arena.threat(2e6).level,1,'an empty room resets');
});
test('pvp mode spawns by nearby max player level, ignores stealthed players, and tracks boss last-hit',()=>{
  const arena=new EnemyArena(()=>0,{mode:'pvp',nearbyRadius:500});
  const low={...player(),_id:'low',x:0,y:0,lv:1};
  const high={...player(),_id:'high',x:120,y:0,lv:9};
  const hidden={...player(),_id:'ghost',x:0,y:0,lv:20,stealthUntil:5000};
  arena.step([low,high,hidden],1000);
  assert.equal(arena.threat(1000).level,5,'stealthed lv20 does not raise threat');
  assert.ok(arena.enemies.some(e=>e.tier==='boss'),'boss spawns at threat 5 in pvp');
  assert.equal(arena.attack(hidden,1000).hits.length,0,'stealthed player cannot attack');
  const boss=arena.enemies.find(e=>e.tier==='boss');
  boss.x=120;boss.y=-90;boss.hp=1;
  const res=arena.attack(high,1500);
  assert.equal(res.bossKill,true);
  assert.deepEqual(arena.bossKills,['high']);
});
test('bomber fuses when close, then explodes on the player and nearby monsters',()=>{
  const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;arena.startedAt=0;
  const b=arena.spawn(p,'bomber',1000);b.x=85;b.y=0;
  arena.step([p],1000);assert.equal(b.phase,'hunt','does not fuse when still far');
  b.x=55;b.y=0;
  const other=arena.spawn(p,'charger',1000);other.x=55;other.y=90;other.hp=other.hpmax=500;
  arena.step([p],1050);assert.equal(b.phase,'fuse');
  assert.ok(arena.snapshot(1050).find(e=>e.id===b.id).fuseLeft>0);
  const events=arena.step([p],1050+1000);
  assert.ok(events.some(e=>e.amount===26));assert.ok(other.hp<500);
  assert.ok(!arena.enemies.includes(b));assert.equal(arena.state(2050).blasts.length,1);
});
test('a bomber cut down by the sword blows up its neighbours for the killer',()=>{
  const arena=new EnemyArena(()=>0),p=player();
  const b=arena.spawn(p,'bomber',0);b.x=0;b.y=-110;b.hp=1;
  const other=arena.spawn(p,'stalker',0);other.x=60;other.y=-150;
  const r=arena.attack({...p},1000);
  assert.ok(r.hits.some(h=>h.burst==='bomb'));assert.ok(r.xp>=b.xp);assert.ok(other.hp<other.hpmax);
});
test('spitter aims, fires a shot that hurts; a blade swats it, parry sends it back',()=>{
  for(const parry of [false,true]){
    const arena=new EnemyArena(()=>0),p={...player(),augments:parry?['parry']:[]};arena.nextSpawn=Infinity;arena.startedAt=0;
    const s=arena.spawn(p,'spitter',0);s.x=300;s.y=0;s.nextShot=0;
    arena.step([p],1000);assert.equal(s.phase,'aim');
    s.x=300;s.y=0;arena.step([p],1600);
    assert.equal(arena.projectiles.length,1);const shot=arena.projectiles[0];
    shot.x=0;shot.y=-110;
    const r=arena.attack({...p},1700);
    assert.ok(r.hits.some(h=>h.deflect));
    if(!parry){assert.equal(arena.projectiles.length,0);continue;}
    assert.equal(shot.owner,'player');shot.x=s.x-30;shot.y=s.y;shot.vx=100;shot.vy=0;
    arena.step([p],1750);assert.ok(s.hp<s.hpmax,'reflected shot hits the spitter');
  }
  const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;arena.startedAt=0;
  arena.projectiles.push({id:'s-x',owner:'enemy',sourceId:'ai-9',x:5,y:0,vx:0,vy:0,r:9,damage:14,until:9e9});
  assert.deepEqual(arena.step([p],1000).filter(e=>e.amount===14).length,1);
});
test('splitter breaks into 3-4 dashing mites when killed',()=>{
  const arena=new EnemyArena(()=>0),p=player();
  const s=arena.spawn(p,'splitter',0);s.x=0;s.y=-110;s.hp=1;
  arena.attack({...p},1000);
  assert.ok(arena.enemies.length>=3&&arena.enemies.length<=4);
  assert.ok(arena.enemies.every(e=>e.type==='mite'&&e.phase==='dash'));
});
test('stalker accelerates within range up to a cap and resets on hit',()=>{
  const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;arena.startedAt=0;arena.lastTime=1000;
  const s=arena.spawn(p,'stalker',1000,{x:350,y:0});s.hp=s.hpmax=100;
  arena.step([p],1050);
  const early=s.ramp;
  for(let t=1150;t<=13000;t+=100){s.x=350;s.y=0;arena.step([p],t);}
  assert.ok(s.ramp>early,'ramps up while in range');
  assert.ok(Math.hypot(s.vx,s.vy)>450&&Math.hypot(s.vx,s.vy)<=560,'exceeds player speed but stays capped');
  arena.damageEnemy(s,5,'human',{},13000);
  assert.equal(s.ramp,0,'hit resets stalker ramp');
});
test('ghosted players pass through bodies without contact damage',()=>{
  const arena=new EnemyArena(()=>0),p={...player(),skillState:{ghost:true}};arena.nextSpawn=Infinity;arena.startedAt=0;
  const e=arena.spawn(p,'stalker',0);e.x=10;e.y=0;
  assert.equal(arena.step([p],1000).length,0);
});
test('spitters steer smoothly: no velocity snaps while kiting around a moving player',()=>{
  const arena=new EnemyArena(()=>0);arena.nextSpawn=Infinity;arena.startedAt=0;
  const p={...player(),x:0,y:0};const s=arena.spawn(p,'spitter',0);s.x=250;s.y=0;s.nextShot=Infinity;
  let worst=0,prev=null;
  // The player walks back and forth across the spitter's preferred range.
  for(let t=50;t<=8000;t+=50){
    p.x=Math.sin(t/700)*160;
    arena.step([p],t);
    if(prev)worst=Math.max(worst,Math.hypot(s.vx-prev.vx,s.vy-prev.vy));
    prev={vx:s.vx,vy:s.vy};
  }
  assert.ok(worst<25,`largest change in one 50ms tick: ${worst.toFixed(1)} px/s`);
  assert.ok(Math.hypot(s.aimX,s.aimY)>.99,'faces the player');
});
test('enemies of every kind come early and in growing packs',()=>{
  const {TYPES}=require('./enemies');
  for(const type of ['spinner','charger','stalker','bomber','spitter','splitter'])assert.equal(TYPES[type].unlock,1,type);
  let seed=5;const arena=new EnemyArena(()=>(seed=(seed*16807)%2147483647)/2147483647),p={...player(),x:0,y:0};
  for(let t=0;t<=10000;t+=50)arena.step([p],t);
  assert.ok(arena.enemies.length>=9,`after 10s: ${arena.enemies.length}`);
});

test('knockback carries enemies outward, then pursuit accelerates without a speed snap',()=>{
  for(const type of ['spinner','stalker','splitter','mite','bomber','spitter','charger']){
    const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;arena.startedAt=0;arena.lastTime=1000;
    const e=arena.spawn(p,type,1000,{x:600,y:0});e.nextShot=Infinity;
    e.pushVx=700;e.staggerUntil=1250;
    let lastX=e.x,lastPush=700;
    for(let now=1050;now<1250;now+=50){
      arena.step([p],now);
      assert.ok(e.x>lastX,`${type}: momentum continues outward during stagger`);
      assert.ok(e.pushVx<lastPush,`${type}: launch slows gradually`);
      assert.equal(e.moveVx,0,`${type}: pursuit is stopped during stagger`);
      lastX=e.x;lastPush=e.pushVx;
    }
    const speeds=[];
    for(let now=1250;now<=1850;now+=50){
      arena.step([p],now);
      speeds.push(Math.hypot(e.vx-e.pushVx,e.vy-e.pushVy));
    }
    assert.ok(speeds[0]>0&&speeds[0]<speeds.at(-1)*.3,`${type}: starts returning slowly`);
    assert.ok(speeds.every((v,i)=>!i||v>speeds[i-1]),`${type}: return speed rises gradually`);
    assert.ok(e.vx<0,`${type}: eventually returns toward the player`);
  }
});

test('launch travel is independent of simulation tick size',()=>{
  const travel=step=>{
    const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;arena.startedAt=0;arena.lastTime=1000;
    const e=arena.spawn(p,'splitter',1000,{x:600,y:0});e.pushVx=1000;e.staggerUntil=2000;
    for(let now=1000+step;now<=1300;now+=step)arena.step([p],now);
    return e.x-600;
  };
  assert.ok(Math.abs(travel(25)-travel(100))<1e-6);
  assert.ok(Math.abs(travel(50)-1000/5*(1-Math.exp(-5*.3)))<1e-6);
});

test('a dash launch interrupts a charge and moves the enemy through momentum',()=>{
  const arena=new EnemyArena(()=>0),p={...player(),skillState:{dash:true}};
  arena.nextSpawn=Infinity;arena.startedAt=0;arena.lastTime=1000;
  const e=arena.spawn(p,'charger',1000,{x:0,y:-110});e.hp=500;
  e.phase='charge';e.phaseUntil=2000;e.aimX=0;e.aimY=1;e.chargeEndX=0;e.chargeEndY=176;
  arena.attack(p,1000);
  assert.equal(e.y,-110,'hit applies an impulse without teleporting');
  arena.step([p],1050);
  assert.equal(e.phase,'recover');
  assert.ok(e.y<-110&&e.y>-175,'moves outward over the first tick, away from the charge endpoint');
  assert.ok(e.vy<0);
});

test('a charger still accelerates if its recovery phase outlasts knockback stagger',()=>{
  const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;arena.startedAt=0;arena.lastTime=1000;
  const e=arena.spawn(p,'charger',1000,{x:600,y:0});
  e.phase='recover';e.phaseUntil=1600;e.staggerUntil=1250;e.pushVx=700;
  for(let now=1050;now<=1550;now+=50)arena.step([p],now);
  assert.equal(e.moveVx,0);
  arena.step([p],1600);
  assert.equal(e.phase,'hunt');
  const firstSpeed=-(e.vx-e.pushVx);
  assert.ok(firstSpeed>0&&firstSpeed<10,'pursuit starts slowly after the stationary phase');
  arena.step([p],1650);
  assert.ok(-(e.vx-e.pushVx)>firstSpeed);
});

test('spitter tracks player while aiming and fires a faster red shot every 3rd attack',()=>{
  const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;arena.startedAt=0;
  const s=arena.spawn(p,'spitter',0,{x:300,y:0});s.nextShot=0;
  let t=100;
  for(let shot=1;shot<=3;shot++){
    s.nextShot=t;arena.step([p],t);assert.equal(s.phase,'aim');
    p.y=120;arena.step([p],t+200);
    assert.ok(s.aimY>0,'aim tracks moving player during windup');
    assert.equal(s.charged,shot===3);
    arena.step([p],t+600);
    const proj=arena.projectiles.at(-1);
    const spd=Math.hypot(proj.vx,proj.vy);
    if(shot<3){assert.ok(spd<300);assert.equal(proj.kind,undefined);}
    else{assert.ok(spd>400,'3rd shot is faster');assert.equal(proj.kind,'spitRed');assert.equal(proj.damage,24);}
    arena.projectiles=[];t+=3000;
  }
});

test('splitter and mite move in repeated short hops with inertia coasting',()=>{
  for(const type of ['splitter','mite']){
    const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;arena.startedAt=0;arena.lastTime=1000;
    const e=arena.spawn(p,type,1000,{x:500,y:0});
    arena.step([p],1050);const peak=Math.hypot(e.vx,e.vy);
    arena.step([p],1200);const coast=Math.hypot(e.vx,e.vy);
    assert.ok(peak>coast&&coast>0,`${type} coasts down after initial hop`);
  }
});

test('charging charger knocks the player back strongly without being pushed itself',()=>{
  const arena=new EnemyArena(()=>0),p=player();arena.nextSpawn=Infinity;arena.startedAt=0;arena.lastTime=1000;
  const c=arena.spawn(p,'charger',1000,{x:-10,y:0});
  c.phase='charge';c.phaseUntil=2000;c.aimX=1;c.aimY=0;c.chargeEndX=280;c.chargeEndY=0;
  arena.step([p],1050);
  const corr=arena.playerCorrections.find(x=>x.id===String(p._id));
  assert.ok(corr&&corr.dvx>600,'player is knocked back strongly along charge');
  assert.equal(c.pushVx||0,0,'charger is not pushed back');
});

test('charger gains speed then brakes smoothly into the marked endpoint',()=>{
  const a=new EnemyArena(()=>0),p=player();a.nextSpawn=Infinity;a.startedAt=1000;a.lastTime=1000;
  const e=a.spawn(p,'charger',1000,{x:300,y:0});
  a.step([p],1050);
  p.y=500; // Keep collision response out of the motion profile.
  const speeds=[];
  for(let t=1900;t<=2800;t+=50){a.step([p],t);speeds.push(Math.hypot(e.vx,e.vy));}
  assert.ok(speeds[0]>0&&speeds[0]<speeds[5],'accelerates after windup');
  assert.ok(speeds[12]>0&&speeds[12]<speeds[8],'brakes before recovery');
  assert.equal(e.phase,'recover');
  assert.equal(e.x,e.chargeEndX);assert.equal(e.y,e.chargeEndY);
});

test('spinner closes the old dead zone and brings its short blade into range',()=>{
  const a=new EnemyArena(()=>0),p=player();a.nextSpawn=Infinity;a.startedAt=1000;a.lastTime=1000;
  const e=a.spawn(p,'spinner',1000,{x:145,y:0});
  let bladeHit=false;
  for(let t=1050;t<=11000;t+=50){
    const events=a.step([p],t);
    if(t===1050)assert.ok(e.vx<0,'approaches instead of backing away at distance 145');
    if(events.some(d=>d.source==='spinner:blade'))bladeHit=true;
  }
  assert.ok(bladeHit,'its own blade can reach a stationary player');
});

test('red spit and boomerangs survive a blade with or without reflection',()=>{
  for(const kind of ['spitRed','sickle'])for(const augments of [[],['parry']]){
    const a=new EnemyArena(()=>0),p={...player(),augments};
    const shot={id:'test-shot',kind,owner:'enemy',sourceId:'test-enemy',x:0,y:-110,vx:10,vy:0,r:10,damage:24,until:5000};
    a.projectiles.push(shot);
    const result=a.attack(p,1000);
    assert.equal(a.projectiles[0],shot);assert.equal(shot.owner,'enemy');
    assert.ok(!result.hits.some(h=>h.deflect));
  }
});

test('splitters coast farther between longer hops and expose synchronized bounce timing',()=>{
  const a=new EnemyArena(()=>0),p=player();a.nextSpawn=Infinity;a.startedAt=1000;a.lastTime=1000;
  const e=a.spawn(p,'splitter',1000,{x:500,y:0});
  a.step([p],1050);const first=e.nextHop,from=e.x;
  a.step([p],1200);
  assert.ok(a.snapshot(1200)[0].hopProgress>0&&a.snapshot(1200)[0].hopProgress<1);
  for(let t=1250;t<=1900;t+=50)a.step([p],t);
  assert.equal(e.nextHop,first,'one long coast rather than another early hop');
  assert.ok(from-e.x>55,'coasts farther than the previous short hop');
  assert.ok(Math.hypot(e.vx,e.vy)>20,'retains momentum between hops');
});
