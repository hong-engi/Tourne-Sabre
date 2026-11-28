const {test}=require('node:test');const assert=require('node:assert/strict');
const {EnemyArena}=require('./enemies');
const rules=require('../../../frontend/src/gameRules');
// Far away from any spawn ring; a bare test player with a custom loadout.
const pl=(loadout,augments=[],spells=['blink','heal'])=>({_id:'p',x:0,y:0,r:25,hp:100,hpmax:100,lv:1,sw_angle:0,sw_r:65,sw_w:40,sw_h:100,
  augments,loadout,spells,poses:[{sw_angle:Math.PI,sw_r:65,sw_w:1,sw_h:1}]});
const arena=()=>{const a=new EnemyArena(()=>.5);a.nextSpawn=Infinity;a.startedAt=0;return a;};
const foe=(a,player,x,y,hp=1000)=>{const e=a.spawn(player,'charger',0,{x,y});e.x=x;e.y=y;e.hp=e.hpmax=hp;return e;};
const cast=(id,extra={})=>({kind:'cast',id,x:0,y:0,ox:0,oy:0,dx:0,dy:-1,...extra});

test('the expansion adds 31 skills, 11 spells and 105 augments with unique ids',()=>{
 assert.equal(rules.SKILLS.length,40);assert.equal(rules.SPELLS.length,18);
 assert.equal(rules.AUGMENTS.length,161);assert.equal(new Set(rules.AUGMENTS.map(a=>a.id)).size,161);
 for (const a of rules.AUGMENTS.filter(a=>a.exclusive)) for (const id of [].concat(a.requires||a.requiresAll)) assert.ok(rules.SKILLS.concat(rules.SPELLS).some(s=>s.id===id),a.id);
});
test('crescent hits a cone in front once the server accepts the cast; cooldown is enforced',()=>{
 const a=arena(),p=pl(['crescent','giant','accel','thrust']);
 const front=foe(a,p,0,-150),behind=foe(a,p,0,150);
 a.attack({...p,bursts:[cast('crescent')]},1000);a.step([p],1050);
 assert.equal(front.hpmax-front.hp,14);assert.equal(behind.hp,1000);
 a.attack({...p,bursts:[cast('crescent')]},1500);a.step([p],1550);
 assert.equal(front.hpmax-front.hp,14,'still cooling down');
 const other=pl(['reverse','giant','accel','thrust']),c=arena(),x=foe(c,other,0,-150);
 c.attack({...other,bursts:[cast('crescent')]},1000);c.step([other],1050);assert.equal(x.hp,1000,'not in the kit');
});
test('delayed areas arm on time, ticking areas tick, and statuses slow or root enemies',()=>{
 const a=arena(),p=pl(['execCircle','bladeRain','accel','thrust'],[],['blink','freezeWave']);
 const e=foe(a,p,0,-150);
 a.attack({...p,bursts:[cast('execCircle')]},1000);
 a.step([p],1500);assert.equal(e.hp,1000,'still warning');
 a.step([p],1950);assert.equal(e.hpmax-e.hp,42);
 const b=arena(),q=pl(['execCircle','bladeRain','accel','thrust'],[],['blink','freezeWave']),f=foe(b,q,0,-100);
 b.attack({...q,bursts:[cast('freezeWave')]},1000);b.step([q],1020);
 assert.ok(f.stunUntil>1500,'rooted');assert.equal(b.skillSpeedFactor(f,1300),0);assert.ok(b.skillSpeedFactor(f,2500)<1,'then slowed');
});
test('parry blocks the first hit, guard reduces later ones, and oath keeps 1 health',()=>{
 const a=arena(),p=pl(['parryStance','ironStance','accel','thrust'],[],['oath','heal']);
 a.attack({...p,bursts:[cast('parryStance')]},1000);
 assert.deepEqual(a.shapeIncoming([p],[{id:'p',amount:40,source:'x'}],1050),[],'blocked');
 assert.equal(a.shapeIncoming([p],[{id:'p',amount:40,source:'x'}],1300)[0].amount,16,'60% guard');
 a.attack({...p,bursts:[cast('oath')]},2000);
 assert.equal(a.shapeIncoming([p],[{id:'p',amount:500,source:'x'}],2200)[0].amount,99);
});
test('shields, heals and blood costs come back on the attack response',()=>{
 const a=arena(),p=pl(['bladeVeil','bloodPact','accel','thrust'],[],['blink','secondDawn']);
 const r=a.attack({...p,bursts:[cast('bladeVeil'),cast('bloodPact'),cast('secondDawn')]},1000);
 assert.ok(r.shield>=18);assert.equal(r.hpCost,10);assert.equal(r.heal,20);
});
test('expansion blades are only accepted while their skill is active, with server power',()=>{
 const a=arena(),p=pl(['kingsMarch','giant','accel','thrust']);const e=foe(a,p,100,0);
 const blade={blade:'sk-kingsMarch-0',sw_angle:-Math.PI/2,sw_r:40,sw_w:22,sw_h:50};
 a.attack({...p,poses:[blade]},1000);assert.equal(e.hp,1000,'not cast');
 a.attack({...p,bursts:[cast('kingsMarch')]},1200);
 const r=a.attack({...p,poses:[blade]},1400);assert.ok(r.hits.some(h=>h.blade==='sk-kingsMarch-0'&&h.damage===7));
});
test('exclusive and combo augments need their skills equipped; transcendent waits for level 15',()=>{
 const kit={skills:['crescent','reverse','accel','thrust'],spells:['blink','heal']};
 const pick=id=>rules.AUGMENTS.find(a=>a.id===id);
 const open=(id,k=kit)=>{let seen=false;let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for (let i=0;i<300&&!seen;i++){const o=rules.rollOffer([],rnd,k,{},20);seen=!!(o&&o.options.includes(id));}return seen;};
 assert.ok(open('xQ04'));assert.ok(open('combo1'));
 assert.ok(!open('combo1',{skills:['crescent','giant','accel','thrust'],spells:['blink','heal']}),'needs both');
 assert.equal(rules.tierOdds({},{level:14,owned:[]}).transcendent,0);
 assert.equal(rules.tierOdds({},{level:15,owned:[]}).transcendent,2);
 assert.equal(rules.tierOdds({transcendent:20},{level:15,owned:[]}).transcendent,10);
 assert.equal(rules.tierOdds({},{level:20,owned:['causalKnot']}).transcendent,0,'one per run');
 assert.ok(pick('rainbowKing').tier==='transcendent');
});
test('patched specs: X-Q12 adds side lines, X-W04 drops the slow',()=>{
 assert.equal(rules.specFor('horizon',['xQ12']).fx.length,3);
 assert.ok(rules.specFor('ironStance',[]).speed);assert.equal(rules.specFor('ironStance',['xW04']).speed,undefined);
 assert.equal(rules.specFor('horizon',[]).fx.length,1,'tables are not mutated');
});
test('life anchor and causal knot save lethal hits once and move the player back',()=>{
 const a=arena(),p=pl(['crescent','giant','accel','thrust'],['causalKnot'],['blink','lifeAnchor']);
 a.attack({...p,bursts:[cast('lifeAnchor')]},1000);
 const out=a.shapeIncoming([{...p,x:300,y:0}],[{id:'p',amount:999,source:'x'}],1500);
 assert.equal(out[0].amount,80,'down to 20%');assert.ok(a.playerCorrections.some(c=>c.dx===-300));
 a.playerCorrections=[];
 assert.equal(a.shapeIncoming([p],[{id:'p',amount:999,source:'x'}],3000)[0].amount,999,'10s lock between saves');
 assert.equal(a.shapeIncoming([p],[{id:'p',amount:999,source:'x'}],12000)[0].amount,65,'knot: 35%');
 assert.equal(a.shapeIncoming([p],[{id:'p',amount:999,source:'x'}],30000)[0].amount,999,'knot is once per run');
});

