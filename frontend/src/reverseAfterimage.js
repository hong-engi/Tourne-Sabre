// Canvas-only effect, shared by the game and the feedback preview.
(function () {
  const TAU=Math.PI*2, DURATION=300;
  function pose(elapsed,start=0,direction=1) {
    if(elapsed<0||elapsed>=DURATION)return null;
    const progress=elapsed/DURATION;
    return {angle:start+direction*TAU*progress,alpha:Math.min(1,(1-progress)*4)*.7,progress};
  }
  function draw(ctx,elapsed,start,direction,radius,paint,reduced=false) {
    const head=pose(elapsed,start,direction);if(!head)return;
    ctx.save();
    // A tapered ribbon and spaced blade silhouettes follow only the arc
    // already swept, never the opposite side of the next revolution.
    const count=reduced?1:12;
    for(let i=count-1;i>=0;i--){
      const age=i*9,ghost=pose(elapsed-age,start,direction);if(!ghost)continue;
      ctx.save();ctx.rotate(-ghost.angle);
      ctx.globalAlpha*=head.alpha*(1-i/count)*(i===0?1:.32);
      paint(ctx,radius);ctx.restore();
    }
    if(!reduced){
      const tip=-Math.PI/2-head.angle,tail=tip+direction*TAU*Math.min(head.progress,.25);
      ctx.beginPath();ctx.arc(0,0,radius-4,tail,tip,direction>0);
      ctx.strokeStyle='rgba(170,255,245,.65)';ctx.lineWidth=2;ctx.globalAlpha*=head.alpha;ctx.stroke();
    }
    ctx.restore();
  }
  if(typeof module!=='undefined')module.exports={pose,draw,DURATION};
  else window.reverseAfterimage={pose,draw,DURATION};
}());
