import {mergeShots,shotAt} from './map';
test('known shots keep their own smooth path; new, turned or drifted shots take the server state',()=>{
  const first=mergeShots({list:[]},[{id:'s1',owner:'enemy',x:0,y:0,vx:260,vy:0,r:9}],1000);
  expect(shotAt(first.list[0],1500)).toEqual({x:130,y:0});
  // The server's next report lags a little behind the local path: no snap back.
  const next=mergeShots(first,[{id:'s1',owner:'enemy',x:120,y:0,vx:260,vy:0,r:9},{id:'s2',owner:'enemy',x:5,y:5,vx:0,vy:260,r:9}],1500);
  expect(next.list[0].t).toBe(first.list[0].t);expect(shotAt(next.list[0],1600).x).toBeCloseTo(156);
  expect(next.list[1]).toMatchObject({id:'s2',t:1500});
  // A parried shot turns around: take the new path at once.
  const parried=mergeShots(next,[{id:'s1',owner:'player',x:130,y:0,vx:-338,vy:0,r:9}],1550);
  expect(shotAt(parried.list[0],1550)).toEqual({x:130,y:0});expect(parried.list).toHaveLength(1);
});
test('shots stop while the server holds them still (augment choice) and resume after',()=>{
  const row={id:'s1',owner:'enemy',x:100,y:0,vx:260,vy:0,r:9};
  let shots=mergeShots({list:[]},[row],1000);
  shots=mergeShots(shots,[row],1050);
  expect(shotAt(shots.list[0],1100).x).toBeCloseTo(126,0); // one repeated poll is not a pause
  shots=mergeShots(shots,[row],1200);
  expect(shotAt(shots.list[0],3000)).toEqual({x:100,y:0});
  shots=mergeShots(shots,[{...row,x:113}],3050);
  expect(shotAt(shots.list[0],3150).x).toBeCloseTo(139);
});
