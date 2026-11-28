import {map,shotAt} from './map';
import {Player} from './object';
import knightUrl from './assets/pixel/knight.png';
import enemyUrl from './assets/pixel/enemy.png';
import chargerUrl from './assets/pixel/charger.png';
import shellbackUrl from './assets/pixel/shellback.png';
import lancerUrl from './assets/pixel/lancer.png';
import lancerSpearUrl from './assets/pixel/lancer-spear.png';
import fleaUrl from './assets/pixel/flea.png';
import bannerUrl from './assets/pixel/banner.png';
import stalkerUrl from './assets/pixel/stalker.png';
import houndUrl from './assets/pixel/hound.png';
import swordsaintUrl from './assets/pixel/swordsaint.png';
import crabUrl from './assets/pixel/crab.png';
import sabreUrl from './assets/pixel/sabre.png';
import turretBaseUrl from './assets/pixel/sword-turret-base.png';
import {XP_PICKUPS, getXpPickup} from './xpPickups';
import floorUrl from './assets/pixel/floor.png';
import {createEnemySprite,NEW_ENEMY_ART} from './enemyArt';
import {ENEMY_NAMES} from './enemyNames';
import {LEVEL_UP_DURATION,drawLevelUpAura} from './levelUpEffect';
const {chargeTelegraph}=require('./gameRules');
const {separateBodies}=require('./bodyPhysics');
const {ringRadius}=require('./hazardGeometry');
const {bookVisuals}=require('./skillCasts');

