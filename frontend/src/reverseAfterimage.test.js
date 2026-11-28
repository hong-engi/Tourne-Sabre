const {pose}=require('./reverseAfterimage');
test('echo appears after the real turn, completes one original-direction turn, then disappears',()=>{
  expect(pose(-1)).toBeNull();
  expect(pose(0,1,-1).angle).toBe(1);
  expect(pose(150,1,-1).angle).toBeCloseTo(1-Math.PI);
  expect(pose(299,1,-1).angle).toBeCloseTo(1-Math.PI*2*299/300);
  expect(pose(300)).toBeNull();
  expect(pose(150,1,1).angle).toBeCloseTo(1+Math.PI);
  expect(pose(299).alpha).toBeLessThan(pose(150).alpha);
});
