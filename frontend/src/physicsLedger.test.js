import {map} from './map';

function player(){return {pos:{x:0,y:0},speed:{x:0,y:0},physicsAck:{seq:0,x:0,y:0,vx:0,vy:0}};}

test('knockback from the fast poll applies once and a stale sync row is ignored',()=>{
  const me=player();
  map.applyPhysics(me,{seq:1,x:0,y:0,vx:300,vy:-60});
  expect(me.speed).toEqual({x:10,y:-2});
  map.applyPhysics(me,{seq:1,x:0,y:0,vx:300,vy:-60});
  map.applyRecord(me,{physicsSeq:0,physicsVx:0,physicsVy:0,hp:50,augments:[]});
  expect(me.speed).toEqual({x:10,y:-2});
  map.applyPhysics(me,{seq:2,x:0,y:0,vx:600,vy:-60});
  expect(me.speed).toEqual({x:20,y:-2});
});
