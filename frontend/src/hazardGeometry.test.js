const {hazardTouches,hazardForces,ringRadius}=require('./hazardGeometry');

test('hazard shapes: line, cone and a ring with a safe gap',()=>{
  const line={kind:'line',x:0,y:0,angle:0,length:200,width:40};
  expect(hazardTouches(line,150,10,5)).toBe(true);
  expect(hazardTouches(line,150,60,5)).toBe(false);
  const cone={kind:'cone',x:0,y:0,angle:0,length:200,spread:Math.PI/3};
  expect(hazardTouches(cone,100,0,5)).toBe(true);
  expect(hazardTouches(cone,0,100,5)).toBe(false);
  const ring={kind:'ring',x:0,y:0,from:0,to:200,band:20,gapAngle:0,gapSize:Math.PI/2};
  expect(ringRadius(ring,500,1000)).toBe(100);
  expect(hazardTouches(ring,0,100,5,100)).toBe(true);
  expect(hazardTouches(ring,100,0,5,100)).toBe(false);
});
test('frost slows without stacking, magnets do not add up, and unarmed fields do nothing',()=>{
  const frost={kind:'circle',x:0,y:0,r:50,effect:'slow',force:.7,armIn:0,left:500};
  expect(hazardForces([frost,{...frost,force:.7}],0,0,20).slow).toBe(.7);
  const pull={kind:'circle',x:100,y:0,r:200,effect:'pull',force:150,armIn:0,left:500};
  expect(hazardForces([pull,pull],0,0,20).px).toBe(150);
  expect(hazardForces([{...pull,armIn:200}],0,0,20).px).toBe(0);
});
