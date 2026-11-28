// Canvas-only effect, shared by the game and the feedback preview.
(function () {
  const TAU=Math.PI*2, DURATION=300;
  function pose(elapsed,start=0,direction=1) {
    if(elapsed<0||elapsed>=DURATION)return null;
    const progress=elapsed/DURATION;
    return {angle:start+direction*TAU*progress,alpha:Math.min(1,(1-progress)*4)*.7,progress};
  }
  function silhouette(ctx,radius,isHead=true) {
    const base=-radius+100,tip=-radius;
    ctx.save();
    ctx.fillStyle=isHead?'#dcfffb':'#5beee2';
    ctx.beginPath();
    ctx.moveTo(-3,base);ctx.lineTo(3,base);
    ctx.lineTo(2.5,base-10);ctx.lineTo(10,base-10);ctx.lineTo(10,base-14);
    ctx.lineTo(5,base-14);ctx.lineTo(4,tip+22);ctx.lineTo(0,tip);
    ctx.lineTo(-4,tip+22);ctx.lineTo(-5,base-14);ctx.lineTo(-10,base-14);
    ctx.lineTo(-10,base-10);ctx.lineTo(-2.5,base-10);
    ctx.closePath();ctx.fill();
    ctx.restore();
  }
  function draw(ctx,elapsed,start,direction,radius,paint=silhouette,reduced=false) {
    const head=pose(elapsed,start,direction);if(!head)return;
    ctx.save();
    if(!reduced){
      const tip=-Math.PI/2-head.angle,span=TAU*Math.min(head.progress,.42);
      const tail=tip+direction*span,inner=radius*.54,outer=radius,segs=8;
      for(let s=0;s<segs;s++){
        const f0=s/segs,f1=(s+1)/segs;
        const a0=tail-direction*span*f0,a1=tail-direction*span*f1;
        const aMid=(f0+f1)/2,fade=aMid*aMid*head.alpha;
        ctx.beginPath();
        ctx.arc(0,0,outer,a0,a1,direction>0);
        ctx.arc(0,0,inner,a1,a0,!(direction>0));
        ctx.closePath();
        const g=Math.round(232+23*aMid),b=Math.round(222+26*aMid);
        ctx.fillStyle=`rgba(${Math.round(72+123*aMid)},${g},${b},${.36*fade})`;
        ctx.fill();
      }
      ctx.beginPath();ctx.arc(0,0,outer-2,tail,tip,direction>0);
      ctx.strokeStyle=`rgba(226,255,251,${Math.min(1,head.alpha*1.25)})`;ctx.lineWidth=3.5;ctx.stroke();
      ctx.beginPath();ctx.arc(0,0,radius*.78,tail,tip,direction>0);
      ctx.strokeStyle=`rgba(120,248,238,${.55*head.alpha})`;ctx.lineWidth=1.8;ctx.stroke();
    }
    // A tapered ribbon and spaced blade silhouettes follow only the arc
    // already swept, never the opposite side of the next revolution.
    const count=reduced?1:12;
    for(let i=count-1;i>=0;i--){
      const age=i*9,ghost=pose(elapsed-age,start,direction);if(!ghost)continue;
      const decay=i===0?1:Math.pow(1-i/count,1.6)*.45;
      ctx.save();ctx.rotate(-ghost.angle);
      ctx.globalAlpha*=head.alpha*decay;
      paint(ctx,radius,i===0);ctx.restore();
    }
    if(!reduced){
      const tip=-Math.PI/2-head.angle,tangent=tip+(direction>0?-Math.PI/2:Math.PI/2);
      for(let i=0;i<5;i++){
        const back=i*.14,a=tip+direction*back,r=radius*(.78+.05*(i%3));
        const sx=Math.cos(a)*r,sy=Math.sin(a)*r,len=6+(4-i)*2.5;
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx-Math.cos(tangent)*len,sy-Math.sin(tangent)*len);
        ctx.strokeStyle=`rgba(210,255,250,${head.alpha*(1-i/5)*.8})`;ctx.lineWidth=1.8;ctx.stroke();
      }
      if(head.progress>.82){
        const k=(head.progress-.82)/.18;
        ctx.beginPath();ctx.arc(0,0,radius*(1+k*.18),0,TAU);
        ctx.strokeStyle=`rgba(170,255,245,${(1-k)*.55})`;ctx.lineWidth=2.5*(1-k)+.5;ctx.stroke();
      }
    }
    ctx.restore();
  }
  if(typeof module!=='undefined')module.exports={pose,draw,silhouette,DURATION};
  else window.reverseAfterimage={pose,draw,silhouette,DURATION};
}());
