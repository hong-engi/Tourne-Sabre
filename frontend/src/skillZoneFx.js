// Canvas effects shared with the feedback page. World coordinates, origin at
// the zone centre; the server supplies relative timing, never wall-clock time.
(function () {
  const TAU=Math.PI*2;
  const SUPPORTED=new Set(['crescent','crossScar','needleRain','iaido','horizon','sawThrow','bloodSeal',
      'afterimage','chainRush','magnetLeap','retreatGust','stormTrail','bladeRain','gravityWell',
      'phoenix','execCircle','timeGarden','frostMail','freezeWave','emberBloom','sanctuary','warBanner','markShot']);
  const clamp=n=>Math.max(0,Math.min(1,n));
  function timing(z) {
    const active=-z.armIn,duration=Math.max(1,z.left-z.armIn);
    return {active,duration,progress:clamp(active/duration),
      charge:z.armIn>0?clamp((z.age||0)/Math.max(1,(z.age||0)+z.armIn)):1,
      fade:clamp(z.left/Math.min(180,duration)),
      beat:z.every?((Math.max(0,active)%z.every)/z.every):clamp(active/250)};
  }
  function style(z,tint) {
    if(['phoenix','emberBloom'].includes(z.skill))return '255,172,94';
    if(['freezeWave','frostMail'].includes(z.skill))return '166,226,255';
    if(z.skill==='bloodSeal')return '255,135,158';
    if(z.skill==='gravityWell')return '196,172,255';
    return tint;
  }
  function arc(ctx,r,start,end,color,width=2,ccw=false){
    ctx.beginPath();ctx.arc(0,0,Math.max(0,r),start,end,ccw);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function line(ctx,x,y,xx,yy,color,width=2){
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function sword(ctx,x,y,angle,length,color){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.beginPath();ctx.moveTo(-4,8);ctx.lineTo(-4,-length+10);ctx.lineTo(0,-length);ctx.lineTo(4,-length+10);ctx.lineTo(4,8);ctx.closePath();
    ctx.fillStyle=color;ctx.fill();line(ctx,-10,3,10,3,color,3);ctx.restore();
  }
  // Returns false for an unknown zone so the existing range display remains
  // available for new skills. Range cues use the server hitbox; rain falls toward points inside it.
  function draw(ctx,z,{tint='120,230,220',reduced=false,paintGhost}={}) {
    if(z.left<=0)return true;
    const t=timing(z),warning=z.armIn>0,r=z.r||0,skill=z.skill;
    if(!SUPPORTED.has(skill))return false;
    ctx.save();
    const color=style(z,tint),ink=a=>`rgba(${color},${a})`;
    const ghost=()=>{
      if(paintGhost){paintGhost(ctx);return;}
      ctx.fillStyle=ink(.65);ctx.beginPath();ctx.arc(0,-14,10,0,TAU);ctx.fill();
      ctx.fillRect(-12,-3,24,30);sword(ctx,22,0,-Math.PI/4,65,ink(.85));
    };
    ctx.globalAlpha*=warning?1:t.fade;
    ctx.lineCap='round';
    // Preparation fills over the actual server delay, rather than pulsing
    // identically to an active hit. Delayed projectiles stay hidden until fired.
    if(warning){
      if(z.kind==='line'){
        if(z.warn){
          ctx.rotate(z.angle||0);
          ctx.fillStyle=ink(.07);ctx.fillRect(0,-z.width/2,z.length,z.width);
          ctx.setLineDash([9,8]);ctx.strokeStyle=ink(.45);ctx.lineWidth=1;ctx.strokeRect(0,-z.width/2,z.length,z.width);ctx.setLineDash([]);
          line(ctx,0,0,z.length*t.charge,0,ink(.4+.5*t.charge),2+3*t.charge);
        }
      }else if(r){
        arc(ctx,r,0,TAU,ink(.2),1);
        arc(ctx,r,-Math.PI/2,-Math.PI/2+TAU*t.charge,ink(.8),3);
        if(skill==='afterimage'){
          ctx.globalAlpha*=.25+.3*t.charge;
          ghost();
        }
        if(skill==='execCircle'){
          line(ctx,-r*.45,0,r*.45,0,ink(.4),2);line(ctx,0,-r*.45,0,r*.45,ink(.4),2);
          arc(ctx,r*(1-.65*t.charge),0,TAU,ink(.3),1);
        }
      }
      ctx.restore();return true;
    }
    if(z.kind==='line'){
      ctx.rotate(z.angle||0);
      const len=z.length,w=z.width,travel=reduced?len*.65:len*clamp(t.active/180);
      if(skill==='phoenix'){
        const reach=reduced?len:len*clamp((t.active+80)/220);
        ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(reach*.5,-w*.5,reach,0);ctx.quadraticCurveTo(reach*.5,w*.5,0,0);ctx.fillStyle=ink(.3);ctx.fill();
        for(let i=-1;i<=1;i++)line(ctx,Math.max(0,reach-len*.55),i*w*.15,reach-8,0,ink(i===0?.95:.5),i===0?5:2);
      }else if(skill==='needleRain'||skill==='markShot'){
        line(ctx,Math.max(0,travel-100),0,travel,0,ink(.4),3);
        const bladeLength=Math.min(65,len*.2);
        sword(ctx,Math.max(0,travel-bladeLength),0,Math.PI/2,bladeLength,ink(.95));
      }else{
        ctx.fillStyle=ink(.08);ctx.fillRect(0,-w/2,len,w);
        const slant=skill==='crossScar'?w*.3:0;
        line(ctx,0,slant,len,-slant,ink(.16),w*.6*(1-t.progress));
        line(ctx,0,slant,len,-slant,ink(.9),Math.max(2,w*.06*(1-t.progress)));
        if(!reduced)for(let i=1;i<=4;i++){
          const x=len*i/5;line(ctx,x-10,-w*.25*(1-t.progress),x+10,w*.25*(1-t.progress),ink(.4),2);
        }
      }
    }else if(z.kind==='cone'){
      ctx.rotate(z.angle||0);
      const len=z.length,half=z.spread/2,head=reduced?half:-half+z.spread*clamp(t.active/180),tail=Math.max(-half,head-.65);
      ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,len,-half,half);ctx.closePath();ctx.fillStyle=ink(.05);ctx.fill();
      ctx.beginPath();ctx.arc(0,0,len,tail,head);ctx.arc(0,0,len*.62,head,tail,true);ctx.closePath();ctx.fillStyle=ink(.38);ctx.fill();
      arc(ctx,len*.96,tail,head,ink(.95),3);
    }else if(skill==='sawThrow'&&z.tag!=='sawKing'){
      ctx.rotate(reduced?0:t.active/85);
      ctx.beginPath();for(let i=0;i<32;i++){
        const a=i*TAU/32,rr=r*(i%2?.72:.96),x=Math.cos(a)*rr,y=Math.sin(a)*rr;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }ctx.closePath();ctx.fillStyle=ink(.18);ctx.fill();ctx.strokeStyle=ink(.85);ctx.lineWidth=2;ctx.stroke();
      arc(ctx,r*.38,0,TAU,ink(.7),3);line(ctx,-r*.24,0,r*.24,0,ink(.6),2);
    }else if(skill==='bladeRain'){
      arc(ctx,r,0,TAU,ink(.25),1);
      // Each impact has a fixed location and phase, so network snapshots
      // don't shuffle the rain or restart every sword's fall.
      for(let i=0;i<(reduced?5:11);i++){
        const a=i*2.39996,d=r*Math.sqrt((i+.5)/11)*.85,x=Math.cos(a)*d,y=Math.sin(a)*d;
        const phase=reduced?.8:((t.active+i*71)%500)/500,drop=(1-phase)*75;
        ctx.save();ctx.globalAlpha*=Math.sin(Math.PI*phase);
        sword(ctx,x,y-drop,Math.PI,38,ink(.9));
        ctx.translate(x,y);ctx.scale(1,.35);arc(ctx,5+phase*13,0,TAU,ink(.5),2);ctx.restore();
      }
    }else if(skill==='gravityWell'&&z.tag!=='wellEnd'){
      ctx.fillStyle=ink(.07);ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
      for(let i=0;i<3;i++){
        const phase=reduced?(i+1)/4:((t.active/950+i/3)%1),rr=r*(1-phase);
        arc(ctx,rr,i*2+t.active/(reduced?1e12:550),i*2+t.active/(reduced?1e12:550)+Math.PI*1.25,ink(.2+phase*.5),2);
      }
      arc(ctx,r*.12,0,TAU,ink(.8),3);
      if(!reduced)for(let i=0;i<8;i++){
        const a=i*TAU/8,phase=(t.active/700+i*.17)%1,d=r*(1-phase);
        line(ctx,Math.cos(a)*(d+8),Math.sin(a)*(d+8),Math.cos(a)*d,Math.sin(a)*d,ink(.65),2);
      }
    }else if(skill==='timeGarden'||skill==='sanctuary'||skill==='warBanner'){
      arc(ctx,r,0,TAU,ink(.45),2);arc(ctx,r*.86,0,TAU,ink(.2),1);
      const spin=reduced?0:t.active/4000;
      for(let i=0;i<12;i++){
        const a=i*TAU/12+spin;line(ctx,Math.cos(a)*r*.92,Math.sin(a)*r*.92,Math.cos(a)*r*.98,Math.sin(a)*r*.98,ink(.65),2);
      }
      if(skill==='timeGarden'){
        line(ctx,0,0,Math.cos(spin)*r*.5,Math.sin(spin)*r*.5,ink(.45),2);
        line(ctx,0,0,Math.sin(spin)*r*.28,-Math.cos(spin)*r*.28,ink(.65),3);
      }else if(skill==='warBanner'){
        line(ctx,0,14,0,-45,ink(.95),4);
        ctx.beginPath();ctx.moveTo(0,-45);ctx.lineTo(35,-35);ctx.lineTo(0,-23);ctx.closePath();ctx.fillStyle=ink(.65);ctx.fill();
      }else{
        line(ctx,-14,0,14,0,ink(.75),5);line(ctx,0,-14,0,14,ink(.75),5);
      }
    }else if(skill==='frostMail'||skill==='freezeWave'){
      if(z.tag==='icicle'){
        for(let i=0;i<12;i++){
          ctx.save();ctx.rotate(i*TAU/12);ctx.beginPath();ctx.moveTo(r*.55,-7);ctx.lineTo(r*.98,0);ctx.lineTo(r*.55,7);ctx.closePath();ctx.fillStyle=ink(.8);ctx.fill();ctx.restore();
        }
      }
      const radius=skill==='freezeWave'?r*(reduced?1:clamp(t.active/190)):r;
      arc(ctx,radius,0,TAU,ink(.65),3);
      for(let i=0;i<8;i++){
        ctx.save();ctx.rotate(i*TAU/8);const d=radius*.74;
        line(ctx,d-12,0,d+12,0,ink(.7),2);line(ctx,d-6,-7,d+6,7,ink(.7),2);line(ctx,d-6,7,d+6,-7,ink(.7),2);ctx.restore();
      }
    }else if(skill==='bloodSeal'){
      arc(ctx,r*.8,0,TAU,ink(.8),2);ctx.rotate(Math.PI/4);ctx.strokeStyle=ink(.8);ctx.lineWidth=2;ctx.strokeRect(-r*.42,-r*.42,r*.84,r*.84);
    }else if(skill==='stormTrail'){
      for(let i=0;i<3;i++)arc(ctx,r*(.4+i*.22),i*2+(reduced?0:t.active/300),i*2+(reduced?0:t.active/300)+Math.PI,ink(.6),2);
    }else{
      // Arrival bursts, echo slash, execution, embers and well detonation.
      const expand=reduced?1:clamp(t.active/180);
      arc(ctx,r*expand,0,TAU,ink(.7),3);
      if(skill==='afterimage'){
        ctx.save();ctx.globalAlpha*=1-t.progress;ghost();ctx.restore();
        arc(ctx,r*.83,-Math.PI*.9,Math.PI*.6,ink(.9),5);
      }else if(skill==='execCircle'){
        line(ctx,-r*.65,-r*.65,r*.65,r*.65,ink(.9),5*(1-t.progress)+1);
        line(ctx,-r*.65,r*.65,r*.65,-r*.65,ink(.9),5*(1-t.progress)+1);
      }else for(let i=0;i<8;i++){
        ctx.save();ctx.rotate(i*TAU/8);
        line(ctx,r*.3*expand,0,r*.85*expand,0,ink(.7),skill==='emberBloom'?4:2);ctx.restore();
      }
    }
    ctx.restore();return true;
  }
  function wall(ctx,length,width,left){
    ctx.save();ctx.globalAlpha*=clamp(left/180);
    ctx.fillStyle='rgba(180,220,255,.09)';ctx.fillRect(0,-width/2,length,width);
    line(ctx,0,0,length,0,'rgba(180,220,255,.4)',3);
    const count=Math.max(2,Math.floor(length/28));
    for(let i=0;i<=count;i++)sword(ctx,i*length/count,0,0,width+36,'rgba(210,240,255,.85)');
    ctx.restore();
  }
  const api={timing,draw,wall};
  if(typeof module!=='undefined')module.exports=api;else window.skillZoneFx=api;
}());
