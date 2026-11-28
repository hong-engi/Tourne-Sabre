const test=require('node:test');
const assert=require('node:assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {EnemyLab,readNotes,writeNote,readFeedback,writeFeedback}=require('./lab');

function seeded(seed=7) {
  return ()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
}

test('lab lists every non-part enemy type', ()=>{
  const types=new EnemyLab().types();
  assert.ok(types.length>=40);
  assert.ok(types.some(t=>t.type==='lancer'&&t.tier==='normal'));
  assert.ok(types.some(t=>t.tier==='boss'));
  assert.ok(!types.some(t=>t.tier==='part'));
});

test('each lab type simulates its own enemy and the dummy never dies', ()=>{
  const lab=new EnemyLab({random:seeded()});
  const t0=1e6;
  for (const {type} of lab.types()) {
    let state;
    for (let k=1;k<=20;k++) state=lab.step(type,t0+k*110,{attack:k%2===0});
    assert.strictEqual(state.type,type);
    // Self-destructing enemies may be in the 1.2s respawn gap.
    assert.ok(state.enemies.length>0||lab.sims.get(type).respawnAt>0,`${type} has enemies or is respawning`);
    assert.ok(Number.isFinite(state.dummy.x)&&Number.isFinite(state.dummy.y));
  }
});

test('lab simulations stay separate and reset brings the subject back', ()=>{
  const lab=new EnemyLab({random:seeded(3)});
  lab.step('flea',1000);lab.step('lancer',1000);
  assert.notStrictEqual(lab.sims.get('flea').arena,lab.sims.get('lancer').arena);
  const sim=lab.reset('lancer',2000);
  assert.strictEqual(sim.arena.enemies.filter(e=>e.type==='lancer').length,1);
  assert.throws(()=>lab.reset('nope'));
});

test('playable lab step uses user position/poses and spawns companions for support enemies', ()=>{
  const lab=new EnemyLab({random:seeded(9)});
  const menderState=lab.stepPlay('mender',1000,{x:0,y:0,sw_angle:0,sw_r:65,sw_w:40,sw_h:100});
  assert.ok(menderState.enemies.length>=3,'mender spawns with hurt allies');
  const bannerState=lab.stepPlay('banner',1000,{x:0,y:0,sw_angle:0,sw_r:65,sw_w:40,sw_h:100});
  assert.ok(bannerState.enemies.length>=3,'banner spawns with allies to buff');
  const sim=lab.reset('lancer',2000);
  const target=sim.arena.enemies[0];
  const res=lab.stepPlay('lancer',2050,{x:target.x,y:target.y+100,sw_angle:0,sw_r:65,sw_w:40,sw_h:100,poses:[{sw_angle:0,sw_r:65,sw_w:40,sw_h:100}]});
  assert.ok(res.attackHits.length>0,'player sword hits the enemy in playable mode');
  assert.ok(target.hp<target.hpmax);
});

test('a lagging tab resumes from now instead of replaying', ()=>{
  const lab=new EnemyLab({random:seeded(5)});
  lab.step('charger',1000);
  lab.step('charger',600000);
  assert.ok(lab.sims.get('charger').clock>=599900);
});

test('notes save, update status and delete on empty text', ()=>{
  const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'lab-notes-')),'notes.json');
  assert.deepStrictEqual(readNotes(file),{});
  writeNote('lancer',{text:'예고 더 길게',status:'todo'},file);
  writeNote('flea',{text:'메모',status:'weird'},file);
  const notes=readNotes(file);
  assert.strictEqual(notes.lancer.status,'todo');
  assert.strictEqual(notes.flea.status,'note');
  assert.deepStrictEqual(Object.keys(notes),['flea','lancer']);
  writeNote('lancer',{text:'  '},file);
  assert.ok(!readNotes(file).lancer);
  assert.throws(()=>writeNote('nope',{text:'x'},file));
});

test('codex training ground carries the kit and respawns its pack', ()=>{
  const lab=new EnemyLab({random:seeded(11)});
  const setup={loadout:['thrust','reverse','giant','accel'],spells:['blink','heal'],augments:['vampire'],pack:3,enemyHp:.5};
  const state=lab.codexStep('vampire',1000,{x:0,y:0,hp:150,setup});
  assert.strictEqual(state.type,'codex:vampire');
  const sim=lab.sims.get('codex:vampire');
  assert.deepStrictEqual(sim.dummy.augments,['vampire']);
  assert.strictEqual(sim.dummy.loadout[0],'thrust');
  assert.strictEqual(sim.arena.enemies.filter(e=>e.labSlot!=null).length,3);
  assert.ok(sim.arena.enemies.every(e=>e.hp<=Math.ceil(e.hpmax*.5)),'enemies start at the requested health');
  for (const e of sim.arena.enemies) e.hp=0;
  for (let k=1;k<=15;k++) lab.codexStep('vampire',1000+k*100,{x:0,y:0,hp:150,setup});
  assert.strictEqual(sim.arena.enemies.filter(e=>e.hp>0&&e.labSlot!=null).length,3,'killed pack comes back');
  // A changed setup rebuilds the sim; low health reaches the server dummy.
  lab.codexStep('vampire',3000,{x:0,y:0,hp:30,setup:{...setup,boss:true}});
  const next=lab.sims.get('codex:vampire');
  assert.notStrictEqual(next,sim);
  assert.strictEqual(next.dummy.hp,30);
  assert.ok(next.arena.enemies.some(e=>e.type==='swordsaint'));
  assert.throws(()=>lab.codexStep('nope',4000,{}));
});

test('codex step casts expansion skills through the real skill engine', ()=>{
  const lab=new EnemyLab({random:seeded(13)});
  const setup={loadout:['crescent','reverse','giant','accel'],spells:['blink','heal'],augments:[],pack:2,frozen:true};
  lab.codexStep('crescent',1000,{x:0,y:0,hp:150,setup});
  const res=lab.codexStep('crescent',1100,{x:0,y:0,hp:150,setup,bursts:[{kind:'cast',id:'crescent',x:0,y:0,ox:0,oy:0,dx:0,dy:-1}]});
  assert.ok(res.skillZones.length>0,'crescent leaves a skill zone to draw');
  const sim=lab.sims.get('codex:crescent');
  const home=sim.arena.enemies.map(e=>[e.x,e.y]);
  lab.codexStep('crescent',1600,{x:0,y:0,hp:150,setup});
  assert.deepStrictEqual(sim.arena.enemies.map(e=>[e.x,e.y]),home,'frozen targets stay put');
});

test('skill feedback writes keep the shared file shape and older verdicts', ()=>{
  const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'fb-')),'feedback.json');
  fs.writeFileSync(file,JSON.stringify({thrust:{text:'old',verdict:'keep',at:'x'}}));
  writeFeedback('thrust',{text:' 더 길게 '},file,new Date(0));
  writeFeedback('vampire',{text:'좋음'},file,new Date(0));
  let all=readFeedback(file);
  assert.deepStrictEqual(all.thrust,{text:'더 길게',verdict:'keep',at:new Date(0).toISOString()});
  assert.strictEqual(all.vampire.text,'좋음');
  writeFeedback('vampire',{text:''},file);
  all=readFeedback(file);
  assert.ok(!all.vampire);
  assert.throws(()=>writeFeedback('nope',{text:'x'},file));
});
