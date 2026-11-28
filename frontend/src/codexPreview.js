// Looping effect sketch for a codex card (Lab skill/spell/augment tabs and
// tools/feedback). Draws one catalog item from its fx/move/blades data on a
// 220×165 canvas; the player stands low in the frame facing up.
// No destructuring/spread: Babel helpers would turn this CommonJS file into
// an ES module in the production build.
// Canvas-only and dependency-light so the feedback page can load it as a
// plain <script> (window.codexPreview) next to skillZoneFx / reverseAfterimage.
(function () {
  const node=typeof module!=='undefined';
  /* eslint-disable global-require */
  const zoneFx=node?require('./skillZoneFx'):window.skillZoneFx;
  const afterimage=node?require('./reverseAfterimage'):window.reverseAfterimage;
  const W=220,H=165,SC=.24,PX=W/2,PY=H*.74,DEFAULT_LOOP=2600;
  const TIER={silver:'#c9d1db',gold:'#f2c14e',prismatic:'#c58cff',transcendent:'#ff7ad9'};
  const FOES=[[0,-230],[-110,-170],[105,-300],[-40,-420]];
  const loops=new WeakMap();
  function timeline(spec){let end=1200;
    (spec.fx||[]).forEach(f=>{end=Math.max(end,(f.delay||0)+Math.max((f.every||0)*((f.ticks||1)-1)+250,f.last||f.ms||0)+500);});
    if(spec.blades)end=Math.max(end,2600);return Math.min(Math.max(end+600,DEFAULT_LOOP),5200);}
  function moveAt(spec,t){ // player offset and where the move started/ended
    const m=spec.move;if(!m)return {x:0,y:0,end:{x:0,y:0}};
    let d=m.dist||160,tx=0,ty=-d;
    if(m.kind==='nearest'){tx=FOES[0][0];ty=FOES[0][1]+(m.stop||70);}
    if(m.kind==='gate')return {x:0,y:0,end:{x:0,y:-m.dist}};
    const k=m.kind==='dash'?Math.min(1,t/(m.ms||180)):(t>0?1:0);
    return {x:tx*k,y:ty*k,end:{x:tx,y:ty}};}
  function anchorPos(f,me,end){
    if(f.at==='origin')return {x:0,y:0};
    if(f.at==='dest')return end;
    if(f.at==='nearest')return {x:FOES[0][0],y:FOES[0][1]};
    if(f.at==='point'||f.at==='front')return {x:me.x,y:me.y-(f.off||f.len||250)};
    return me;}
  function drawSword(ctx,x,y,a,len,col){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.strokeStyle=col;ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,-25*SC);ctx.lineTo(0,-(25+100*len)*SC);ctx.stroke();ctx.restore();}
  function drawAux(ctx,f,t,P,me,reduce){
    if(t<0)return;const ms=f.ms||(f.ticks?f.ticks*1000:1500);if(t>Math.min(ms,3000)&&!['heal','cost'].includes(f.t))return;
    const px=P(me.x,me.y),x=px[0],y=px[1];ctx.save();
    const ring=(r,col,dash)=>{ctx.strokeStyle=col;ctx.lineWidth=2;if(dash)ctx.setLineDash(dash);ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.stroke();ctx.setLineDash([]);};
    const k=(t%900)/900;
    switch(f.t){
      case 'shield':ring(11,'rgba(120,190,255,.95)');ctx.fillStyle='rgba(120,190,255,.18)';ctx.beginPath();ctx.arc(x,y,11,0,7);ctx.fill();break;
      case 'guard':case 'parry':case 'record':case 'undying':case 'anchor':ring(10,f.t==='parry'?'#fff2a8':f.t==='undying'?'#ff9b9b':'#f2c14e',f.t==='anchor'?[3,2]:null);break;
      case 'heal':case 'hot':if(t<1400){ctx.fillStyle='rgba(120,230,140,'+(1-t/1400)+')';ctx.font='bold 13px sans-serif';ctx.fillText('+',x+8,y-6-t/60);ctx.fillText('+',x-14,y-2-t/80);}break;
      case 'cost':if(t<700){ctx.fillStyle='rgba(230,60,80,'+(1-t/700)+')';ctx.font='bold 12px sans-serif';ctx.fillText('−',x+8,y-4-t/50);}break;
      case 'buff':ring(9+k*4,'rgba(255,110,90,'+(1-k)+')');break;
      case 'shots':ring((f.r||120)*.24,'rgba(180,220,255,.7)',[2,3]);break;
      case 'sanctum':case 'banner':{ctx.translate(x,y);ctx.scale(SC,SC);
        zoneFx.draw(ctx,{skill:f.t==='banner'?'warBanner':'sanctuary',kind:'circle',r:f.r||160,age:t,armIn:-t,left:ms-t},{reduced:reduce,tint:'140,220,150'});break;}
      case 'wall':{const pwx=P(me.x,me.y-(f.off||120)),wx=pwx[0],wy=pwx[1];ctx.translate(wx-(f.len||220)*SC/2,wy);ctx.scale(SC,SC);zoneFx.wall(ctx,f.len||220,30,ms-t,reduce);break;}
      case 'decoy':{
        const wave=(t%900)/900;
        if(!reduce){ctx.strokeStyle='rgba(143,208,255,'+(0.55*(1-wave))+')';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,7+wave*11,0,7);ctx.stroke();}
        ctx.globalAlpha=.72;ctx.fillStyle='rgba(120,210,255,.32)';ctx.beginPath();ctx.arc(x,y,8,0,7);ctx.fill();
        ctx.fillStyle='#8fd0ff';ctx.beginPath();ctx.arc(x,y-2,5,0,7);ctx.fill();
        ctx.fillRect(x-4,y+2,8,7);
        drawSword(ctx,x,y,Math.PI/4,.8,'#b6eaff');
        break;
      }
      case 'trail':{ctx.fillStyle='rgba(200,230,255,.25)';ctx.fillRect(x-3,y,6,40);break;}
      case 'beat':ring(8+k*6,'rgba(255,255,255,'+(1-k)+')');break;
      default:break;
    }
    ctx.restore();}
  // Draw `item` at time `now` (ms). `scale` is the canvas pixel ratio.
  function draw(ctx,item,now,{reduced:reduce=false,scale=2}={}){
    const spec=item.fx||{generic:true,fx:[]};
    let loop=loops.get(item);if(!loop){loop=timeline(spec);loops.set(item,loop);}
    const t=(now%loop)-300;const accent=TIER[item.tier]||'#7fb2ff';
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W*scale,H*scale);ctx.setTransform(scale,0,0,scale,0,0);
    ctx.fillStyle='#1d2129';ctx.fillRect(0,0,W,H);
    const P=(x,y)=>[PX+x*SC,PY+y*SC];
    ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;for(let x=0;x<W;x+=22){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    const mv=moveAt(spec,Math.max(t,-1));const me={x:mv.x,y:mv.y};
    let flash=0,slow=false;
    (spec.fx||[]).forEach(f=>{
      const c=Object.assign({},anchorPos(f,me,mv.end));c.x+=f.side||0;c.y-=(f.drift||0)*Math.max(0,t)/1000;const st=f.delay||0;
      if(f.t!=='hit'){drawAux(ctx,f,t,P,me,reduce);return;}
      const live=Math.max((f.every||0)*((f.ticks||1)-1)+250,f.last||0);
      const warn=t>=0&&t<st&&(f.warn||st>=300);const on=t>=st&&t<st+live;
      if(!warn&&!on)return;
      const fade=on?1-Math.min(1,(t-st)/live)*.7:.5;
      if(on&&t-st<200)flash=Math.max(flash,1-(t-st)/200);
      if((on&&f.status&&f.status.slow)||(f.status&&f.status.root))slow=slow||on;
      const col=f.status&&(f.status.slow||f.status.root)&&!f.power?'120,200,255':f.status&&f.status.burn?'255,140,60':f.status&&f.status.bleed?'230,60,80':'255,235,170';
      ctx.save();const pcx=P(c.x,c.y),cx=pcx[0],cy=pcx[1];ctx.translate(cx,cy);
      ctx.save();ctx.scale(SC,SC);
      const rendered=zoneFx.draw(ctx,{skill:item.id==='xQ01'?'reverse':item.previewSkill||item.id,
        tag:f.tag,kind:f.shape,angle:-Math.PI/2+(f.angle||0),r:f.r,length:f.len,width:f.w,spread:f.spread,
        age:t,armIn:st-t,left:st+live-t,every:f.every,warn:f.warn,echo:f.echo,echoLead:f.echoLead!==false,castX:0,castY:0},{reduced:reduce,tint:'120,230,220'});
      ctx.restore();if(rendered){ctx.restore();return;}
      ctx.rotate(f.angle||0);
      ctx.beginPath();
      if(f.shape==='circle'){ctx.arc(0,0,(f.r||100)*SC,0,7);if(f.ring){ctx.arc(0,0,Math.max(0,(f.r-f.ring))*SC,0,7,true);}}
      else if(f.shape==='cone'){const s=(f.spread||1.6)/2;ctx.moveTo(0,0);ctx.arc(0,0,(f.len||200)*SC,-Math.PI/2-s,-Math.PI/2+s);ctx.closePath();}
      else {const w=(f.w||50)*SC,l=(f.len||250)*SC;ctx.rect(-w/2,-l,w,l);}
      if(warn){ctx.setLineDash([4,3]);ctx.strokeStyle='rgba(255,90,90,.85)';ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle='rgba(255,60,60,.12)';ctx.fill('evenodd');ctx.setLineDash([]);}
      else{ctx.fillStyle=`rgba(${col},${.42*fade})`;ctx.fill('evenodd');ctx.strokeStyle=`rgba(${col},${.9*fade})`;ctx.lineWidth=1.2;ctx.stroke();}
      ctx.restore();});
    // gate portals / turret markers
    if(spec.move&&spec.move.kind==='gate'&&t>=0){[[0,0],[0,-spec.move.dist]].forEach(q=>{const x=q[0],y=q[1];const pa=P(x,y),a=pa[0],b=pa[1];ctx.strokeStyle='#9ef';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(a,b,9,13,0,0,7);ctx.stroke();});}
    if((spec.move&&spec.move.kind==='turret')||spec.turret){const pa=P(0,spec.turret?-160:-(spec.move.dist||160)),a=pa[0],b=pa[1];drawSword(ctx,a,b,now/220,.75,'rgba(180,220,255,.8)');ctx.fillStyle='#8ab';ctx.fillRect(a-5,b-5,10,10);}
    // mirror clone at origin, causal-knot temporal ghost
    if(spec.mirrorClone&&t>=0&&t<2000){
      const o=P(0,0),ox=o[0],oy=o[1];const life=Math.max(0,1-t/2000),ca=-Math.PI/1000*t*2;
      ctx.save();ctx.globalAlpha=.75*Math.min(1,life*4);
      ctx.strokeStyle='rgba(140,230,255,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ox,oy,10,-Math.PI/2,-Math.PI/2+6.283*life);ctx.stroke();
      ctx.fillStyle='#7cdfff';ctx.beginPath();ctx.arc(ox,oy,25*SC,0,7);ctx.fill();
      if(!reduce){ctx.strokeStyle='rgba(165,245,255,.45)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(ox,oy,26,ca-Math.PI/2-.9,ca-Math.PI/2);ctx.stroke();}
      drawSword(ctx,ox,oy,ca,.95,'#a8f4ff');
      ctx.restore();
    }
    if(spec.causalGhost){
      const g=P(-90,85),gx=g[0],gy=g[1],h=P(me.x,me.y),hx=h[0],hy=h[1];
      ctx.save();ctx.strokeStyle='rgba(242,193,78,.55)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(hx,hy);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='rgba(205,160,255,.35)';ctx.strokeStyle='#f2c14e';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(gx,gy,8,0,7);ctx.fill();ctx.stroke();
      ctx.fillStyle='#e8c4ff';ctx.beginPath();ctx.arc(gx,gy,4.5,0,7);ctx.fill();
      ctx.restore();
    }
    // enemies
    FOES.forEach(q=>{const x=q[0],y=q[1];const pa=P(x,y),a=pa[0],b=pa[1];ctx.fillStyle=flash>0?`rgb(255,${255-120*flash},${255-160*flash})`:slow?'#7ab8e8':'#c4545b';ctx.beginPath();ctx.arc(a,b,5.5,0,7);ctx.fill();});
    // player and sword
    const ppx=P(me.x,me.y),px=ppx[0],py=ppx[1];
    if(spec.move&&spec.move.kind==='blink'&&t>=0&&t<350){const pox=P(0,0),ox=pox[0],oy=pox[1];ctx.strokeStyle='rgba(160,220,255,'+(1-t/350)+')';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(px,py);ctx.stroke();ctx.setLineDash([]);}
    const active=arr=>arr&&t>=0&&t<arr[1];
    const len=active(spec.length)?spec.length[0]:1;
    const angle=spec.classicReverse||spec.afterSpin?(t<0?t/1000*Math.PI:-Math.min(t,300)/300*Math.PI*2-Math.max(0,t-300)/1000*Math.PI)
      :Math.PI/1000*(t<0?t:spec.spin?Math.min(t,spec.spin[1])*spec.spin[0]+Math.max(0,t-spec.spin[1]):t);
    const phase=spec.phase&&t>=0&&t<spec.phase;
    ctx.globalAlpha=phase?.45:1;
    const swordCol=spec.fire&&t>=0&&t<2500?'#ff9a3c':item.fx?'#e9eef7':accent;
    if(spec.afterSpin&&afterimage){
      ctx.save();ctx.translate(px,py);ctx.scale(SC,SC);
      afterimage.draw(ctx,t-300,0,1,170,(c,r,isHead)=>{
        afterimage.silhouette(c,r,isHead);
      },reduce);ctx.restore();
    }
    drawSword(ctx,px,py,angle,len,swordCol);
    if(spec.twin&&t>=0&&t<3000)drawSword(ctx,px,py,angle+Math.PI,1,'#bcd');
    ctx.fillStyle='#ffd27a';ctx.beginPath();ctx.arc(px,py,25*SC,0,7);ctx.fill();ctx.globalAlpha=1;
    if(spec.blades&&t>=0&&t<Math.min(spec.blades.ms||3000,3000)){const n=spec.blades.count||3,r=(spec.blades.r||180)*SC;
      for(let i=0;i<n;i++){
        const a=now/600*(spec.blades.speed||1.5)+i*Math.PI*2/n;
        const bx=px+Math.cos(a)*r,by=py+Math.sin(a)*r;
        if(spec.blades.doll){
          ctx.fillStyle='rgba(255,212,110,.3)';ctx.strokeStyle='#ffd56a';ctx.lineWidth=1.2;
          ctx.beginPath();ctx.arc(bx,by,5.5,0,7);ctx.fill();ctx.stroke();
          drawSword(ctx,bx,by,a+Math.PI/2,.55,'#ffe699');
        }else drawSword(ctx,bx,by,a+Math.PI/2,.45,'#bfe');
      }}
    if(spec.generic){ // shared augments: sword + tier glow
      const pulse=(Math.sin(now/260)+1)/2;ctx.strokeStyle=accent;ctx.globalAlpha=.25+.35*pulse;ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,(25+110)*SC,0,7);ctx.stroke();ctx.globalAlpha=1;}
    if(t>=0&&t<180){ctx.strokeStyle='rgba(255,255,255,'+(1-t/180)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,(25+t/3)*SC*2,0,7);ctx.stroke();}
  }
  const api={draw,W,H};
  if(node)module.exports=api;else window.codexPreview=api;
}());
