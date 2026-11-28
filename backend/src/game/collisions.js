const {separateBodies}=require('../../../frontend/src/bodyPhysics');
// Player positions are owned by their client, which already slides around
// enemies locally. The server therefore treats players as immovable: it only
// pushes enemies out of them and sends a velocity-only knockback, so the local
// player never snaps to a stale server-side position.
// Both sides are thrown apart on contact so bodies do not stay glued together:
// the player slides about KNOCKBACK/2 units, the enemy about PUSHBACK/5 units
// and then stays staggered briefly before it walks back in.
const CONTACT_KNOCKBACK=260,CHARGE_KNOCKBACK=760,ENEMY_PUSHBACK=480,ENEMY_STAGGER=400;
const CHARGE_DAMAGE=24;
function playerEnemy(c){
  if(c.a.kind===c.b.kind)return null;
  return c.a.kind==='player'?{player:c.a,enemy:c.b,nx:c.nx,ny:c.ny}:{player:c.b,enemy:c.a,nx:-c.nx,ny:-c.ny};
}
class CollisionWorld{
  constructor(){this.previous=new Map();this.cooldowns=new Map();}
  clear(){this.previous.clear();this.cooldowns.clear();}
  resolve(players,enemies,now){
    // Ghosted players (the ghost spell) pass through bodies and take no contact damage.
    const living=players.filter(p=>p.hp>0&&!p.skillState?.ghost);
    // A charge passes through players. The charger stays non-solid against
    // them until it no longer overlaps anyone, instead of shoving them apart.
    for(const e of enemies){
      if(e.type!=='charger')continue;
      if(e.phase==='charge')e.passThrough=true;
      else if(e.passThrough&&!living.some(p=>Math.hypot(p.x-e.x,p.y-e.y)<(p.r||25)+e.r))e.passThrough=false;
    }
    const bodies=[...living.map(p=>({id:String(p._id),kind:'player',source:p,x:p.x,y:p.y,r:p.r||25,fixed:true})),
      ...enemies.filter(e=>e.hp>0).map(e=>({id:e.id,kind:'enemy',source:e,x:e.x,y:e.y,r:e.r,mass:e.mass??(e.type==='charger'?2.4:e.type==='stalker' ? .65 : 1)}))];
    const ignore=(a,b)=>a.kind!==b.kind&&(a.kind==='enemy'?a:b).source.passThrough;
    const contacts=separateBodies(bodies,{previous:this.previous,impulses:false,ignore});
    // Pass-through chargers still hit whoever they overlap.
    for(const p of bodies)if(p.kind==='player')for(const e of bodies)if(e.kind==='enemy'&&e.source.passThrough&&!e.source.airborne){
      const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy);
      if(d<p.r+e.r)contacts.push({pair:[p.id,e.id].sort().join('|'),a:p,b:e,nx:d?dx/d:0,ny:d?dy/d:0});
    }
    const events=[],corrections=[];
    for(const c of contacts){
      const hit=playerEnemy(c);
      if(!hit||hit.player.source.choosingAugment)continue;
      const {player,enemy,nx,ny}=hit,charging=enemy.source.phase==='charge',bashing=enemy.source.type==='shellback'&&enemy.source.phase==='active',lunging=enemy.source.type==='leech'&&enemy.source.phase==='lunge';
      const contactDmg=bashing?Math.round(16*(enemy.source.power||1)):charging?Math.round(CHARGE_DAMAGE*(enemy.source.power||1)):lunging?Math.round(12*(enemy.source.power||1)):enemy.source.contact??13;
      events.push({id:player.id,sourceId:enemy.id,amount:contactDmg});
      if(now<(this.cooldowns.get(c.pair)||0))continue;
      this.cooldowns.set(c.pair,now+600);
      const mass=lunging?2.0:(enemy.mass||1);
      let kx=-nx,ky=-ny;
      if((charging||lunging||bashing)&&Number.isFinite(enemy.source.aimX)&&Number.isFinite(enemy.source.aimY)){
        const bx=-nx*.45+enemy.source.aimX,by=-ny*.45+enemy.source.aimY,bl=Math.hypot(bx,by);
        if(bl>1e-5){kx=bx/bl;ky=by/bl;}
      }
      const knock=charging?CHARGE_KNOCKBACK:(lunging||bashing)?460:CONTACT_KNOCKBACK*Math.min(1.6,Math.max(.65,Math.sqrt(mass)));
      corrections.push({id:player.id,dx:0,dy:0,dvx:kx*knock,dvy:ky*knock});
      if(!charging&&!bashing&&!enemy.source.fixed){
        const push=ENEMY_PUSHBACK/Math.max(.6,mass);
        enemy.source.pushVx=(enemy.source.pushVx||0)+nx*push;
        enemy.source.pushVy=(enemy.source.pushVy||0)+ny*push;
        enemy.source.staggerUntil=now+ENEMY_STAGGER;
      }
    }
    for(const b of bodies)if(b.kind==='enemy'){b.source.x=b.x;b.source.y=b.y;}
    this.previous=new Map(bodies.map(b=>[b.id,{x:b.x,y:b.y}]));
    const ids=new Set(bodies.map(b=>b.id));
    for(const pair of this.cooldowns.keys())if(pair.split('|').some(id=>!ids.has(id)))this.cooldowns.delete(pair);
    return {corrections,events};
  }
}
module.exports={CollisionWorld};
