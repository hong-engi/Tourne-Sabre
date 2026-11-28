// Shared circle-body physics. Velocities are world units/second.
const WORLD_LIMIT=3000;
function inverseMass(b){return b.fixed?0:1/(b.mass||Math.max(.5,(b.r/25)**2));}
function key(b){return String(b.id||b._id);}
function normal(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d>1e-8)return {x:dx/d,y:dy/d,distance:d};
  let hash=0;const text=key(a)+'|'+key(b);for(let i=0;i<text.length;i++)hash=(hash*31+text.charCodeAt(i))>>>0;
  const angle=hash/0xffffffff*Math.PI*2;
  return {x:Math.cos(angle),y:Math.sin(angle),distance:0};
}
function clampBody(b){if(b.fixed)return;b.x=Math.max(-WORLD_LIMIT+b.r,Math.min(WORLD_LIMIT-b.r,b.x));b.y=Math.max(-WORLD_LIMIT+b.r,Math.min(WORLD_LIMIT-b.r,b.y));}
function sweep(a,b,previous){
  const pa=previous?.get(key(a)),pb=previous?.get(key(b));
  if(!pa||!pb)return null;
  const rx=pb.x-pa.x,ry=pb.y-pa.y;
  const dx=(b.x-pb.x)-(a.x-pa.x),dy=(b.y-pb.y)-(a.y-pa.y);
  const radius=a.r+b.r,c=rx*rx+ry*ry-radius*radius;
  const aa=dx*dx+dy*dy,bb=2*(rx*dx+ry*dy),disc=bb*bb-4*aa*c;
  if(c<=0||aa<1e-8||disc<0)return null;
  const t=(-bb-Math.sqrt(disc))/(2*aa);
  if(t<0||t>1)return null;
  return {t,pa,pb};
}
function separateBodies(bodies,{previous,impulses=true,iterations=60,ignore}={}){
  const contacts=new Map();
  // Swept tests stop fast bodies swapping sides between simulation ticks.
  if(previous){
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j];
      if(ignore?.(a,b))continue;
      const hit=sweep(a,b,previous);
      if(!hit)continue;
      if(!a.fixed){a.x=hit.pa.x+(a.x-hit.pa.x)*hit.t;a.y=hit.pa.y+(a.y-hit.pa.y)*hit.t;}
      if(!b.fixed){b.x=hit.pb.x+(b.x-hit.pb.x)*hit.t;b.y=hit.pb.y+(b.y-hit.pb.y)*hit.t;}
    }
  }
  for(let pass=0;pass<iterations;pass++){
    let penetration=0;
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j];
      if(ignore?.(a,b))continue;
      const n=normal(a,b),radius=a.r+b.r;
      if(n.distance>radius+.75)continue;
      const invA=inverseMass(a),invB=inverseMass(b),sum=invA+invB;
      if(!sum)continue;
      const pair=[key(a),key(b)].sort().join('|');
      const closing=((a.vx||0)-(b.vx||0))*n.x+((a.vy||0)-(b.vy||0))*n.y;
      const intent=((a.intentVx??a.vx??0)-(b.intentVx??b.vx??0))*n.x+((a.intentVy??a.vy??0)-(b.intentVy??b.vy??0))*n.y;
      if(!contacts.has(pair))contacts.set(pair,{pair,a,b,nx:n.x,ny:n.y,closingSpeed:Math.max(0,closing,intent),x:(a.x+b.x)/2,y:(a.y+b.y)/2});
      if(impulses&&closing>0){
        const force=1.2*closing/sum;
        a.vx=(a.vx||0)-force*invA*n.x;a.vy=(a.vy||0)-force*invA*n.y;
        b.vx=(b.vx||0)+force*invB*n.x;b.vy=(b.vy||0)+force*invB*n.y;
      }
      const overlap=radius+.25-n.distance;
      if(overlap>0){
        penetration=Math.max(penetration,overlap);
        a.x-=n.x*overlap*invA/sum;a.y-=n.y*overlap*invA/sum;
        b.x+=n.x*overlap*invB/sum;b.y+=n.y*overlap*invB/sum;
        clampBody(a);clampBody(b);
      }
    }
    bodies.forEach(clampBody);
    if(penetration<.001)break;
  }
  return Array.from(contacts.values());
}
function predictPlayer(player,obstacles){
  const body={id:player.id,x:player.pos.x,y:player.pos.y,r:player.r,vx:player.speed.x*30,vy:player.speed.y*30};
  const solids=obstacles.filter(b=>b.hp>0&&!b.passThrough&&(b.id||b._id)!==player.id).map(b=>Object.assign({},b,{id:b.id||b._id,fixed:true}));
  const contacts=separateBodies([body].concat(solids),{impulses:false,iterations:20});
  player.pos.x=body.x;player.pos.y=body.y;
  for(let k=0;k<contacts.length;k++){const c=contacts[k];
    const into=player.speed.x*c.nx+player.speed.y*c.ny;
    if(into>0){player.speed.x-=into*c.nx;player.speed.y-=into*c.ny;}
  }
}
module.exports={WORLD_LIMIT,inverseMass,separateBodies,predictPlayer};
