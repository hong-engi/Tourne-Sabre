const test=require('node:test');
const assert=require('node:assert');
const path=require('path');
const {relevant,shouldRestart,SHARED,BACKEND}=require('./supervisor');

test('only backend source and shared frontend modules trigger a restart', ()=>{
  const src=path.join(BACKEND,'src');
  assert.ok(relevant(src,'game/progression.js'));
  assert.ok(!relevant(src,'game/progression.test.js'));
  assert.ok(!relevant(src,'notes.md'));
  assert.ok(relevant(SHARED,'gameRules.js'));
  assert.ok(relevant(SHARED,'bodyPhysics.js'));
  assert.ok(!relevant(SHARED,'canvas.js'));
});

test('restart waits for a pending change and an empty, reachable arena', ()=>{
  assert.ok(shouldRestart('app.js',[]));
  assert.ok(!shouldRestart('app.js',[{name:'otter'}]));
  assert.ok(!shouldRestart('app.js',null));
  assert.ok(!shouldRestart(null,[]));
});
