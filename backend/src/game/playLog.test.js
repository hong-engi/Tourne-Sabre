const {test} = require('node:test');
const assert = require('node:assert/strict');
const {PlayLogger} = require('./playLog');
const {EnemyArena} = require('./enemies');

const memory = () => {
  const files = {};
  return {files, write:(file,text,append)=>{files[file]=(append?files[file]||'':'')+text;}};
};
const player = (over={}) => ({_id:'abcdef123456',name:'tester',x:0,y:0,r:25,hp:100,hpmax:100,lv:1,xp:0,augments:[],loadout:['thrust'],spells:['heal'],...over});

test('samples once per second with attack and damage windows, then writes the log on death', () => {
  const out = memory(), log = new PlayLogger({dir:'/logs', write:out.write});
  const arena = new EnemyArena(()=>0), p = player();
  log.start(p, 0);
  arena.spawn(p, 'stalker', 0, {x:100, y:0});
  log.tick([p], arena, 500);
  log.attack(p._id, {hits:[{damage:10,killed:false},{damage:20,killed:true}], xp:35}, 600, 1);
  log.damage(p._id, {source:'stalker:contact', raw:9, before:{hp:100,hpmax:100,shield:0}, after:{hp:91,shield:0}}, 700);
  log.tick([{...p, hp:91}], arena, 1000);
  log.tick([{...p, hp:91}], arena, 1200);
  assert.equal(log.get(p._id).samples.length, 1);
  const row = log.get(p._id).samples[0];
  assert.equal(row.t, 1); assert.equal(row.dealt, 30); assert.equal(row.kills, 1); assert.equal(row.xpGain, 35);
  assert.equal(row.taken, 9); assert.equal(row.minHp, 91); assert.equal(row.nearby, 1); assert.deepEqual(row.nearbyTypes, {stalker:1});

  log.damage(p._id, {source:'bomber:blast', raw:91, before:{hp:91,hpmax:100,shield:0}, after:{hp:0,shield:0}}, 4000);
  const summary = log.end(p._id, 'kill', 4500);
  assert.equal(summary.reason, 'death'); assert.equal(summary.durationSec, 4);
  assert.deepEqual(summary.takenBySource, {'stalker:contact':9, 'bomber:blast':91});
  const file = Object.keys(out.files).find(f => f.endsWith('.json'));
  assert.match(file, /tester_abcdef12\.json$/);
  const saved = JSON.parse(out.files[file]);
  assert.deepEqual(saved.events.map(e=>e.type), ['start','danger','death','end']);
  assert.equal(saved.events[1].kind, 'burst');
  assert.equal(JSON.parse(out.files['/logs/index.jsonl']).file, file.split('/').pop());
  assert.equal(log.end(p._id, 'disconnect'), null, 'ending twice is a no-op');
});

test('low HP opens a danger window that closes on recovery; shields and revives are recorded', () => {
  const log = new PlayLogger({write:()=>{}}), arena = new EnemyArena(()=>0), p = player({augments:['immortal']});
  log.start(p, 0);
  log.damage(p._id, {source:'charger:contact', raw:20, before:{hp:100,hpmax:100,shield:30}, after:{hp:90,shield:0}}, 100);
  log.damage(p._id, {source:'spitter:shot', raw:70, before:{hp:90,hpmax:100,shield:0}, after:{hp:20,shield:0}}, 5000);
  log.damage(p._id, {source:'spinner:blade', raw:40, before:{hp:20,hpmax:100,shield:0,reviveUsed:false}, after:{hp:1,shield:0,reviveUsed:true}}, 9000);
  log.tick([{...p, hp:60}], arena, 12000);
  const s = log.get(p._id);
  const kinds = s.events.filter(e=>e.type==='danger').map(e=>e.kind);
  assert.deepEqual(kinds, ['burst','lowHp','revive']);
  assert.equal(s.events.find(e=>e.type==='recovered').minHp, 1);
  const summary = log.end(p._id, 'disconnect', 13000);
  assert.equal(summary.reason, 'disconnect'); assert.equal(summary.shieldAbsorbed, 30);
  assert.equal(summary.danger.lowHpCount, 1); assert.equal(summary.danger.lowHpSec, 7); assert.equal(summary.danger.minHpRatio, .01);
});

test('very short runs without samples are not written, and logging can be disabled', () => {
  const out = memory();
  const log = new PlayLogger({write:out.write});
  log.start(player(), 0); log.end('abcdef123456', 'disconnect', 1000);
  assert.deepEqual(out.files, {});
  const off = new PlayLogger({enabled:false, write:out.write});
  assert.equal(off.start(player(), 0), null);
  off.tick([player()], new EnemyArena(), 2000);
  assert.equal(off.sessions.size, 0);
});