test('reverse echo retains the original blade direction and starts after the real turn',()=>{
 const a=arena(),p=pl(['reverse','giant','accel','thrust'],['xQ01']);
 a.attack({...p,bursts:[cast('reverse',{bladeAngle:1.2,spinDirection:-1})]},1000);
 const z=a.zones.find(z=>z.tag==='afterSpin');
 assert.equal(z.armAt,1300);assert.equal(z.until,1600);
 assert.equal(z.bladeAngle,1.2);assert.equal(z.spinDirection,-1);
 assert.equal(z.power,.8);assert.equal(z.ticksLeft,1);
});

test('skill area snapshots retain charge age and tick spacing for deterministic effects',()=>{
 const a=arena(),p=pl(['bladeRain','iaido','accel','thrust']);
 a.attack({...p,bursts:[cast('bladeRain'),cast('iaido')]},1000);
 const zones=a.state(1200).skillZones;
 const rain=zones.find(z=>z.skill==='bladeRain'),slash=zones.find(z=>z.skill==='iaido');
 assert.equal(rain.age,200);assert.equal(rain.armIn,300);assert.equal(rain.every,500);assert.equal(rain.tag,'rain');
 assert.equal(slash.age,200);assert.equal(slash.armIn,400);assert.equal(slash.warn,true);
});

test('echoArt and timeSplitter snapshots expose echo metadata and causalKnot sets knotUsed flag',()=>{
 const a=arena(),p=pl(['crossScar','giant','accel','thrust'],['timeSplitter','causalKnot']);
 a.attack({...p,bursts:[cast('crossScar',{x:10,y:20})]},1000);
 const echoes=a.state(1200).skillZones.filter(z=>z.echo);
 assert.equal(echoes.length,2);
 assert.equal(echoes[0].echo,'timeSplitter');
 assert.equal(echoes[0].echoLead,true);
 assert.equal(echoes[1].echoLead,false);
 assert.equal(echoes[0].castX,10);assert.equal(echoes[0].castY,20);
 assert.equal(a.zones.find(z=>z.echo).follow,false);
 a.shapeIncoming([p],[{id:'p',amount:999,source:'x'}],1500);
 const r=a.attack(p,1600);
 assert.equal(r.flags.knotUsed,true);
});
