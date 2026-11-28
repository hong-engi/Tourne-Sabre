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
        return {...r,x:r.x+dx,y:r.y+dy,angle:r.angle===undefined?undefined:r.angle+(r.angularVelocity??2.7)*ahead,sw_angle:r.sw_angle===undefined?undefined:r.sw_angle-(r.sw_speed||0)*ahead};
      });
    }
    const t=Math.max(0,Math.min(1,(target-a.time)/(b.time-a.time || 1)));
    const next=new Map(b.rows.map(r=>[r.id||r._id,r]));
    return a.rows.map(r=>{
      const n=next.get(r.id||r._id);if(!n)return r;
      const out={...r,x:r.x+(n.x-r.x)*t,y:r.y+(n.y-r.y)*t};
      for(const field of ['angle','sw_angle'])if(Number.isFinite(r[field])&&Number.isFinite(n[field]))out[field]=r[field]+Math.atan2(Math.sin(n[field]-r[field]),Math.cos(n[field]-r[field]))*t;
      return out;
    });
  }
}
