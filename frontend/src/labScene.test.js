// drawLabScene draws the codex training ground: server skill zones, walls,
// decoys and the knight's detached blades, without touching the game map.
import {drawLabScene, addEffect, resetEffects} from './mapdraw';
const skillZoneFx=require('./skillZoneFx');

function fakeContext(){
  const calls=[];
  const ctx=new Proxy({calls},{
    get:(t,k)=>k in t?t[k]:(...args)=>{calls.push(k);return k==='measureText'?{width:10}:k==='createLinearGradient'||k==='createRadialGradient'?{addColorStop(){}}:undefined;},
    set:(t,k,v)=>{t[k]=v;return true;},
  });
  return ctx;
}

test('lab scenes draw server skill zones, walls, decoys and detached blades', () => {
  resetEffects();
  const zoneDraw=jest.spyOn(skillZoneFx,'draw');
  const wallDraw=jest.spyOn(skillZoneFx,'wall');
  const ctx=fakeContext();
  const player={id:'lab-dummy',pos:{x:0,y:0},speed:{x:0,y:0},r:25,hp:100,hpmax:150,sw_angle:0,sw_r:65,sw_w:40,sw_h:100,
    skills:{book:null},blades:[{blade:'turret-1',x:120,y:0,sw_angle:1,sw_r:20,sw_w:20,sw_h:60}],swordPoses:[]};
  addEffect('levelUp',{x:0,y:0,id:'lab-dummy'},'Lv. 11');
  const scene={type:'codex:crescent',enemies:[],projectiles:[],hazards:[],
    skillZones:[{id:'z1',owner:'lab-dummy',skill:'crescent',kind:'cone',x:0,y:-50,r:200,angle:-Math.PI/2,spread:1.7,age:40,armIn:-40,left:200}],
    walls:[{id:'w1',owner:'lab-dummy',x:0,y:-120,angle:0,length:220,width:30,left:900}],
    decoys:[{id:'d1',owner:'lab-dummy',x:60,y:40,left:900}]};
  expect(()=>drawLabScene(ctx,scene,{width:640,height:420},1000,{at:1000,player})).not.toThrow();
  const [,zone,opts]=zoneDraw.mock.calls[0];
  expect(zone).toMatchObject({skill:'crescent',kind:'cone'});
  expect(opts.tint).toBe('120,230,220'); // own zones use the player's teal
  expect(wallDraw).toHaveBeenCalled();
  expect(ctx.calls.length).toBeGreaterThan(50);
  zoneDraw.mockRestore();wallDraw.mockRestore();
});

test('lab scenes draw mirror clones, workshop dolls, reverse afterimage, echo zones, fold and causal-knot ghost', () => {
  resetEffects();
  const ctx=fakeContext();
  const player={id:'lab-dummy',pos:{x:0,y:0},speed:{x:0,y:0},r:25,hp:100,hpmax:150,sw_angle:0,sw_r:65,sw_w:40,sw_h:100,
    augments:['causalKnot','mirror','workshopHeart'],
    skills:{book:{gates:null,anchor:null,garden:null,banner:null,history:[{x:-120,y:40,t:100},{x:0,y:0,t:3200}]}},
    blades:[
      {blade:'clone-1',x:-80,y:-20,sw_angle:.5,sw_r:65,sw_w:40,sw_h:100,born:800,until:2800,duration:2000,faceLeft:true,spinDir:1},
      {blade:'sk-heart-0',sw_angle:1.2,sw_r:40,sw_w:30,sw_h:64,born:500,until:3500,duration:3000,doll:true},
    ],
    swordPoses:[]};
  const scene={type:'codex:mirror',enemies:[],projectiles:[],hazards:[],
    skillZones:[
      {id:'z1',owner:'lab-dummy',skill:'reverse',tag:'afterSpin',kind:'circle',x:0,y:0,r:170,bladeAngle:.4,spinDirection:-1,age:400,armIn:-100,left:200},
      {id:'z2',owner:'lab-dummy',skill:'crescent',kind:'cone',x:0,y:0,r:0,length:220,spread:1.7,angle:-Math.PI/2,age:300,armIn:300,left:550,echo:'timeSplitter',echoLead:true,castX:0,castY:0},
      {id:'z3',owner:'lab-dummy',skill:'blink',tag:'fold',kind:'circle',x:-60,y:0,r:60,age:150,armIn:-150,left:850,every:200},
    ],
    walls:[],decoys:[{id:'d1',owner:'lab-dummy',x:60,y:40,left:1500}]};
  expect(()=>drawLabScene(ctx,scene,{width:640,height:420},3300,{at:3300,player})).not.toThrow();
  expect(ctx.calls.length).toBeGreaterThan(80);
});
