const {test}=require('node:test');const assert=require('node:assert/strict');
const {EnemyArena}=require('./enemies');
const rules=require('../../../frontend/src/gameRules');
const p=(extra={})=>({_id:'p',x:0,y:0,r:25,hp:100,lv:1,sw_angle:Math.PI,sw_r:65,sw_w:40,sw_h:100,augments:[],...extra});
const seeded=seed=>()=>(seed=(seed*16807)%2147483647)/2147483647;

test('every offer starts at 40/45/15 and raises gold/prismatic odds until they appear',()=>{
 assert.deepEqual(rules.tierOdds({gold:0,prismatic:0}),{silver:40,gold:45,prismatic:15});
 let pity={gold:0,prismatic:0};
 pity=rules.nextPity(pity,'silver');assert.deepEqual(rules.tierOdds(pity),{silver:25,gold:55,prismatic:20});
 pity=rules.nextPity(pity,'gold');assert.deepEqual(pity,{gold:0,prismatic:2});
 assert.deepEqual(rules.tierOdds(pity),{silver:30,gold:45,prismatic:25});
 assert.deepEqual(rules.nextPity(pity,'prismatic'),{gold:0,prismatic:0});
 const odds=rules.tierOdds({gold:20,prismatic:30});assert.equal(odds.silver+odds.gold+odds.prismatic,100);assert.ok(odds.silver>=0&&odds.gold>=0);
 // The odds are actually used, from the very first offer.
 const random=seeded(9),seen={silver:0,gold:0,prismatic:0};
 for(let i=0;i<3000;i++)seen[rules.rollOffer([],random,undefined,{gold:0,prismatic:0}).tier]++;
 assert.ok(seen.prismatic>330&&seen.prismatic<570,`prismatic ${seen.prismatic}`);
 assert.ok(seen.gold>1200&&seen.gold<1500,`gold ${seen.gold}`);
});
test('skill augments are offered only to players who brought that skill',()=>{
 const random=seeded(4),kit={skills:['dash','turret','slam','boomerang'],spells:['ghost','smite']};
 const offered=new Set();
 for(let i=0;i<400;i++)for(const tier of ['silver','gold','prismatic'])(rules.rollOffer([],()=>random(),kit,{gold:tier==='silver'?0:20,prismatic:tier==='prismatic'?40:0})?.options||[]).forEach(id=>offered.add(id));
 for(const id of ['cyclone','duration','reach','pierce','chain','tempest','quake','twin','execute','blinkStrike','wildfire','frenzy'])assert.ok(!offered.has(id),id);
 for(const id of ['momentum','longThrow','turretTwin','aftershock','mirror','pursuit'])assert.ok(offered.has(id),id);
 assert.deepEqual(rules.validSkills(['dash','dash','slam','turret']),rules.DEFAULT_SKILLS,'four different skills');
 assert.deepEqual(rules.validSkills(['dash','twinBlade','slam','turret']),['dash','twinBlade','slam','turret']);
});
test('skill blades only count for players who brought the skill, with server-owned power',()=>{
 const a=new EnemyArena(()=>0);const e=a.spawn(p(),'charger');e.hp=e.hpmax=500;e.x=0;e.y=110;
 const twin={blade:'twin',sw_angle:Math.PI,sw_r:65,sw_w:40,sw_h:100,power:5};
 assert.equal(a.attack(p({sw_angle:0,poses:[twin]}),1000).hits.length,0,'twin blade not brought');
 assert.equal(a.attack(p({sw_angle:0,loadout:['twinBlade','giant','accel','thrust'],poses:[twin]}),1200).hits[0].damage,10,'power is 1 whatever the client says');
 const turret={blade:'turret-1',sw_angle:Math.PI,sw_r:65,sw_w:40,sw_h:100};
 const kit=['turret','giant','accel','thrust'];
 e.x=900;e.y=110;
 assert.equal(a.attack(p({sw_angle:0,loadout:kit,poses:[turret]}),1400).hits.length,0,'a turret pose without a position is dropped');
 assert.equal(a.attack(p({sw_angle:0,loadout:kit,poses:[{...turret,x:900,y:0}]}),1600).hits[0].damage,8,'turret deals 80%');
});
test('dash slash hits harder and launches the enemy',()=>{
 const a=new EnemyArena(()=>0),player=p({sw_angle:0,skillState:{dash:true}});const e=a.spawn(player,'stalker');e.hp=e.hpmax=500;e.x=0;e.y=-110;
 const hit=a.attack(player,1000).hits[0];assert.equal(hit.damage,18);
 assert.ok(e.pushVy<-1000&&e.staggerUntil>1000);
 a.lastTime=1000;a.step([{...player,x:0,y:400}],1100);assert.ok(e.y<-150,`flew back to ${e.y}`);
});
test('slam needs the skill, respects its cooldown, pushes enemies, and aftershock follows once',()=>{
 const a=new EnemyArena(()=>0);const e=a.spawn(p(),'charger');e.hp=e.hpmax=500;e.x=100;e.y=0;
 const slam={kind:'slam',x:0,y:0},kit=['slam','giant','accel','thrust'];
 assert.ok(!a.attack(p({bursts:[slam]}),1000).hits.some(h=>h.burst),'not brought');
 const r=a.attack(p({loadout:kit,bursts:[slam]}),1200);
 assert.ok(r.hits.some(h=>h.burst==='slam'));assert.equal(r.hits.find(h=>h.id===e.id).damage,25);assert.ok(e.pushVx>500);
 assert.ok(!a.attack(p({loadout:kit,bursts:[slam]}),2000).hits.some(h=>h.burst),'cooldown');
 assert.ok(!a.attack(p({loadout:kit,bursts:[{kind:'aftershock',x:0,y:0}]}),2200).hits.some(h=>h.burst),'aftershock needs the augment');
 const b=new EnemyArena(()=>0),q=p({loadout:kit,augments:['aftershock']});
 b.attack({...q,bursts:[slam]},1000);
 assert.ok(b.attack({...q,bursts:[{kind:'aftershock',x:0,y:0}]},1600).hits.some(h=>h.burst==='aftershock'));
 assert.ok(!b.attack({...q,bursts:[{kind:'aftershock',x:0,y:0}]},1800).hits.some(h=>h.burst),'only once');
});
test('ignite burns struck enemies each second, and wildfire spreads it on death',()=>{
 const a=new EnemyArena(()=>0),player=p({sw_angle:0,spells:['ignite','heal'],augments:['wildfire']});
 const e=a.spawn(player,'charger'),near=a.spawn(player,'charger');e.hp=e.hpmax=500;e.x=0;e.y=-110;near.hp=near.hpmax=500;near.x=900;near.y=900;
 a.castSpell(player,'ignite',1000);
 a.attack(player,1000);assert.equal(e.hp,490);assert.equal(e.burnUntil,4000);
 a.lastTime=1900;a.step([{...player,x:0,y:-3000}],2000);
 assert.equal(e.hp,486,'burn tick of 40% attack');
 a.attack(player,2100); // drain rewards
 e.hp=1;near.x=e.x+60;near.y=e.y;a.lastTime=2900;a.step([{...player,x:0,y:-3000}],3000);
 assert.ok(near.burnUntil>3000,'wildfire spread');
 const r=a.attack({...player,sw_angle:Math.PI},3100);assert.ok(r.hits.some(h=>h.burn&&h.killed));
});
test('exhaust slows nearby enemies and softens their hits; smite strikes the nearest',()=>{
 const a=new EnemyArena(()=>0),player=p();const e=a.spawn(player,'stalker'),far=a.spawn(player,'stalker');
 e.x=200;e.y=0;far.x=1000;far.y=0;e.hp=e.hpmax=500;
 a.castSpell(player,'exhaust',1000);
 assert.equal(e.exhaustUntil,4000);assert.ok(!far.exhaustUntil);
 assert.equal(a.outgoing(e,20,1500),12);assert.equal(a.outgoing(far,20,1500),20);
 a.castSpell({...player,lv:3},'smite',1000);
 assert.equal(e.hp,420);assert.equal(far.hp,far.hpmax);
 assert.ok(a.attack({...player,sw_angle:Math.PI},1100).hits.some(h=>h.smite));
});
test('prismatics: storm blades, storm lord bolts, chain reaction and vampire lord',()=>{
 const a=new EnemyArena(()=>0);a.nextSpawn=Infinity;a.startedAt=0;
 const storm={blade:'storm-0',sw_angle:Math.PI,sw_r:65,sw_w:40,sw_h:100};
 const e=a.spawn(p(),'charger');e.hp=e.hpmax=500;e.x=0;e.y=110;
 assert.equal(a.attack(p({sw_angle:0,poses:[storm]}),1000).hits.length,0,'needs bladeStorm');
 assert.equal(a.attack(p({sw_angle:0,augments:['bladeStorm'],poses:[storm]}),1200).hits[0].damage,10);
 // Storm lord strikes the three nearest every two seconds.
 const b=new EnemyArena(()=>0);b.nextSpawn=Infinity;b.startedAt=0;const lord=p({augments:['stormLord']});
 const foes=[0,1,2,3].map(i=>{const f=b.spawn(lord,'charger');f.hp=f.hpmax=500;f.x=100+i*60;f.y=0;return f;});
 b.step([lord],1000);assert.deepEqual(foes.map(f=>f.hp),[485,485,485,500]);
 b.step([lord],1500);assert.equal(foes[0].hp,485,'cooldown');
 // Chain reaction: a kill explodes and the explosion's kills explode too.
 const c=new EnemyArena(()=>0);c.nextSpawn=Infinity;const boom=p({sw_angle:0,augments:['chainReaction']});
 const first=c.spawn(boom,'stalker'),second=c.spawn(boom,'stalker'),third=c.spawn(boom,'stalker');
 first.x=0;first.y=-110;first.hp=1;second.x=0;second.y=-220;second.hp=5;third.x=0;third.y=-330;third.hp=500;third.hpmax=500;
 const r=c.attack(boom,1000);assert.equal(second.hp,0);assert.equal(third.hp,480);assert.ok(r.xp>=first.xp+second.xp);
 // Vampire lord heals 8% of sword damage.
 const d=new EnemyArena(()=>0);d.nextSpawn=Infinity;const vamp=p({sw_angle:0,lv:41,augments:['vampLord']});
 const target=d.spawn(vamp,'charger');target.hp=target.hpmax=5000;target.x=0;target.y=-110;
 assert.equal(d.attack(vamp,1000).heal,4);
});
