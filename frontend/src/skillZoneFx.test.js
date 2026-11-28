const fx=require('./skillZoneFx');
const {SKILLS,SPELLS,specFor}=require('./gameRules');
function canvas(){
  let depth=0,draws=0;
  const finite=(...args)=>args.forEach(v=>{if(typeof v==='number')expect(Number.isFinite(v)).toBe(true);});
  const ctx={globalAlpha:1,lineWidth:1,
    save(){depth++;},restore(){expect(depth).toBeGreaterThan(0);depth--;},
    arc(x,y,r,a,b){finite(x,y,r,a,b);expect(r).toBeGreaterThanOrEqual(0);draws++;},
    beginPath(){},closePath(){},fill(){draws++;},stroke(){draws++;},
    moveTo:finite,lineTo:finite,quadraticCurveTo:finite,translate:finite,rotate:finite,scale:finite,
    fillRect(...args){finite(...args);draws++;},strokeRect(...args){finite(...args);draws++;},setLineDash(){}
  };
  return {ctx,depth:()=>depth,draws:()=>draws};
}
test('charge timing is stable across snapshots and does not depend on render frame rate',()=>{
  expect(fx.timing({age:200,armIn:600,left:850}).charge).toBe(.25);
  expect(fx.timing({age:600,armIn:200,left:450}).charge).toBe(.75);
  const t=fx.timing({age:1000,armIn:-200,left:50});
  expect(t.duration).toBe(250);expect(t.progress).toBe(.8);expect(t.fade).toBeCloseTo(50/180);
});
test('delayed needles do not appear before launch, and expired zones draw nothing',()=>{
  const c=canvas(),zone={skill:'needleRain',kind:'line',length:420,width:44,angle:0,armIn:100,left:350,age:0};
  expect(fx.draw(c.ctx,zone)).toBe(true);expect(c.draws()).toBe(0);
  fx.draw(c.ctx,{...zone,armIn:-30,left:220});expect(c.draws()).toBeGreaterThan(0);
  const end=canvas();fx.draw(end.ctx,{...zone,left:0});expect(end.draws()).toBe(0);
  expect(c.depth()).toBe(0);
});
test('all skill hit effects handle charging, impact, fade and reduced motion with finite canvas geometry',()=>{
  for(const skill of SKILLS.concat(SPELLS)){
    const spec=specFor(skill.id);if(!spec)continue;
    for(const f of spec.fx.filter(f=>f.t==='hit')){
      const delay=f.delay||0,live=Math.max((f.every||0)*((f.ticks||1)-1)+250,f.last||0);
      for(const elapsed of [0,delay,delay+live/2,delay+live-1])for(const reduced of [false,true]){
        const c=canvas();
        fx.draw(c.ctx,{skill:skill.id,tag:f.tag,kind:f.shape,r:f.r,length:f.len,width:f.w,spread:f.spread,
          angle:f.angle||0,age:elapsed,armIn:delay-elapsed,left:delay+live-elapsed,every:f.every,warn:f.warn},{reduced});
        expect(c.depth()).toBe(0);
      }
    }
  }
});
test('unknown skills retain their fallback range renderer',()=>{
  const c=canvas();expect(fx.draw(c.ctx,{skill:'futureSkill',left:100})).toBe(false);expect(c.draws()).toBe(0);
});
test('afterimage, echo, fold, decoy and turret-recall zones draw with balanced save/restore and finite geometry',()=>{
  const cases=[
    {skill:'blink',tag:'fold',kind:'circle',r:60,age:150,armIn:-150,left:850,every:200},
    {skill:'afterimage',tag:'echo',kind:'circle',r:100,age:300,armIn:300,left:550},
    {skill:'afterimage',tag:'echo',kind:'circle',r:100,age:650,armIn:-50,left:200},
    {skill:'afterimage',tag:'echo2',kind:'circle',r:100,age:300,armIn:700,left:950},
    {skill:'afterimage',tag:'echo2',kind:'circle',r:100,age:800,armIn:200,left:450},
    {skill:'afterimage',tag:'echo2',kind:'circle',r:100,age:1050,armIn:-50,left:200},
    {skill:'crescent',echo:'echoArt',echoLead:true,kind:'cone',length:220,spread:1.7,angle:0,age:300,armIn:300,left:550,castX:0,castY:0,x:0,y:0},
    {skill:'crossScar',echo:'timeSplitter',echoLead:true,kind:'line',length:280,width:60,angle:.3,age:650,armIn:-50,left:200,castX:0,castY:0,x:0,y:0},
    {skill:'execCircle',echo:'timeSplitter',echoLead:false,kind:'circle',r:190,age:400,armIn:500,left:750},
    {skill:'decoy',tag:'fake',kind:'circle',r:180,age:2000,armIn:500,left:750},
    {skill:'decoy',tag:'fake',kind:'circle',r:180,age:2550,armIn:-50,left:200},
    {skill:'turret',kind:'line',length:300,width:70,angle:0,age:80,armIn:-80,left:220},
  ];
  for(const z of cases)for(const reduced of [false,true]){
    const c=canvas();
    expect(fx.draw(c.ctx,z,{reduced})).toBe(true);
    expect(c.draws()).toBeGreaterThan(0);
    expect(c.depth()).toBe(0);
  }
});
