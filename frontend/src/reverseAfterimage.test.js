const {pose,draw,silhouette}=require('./reverseAfterimage');
test('echo appears after the real turn, completes one original-direction turn, then disappears',()=>{
  expect(pose(-1)).toBeNull();
  expect(pose(0,1,-1).angle).toBe(1);
  expect(pose(150,1,-1).angle).toBeCloseTo(1-Math.PI);
  expect(pose(299,1,-1).angle).toBeCloseTo(1-Math.PI*2*299/300);
  expect(pose(300)).toBeNull();
  expect(pose(150,1,1).angle).toBeCloseTo(1+Math.PI);
  expect(pose(299).alpha).toBeLessThan(pose(150).alpha);
});

test('draw marks the leading blade with isHead=true and trails with isHead=false, and silhouette keeps balanced state',()=>{
  let depth=0;
  const finite=(...args)=>args.forEach(v=>{if(typeof v==='number')expect(Number.isFinite(v)).toBe(true);});
  const ctx={globalAlpha:1,lineWidth:1,
    save(){depth++;},restore(){expect(depth).toBeGreaterThan(0);depth--;},
    beginPath(){},closePath(){},fill(){},stroke(){},
    arc(...args){finite(...args);},moveTo:finite,lineTo:finite,rotate:finite};
  const heads=[];
  draw(ctx,160,0,1,170,(c,r,isHead)=>{heads.push(isHead);silhouette(c,r,isHead);},false);
  expect(heads.length).toBeGreaterThan(1);
  expect(heads[heads.length-1]).toBe(true);
  expect(heads.slice(0,-1).every(h=>h===false)).toBe(true);
  expect(depth).toBe(0);
});
