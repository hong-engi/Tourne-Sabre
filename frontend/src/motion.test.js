import {MotionBuffer} from './motion';
test('positions and swords interpolate between snapshots rather than snapping',()=>{
  const m=new MotionBuffer(100);
  m.push([{id:'a',x:0,y:10,angle:3.1,facing:3.1}],1000);
  m.push([{id:'a',x:10,y:30,angle:-3.1,facing:-3.1}],1100);
  const [p]=m.sample(1150);
  expect(p.x).toBe(5);expect(p.y).toBe(20);expect(p.angle).toBeCloseTo(Math.PI);expect(p.facing).toBeCloseTo(Math.PI);
});
test('packet gaps extrapolate only 100ms and clearing removes stale enemies',()=>{
  const m=new MotionBuffer(100);m.push([{id:'a',x:0,y:0,vx:100,vy:0,angle:0}],1000);
  expect(m.sample(2000)[0].x).toBe(10);
  m.clear();expect(m.sample(2000)).toEqual([]);
});

test('charge telegraph shrinks to a fixed destination with interpolated movement',()=>{
  const {chargeTelegraph}=require('./gameRules');
  const m=new MotionBuffer(100);
  m.push([{id:'ai-1',type:'charger',phase:'charge',x:0,y:0,chargeEndX:286,chargeEndY:0}],1000);
  m.push([{id:'ai-1',type:'charger',phase:'charge',x:100,y:0,chargeEndX:286,chargeEndY:0}],1100);
  const early=chargeTelegraph(m.sample(1125)[0]),late=chargeTelegraph(m.sample(1175)[0]);
  expect(early.length).toBe(261);expect(late.length).toBe(211);
  expect(early.endX).toBe(late.endX);
});
test('charge extrapolation stops at its destination and recovery hides the lane',()=>{
  const {chargeTelegraph}=require('./gameRules');const m=new MotionBuffer(100);
  m.push([{id:'ai-1',type:'charger',phase:'charge',x:280,y:0,vx:520,vy:0,chargeEndX:286,chargeEndY:0}],1000);
  const e=m.sample(1500)[0];expect(e.x).toBe(286);expect(chargeTelegraph(e).length).toBe(0);
  expect(chargeTelegraph({...e,phase:'recover'})).toBeNull();
});
