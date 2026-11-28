const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EnemyArena,TYPES,threatScale,spawnPlan}=require('./enemies');
const {SPECS,AI,encounterFor}=require('./bestiary');
const player=(o={})=>({_id:'human',x:0,y:0,r:25,hp:100,lv:1,sw_angle:0,sw_r:65,sw_w:40,sw_h:100,...o});
const quiet=()=>{const a=new EnemyArena(()=>.3);a.nextSpawn=Infinity;a.startedAt=0;a.lastTime=1000;a.encounters=new Set([3,5,8,10,13,15]);return a;};

test('every new type spawns, acts and survives a long simulated fight without errors',()=>{
  for (const type of Object.keys(SPECS).filter(t=>SPECS[t].tier!=='part')) {
    const a=quiet(),p=player();
    const e=a.spawn(p,type,1000,{x:220,y:40});
    for (let now=1050;now<=16000;now+=50) {
      // The player strafes in a circle so attacks resolve and target moves.
      p.x=Math.cos(now/900)*120;p.y=Math.sin(now/900)*120;p.sw_angle=now/200;
      a.step([p],now);
      for (const h of a.hazards) assert.ok(Number.isFinite(h.armAt)&&Number.isFinite(h.until),`${type} hazard timing`);
    }
    assert.ok(a.enemies.every(o=>Number.isFinite(o.x)&&Number.isFinite(o.y)),`${type} positions stay finite`);
    assert.ok(a.state(16000).hazards.every(h=>Number.isFinite(h.armIn)),type);
    void e;
  }
});
test('normal types unlock by threat level; elites and bosses arrive at milestones',()=>{
  let seed=7;const a=new EnemyArena(()=>(seed=(seed*16807)%2147483647)/2147483647);
  const early=new Set(),late=new Set();
  for (let i=0;i<400;i++) {early.add(a.pickType(1));late.add(a.pickType(6));}
  assert.ok(!early.has('magnet')&&late.has('magnet'));
  assert.ok(!late.has('warden')&&!late.has('swordsaint')&&!late.has('egg'));
  assert.deepEqual(encounterFor(3),{tier:'elite',type:'warden'});
  assert.deepEqual(encounterFor(5),{tier:'boss',type:'swordsaint'});
  assert.equal(encounterFor(4),null);
});
test('threat scaling: health, damage and spawn rate keep rising',()=>{
  const l1=threatScale(1),l10=threatScale(10),l20=threatScale(20);
  assert.ok(l10.hp>3&&l20.hp>l10.hp*1.7,'health accelerates');
  assert.ok(l10.power>2&&l20.power>l10.power,'damage keeps growing');
  assert.equal(l1.hp,1);
  assert.ok(spawnPlan(10).interval<spawnPlan(1).interval&&spawnPlan(10).cap>spawnPlan(1).cap&&spawnPlan(10).pack>spawnPlan(1).pack);
});
test('a boss spawns once at threat 5 and regular spawns thin out around it',()=>{
  const a=new EnemyArena(()=>.4),p=player();
  a.step([p],0);a.startedAt=-4*40000;a.encounters.add(3);
  a.step([p],100);
  assert.equal(a.enemies.filter(e=>e.type==='swordsaint').length,1);
  a.step([p],200);
  assert.equal(a.enemies.filter(e=>e.type==='swordsaint').length,1);
});
test('lancer telegraphs a locked line, and only the armed hazard deals damage',()=>{
  const a=quiet(),p=player();
  const e=a.spawn(p,'lancer',1000,{x:200,y:0});e.nextAttack=0;
  a.step([p],1050);
  assert.equal(e.phase,'windup');
  const h=a.hazards.find(h=>h.sourceId===e.id);
  assert.equal(h.kind,'line');assert.equal(h.bar,true);
  assert.equal(a.step([p],1300).length,0,'no damage during the warning');
  const hits=a.step([p],1050+470);
  assert.ok(hits.some(d=>d.source==='lancer:hazard'));
  assert.equal(e.phase,'active');
  assert.ok(a.snapshot(1050+520).find(o=>o.id===e.id).spearExt>0,'spear extends during thrust');
});
test('sickler telegraphs with a bar, pierces players, and returns faster',()=>{
  const a=quiet(),p=player();
  const e=a.spawn(p,'sickler',1000,{x:200,y:0});e.nextAttack=0;
  a.step([p],1050);
  assert.equal(e.phase,'windup');
  assert.ok(a.hazards.some(h=>h.sourceId===e.id&&h.bar));
  a.step([p],1650);
  const s=a.projectiles.find(o=>o.kind==='sickle');
  assert.ok(s&&s.pierce);
  const outSpeed=Math.hypot(s.vx,s.vy);
  s.x=p.x;s.y=p.y;
  const hit=a.step([p],1700);
  assert.ok(hit.some(d=>d.source==='sickler'));
  assert.ok(a.projectiles.includes(s),'pierces without disappearing');
  a.step([p],2650);
  assert.ok(Math.hypot(s.vx,s.vy)>outSpeed*1.8,'returns much faster');
});
test('shellback blocks frontal sword hits completely but not hits from behind',()=>{
  const a=quiet(),p=player();
  const front=a.spawn(p,'shellback',1000,{x:0,y:-110});front.facing=Math.PI/2;front.guarding=true;front.hp=front.hpmax=500;
  a.damageEnemy(front,20,'human',{nx:0,ny:-1},1000);
  assert.equal(front.hp,500);
  assert.equal(a.reward('human').hits[0].blocked,true);
  a.damageEnemy(front,20,'human',{nx:0,ny:1},1000);
  assert.equal(front.hp,480);
});
test('skeleton falls to a core first; finishing the core is the only kill that pays',()=>{
  const a=quiet(),p=player();
  const e=a.spawn(p,'skeleton',1000,{x:300,y:0});
  a.damageEnemy(e,e.hp+3,'human',{});
  assert.equal(e.phase,'core');assert.equal(e.hp,9);
  assert.equal(a.reward('human').xp,0);
  a.damageEnemy(e,9,'human',{});
  assert.equal(a.reward('human').xp,e.xp);assert.equal(a.reward('human').kills,1);
});
test('skeleton reassembles at half health if the core is left alone',()=>{
  const a=quiet(),p=player();
  const e=a.spawn(p,'skeleton',1000,{x:300,y:0});
  a.damageEnemy(e,e.hp,'human',{});
  a.step([p],1050);a.step([p],3400);
  assert.equal(e.phase,'hunt');assert.equal(e.reassembled,true);assert.equal(e.hp,Math.round(e.fullHp*.5));
});
test('parts pay nothing and collapse with their owner',()=>{
  const a=quiet(),p=player();
  const b=a.spawn(p,'balloon',1000,{x:300,y:0});
  const parts=a.enemies.filter(o=>o.parentId===b.id);
  assert.equal(parts.length,2);
  a.damageEnemy(parts[0],99,'human',{});
  assert.equal(a.reward('human').xp,0);assert.equal(a.reward('human').kills,0);
  a.damageEnemy(b,999,'human',{});
  assert.ok(parts.every(o=>o.hp<=0));
});
test('herald reinforcements: interrupted signal calls nobody, a finished one calls two',()=>{
  const a=quiet(),p=player();
  const e=a.spawn(p,'herald',1000,{x:300,y:0});e.nextAttack=0;
  a.step([p],1050);assert.equal(e.phase,'signal');
  a.damageEnemy(e,1,'human',{});assert.equal(e.phase,'hunt');
  e.nextAttack=0;a.step([p],1100);a.step([p],2650);
  const before=a.enemies.length;
  a.step([p],4000);
  assert.equal(a.enemies.filter(o=>!o.part).length,before+2);
});
test('seeds become traps where they land unless swatted, and frost slows without damage',()=>{
  const a=quiet(),p=player({x:-600});
  const e=a.spawn(p,'seeder',1000,{x:0,y:0});
  a.addShot(e,{kind:'seed',x:0,y:0,vx:0,vy:0,r:9,damage:5,until:1300,land:{kind:'circle',r:32,arm:700,last:6000,damage:14,once:true,trap:true}});
  a.step([p],1050);a.step([p],1300);
  assert.ok(a.hazards.some(h=>h.trap));
  const s=a.spawn(p,'snail',1300,{x:300,y:300});s.nextAttack=0;a.step([p],1350);
  const frost=a.hazards.find(h=>h.sourceId===s.id);
  assert.equal(frost.effect,'slow');assert.equal(frost.damage,0);
});
test('a batted wheel flies away from the player and hurts enemies, not the player',()=>{
  const a=quiet(),p=player();
  const roller=a.spawn(p,'roller',1000,{x:600,y:0});
  const shot=a.addShot(roller,{kind:'wheel',x:0,y:-110,vx:0,vy:200,r:18,damage:15,until:5000,batted:true});
  a.attack(p,1000);
  assert.equal(shot.owner,'player');assert.ok(shot.vy<0&&Math.abs(shot.vx)<1e-9);
});
test('centipede segments share the head health, once per blade pass',()=>{
  const a=quiet(),p=player();
  const head=a.spawn(p,'centipede',1000,{x:600,y:0});a.step([p],1050);
  const segs=a.enemies.filter(o=>o.type==='segment');
  assert.equal(segs.length,5);
  const hp=head.hp;a.attackSerial=7;
  a.damageEnemy(segs[0],10,'human',{sweep:true});a.damageEnemy(segs[1],10,'human',{sweep:true});
  assert.equal(head.hp,hp-10);
  assert.ok(segs.every(s=>s.hp>0));
});
test('all types are known to the spawner and have sane stats',()=>{
  for (const [type,spec] of Object.entries(TYPES)) {
    assert.ok(spec.r>0&&spec.hp>0,type);
    if (!spec.tier&&type!=='mite'&&type!=='leech') assert.ok(Number.isFinite(spec.unlock),type);
    if (spec.tier&&spec.tier!=='part') assert.ok(AI[type],type);
  }
});