const sprites = {};
Object.entries({knight: knightUrl, enemy: enemyUrl, charger: chargerUrl, shellback: shellbackUrl, lancer: lancerUrl, lancerSpear: lancerSpearUrl, flea: fleaUrl, banner: bannerUrl, stalker: stalkerUrl, hound: houndUrl, swordsaint: swordsaintUrl, crab: crabUrl, sabre: sabreUrl, turretBase: turretBaseUrl, floor: floorUrl, ...Object.fromEntries(XP_PICKUPS.map(tier => [tier.key,tier.url]))}).forEach(([key, url]) => {
  const img = new Image();
  img.src = url;
  sprites[key] = img;
});
// Enlarge the source pixel art once with nearest-neighbor sampling. Transform
// those prepared sprites at display resolution so rotation does not re-sample
// a tiny source or quantize the entire world onto a coarse pixel grid.
const scaledSprites = new Map();
function enemySprites() {
  if (!sprites.charger) sprites.charger = createEnemySprite("charger");
  for (const type of ['stalker','bomber','spitter','splitter','mite',...NEW_ENEMY_ART]) if (!sprites[type]) sprites[type] = createEnemySprite(type);
}
function sprite(ctx, key, x, y, width, height) {
  const img = sprites[key];
  if (!img || img.complete === false || !(img.naturalWidth || img.width)) return;
  // Keep reconstructed sprite proportions; do not stretch the native pixel grid.
  if (key !== 'floor') {
    const sourceW = img.naturalWidth || img.width;
    const sourceH = img.naturalHeight || img.height;
    const scale = Math.min(width / sourceW, height / sourceH);
    const fittedW = sourceW * scale, fittedH = sourceH * scale;
    x += (width - fittedW) / 2; y += (height - fittedH) / 2;
    width = fittedW; height = fittedH;
  }
  const transform = ctx.getTransform();
  const dpr = Math.hypot(transform.a, transform.b);
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  const cacheKey = `${key}:${w}:${h}`;
  let prepared = scaledSprites.get(cacheKey);
  if (!prepared) {
    prepared = document.createElement('canvas');
    prepared.width = w; prepared.height = h;
    const buffer = prepared.getContext('2d');
    buffer.imageSmoothingEnabled = false;
    buffer.drawImage(img, 0, 0, w, h);
    if (scaledSprites.size >= 256) scaledSprites.delete(scaledSprites.keys().next().value);
    scaledSprites.set(cacheKey, prepared);
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(prepared, x, y, width, height);
  ctx.restore();
}

const TAU = Math.PI * 2;
let effects = [];
let lastPlayer = null;
let renderPlayers=[];
let renderEnemies=[];
const enemyHealth = new Map();
export function resetEffects() {
  effects = [];
  trails.clear();
  lastPlayer = null;
  enemyHealth.clear();
}
export function addEffect(type, pos, text = '', born = performance.now()) {
  // Rapid XP rewards can cross several levels; keep one level-up burst active.
  if(type==='levelUp')effects=effects.filter(fx=>fx.type!==type||fx.targetId!==pos.id);
  effects.push({type,...pos,x:pos.x,y:pos.y,targetId:pos.id,nx:pos.nx||0,ny:pos.ny||0,text,born,seed:Math.random()*TAU});
  if (effects.length > 80) effects.shift();
}
// Level-up blast: a white flash, a filled storm-teal shockwave covering the
// whole 300px hit radius, and forked lightning — unlike the plain skill rings.
const NOVA_DURATION=700,NOVA_RADIUS=300;
function drawNova(ctx,x,y,t,seed){
  const ease=1-(1-t)*(1-t),r=NOVA_RADIUS*(.15+.85*ease),fade=1-t;
  ctx.save();
  if(t<.18){const f=1-t/.18;circle(ctx,x,y,60+90*(1-f),`rgba(255,255,255,${.85*f})`);}
  const glow=ctx.createRadialGradient(x,y,r*.55,x,y,r);
  glow.addColorStop(0,'rgba(141,216,207,0)');glow.addColorStop(1,`rgba(141,216,207,${.32*fade})`);
  circle(ctx,x,y,r,glow);
  circle(ctx,x,y,r,null,'#d8fff9',6*fade+1);
  circle(ctx,x,y,r*.72,null,`rgba(141,216,207,${.7*fade})`,2.5*fade+.5);
  if(t<.6){
    const f=1-t/.6;ctx.strokeStyle=`rgba(232,255,252,${f})`;ctx.lineWidth=2.5*f+.8;ctx.lineJoin='round';
    for(let i=0;i<8;i++){
      const a=seed+i/8*TAU,len=r*.95;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*18,y+Math.sin(a)*18);
      for(let k=1;k<=5;k++){const d=len*k/5,j=k<5?Math.sin(seed*13+i*7+k*3.1)*.16:0;ctx.lineTo(x+Math.cos(a+j)*d,y+Math.sin(a+j)*d);}
      ctx.stroke();
    }
  }
  ctx.restore();
}
function circle(ctx, x, y, r, fill, stroke, width = 1) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
  if (fill) {ctx.fillStyle = fill; ctx.fill();}
  if (stroke) {ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke();}
}
function crystal(ctx, x, y, value, time, reduced, seed) {
  // Phase belongs to the item, never its camera-relative screen position.
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const phase = hash / 0xffffffff * TAU;
  const pickup = getXpPickup(value);
  const height = pickup.height;
  const image = sprites[pickup.key];
  const width = height * (image.naturalWidth / image.naturalHeight || 1);
  const bob = reduced ? 0 : Math.sin(time / 350 + phase) * 4.5;
  ctx.fillStyle = '#080f1699';
  ctx.fillRect(x - width * .35, y + height / 2 + 3, width * .7, 3);
  sprite(ctx, pickup.key, x - width / 2, y - height / 2 + bob, width, height);
}
function floor(ctx, width, height, camera, time, reduced) {
  ctx.fillStyle = '#111e24'; ctx.fillRect(0, 0, width, height);
  const left = camera.x - width / 2, top = camera.y - height / 2;
  const tileSize = 192;
  for (let x = Math.floor(left / tileSize) * tileSize; x < left + width; x += tileSize) {
    for (let y = Math.floor(top / tileSize) * tileSize; y < top + height; y += tileSize) {
      sprite(ctx, 'floor', x - left, y - top, tileSize, tileSize);
    }
  }
  ctx.fillStyle = '#0b172342'; ctx.fillRect(0, 0, width, height);
  // Sparse square inlays anchor movement without competing with collectibles.
  ctx.fillStyle = '#587468';
  for (let x = Math.floor(left / 768) * 768; x < left + width; x += 768) {
    for (let y = Math.floor(top / 768) * 768; y < top + height; y += 768) {
      const sx = Math.round(x - left), sy = Math.round(y - top);
      ctx.fillRect(sx - 6, sy, 15, 3); ctx.fillRect(sx, sy - 6, 3, 15);
    }
  }
  // The actual soft map bounds live at +/- 3000 world units.
  ctx.save(); ctx.translate(-left, -top);
  ctx.fillStyle = '#cf765c18';
  ctx.fillRect(-3050, -3050, 6100, 50); ctx.fillRect(-3050, 3000, 6100, 50);
  ctx.fillRect(-3050, -3000, 50, 6000); ctx.fillRect(3000, -3000, 50, 6000);
  ctx.strokeStyle = '#d7937370'; ctx.setLineDash([8, 10]); ctx.strokeRect(-3000, -3000, 6000, 6000); ctx.setLineDash([]);
  ctx.font = '10px monospace'; ctx.fillStyle = '#e8aa8b'; ctx.textAlign = 'center';
  ctx.fillText('ARENA BOUNDARY', 0, -2980); ctx.fillText('ARENA BOUNDARY', 0, 2980); ctx.restore();
  if (camera.idle) {
    for (let i = 0; i < 26; i++) {
      const x = ((i * 237 + 57) % Math.max(1, width));
      const y = ((i * 173 + 130) % Math.max(1, height));
      crystal(ctx, x, y, 2 + i % 13, time, reduced, `lobby-${i}`);
    }
  }
}
// Blade afterimages are sampled from the blade's real recent poses, so a
// reversal, a faster spin or a thrust leaves its own trail. Giant blade has
// no extra effect beyond its size.
const trails=new Map();
function trailStyle(p,time){
  const state=p.combatState||{};
  if(state.whirl)return {length:160,alpha:.45};
  if(state.thrust)return {length:200,alpha:.4};
  if(state.fast)return {length:230,alpha:.32};
  return {length:90,alpha:.16};
}
// Draw one blade (or orb) with its afterimage trail. `paint` draws it at the
// current rotation; poses are recorded per key so each blade keeps its trail.
function trailed(ctx,key,angle,radius,w,h,time,reduced,style,paint){
  if(!reduced){
    const trail=trails.get(key)||{poses:[]};
    trails.set(key,trail);trail.seen=time;
    trail.poses=trail.poses.filter(pose=>time-pose.t<style.length);
    let ghosts=0;
    for(let i=0;i<trail.poses.length&&ghosts<28;i++){
      const pose=trail.poses[i],next=trail.poses[i+1]||{angle,radius,w,h};
      const turn=Math.atan2(Math.sin(next.angle-pose.angle),Math.cos(next.angle-pose.angle));
      const steps=Math.min(4,Math.max(1,Math.ceil(Math.abs(turn)/.07),Math.ceil(Math.abs(next.radius-pose.radius)/14)));
      for(let k=0;k<steps;k++,ghosts++){
        const f=k/steps,age=(time-pose.t)/style.length;
        ctx.save();ctx.rotate(-(pose.angle+turn*f));ctx.globalAlpha*=style.alpha*(1-age)*(1-age);
        paint(ctx,pose.w,pose.h,pose.radius+(next.radius-pose.radius)*f);ctx.restore();
      }
    }
    trail.poses.push({t:time,angle,radius,w,h});
  }
  ctx.save();ctx.rotate(-angle);paint(ctx,w,h,radius);ctx.restore();
}
const paintSabre=(ctx,w,h,radius)=>sprite(ctx,'sabre',-w/2,-radius-h/2,w,h);
const paintOrb=(ctx,w,h,radius)=>{circle(ctx,0,-radius,w/2+3,'#8be9ff33');circle(ctx,0,-radius,w/2,'#bff4ff','#4fc3dd',2);};
function blade(ctx,p,time,reduced){
  trailed(ctx,p.id,p.sw_angle,p.r+p.sw_r,p.sw_w,p.sw_h,time,reduced,trailStyle(p,time),paintSabre);
}
// The doubleEdge back blade and orbs travel with the player.
function extraBlades(ctx,p,time,reduced){
  for(const b of p.blades||[]){
    if(b.blade==='main'||b.x!=null)continue;
    const orb=b.blade.startsWith('orb');
    // T-01 rainbow swords: each blade a different hue.
    if(b.rainbow){ctx.save();ctx.filter=`hue-rotate(${(Number(b.blade.slice(-1))*120+time/8)%360}deg) saturate(2.2) brightness(1.2)`;}
    trailed(ctx,`${p.id}:${b.blade}`,b.sw_angle,p.r+b.sw_r,b.sw_w,b.sw_h,time,reduced,{length:orb?160:110,alpha:orb?.35:.2},orb?paintOrb:paintSabre);
    if(b.rainbow)ctx.restore();
  }
}
// Dash slash: show the crescent the blade sweeps during the lunge. A blade
// angle a points along world (-sin a, -cos a), i.e. canvas angle -PI/2-a.
function dashArc(ctx,p){
  const d=p.skills?.dash;
  if(!d||!p.combatState?.dash)return;
  const dir=p.skills.direction||1,outer=p.r+p.sw_r+p.sw_h/2,inner=Math.max(p.r,p.r+p.sw_r-p.sw_h/2);
  const canvas=a=>-Math.PI/2-a,start=canvas(d.angle+dir*1.4),end=canvas(d.angle-dir*1.4),now=canvas(p.sw_angle);
  const crescent=(from,to,fill,stroke)=>{
    const ccw=to<from;
    ctx.beginPath();ctx.arc(0,0,outer,from,to,ccw);ctx.arc(0,0,inner,to,from,!ccw);ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
  };
  ctx.save();
  crescent(start,end,'#ffe4a41f','#ffe4a466');
  crescent(start,now,'#fff6d855');
  ctx.restore();
}
function actor(ctx, p, own, x, y, time, reduced) {
  ctx.save(); ctx.translate(x, y);
  const recoil=effects.find(fx=>fx.targetId===p.id&&['impact','kill'].includes(fx.type)&&time-fx.born<150);
  if(recoil&&!reduced){const kick=Math.sin((time-recoil.born)/150*Math.PI)*5;ctx.translate(recoil.nx*kick,recoil.ny*kick);}
  const moving = Math.hypot(p.speed.x, p.speed.y) > .5;
  const step = reduced || !moving ? 0 : Math.sin(time / 130) * 1.5;
  const height = p.r * 2 + 12;
  const width = own ? height * .75 : height * .8125;
  ctx.fillStyle = '#07101899'; ctx.fillRect(-width / 2 + 3, height / 2 - 3, width - 6, 9);
  const flashed = !reduced && effects.some(fx => ['impact','hurt','kill'].includes(fx.type) && time-fx.born<150 && (fx.targetId===p.id || Math.hypot(fx.x-p.pos.x,fx.y-p.pos.y)<p.r));
  const ghost=own&&p.combatState?.ghost;
  if(ghost){circle(ctx,0,0,p.r+8,'#7fe3ff22','#9eeaffaa',1.5);ctx.globalAlpha=.5;}
  if(flashed)ctx.filter='brightness(2.8) saturate(.3)';
  if (p.speed.x < -.5) {
    ctx.save(); ctx.scale(-1, 1); sprite(ctx, own ? 'knight' : 'enemy', -width / 2, -height / 2 - step, width, height); ctx.restore();
  } else sprite(ctx, own ? 'knight' : 'enemy', -width / 2, -height / 2 - step, width, height);
  if(flashed)ctx.filter='none';
  if(ghost)ctx.globalAlpha=1;
  if(p.shield>0)circle(ctx,0,0,p.r+12,null,'#a4c9f0aa',2);
  // Ignite: the player's blades burn.
  if(own&&p.combatState?.ignite&&!reduced){ctx.shadowColor='#ff7a2a';ctx.shadowBlur=14+4*Math.sin(time/70);}
  if(own){dashArc(ctx,p);extraBlades(ctx,p,time,reduced);}
  blade(ctx, p, time, reduced);
  ctx.shadowBlur=0;
  const health = Math.max(0, Math.min(1, p.hp / p.hpmax));
  ctx.fillStyle = '#061018'; ctx.fillRect(-27, height / 2 + 10, 54, 7);
  ctx.fillStyle = own ? '#a5ead0' : '#efa184'; ctx.fillRect(-24, height / 2 + 12, health * 48, 3);
  ctx.restore();
}
const BOMB_RADIUS=115;
const HEALTH_COLORS={charger:'#e0ab77',stalker:'#b99adc',bomber:'#f08a5d',spitter:'#8fd07a',splitter:'#6cc4cf',mite:'#6cc4cf'};
// Every enemy attack uses the same warning language: a dashed warm outline
// whose fill rises as the strike approaches, then a solid flash while it can
// hurt. Only the tint changes for non-damaging fields (frost, wind, magnet).
const HAZARD_TINT={fire:'255,140,60',poison:'170,110,210',frost:'150,215,255',wind:'190,220,240',trap:'230,200,120',echo:'255,200,120',chain:'255,170,120',marker:'230,220,180'};
function arrowPath(ctx,length,width){
  const head=Math.min(length*.42,Math.max(24,width*.9)),shaftLen=Math.max(0,length-head),hw=width/2,headW=width*.82;
  ctx.beginPath();
  ctx.moveTo(0,-hw);
  ctx.lineTo(shaftLen,-hw);
  ctx.lineTo(shaftLen,-headW);
  ctx.lineTo(length,0);
  ctx.lineTo(shaftLen,headW);
  ctx.lineTo(shaftLen,hw);
  ctx.lineTo(0,hw);
  ctx.closePath();
}
function hazardShape(ctx,h,radius){
  ctx.beginPath();
  if(h.kind==='circle')ctx.arc(0,0,h.r,0,TAU);
  else if(h.kind==='line'&&h.arrow){ctx.save();ctx.rotate(h.angle);arrowPath(ctx,h.length,h.width);ctx.restore();}
  else if(h.kind==='line'){ctx.save();ctx.rotate(h.angle);ctx.rect(0,-h.width/2,h.length,h.width);ctx.restore();}
  else if(h.kind==='cone'){ctx.moveTo(0,0);ctx.arc(0,0,h.length,h.angle-h.spread/2,h.angle+h.spread/2);ctx.closePath();}
  else if(h.kind==='ring'){
    const gaps=h.gapCount||1,step=TAU/gaps,inner=Math.max(0,radius-h.band/2),outer=radius+h.band/2;
    for(let g=0;g<gaps;g++){
      const a0=h.gapAngle+g*step+h.gapSize/2,a1=h.gapAngle+(g+1)*step-h.gapSize/2;
      ctx.moveTo(Math.cos(a0)*outer,Math.sin(a0)*outer);
      ctx.arc(0,0,outer,a0,a1);
      ctx.arc(0,0,inner,a1,a0,true);
      ctx.closePath();
    }
  }
}
// Player skill areas use cool ally tints (own: teal, others: violet) so they
// never read as enemy warnings. Support fields (sanctuary, banner) are green.
function drawSkillZones(ctx,me,size,time,reduced){
  const sz=map.skillZones||{list:[]},elapsed=Math.max(0,time-(sz.at||time));
  const screen=(x,y)=>[size.width/2+x-me.pos.x,size.height/2+y-me.pos.y];
  for(const raw of sz.list||[]){
    const z={...raw,armIn:raw.armIn-elapsed,left:raw.left-elapsed};
    if(z.left<0)continue;
    const [x,y]=screen(z.x,z.y),reach=(z.length||0)+(z.r||0)+60;
    if(x<-reach||x>size.width+reach||y<-reach||y>size.height+reach)continue;
    const own=z.owner===me.id,tint=z.support?'140,220,150':own?'120,230,220':'190,160,255';
    ctx.save();ctx.translate(x,y);hazardShape(ctx,z,0);
    if(z.armIn>0){
      ctx.fillStyle=`rgba(${tint},.08)`;ctx.fill();
      ctx.setLineDash([6,6]);ctx.lineDashOffset=reduced?0:-time/50;ctx.strokeStyle=`rgba(${tint},.7)`;ctx.lineWidth=1.4;ctx.stroke();ctx.setLineDash([]);
    }else{
      const pulse=reduced?.5:.5+.5*Math.sin(time/90);
      ctx.fillStyle=`rgba(${tint},${z.support?.1:.16+.08*pulse})`;ctx.fill();
      ctx.strokeStyle=`rgba(${tint},.8)`;ctx.lineWidth=1.6;ctx.stroke();
    }
    ctx.restore();
  }
  for(const w of sz.walls||[]){
    if(w.left-elapsed<0)continue;
    const [x,y]=screen(w.x,w.y);
    ctx.save();ctx.translate(x,y);ctx.rotate(w.angle);
    ctx.fillStyle='rgba(200,230,255,.35)';ctx.fillRect(0,-w.width/2,w.length,w.width);
    ctx.strokeStyle='rgba(230,245,255,.9)';ctx.lineWidth=2;ctx.strokeRect(0,-w.width/2,w.length,w.width);
    ctx.restore();
  }
  for(const d of sz.decoys||[]){
    if(d.left-elapsed<0)continue;
    const [x,y]=screen(d.x,d.y);
    ctx.save();ctx.globalAlpha=.6;circle(ctx,x,y,24,'#8fd0ff33','#8fd0ffcc',2);ctx.fillStyle='#e8f6ff';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText('미끼',x,y+4);ctx.restore();
  }
  // Local-only book objects: gates, anchors, garden and banner outlines.
  for(const v of bookVisuals(me,time)){
    const [x,y]=screen(v.x,v.y);
    ctx.save();
    if(v.kind==='gate'){circle(ctx,x,y,30,'#c9a8ff33','#c9a8ffdd',2.5);}
    else if(v.kind==='anchor'){ctx.strokeStyle='#9fe3ff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-12);ctx.lineTo(x,y+10);ctx.moveTo(x-9,y+4);ctx.quadraticCurveTo(x,y+16,x+9,y+4);ctx.stroke();}
    else {ctx.setLineDash([4,6]);circle(ctx,x,y,v.r,null,v.kind==='garden'?'#b6f0ff88':'#ffe28a88',1.5);ctx.setLineDash([]);}
    ctx.restore();
  }
}
function drawHazards(ctx,me,size,time,reduced,source=map.hazards){
  const elapsed=Math.max(0,time-(source.at||time));
  for(const raw of source.list||[]){
    const h={...raw,armIn:raw.armIn-elapsed,left:raw.left-elapsed};
    if(h.left<0)continue;
    const x=size.width/2+h.x-me.pos.x,y=size.height/2+h.y-me.pos.y;
    const reach=(h.length||0)+(h.r||0)+Math.max(h.from||0,h.to||0)+60;
    if(x<-reach||x>size.width+reach||y<-reach||y>size.height+reach)continue;
    const tint=HAZARD_TINT[h.style]||'255,120,80',warning=h.armIn>0;
    const radius=h.kind==='ring'?(warning?h.from:ringRadius(h,-h.armIn,h.left-h.armIn)):0;
    ctx.save();ctx.translate(x,y);
    if(warning){
      const total=Math.max(1,h.total||h.armIn),k=Math.max(0,Math.min(1,1-h.armIn/total));
      if(h.kind==='line'&&h.bar){
        ctx.save();ctx.rotate(h.angle);
        ctx.fillStyle=`rgba(${tint},.12)`;ctx.fillRect(0,-h.width/2,h.length,h.width);
        ctx.fillStyle=`rgba(${tint},.46)`;ctx.fillRect(0,-h.width/2,h.length*k,h.width);
        ctx.setLineDash([8,7]);ctx.lineDashOffset=reduced?0:-time/40;
        ctx.strokeStyle=`rgba(${h.harmful?'255,178,139':tint},.9)`;ctx.lineWidth=1.8;ctx.strokeRect(0,-h.width/2,h.length,h.width);ctx.setLineDash([]);
        ctx.restore();
      }else{
        hazardShape(ctx,h,radius);
        ctx.fillStyle=`rgba(${tint},${h.harmful?.06+.22*k:.05+.08*k})`;ctx.fill();
        ctx.setLineDash([8,7]);ctx.lineDashOffset=reduced?0:-time/40;
        ctx.strokeStyle=`rgba(${h.harmful?'255,178,139':tint},${.55+.4*k})`;ctx.lineWidth=1.6;ctx.stroke();ctx.setLineDash([]);
        // Rings also outline where they will end up.
        if(h.kind==='ring'){hazardShape(ctx,h,h.to);ctx.strokeStyle=`rgba(${tint},.25)`;ctx.lineWidth=1;ctx.stroke();}
        // Arcing bomb drop animation from the thrower/porter into the landing circle.
        if(h.bomb){
          const sx=Number.isFinite(h.fromX)?h.fromX-h.x:0,sy=Number.isFinite(h.fromY)?h.fromY-h.y:-120;
          const bx=sx*(1-k),by=sy*(1-k)-Math.sin(k*Math.PI)*95;
          const bScale=.7+.45*Math.sin(k*Math.PI);
          circle(ctx,bx,by+12,6*(1-.4*Math.sin(k*Math.PI)),'rgba(7,16,24,.35)');
          circle(ctx,bx,by,8*bScale,'#3a3230','#ff9a5a',2);
          circle(ctx,bx+3*bScale,by-6*bScale,3*bScale,'#fff2a6');
        }
      }
    }else if(h.style==='frost'&&h.kind==='circle'){
      const fade=Math.min(1,Math.max(0,h.left/900));
      const grad=ctx.createRadialGradient(0,0,h.r*.15,0,0,h.r);
      grad.addColorStop(0,`rgba(170,230,255,${.28*fade})`);
      grad.addColorStop(.65,`rgba(145,215,255,${.16*fade})`);
      grad.addColorStop(1,'rgba(145,215,255,0)');
      circle(ctx,0,0,h.r,grad);
      if(!reduced){
        ctx.fillStyle=`rgba(235,250,255,${.5*fade})`;
        const seed=(h.x*13+h.y*7)%100;
        for(let i=0;i<3;i++){
          const a=seed+i*2.1,d=h.r*(.28+i*.2);
          ctx.fillRect(Math.cos(a)*d-1.5,Math.sin(a)*d-1.5,3,3);
        }
      }
    }else if(h.style==='chain'&&h.kind==='line'){
      const pulse=reduced?.5:.5+.5*Math.sin(time/60);
      hazardShape(ctx,h,radius);
      ctx.fillStyle=`rgba(${tint},${.14+.08*pulse})`;ctx.fill();
      ctx.save();ctx.rotate(h.angle);
      ctx.strokeStyle='#ffe2c4';ctx.lineWidth=4.5;ctx.beginPath();
      const steps=Math.max(8,Math.round(h.length/16));
      for(let i=0;i<=steps;i++){
        const u=h.length*i/steps,env=Math.sin(Math.PI*i/steps);
        const v=reduced?0:Math.sin(i*.9-time/45)*(h.width*.42)*env;
        if(i===0)ctx.moveTo(u,v);else ctx.lineTo(u,v);
      }
      ctx.stroke();
      ctx.strokeStyle='#7a4a2a';ctx.lineWidth=2;ctx.setLineDash([6,6]);ctx.stroke();ctx.setLineDash([]);
      ctx.restore();
    }else if(h.kind==='cone'&&h.sweep){
      const dur=Math.max(1,h.left-h.armIn),f=Math.max(0,Math.min(1,-h.armIn/dur));
      const a0=h.angle-h.spread/2,cur=a0+h.spread*f;
      hazardShape(ctx,h,radius);
      ctx.fillStyle=`rgba(${tint},.08)`;ctx.fill();
      ctx.strokeStyle=`rgba(${tint},.4)`;ctx.lineWidth=1.2;ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,h.length,Math.max(a0,cur-.65),cur);ctx.closePath();
      ctx.fillStyle=`rgba(${tint},.45)`;ctx.fill();
      ctx.strokeStyle='rgba(255,240,210,.95)';ctx.lineWidth=3.5;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(cur)*h.length,Math.sin(cur)*h.length);ctx.stroke();
    }else{
      const pulse=reduced?.5:.5+.5*Math.sin(time/70);
      hazardShape(ctx,h,radius);
      ctx.fillStyle=h.harmful?`rgba(${tint},${.3+.12*pulse})`:`rgba(${tint},.14)`;ctx.fill();
      ctx.strokeStyle=h.harmful?'rgba(255,230,200,.85)':`rgba(${tint},.45)`;ctx.lineWidth=h.harmful?2.2:1.2;ctx.stroke();
    }
    // Echo afterimage: show a ghostly copy of the player + sword at the recorded spot.
    if(h.style==='echo'&&h.kind==='line'&&Number.isFinite(h.fromX)&&Number.isFinite(h.fromY)){
      const gx=h.fromX-h.x,gy=h.fromY-h.y;
      const total=Math.max(1,h.total||1000),k=warning?Math.max(0,Math.min(1,1-h.armIn/total)):1;
      ctx.save();
      ctx.translate(gx,gy);
      circle(ctx,0,0,28,`rgba(255,216,138,${warning?.08+.12*k:.28})`,`rgba(255,224,160,${warning?.5+.4*k:.95})`,2);
      ctx.globalAlpha=warning?.35+.4*k:.9;
      ctx.filter='sepia(.7) saturate(2) hue-rotate(10deg) brightness(1.3)';
      sprite(ctx,'knight',-22,-28,44,56);
      ctx.rotate(h.angle+Math.PI/2);
      sprite(ctx,'sabre',-16,-95-(warning?0:35),32,96);
      ctx.restore();
    }
    // Direction cues for movement fields.
    if((h.effect==='wind'||h.effect==='pull')&&!reduced){
      ctx.strokeStyle=`rgba(${tint},.75)`;ctx.lineWidth=2;
      for(let i=0;i<4;i++){
        const f=(time/600+i/4)%1;ctx.save();
        if(h.effect==='wind'){ctx.rotate(h.angle);const u=f*h.length,v=(i-1.5)*h.width/5;ctx.beginPath();ctx.moveTo(u-10,v-6);ctx.lineTo(u,v);ctx.lineTo(u-10,v+6);ctx.stroke();}
        else{const d=(1-f)*h.length;ctx.rotate(h.angle+(i-1.5)*h.spread/4);ctx.beginPath();ctx.moveTo(d+10,-6);ctx.lineTo(d,0);ctx.lineTo(d+10,6);ctx.stroke();}
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
const SHOT_COLORS={sickle:['#e8d8a0','#6a5a2a'],seed:['#a8a050','#3c3420'],wheel:['#9aa0a8','#3a3026'],glass:['#bff4ff','#2a6070'],spark:['#ff9a4a','#6a2a10'],feather:['#e0f4ff','#3a5a78'],lantern:['#ffe082','#7a4f10'],mud:['#9c7a56','#3d2c1c'],frost:['#a8e6ff','#3a7a9c'],potionG:['#7bf08a','#245e30'],potionR:['#ff7d70','#6e2018'],potionB:['#7cc8ff','#1e4a78']};
const SPRITE_SCALE={lancer:3.0,banner:2.5,bannerFlag:2.2,flea:1.3,shellback:1.1,hound:1.45,swordsaint:1.4};
const FACED=new Set(['shellback','magnet','crab','segment','cannon']);
// Bosses get a named health bar at the top of the screen.
function bossBar(ctx,size){
  const boss=renderEnemies.find(e=>e.tier==='boss'&&e.hp>0);
  if(!boss)return;
  const w=Math.min(520,size.width-80),x=(size.width-w)/2,y=86;
  ctx.save();ctx.fillStyle='#071018cc';ctx.fillRect(x-4,y-4,w+8,16);
  ctx.fillStyle='#3a1a18';ctx.fillRect(x,y,w,8);
  ctx.fillStyle=boss.armor>1?'#ffd88a':'#e8735a';ctx.fillRect(x,y,w*Math.max(0,boss.hp/boss.hpmax),8);
  ctx.font='600 13px system-ui, sans-serif';ctx.textAlign='center';ctx.fillStyle='#f3e2c8';ctx.shadowColor='#050b10';ctx.shadowBlur=4;
  ctx.fillText(ENEMY_NAMES[boss.type]||boss.type,size.width/2,y-8);ctx.restore();
}
function enemyPose(enemy) {return enemy;}
function drawEnemy(ctx, raw, me, size, time, reduced) {
  const e = enemyPose(raw, time);
  const x = size.width/2 + e.x - me.pos.x, y = size.height/2 + e.y - me.pos.y;
  if (x < -400 || x > size.width+400 || y < -400 || y > size.height+400) return;
  if (e.type === 'spinner') {
    actor(ctx, {id:e.id,pos:{x:e.x,y:e.y},r:e.r,hp:e.hp,hpmax:e.hpmax,speed:{x:e.vx,y:e.vy},sw_angle:e.angle,sw_r:42,sw_w:22,sw_h:70}, false, x, y, time, reduced);
    return;
  }
  enemySprites();
  if(!sprites[e.type])sprites[e.type]=createEnemySprite(e.type);
  // Support links: mender thread, banner aura, herald beacon.
  if(e.linkId){
    const t=renderEnemies.find(o=>o.id===e.linkId);
    if(t){
      const tx=size.width/2+t.x-me.pos.x,ty=size.height/2+t.y-me.pos.y;
      ctx.save();
      ctx.strokeStyle='#9cf0b8aa';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();
      ctx.strokeStyle='#e4ffec';ctx.setLineDash([5,5]);ctx.lineDashOffset=reduced?0:-time/35;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();
      ctx.setLineDash([]);
      circle(ctx,tx,ty,(t.r||20)+7,'rgba(156,240,184,.14)','#9cf0b8',2);
      ctx.restore();
    }
  }
  if(e.type==='gatekeeper'&&e.pairId&&!e.twinB){
    const twin=renderEnemies.find(o=>o.id===e.pairId);
    if(twin){
      ctx.save();ctx.strokeStyle='#9ec6ff66';ctx.setLineDash([6,6]);ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(size.width/2+twin.x-me.pos.x,size.height/2+twin.y-me.pos.y);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    }
  }
  if(e.type==='banner'||e.type==='bannerFlag'){
    const pulse=reduced?.5:.5+.5*Math.sin(time/220);
    circle(ctx,x,y,220,`rgba(244,184,106,${.05+.04*pulse})`,`rgba(244,184,106,${.35+.2*pulse})`,2);
  }
  if(e.type==='balloonPart'&&e.parentId){
    const p=renderEnemies.find(o=>o.id===e.parentId);
    if(p){
      const px=size.width/2+p.x-me.pos.x,py=size.height/2+p.y-me.pos.y;
      ctx.save();ctx.strokeStyle='#d6c9b4cc';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(x,y+e.r*.4);ctx.quadraticCurveTo((x+px)/2,(y+py)/2+6,px,py-p.r*.3);ctx.stroke();
      ctx.restore();
    }
  }
  if(e.type==='herald'&&e.phase==='signal'){ctx.fillStyle='#ff6a3a55';ctx.fillRect(x-4,y-160,8,160-e.r);}
  ctx.save(); ctx.translate(x,y);
  const lane=chargeTelegraph(e);
  if(lane && lane.length>.5){
    ctx.save(); ctx.rotate(lane.angle);
    arrowPath(ctx,lane.length,e.r*1.8);
    ctx.fillStyle = e.phase === 'windup' ? '#f18b6b28' : '#ffd28818';
    ctx.fill();
    ctx.strokeStyle = e.phase === 'windup' ? '#ffb28b' : '#f4da9c'; ctx.lineWidth = 1.6;
    ctx.setLineDash([8,7]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  if(e.type==='bomber'&&e.phase==='fuse'){
    // Blast radius border fills clockwise as a countdown timer until detonation.
    const pulse=reduced?.5:.5+.5*Math.sin(time/60);
    const total=Math.max(1,e.fuseTotal||900),left=Math.max(0,Math.min(total,e.fuseLeft??total));
    const progress=1-left/total;
    circle(ctx,0,0,BOMB_RADIUS,`rgba(240,110,70,${.08+.08*pulse})`,'rgba(255,150,110,.3)',1.5);
    ctx.save();
    ctx.strokeStyle=progress>.75?'#fff2c6':'#ff945e';ctx.lineWidth=4;ctx.lineCap='round';
    ctx.beginPath();ctx.arc(0,0,BOMB_RADIUS,-Math.PI/2,-Math.PI/2+TAU*progress);ctx.stroke();
    ctx.restore();
  }
  if(e.type==='spitter'&&e.phase==='aim'){
    const lineLen=Math.hypot(size.width,size.height)+200;
    ctx.save();ctx.rotate(Math.atan2(e.aimY,e.aimX));
    const grad=ctx.createLinearGradient(e.r+4,0,lineLen,0);
    grad.addColorStop(0,'rgba(155,224,127,.95)');
    grad.addColorStop(.25,'rgba(155,224,127,.65)');
    grad.addColorStop(1,'rgba(155,224,127,0)');
    ctx.strokeStyle=grad;ctx.lineWidth=1.8;ctx.setLineDash([7,7]);
    ctx.beginPath();ctx.moveTo(e.r+4,0);ctx.lineTo(lineLen,0);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }
  const recoil=effects.find(fx=>fx.targetId===e.id&&['impact','kill'].includes(fx.type)&&time-fx.born<150);
  if(recoil&&!reduced){const kick=Math.sin((time-recoil.born)/150*Math.PI)*5;ctx.translate(recoil.nx*kick,recoil.ny*kick);}
  // Decoys cast no shadow: that is how the real masker is told apart.
  const airborne=e.airborne||e.type==='balloonPart';
  const leapArc=e.type==='flea'?(e.leapArc||0):0;
  if(e.type!=='decoy'&&e.type!=='segment'&&e.type!=='cannon'&&!airborne){ctx.fillStyle = '#07101899'; ctx.fillRect(-e.r,e.r-5,e.r*2,10);}
  if(airborne){
    const sFade=1-leapArc*.45;
    ctx.fillStyle=`rgba(7,16,24,${.4*sFade})`;
    ctx.fillRect(-e.r*.7*sFade,e.r+6,e.r*1.4*sFade,6*sFade);
    ctx.translate(0,e.type==='flea'?-leapArc*78:-6);
  }
  if(e.sword)trailed(ctx,e.id,e.angle,e.r+e.sword.sw_r,e.sword.sw_w,e.sword.sw_h,time,reduced,{length:140,alpha:.25},paintSabre);
  if(e.type==='gatekeeper'){
    if(e.enraged)circle(ctx,0,0,e.r+10,'rgba(255,80,50,.22)','#ff5a3a',3.5);
    else if(e.role==='guard')circle(ctx,0,0,e.r+8,'rgba(140,195,255,.16)','#9ec6ff',3);
    else circle(ctx,0,0,e.r+6,'rgba(255,130,90,.1)','#ff9870aa',2);
  }
  if(e.type==='shellback'&&e.guarding){
    const f=e.facing||0,flash=!!e.blockFlash;
    ctx.save();
    ctx.fillStyle=flash?'rgba(220,245,255,.35)':'rgba(216,207,160,.16)';
    ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,e.r+8,f-1.05,f+1.05);ctx.closePath();ctx.fill();
    ctx.strokeStyle=flash?'#f0fbff':'#e6dca8';ctx.lineWidth=flash?5.5:3.5;
    ctx.beginPath();ctx.arc(0,0,e.r+8,f-1.05,f+1.05);ctx.stroke();
    ctx.restore();
  }
  if(e.hasted&&!reduced){
    const pulse=.5+.5*Math.sin(time/120);
    circle(ctx,0,0,e.r+6,`rgba(244,184,106,${.08+.06*pulse})`,`rgba(255,204,120,${.55+.35*pulse})`,2);
    ctx.strokeStyle='#ffd488';ctx.lineWidth=2;
    for(const sd of [-1,1]){
      const off=(time/90)%6;
      ctx.beginPath();ctx.moveTo(sd*(e.r+5+off),-6);ctx.lineTo(sd*(e.r+11+off),0);ctx.lineTo(sd*(e.r+5+off),6);ctx.stroke();
    }
  }
  ctx.save();
  const aiming=(e.type==='charger'&&e.phase!=='hunt')||e.type==='spitter';
  const moving=Math.hypot(e.vx||0,e.vy||0)>1;
  // Turning enemies show their real facing; attackers face their locked aim.
  const direction = Number.isFinite(e.facing)&&(FACED.has(e.type)||e.phase!=='hunt'||!moving) ? e.facing : aiming ? Math.atan2(e.aimY,e.aimX) : moving ? Math.atan2(e.vy,e.vx) : -Math.PI/2;
  if(e.type==='lantern'&&e.phase==='closed')ctx.globalAlpha=.75;
  if(e.type==='decoy'&&e.revealed)ctx.globalAlpha=.42;
  if(e.type==='flea'){
    const zScale=1+leapArc*.55;
    const faceLeft=(e.leapDir?e.leapDir<0:(e.vx||0)<-1);
    if(leapArc>0)ctx.rotate((faceLeft?-1:1)*leapArc*.22);
    ctx.scale(faceLeft?-zScale:zScale,zScale);
  }else if(e.type==='banner'||e.type==='bannerFlag'||e.type==='mender'||e.type==='sculptor'||e.type==='herald'||e.type==='balloon'||e.type==='balloonPart'||e.type==='masker'||e.type==='decoy'||e.type==='gatekeeper'||e.type==='duelist'||e.type==='alchemist'||e.type==='swordsaint'||e.type==='maestro'){
    const faceLeft=(e.vx||0)<-1;
    const sway=reduced?0:(e.type==='balloonPart'?Math.sin(time/260+(e.side||1))*.12:moving?Math.sin(time/160)*.1:0);
    ctx.rotate(sway);
    if(faceLeft&&e.type!=='balloonPart')ctx.scale(-1,1);
  }else{
    ctx.rotate(direction + Math.PI/2);
  }
  if(!reduced && effects.some(fx=>fx.targetId===e.id&&time-fx.born<150))ctx.filter='brightness(2.8) saturate(.3)';
  else if(e.type==='bomber'&&e.phase==='fuse'&&Math.floor(time/90)%2)ctx.filter='brightness(2.2)';
  else if(e.burnUntil>Date.now())ctx.filter=`sepia(1) saturate(3) hue-rotate(-20deg) brightness(${reduced?1.1:1.1+.2*Math.sin(time/80)})`;
  else if(e.exhaustUntil>Date.now())ctx.filter='grayscale(.7) brightness(.8)';
  const art=e.type==='decoy'?'masker':e.type==='bannerFlag'?'banner':e.type==='gatekeeper'&&e.twinB?'gatekeeperB':e.type;
  // Tall, thin imported art (a long spear, a raised banner) is drawn larger so
  // the body stays readable; the collision radius is unchanged.
  const drawn=e.r*(SPRITE_SCALE[art]||1);
  sprite(ctx,sprites[art] ? art : 'enemy',-drawn,-drawn,drawn*2,drawn*2); ctx.restore();ctx.globalAlpha=1;
  if (['windup','fuse','signal','pull','record','mend','reverse','waveWindup','slamWindup','dashWindup'].includes(e.phase)) {ctx.fillStyle = '#ffc3a1'; ctx.font = 'bold 18px monospace'; ctx.textAlign='center'; ctx.fillText('!',0,-e.r-9);}
  if (e.type==='decoy'&&e.revealed) {ctx.fillStyle='#c9b6f0';ctx.font='bold 15px monospace';ctx.textAlign='center';ctx.fillText('?',0,-e.r-8);}
  // Vulnerable windows read the same everywhere: a gold ring.
  if(e.armor>1||e.phase==='core')circle(ctx,0,0,e.r+5,null,'#ffd88a99',2);
  if(e.type==='egg'&&e.hatchLeft!=null){
    const total=Math.max(1,e.hatchTotal||2200),left=Math.max(0,e.hatchLeft),prog=1-Math.min(1,left/total);
    ctx.save();
    ctx.strokeStyle='#ffd488';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(0,0,e.r+5,-Math.PI/2,-Math.PI/2+TAU*prog);ctx.stroke();
    ctx.fillStyle='#ffe8b8';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.shadowColor='#050b10';ctx.shadowBlur=3;
    ctx.fillText(`${(left/1000).toFixed(1)}s`,0,-e.r-8);
    ctx.restore();
  }
  if(e.type!=='segment'&&e.type!=='decoy'&&e.tier!=='boss'){
    const w=e.tier==='elite'?72:48;
    ctx.fillStyle = '#071018'; ctx.fillRect(-w/2,e.r+12,w,5);
    ctx.fillStyle = e.tier==='elite'?'#e6c87f':e.part?'#9aa7b8':HEALTH_COLORS[e.type] || '#b99adc'; ctx.fillRect(-w/2,e.r+12,w*Math.max(0,e.hp/e.hpmax),5);
  }
  ctx.restore();
}
function nameplate(ctx, p, own, x, y) {
  if(p.type || String(p.id || p._id || '').startsWith('ai-'))return;
  const raw = p.name || 'Gladiator';
  const name = raw.length > 18 ? raw.slice(0, 17) + '…' : raw;
  const label = own ? name : `${name} · LV ${p.lv}`;
  ctx.font='500 12px system-ui, sans-serif'; ctx.textAlign='center';
  ctx.shadowColor='#050b10';ctx.shadowBlur=4;ctx.shadowOffsetY=1;
  ctx.fillStyle=own?'#e9efe3':'#edb9a2';
  ctx.fillText(label,x,y-p.r-20);
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
}
function feedback(ctx,camera,width,height,time,reduced){
  effects=effects.filter(fx=>time-fx.born<(fx.type==='levelUp'?LEVEL_UP_DURATION:1000));
  effects.forEach(fx=>{
    const elapsed=Math.max(0,time-fx.born),t=elapsed/1000;
    const x=width/2+fx.x-camera.x,y=height/2+fx.y-camera.y;
    const impact=['impact','kill','hurt'].includes(fx.type);
    const color=fx.type==='hurt'?'#ff9b87':fx.type==='shield'?'#b0d3fc':fx.type==='level'?'#c4eca6':'#ffe4a4';
    ctx.save();ctx.globalAlpha=Math.max(0,1-t);
    if(!reduced){
      if(impact && elapsed<330){
        const age=elapsed/330, count=fx.type==='kill'?18:10;
        ctx.globalAlpha=1-age;
        for(let i=0;i<count;i++){
          const a=fx.seed+i/count*TAU,travel=age*(fx.type==='kill'?85:45)*(1+(i%3)*.22);
          const px=x+Math.cos(a)*travel,py=y+Math.sin(a)*travel+age*age*18;
          ctx.strokeStyle=i%3===0?'#fff9e4':color;ctx.lineWidth=i%3===0?2.6:1.4;
          ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(a)*(8*(1-age)+2),py+Math.sin(a)*(8*(1-age)+2));ctx.stroke();
        }
        if(elapsed<100){
          ctx.save();ctx.translate(x,y);ctx.rotate(fx.seed);
          ctx.fillStyle='#fff6d8';ctx.fillRect(-23,-1.5,46,3);ctx.fillRect(-1,-14,2,28);ctx.restore();
        }
      }
      if(['kill','level','shockwave','shield'].includes(fx.type)){
        const duration=fx.type==='shockwave'?450:650;
        if(elapsed<duration){const t=elapsed/duration;circle(ctx,x,y,12+t*(fx.type==='shockwave'?110:fx.type==='level'?140:60),null,color,3*(1-t)+.5);}
      }
      const RINGS={slam:[170,'#e6c87f',450],aftershock:[170,'#f0a860',450],exhaust:[300,'#9aa7c7',550],turret:[34,'#e6c87f',350],ignite:[50,'#ff8a3d',500],blinkStrike:[150,'#9fd8ff',400],bomb:[fx.r||115,'#ff9a6b',500],corpse:[90,'#d9a7ff',450],quake:[160,'#e6c87f',450],heal:[50,'#a8f0a0',600],ghost:[44,'#9eeaff',500],blink:[30,'#b6e4ff',350]};
      const ring=RINGS[fx.type];
      if(ring&&elapsed<ring[2]){const t=elapsed/ring[2];circle(ctx,x,y,ring[0]*(.25+.75*t),fx.type==='bomb'?`rgba(255,140,90,${.25*(1-t)})`:null,ring[1],4*(1-t)+.5);}
      if(fx.type==='nova'&&elapsed<NOVA_DURATION)drawNova(ctx,x,y,elapsed/NOVA_DURATION,fx.seed);
      if(fx.type==='lightning'&&elapsed<220&&fx.fromX!=null){
        const fx0=width/2+fx.fromX-camera.x,fy0=height/2+fx.fromY-camera.y;
        ctx.strokeStyle='#cfe8ff';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(fx0,fy0);
        for(let i=1;i<6;i++){const f=i/6;ctx.lineTo(fx0+(x-fx0)*f+Math.sin(fx.seed*7+i*3)*10,fy0+(y-fy0)*f+Math.cos(fx.seed*5+i*2)*10);}
        ctx.lineTo(x,y);ctx.stroke();
      }
      if(fx.type==='smite'&&elapsed<260){
        const f=1-elapsed/260;ctx.strokeStyle='#fff1a8';ctx.lineWidth=4*f+1;ctx.beginPath();ctx.moveTo(x+8,y-260);
        for(let i=1;i<6;i++)ctx.lineTo(x+Math.sin(fx.seed*9+i*2.1)*12,y-260+i*52);
        ctx.stroke();circle(ctx,x,y,30*(1-f)+10,null,'#fff1a8',3*f);
      }
      if(fx.type==='burn'&&elapsed<300){for(let i=0;i<4;i++){const a=fx.seed+i*1.7;circle(ctx,x+Math.cos(a)*10,y-elapsed/12-i*4,2.5,'#ff8a3d');}}
      if(fx.type==='deflect'&&elapsed<250){ctx.save();ctx.translate(x,y);ctx.rotate(fx.seed);ctx.fillStyle='#fff6d8';ctx.fillRect(-14,-1.5,28,3);ctx.restore();}
      if(fx.type==='pickup'&&elapsed<500){
        const age=elapsed/500;
        for(let i=0;i<5;i++){const a=fx.seed+i/5*TAU,r=(1-age)*20;circle(ctx,x+Math.cos(a)*r,y+Math.sin(a)*r,1.8,color);}
      }
    }
    ctx.restore();
  });
}
function drawWorld(ctx, me, size, time, reduced) {
  const {width, height} = size;
  if (!width || !height) return;
  const camera = me ? me.pos : {x: 0, y: 0, idle: true};
  floor(ctx, width, height, camera, time, reduced);
  if (me) {
    if (lastPlayer && lastPlayer.id === me.id && me.hp < lastPlayer.hp) addEffect('hurt',me.pos,`−${Math.ceil(lastPlayer.hp-me.hp)}`);
    if(lastPlayer && !lastPlayer.reviveUsed && me.reviveUsed)addEffect('level',me.pos,'불사');
    lastPlayer = {id: me.id, hp: me.hp,reviveUsed:me.reviveUsed};
    map.itemList.forEach(item => {
      const x = width / 2 + item.x - me.pos.x, y = height / 2 + item.y - me.pos.y;
      if (x > -30 && x < width + 30 && y > -30 && y < height + 30) crystal(ctx, x, y, item.xp, time, reduced, item._id);
    });
    const liveIds = new Set();
    renderPlayers.forEach(row => {
      if (row._id === me.id) return;
      liveIds.add(row._id);
      if (enemyHealth.has(row._id) && row.hp < enemyHealth.get(row._id)) addEffect('impact', {id:row._id,x: row.x, y: row.y}, `−${Math.ceil(enemyHealth.get(row._id) - row.hp)}`);
      enemyHealth.set(row._id, row.hp);
      const p = Player.schemaPlayer(row);
      const x = width / 2 + p.pos.x - me.pos.x, y = height / 2 + p.pos.y - me.pos.y;
      if (x > -200 && x < width + 200 && y > -200 && y < height + 200) actor(ctx, p, false, x, y, time, reduced);
      else {
        const angle = Math.atan2(p.pos.y - me.pos.y, p.pos.x - me.pos.x);
        const radius = Math.min((width / 2 - 28) / Math.max(.001, Math.abs(Math.cos(angle))), (height / 2 - 100) / Math.max(.001, Math.abs(Math.sin(angle))));
        ctx.save(); ctx.translate(width / 2 + Math.cos(angle) * radius, height / 2 + Math.sin(angle) * radius); ctx.rotate(angle); ctx.fillStyle = '#ed9a7d'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    });
    enemyHealth.forEach((_, id) => {if (!liveIds.has(id)) enemyHealth.delete(id);});
    drawHazards(ctx,me,size,time,reduced);
    drawSkillZones(ctx,me,size,time,reduced);
    renderEnemies.forEach(e => drawEnemy(ctx, e, me, size, time, reduced));
    for(const shot of map.projectiles?.list||[]){
      const at=shotAt(shot,time),x=width/2+at.x-me.pos.x,y=height/2+at.y-me.pos.y;
      if(shot.kind==='spear'){
        ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(shot.vy,shot.vx)+Math.PI/2);
        sprite(ctx,'lancerSpear',-14,-42,28,84);
        ctx.restore();
        continue;
      }
      if(shot.kind==='sabreWave'){
        ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(shot.vy,shot.vx)+Math.PI/2);
        ctx.shadowColor='#ffe4a4';ctx.shadowBlur=12;
        sprite(ctx,'sabre',-24,-62,48,124);
        ctx.restore();
        continue;
      }
      const mine=shot.owner==='player',kind=SHOT_COLORS[shot.kind];
      const fill=mine?'#ffe4a4':kind?kind[0]:'#9be07f',edge=mine?'#fff6d8':kind?kind[1]:'#2f5a2a';
      circle(ctx,x,y,(shot.r||8)+4,fill+'33');
      circle(ctx,x,y,shot.r||8,fill,edge,2);
      if(shot.kind==='wheel'||shot.kind==='sickle'){ctx.save();ctx.translate(x,y);ctx.rotate(reduced?0:time/80);ctx.strokeStyle=edge;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-(shot.r||8),0);ctx.lineTo(shot.r||8,0);ctx.stroke();ctx.restore();}
    }
    // Blades that stand apart from the player: mirror clones, turrets, the boomerang.
    for(const c of me.blades||[]){
      if(c.x==null)continue;
      const x=width/2+c.x-me.pos.x,y=height/2+c.y-me.pos.y,kind=c.blade.includes('/')?c.blade.split('/')[1].split('-')[0]:c.blade.split('-')[0];
      ctx.save();ctx.translate(x,y);
      if(kind==='clone'){ctx.globalAlpha=.45;circle(ctx,0,0,me.r,'#8fb8ff33','#8fb8ffaa',1.5);}
      if(kind==='turret'){
        sprite(ctx,'turretBase',-20,-20,40,40);
      }
      trailed(ctx,`${me.id}:${c.blade}`,c.sw_angle,me.r+c.sw_r,c.sw_w,c.sw_h,time,reduced,{length:kind==='boomerang'?90:120,alpha:kind==='clone'?.2:.3},paintSabre);
      ctx.restore();
    }
    effects.forEach(fx=>{
      if(fx.type!=='levelUp')return;
      const pos=fx.targetId===me.id?me.pos:fx;
      drawLevelUpAura(ctx,width/2+pos.x-camera.x,height/2+pos.y-camera.y,Math.max(0,time-fx.born),reduced,fx.seed);
    });
    actor(ctx, me, true, width / 2, height / 2, time, reduced);
    feedback(ctx, camera, width, height, time, reduced);
    trails.forEach((trail,id)=>{if(time-trail.seen>1000)trails.delete(id);});
    if (Math.abs(me.pos.x) > 2800 || Math.abs(me.pos.y) > 2800) {
      ctx.fillStyle = '#eab294'; ctx.textAlign = 'center'; ctx.font = '11px monospace, sans-serif'; ctx.fillText('ARENA EDGE · RETURN TO THE FIGHT', width / 2, height - 110);
    }
  }

}

// Draw directly at the device resolution configured by Canvas. Text, effects,
// camera motion and blade transforms are never downsampled with the assets.
export default function draw(ctx, me, size, time, reduced) {
  if (!size.width || !size.height) return;
  renderPlayers=map.playerMotion.sample(time);renderEnemies=map.enemyMotion.sample(time);
  if(me){
    // Interpolation may otherwise visually merge bodies even when the server's
    // newer positions are separated. Keep this correction cosmetic and keep
    // the local camera/player anchored; no collision damage is decided here.
    const visual=[{id:me.id,x:me.pos.x,y:me.pos.y,r:me.r,fixed:true},
      ...renderEnemies.filter(e=>e.hp>0&&!e.passThrough),...renderPlayers.filter(p=>p._id!==me.id&&p.hp>0)];
    separateBodies(visual,{impulses:false,iterations:30});
  }
  ctx.save();
  if(!reduced){
    const recent=effects.filter(fx=>['impact','kill','hurt','shockwave'].includes(fx.type)&&time-fx.born<150);
    if(recent.length){const fx=recent[recent.length-1],fade=1-(time-fx.born)/150,force=fx.type==='hurt'?3:fx.type==='kill'?2.5:1.2;ctx.translate(Math.sin(time*.13)*force*fade,Math.cos(time*.17)*force*fade);}
  }
  drawWorld(ctx, me, size, time, reduced);
  if (!me) {ctx.restore();return;}
  // Names and feedback stay at readable screen resolution, independent of art scale.
  nameplate(ctx, me, true, size.width / 2, size.height / 2);
  renderPlayers.forEach(row => {
    if (row._id === me.id) return;
    const x = size.width / 2 + row.x - me.pos.x, y = size.height / 2 + row.y - me.pos.y;
    if (x > -100 && x < size.width + 100 && y > -100 && y < size.height + 100) nameplate(ctx, Player.schemaPlayer(row), false, x, y);
  });
  effects.forEach(fx => {
    if(fx.type==='levelUp')return;
    const t = Math.max(0, time - fx.born) / 1000;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t);
    const impact=['impact','kill','hurt'].includes(fx.type);
    ctx.font=impact?'bold 18px system-ui, sans-serif':fx.type==='level'?'bold 20px system-ui, sans-serif':'12px system-ui, sans-serif';ctx.textAlign='center';ctx.shadowColor='#071018';ctx.shadowBlur=4;
    ctx.fillStyle=fx.type==='hurt'?'#ff9b87':fx.type==='kill'?'#fff0b8':fx.type==='burn'?'#ff9a52':'#e6c87f';
    if(fx.type==='burn')ctx.font='bold 13px system-ui, sans-serif';
    ctx.fillText(fx.text, Math.round(size.width / 2 + fx.x - me.pos.x), Math.round(size.height / 2 + fx.y - me.pos.y - 54 - (reduced ? 0 : t * 30)));
    ctx.restore();
  });
  bossBar(ctx,size);
  ctx.restore();
}

