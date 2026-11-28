// Short snapshot interpolation buffer; extrapolation is bounded during jitter.
export class MotionBuffer {
  constructor(delay=120){this.delay=delay;this.frames=[];}
  clear(){this.frames=[];}
  push(rows,time){this.frames.push({rows:rows.map(r=>({...r})),time});if(this.frames.length>12)this.frames.shift();}
  sample(now){
    if(!this.frames.length)return [];
    const target=now-this.delay;
    let a=this.frames[0],b;
    for(const frame of this.frames){if(frame.time<=target)a=frame;else{b=frame;break;}}
    if(!b || b===a){
      const ahead=Math.max(0,Math.min(.1,(target-a.time)/1000));
      return a.rows.map(r=>{
        let dx=(r.vx||0)*ahead,dy=(r.vy||0)*ahead;
        if(r.phase==='charge'&&Number.isFinite(r.chargeEndX)&&Number.isFinite(r.chargeEndY)){
          const distance=Math.hypot(r.chargeEndX-r.x,r.chargeEndY-r.y),travel=Math.hypot(dx,dy);
          if(travel>distance){dx=r.chargeEndX-r.x;dy=r.chargeEndY-r.y;}
        }
        const out={...r,x:r.x+dx,y:r.y+dy,angle:r.angle===undefined?undefined:r.angle+(r.angularVelocity??2.7)*ahead,sw_angle:r.sw_angle===undefined?undefined:r.sw_angle-(r.sw_speed||0)*ahead};
        if(Number.isFinite(r.fuseLeft))out.fuseLeft=Math.max(0,r.fuseLeft-ahead*1000);
        if(Number.isFinite(r.hatchLeft))out.hatchLeft=Math.max(0,r.hatchLeft-ahead*1000);
        return out;
      });
    }
    const t=Math.max(0,Math.min(1,(target-a.time)/(b.time-a.time || 1)));
    const next=new Map(b.rows.map(r=>[r.id||r._id,r]));
    return a.rows.map(r=>{
      const n=next.get(r.id||r._id);if(!n)return r;
      const out={...r,x:r.x+(n.x-r.x)*t,y:r.y+(n.y-r.y)*t};
      for(const field of ['angle','sw_angle','facing'])if(Number.isFinite(r[field])&&Number.isFinite(n[field]))out[field]=r[field]+Math.atan2(Math.sin(n[field]-r[field]),Math.cos(n[field]-r[field]))*t;
      for(const field of ['fuseLeft','hatchLeft']){
        if(Number.isFinite(r[field])&&Number.isFinite(n[field]))out[field]=Math.max(0,r[field]+(n[field]-r[field])*t);
        else if(Number.isFinite(r[field]))out[field]=Math.max(0,r[field]-(target-a.time));
      }
      for(const field of ['spearExt','tpProgress']){
        if(Number.isFinite(r[field])&&Number.isFinite(n[field]))out[field]=r[field]+(n[field]-r[field])*t;
      }
      if(Number.isFinite(r.aimX)&&Number.isFinite(r.aimY)&&Number.isFinite(n.aimX)&&Number.isFinite(n.aimY)&&(r.aimX||r.aimY)&&(n.aimX||n.aimY)){
        const a0=Math.atan2(r.aimY,r.aimX),a1=Math.atan2(n.aimY,n.aimX);
        const ai=a0+Math.atan2(Math.sin(a1-a0),Math.cos(a1-a0))*t;
        out.aimX=Math.cos(ai);out.aimY=Math.sin(ai);
      }
      return out;
    });
  }
}
