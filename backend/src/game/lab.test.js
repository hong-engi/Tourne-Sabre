const test=require('node:test');
const assert=require('node:assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {EnemyLab,readNotes,writeNote}=require('./lab');

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
