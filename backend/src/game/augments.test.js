const {test}=require('node:test');const assert=require('node:assert/strict');
const {EnemyArena}=require('./enemies');
const {canChoose,resolveDamage}=require('../../../frontend/src/gameRules');
const p=()=>({_id:'p',x:0,y:0,r:25,hp:100,lv:1,sw_angle:0,sw_r:65,sw_w:40,sw_h:100,augments:[]});
test('tip and knockback affect server-confirmed damage and enemy position',()=>{
 const a=new EnemyArena(()=>0),player={...p(),augments:['tip','knockback']};const e=a.spawn(player,'charger');e.x=0;e.y=-130;
 const r=a.attack(player,1000);assert.equal(r.hits[0].damage,18);assert.ok(e.pushVy<0&&e.staggerUntil>1000);
});
test('reversal bonus applies to five hits; a new Q token refreshes it',()=>{
 const a=new EnemyArena(()=>0),player={...p(),augments:['reverse'],skillState:{reverseToken:1}};const e=a.spawn(player,'charger');e.hp=500;e.x=0;e.y=-90;
 const swing={...player,poses:[{sw_angle:Math.PI,sw_r:65,sw_w:40,sw_h:100},{sw_angle:0,sw_r:65,sw_w:40,sw_h:100}]};
 for(let i=0;i<5;i++)assert.equal(a.attack(swing,1000+i*250).hits[0].damage,16);
 assert.equal(a.attack(swing,2300).hits[0].damage,10);
 swing.skillState.reverseToken=2;assert.equal(a.attack(swing,2600).hits[0].damage,16);
});
test('shockwave hits nearby targets and loot grants shield on confirmed kills',()=>{
 const a=new EnemyArena(()=>0),player={...p(),augments:['quake','spoils'],skillState:{giant:true}};
 const e=a.spawn(player,'stalker'),other=a.spawn(player,'stalker');e.x=0;e.y=-130;e.hp=1;other.x=65;other.y=-130;
 const r=a.attack(player,1000);assert.equal(r.shieldGained,20);assert.ok(r.hits.some(h=>h.shock));assert.ok(r.hits.some(h=>h.shockwave));
});
test('selection keeps the room but pauses attacks and AI against that player',()=>{
 const a=new EnemyArena(()=>0),player=p();a.step([player],1000);const before=a.snapshot();
 player.choosingAugment=true;assert.deepEqual(a.step([player],1100),[]);assert.equal(a.enemies.length,before.length);
 assert.deepEqual(a.attack(player,1200),{hits:[],xp:0});
 assert.equal(resolveDamage({...player,hp:5},50,1200).hp,5);
});
test('offers are one rarity, three distinct choices, and only offered augments can be taken',()=>{
 const {rollOffer,rerollOffer,AUGMENTS}=require('../../../frontend/src/gameRules');
 let seed=1;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<50;i++){
  const offer=rollOffer([],random);
  assert.equal(offer.options.length,3);assert.equal(new Set(offer.options).size,3);
  assert.ok(offer.options.every(id=>AUGMENTS.find(a=>a.id===id).tier===offer.tier));
  // Rerolling one card swaps only that card, once.
  const next=rerollOffer([],offer,1,random);
  assert.equal(next.tier,offer.tier);assert.equal(next.options[0],offer.options[0]);assert.equal(next.options[2],offer.options[2]);
  assert.ok(!offer.options.includes(next.options[1]));assert.equal(AUGMENTS.find(a=>a.id===next.options[1]).tier,offer.tier);
  assert.deepEqual(next.rerolled,[false,true,false]);
  assert.equal(rerollOffer([],next,1,random),null,'each card rerolls once');
  const last=rerollOffer([],rerollOffer([],next,0,random),2,random);
  assert.deepEqual(last.rerolled,[true,true,true]);
  assert.ok(!last.options.includes(offer.options[1])&&!last.options.includes(offer.options[0]),'rerolled-away cards do not come back');
  assert.equal(new Set(last.options).size,3);
 }
 const offer={tier:'gold',options:['thorns','tip','chain']};
 assert.equal(canChoose([],3,'thorns',offer),true);
 assert.equal(canChoose([],3,'vampire',offer),false,'not offered');
 assert.equal(canChoose([],2,'thorns',offer),false,'no milestone yet');
 assert.equal(canChoose(['armor','armor'],6,'armor',{tier:'silver',options:['armor']}),false,'max rank');
});
test('thorns armor cuts incoming damage and hits back with 300% of attack power',()=>{
 for(const lv of [1,11]){
  const a=new EnemyArena(()=>0),player={...p(),lv,augments:['thorns']};a.nextSpawn=Infinity;
  const e=a.spawn(player,'charger');e.hp=e.hpmax=500;e.x=50;e.y=0;
  const events=a.step([player],1000);
  assert.equal(events.length,1);assert.equal(e.hp,500-(10+lv-1)*3);
  assert.equal(resolveDamage({...player,hp:100},events[0].amount,1000).hp,100-Math.round(events[0].amount*.75));
  const r=a.attack({...player,sw_angle:Math.PI},1100);
  assert.ok(r.hits.some(h=>h.thorns&&h.damage===(10+lv-1)*3));
 }
});
test('stacked augments compound multiplicatively and never zero out',()=>{
 const {modifiers,canChoose}=require('../../../frontend/src/gameRules');
 const many=n=>Array(n).fill('haste');
 assert.ok(Math.abs(modifiers(many(3)).hasteCooldown-.75**3)<1e-9);
 assert.ok(modifiers(many(40)).hasteCooldown>0);
 assert.equal(canChoose(Array(5).fill('length'),18,'length',{tier:'silver',options:['length']}),true);
 assert.equal(canChoose(['tip'],6,'tip',{tier:'gold',options:['tip']}),false,'unique augments stay single');
});
test('blink-only augments are offered only to players who brought blink',()=>{
 const {rollOffer}=require('../../../frontend/src/gameRules');
 let seed=3;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<200;i++)assert.ok(!(rollOffer([],random,['ghost','heal'])?.options||[]).includes('blinkStrike'));
});
test('extra blades need their augment, and nova fires once per level',()=>{
 const a=new EnemyArena(()=>0),player=p();const e=a.spawn(player,'charger');e.hp=e.hpmax=500;e.x=0;e.y=110;
 const back={blade:'back',sw_angle:Math.PI,sw_r:40,sw_w:30,sw_h:60,power:.6};
 assert.equal(a.attack({...player,poses:[back]},1000).hits.length,0,'no doubleEdge');
 assert.equal(a.attack({...player,augments:['doubleEdge'],poses:[back]},1200).hits[0].damage,8);
 const nova={...player,augments:['nova'],lv:2,sw_angle:Math.PI,bursts:[{kind:'nova',x:0,y:0}]};
 assert.ok(a.attack(nova,1400).hits.some(h=>h.burst==='nova'));
 assert.ok(!a.attack(nova,1600).hits.some(h=>h.burst==='nova'),'same level again');
 assert.ok(!a.attack({...player,sw_angle:Math.PI,lv:3,bursts:[{kind:'nova',x:0,y:0}]},1800).hits.some(h=>h.burst),'needs nova');
});