// Enemy lab (bestiary page): draw one simulation with the in-game renderer.
// `scene` is a /lab/state entry received at performance.now() `at`; the view
// is centred between the dummy player and the enemy, zoomed by `zoom`.
export function drawLabScene(ctx,scene,size,time,{at=time,zoom=1,reduced=false,simple=false,enemies:sampledEnemies=null,dummy:sampledDummy=null,player=null,projectiles=null,camera=null,cameraMode='player',dt=1/60,delay=0}={}){
  ctx.fillStyle='#111e24';ctx.fillRect(0,0,size.width,size.height);
  if(!scene)return;
  const world={width:size.width/zoom,height:size.height/zoom};
  const ahead=Math.min(.18,Math.max(0,(time-at)/1000));
  const enemies=sampledEnemies||(scene.enemies||[]).map(e=>({...e,x:e.x+(e.vx||0)*ahead,y:e.y+(e.vy||0)*ahead,angle:e.angle+(e.angularVelocity??2.7)*ahead}));
  const d=player?{x:player.pos.x,y:player.pos.y,vx:player.speed.x*30,vy:player.speed.y*30,r:player.r,sw_angle:player.sw_angle,sw_r:player.sw_r,sw_w:player.sw_w,sw_h:player.sw_h}
    :(sampledDummy||{...scene.dummy,x:scene.dummy.x+(scene.dummy.vx||0)*ahead,y:scene.dummy.y+(scene.dummy.vy||0)*ahead,sw_angle:scene.dummy.sw_angle+3.1*ahead});
  const subject=enemies.find(e=>e.type===scene.type)||d;
  let cx=0,cy=0;
  if(cameraMode==='player'){
    const tx=d.x,ty=d.y;
    if(camera){
      if(!camera.ready){camera.x=tx;camera.y=ty;camera.ready=true;}
      else{const k=1-Math.exp(-10*Math.min(.1,Math.max(0,dt)));camera.x+=(tx-camera.x)*k;camera.y+=(ty-camera.y)*k;}
      cx=camera.x;cy=camera.y;
    }else{cx=tx;cy=ty;}
  }else if(cameraMode==='enemy'){
    cx=subject.x;cy=subject.y;
  }else if(cameraMode==='mid'){
    const tx=(d.x+subject.x)/2,ty=(d.y+subject.y)/2;
    if(camera){
      if(!camera.ready){camera.x=tx;camera.y=ty;camera.ready=true;}
      else{const k=1-Math.exp(-8*Math.min(.1,Math.max(0,dt)));camera.x+=(tx-camera.x)*k;camera.y+=(ty-camera.y)*k;}
      cx=camera.x;cy=camera.y;
    }else{cx=tx;cy=ty;}
  }
  const me={id:'lab-camera',pos:{x:cx,y:cy}};
  const saved=renderEnemies;renderEnemies=enemies;
  ctx.save();ctx.scale(zoom,zoom);
  // Floor grid batched into a single path so dozens of thumbnails stay fast.
  ctx.strokeStyle='#1c2f37';ctx.lineWidth=1/zoom;ctx.beginPath();
  for(let gx=Math.floor((cx-world.width/2)/80)*80;gx<cx+world.width/2;gx+=80){const x=world.width/2+gx-cx;ctx.moveTo(x,0);ctx.lineTo(x,world.height);}
  for(let gy=Math.floor((cy-world.height/2)/80)*80;gy<cy+world.height/2;gy+=80){const y=world.height/2+gy-cy;ctx.moveTo(0,y);ctx.lineTo(world.width,y);}
  ctx.stroke();
  const fxReduced=reduced||simple;
  drawHazards(ctx,me,world,time,fxReduced,{list:scene.hazards||[],at:at+delay});
  const dx=world.width/2+d.x-cx,dy=world.height/2+d.y-cy;
  const hero=player?player:{id:`lab-dummy-${scene.type}`,pos:{x:d.x,y:d.y},r:d.r,hp:1,hpmax:1,speed:{x:(d.vx||0)/30,y:(d.vy||0)/30},sw_angle:d.sw_angle,sw_r:d.sw_r,sw_w:d.sw_w,sw_h:d.sw_h,blades:[]};
  actor(ctx,hero,true,dx,dy,time,fxReduced);
  enemies.forEach(e=>drawEnemy(ctx,e,me,world,time,fxReduced));
  const renderTime=time-delay;
  for(const shot of projectiles?projectiles.list||[]:scene.projectiles||[]){
    const pos=projectiles?shotAt(shot,renderTime):{x:shot.x+shot.vx*ahead,y:shot.y+shot.vy*ahead};
    const x=world.width/2+pos.x-cx,y=world.height/2+pos.y-cy;
    if(shot.kind==='spear'){
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(shot.vy,shot.vx)+Math.PI/2);
      sprite(ctx,'lancerSpear',-14,-42,28,84);
      ctx.restore();
      continue;
    }
    if(shot.kind==='sabreWave'){
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(shot.vy,shot.vx)+Math.PI/2);
      ctx.shadowColor='#ffe4a4';ctx.shadowBlur=12;
      sprite(ctx,'sabre',-24,-62,48,124);
      ctx.restore();
      continue;
    }
    const mine=shot.owner==='player',kind=SHOT_COLORS[shot.kind];
    circle(ctx,x,y,shot.r||8,mine?'#ffe4a4':kind?kind[0]:'#9be07f',mine?'#fff6d8':kind?kind[1]:'#2f5a2a',2);
  }
  feedback(ctx,{x:cx,y:cy},world.width,world.height,time,fxReduced);
  effects.forEach(fx=>{
    if(fx.type==='levelUp')return;
    const t=Math.max(0,time-fx.born)/1000;
    ctx.save();ctx.globalAlpha=Math.max(0,1-t);
    const impact=['impact','kill','hurt'].includes(fx.type);
    ctx.font=impact?'bold 18px system-ui, sans-serif':'bold 13px system-ui, sans-serif';ctx.textAlign='center';ctx.shadowColor='#071018';ctx.shadowBlur=4;
    ctx.fillStyle=fx.type==='hurt'?'#ff9b87':fx.type==='kill'?'#fff0b8':fx.type==='shield'?'#b8dcff':'#e6c87f';
    ctx.fillText(fx.text,Math.round(world.width/2+fx.x-cx),Math.round(world.height/2+fx.y-cy-44-(fxReduced?0:t*28)));
    ctx.restore();
  });
  trails.forEach((trail,id)=>{if(time-trail.seen>1000)trails.delete(id);});
  ctx.restore();
  renderEnemies=saved;
  const boss=enemies.find(e=>e.tier==='boss'&&e.hp>0);
  if(boss){ctx.fillStyle='#3a1a18';ctx.fillRect(8,8,size.width-16,5);ctx.fillStyle=boss.armor>1?'#ffd88a':'#e8735a';ctx.fillRect(8,8,(size.width-16)*Math.max(0,boss.hp/boss.hpmax),5);}
}
// Static portrait for the Enemy Lab grid (drawn once; no animation loop or polling).
export function drawLabPortrait(ctx,info,size,onReady){
  ctx.fillStyle='#111e24';ctx.fillRect(0,0,size.width,size.height);
  if(!info)return;
  enemySprites();
  const type=info.type;
  if(!sprites[type]&&type!=='spinner')sprites[type]=createEnemySprite(type);
  const needed=type==='spinner'?[sprites.enemy,sprites.sabre]:[sprites[type]||sprites.enemy];
  if(onReady){
    for(const img of needed){
      if(img&&img.complete===false)img.addEventListener('load',onReady,{once:true});
    }
  }
  const r=info.r||24;
  const art=type==='decoy'?'masker':type;
  const extent=type==='spinner'?Math.max(r*2,115):r*(SPRITE_SCALE[art]||1)*1.35;
  const zoom=Math.min(1.35,Math.max(.38,(Math.min(size.width,size.height)*.36)/Math.max(16,extent)));
  const world={width:size.width/zoom,height:size.height/zoom};
  const me={id:'lab-portrait',pos:{x:0,y:0}};
  ctx.save();ctx.scale(zoom,zoom);
  ctx.strokeStyle='#1c2f37';ctx.lineWidth=1/zoom;ctx.beginPath();
  for(let gx=Math.floor((-world.width/2)/80)*80;gx<world.width/2;gx+=80){const x=world.width/2+gx;ctx.moveTo(x,0);ctx.lineTo(x,world.height);}
  for(let gy=Math.floor((-world.height/2)/80)*80;gy<world.height/2;gy+=80){const y=world.height/2+gy;ctx.moveTo(0,y);ctx.lineTo(world.width,y);}
  ctx.stroke();
  const dummyEnemy={id:`portrait-${type}`,type,tier:info.tier||'normal',x:0,y:0,r,hp:info.hp||100,hpmax:info.hp||100,vx:0,vy:0,angle:.5,facing:-Math.PI/2,phase:'hunt'};
  const saved=renderEnemies;renderEnemies=[dummyEnemy];
  drawEnemy(ctx,dummyEnemy,me,world,0,true);
  renderEnemies=saved;
  ctx.restore();
}
