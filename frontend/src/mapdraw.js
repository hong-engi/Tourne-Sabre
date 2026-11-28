import {map,shotAt} from './map';
import {Player} from './object';
import knightUrl from './assets/pixel/knight.png';
import enemyUrl from './assets/pixel/enemy.png';
import sabreUrl from './assets/pixel/sabre.png';
import turretBaseUrl from './assets/pixel/sword-turret-base.png';
import {XP_PICKUPS, getXpPickup} from './xpPickups';
import floorUrl from './assets/pixel/floor.png';
import {createEnemySprite} from './enemyArt';
const {chargeTelegraph}=require('./gameRules');
const {separateBodies}=require('./bodyPhysics');

const sprites = {};
Object.entries({knight: knightUrl, enemy: enemyUrl, sabre: sabreUrl, turretBase: turretBaseUrl, floor: floorUrl, ...Object.fromEntries(XP_PICKUPS.map(tier => [tier.key,tier.url]))}).forEach(([key, url]) => {
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
  for (const type of ['stalker','bomber','spitter','splitter','mite']) if (!sprites[type]) sprites[type] = createEnemySprite(type);
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
    if (scaledSprites.size >= 128) scaledSprites.delete(scaledSprites.keys().next().value);
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
export function addEffect(type, pos, text = '') {
  effects.push({type,...pos,x:pos.x,y:pos.y,targetId:pos.id,nx:pos.nx||0,ny:pos.ny||0,text,born:performance.now(),seed:Math.random()*TAU});
  if (effects.length > 80) effects.shift();
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
    trailed(ctx,`${p.id}:${b.blade}`,b.sw_angle,p.r+b.sw_r,b.sw_w,b.sw_h,time,reduced,{length:orb?160:110,alpha:orb?.35:.2},orb?paintOrb:paintSabre);
  }
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
  ctx.filter='none';ctx.globalAlpha=1;
  if(p.shield>0)circle(ctx,0,0,p.r+12,null,'#a4c9f0aa',2);
  // Ignite: the player's blades burn.
  if(own&&p.combatState?.ignite&&!reduced){ctx.shadowColor='#ff7a2a';ctx.shadowBlur=14+4*Math.sin(time/70);}
  if(own)extraBlades(ctx,p,time,reduced);
  blade(ctx, p, time, reduced);
  ctx.shadowBlur=0;
  const health = Math.max(0, Math.min(1, p.hp / p.hpmax));
  ctx.fillStyle = '#061018'; ctx.fillRect(-27, height / 2 + 10, 54, 7);
  ctx.fillStyle = own ? '#a5ead0' : '#efa184'; ctx.fillRect(-24, height / 2 + 12, health * 48, 3);
  ctx.restore();
}
const BOMB_RADIUS=115;
const HEALTH_COLORS={charger:'#e0ab77',stalker:'#b99adc',bomber:'#f08a5d',spitter:'#8fd07a',splitter:'#6cc4cf',mite:'#6cc4cf'};
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
  ctx.save(); ctx.translate(x,y);
  const lane=chargeTelegraph(e);
  if(lane && lane.length>.5){
    ctx.save(); ctx.rotate(lane.angle);
    ctx.fillStyle = e.phase === 'windup' ? '#f18b6b22' : '#ffd28811';
    ctx.fillRect(0,-e.r,lane.length,e.r*2);
    ctx.strokeStyle = e.phase === 'windup' ? '#ffb28b' : '#f4da9c'; ctx.lineWidth = 1.5;
    ctx.setLineDash([8,7]); ctx.strokeRect(0,-e.r,lane.length,e.r*2); ctx.setLineDash([]);
    ctx.restore();
  }
  if(e.type==='bomber'&&e.phase==='fuse'){
    // Blast radius grows brighter as the fuse runs out.
    const pulse=reduced?.5:.5+.5*Math.sin(time/60);
    circle(ctx,0,0,BOMB_RADIUS,`rgba(240,110,70,${.08+.1*pulse})`,`rgba(255,150,110,${.5+.4*pulse})`,2);
  }
  if(e.type==='spitter'&&e.phase==='aim'){
    ctx.save();ctx.rotate(Math.atan2(e.aimY,e.aimX));ctx.strokeStyle='#9be07f';ctx.lineWidth=1.5;ctx.setLineDash([6,6]);
    ctx.beginPath();ctx.moveTo(e.r+4,0);ctx.lineTo(320,0);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }
  const recoil=effects.find(fx=>fx.targetId===e.id&&['impact','kill'].includes(fx.type)&&time-fx.born<150);
  if(recoil&&!reduced){const kick=Math.sin((time-recoil.born)/150*Math.PI)*5;ctx.translate(recoil.nx*kick,recoil.ny*kick);}
  ctx.fillStyle = '#07101899'; ctx.fillRect(-e.r,e.r-5,e.r*2,10);
  ctx.save();
  const aiming=(e.type==='charger'&&e.phase!=='hunt')||e.type==='spitter';
  const direction = aiming ? Math.atan2(e.aimY,e.aimX) : Math.atan2(e.vy,e.vx);
  ctx.rotate(direction + Math.PI/2);
  if(!reduced && effects.some(fx=>fx.targetId===e.id&&time-fx.born<150))ctx.filter='brightness(2.8) saturate(.3)';
  else if(e.type==='bomber'&&e.phase==='fuse'&&Math.floor(time/90)%2)ctx.filter='brightness(2.2)';
  else if(e.burnUntil>Date.now())ctx.filter=`sepia(1) saturate(3) hue-rotate(-20deg) brightness(${reduced?1.1:1.1+.2*Math.sin(time/80)})`;
  else if(e.exhaustUntil>Date.now())ctx.filter='grayscale(.7) brightness(.8)';
  sprite(ctx,e.type,-e.r,-e.r,e.r*2,e.r*2); ctx.restore();
  if (e.phase === 'windup' || e.phase === 'fuse') {ctx.fillStyle = '#ffc3a1'; ctx.font = 'bold 18px monospace'; ctx.textAlign='center'; ctx.fillText('!',0,-e.r-9);}
  ctx.fillStyle = '#071018'; ctx.fillRect(-24,e.r+12,48,5);
  ctx.fillStyle = HEALTH_COLORS[e.type] || '#b99adc'; ctx.fillRect(-24,e.r+12,48*Math.max(0,e.hp/e.hpmax),5);
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
  effects=effects.filter(fx=>time-fx.born<1000);
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
      const RINGS={slam:[170,'#e6c87f',450],aftershock:[170,'#f0a860',450],exhaust:[300,'#9aa7c7',550],turret:[34,'#e6c87f',350],ignite:[50,'#ff8a3d',500],nova:[280,'#ffd27a',500],blinkStrike:[150,'#9fd8ff',400],bomb:[fx.r||115,'#ff9a6b',500],corpse:[90,'#d9a7ff',450],quake:[160,'#e6c87f',450],heal:[50,'#a8f0a0',600],ghost:[44,'#9eeaff',500],blink:[30,'#b6e4ff',350]};
      const ring=RINGS[fx.type];
      if(ring&&elapsed<ring[2]){const t=elapsed/ring[2];circle(ctx,x,y,ring[0]*(.25+.75*t),fx.type==='bomb'?`rgba(255,140,90,${.25*(1-t)})`:null,ring[1],4*(1-t)+.5);}
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
    renderEnemies.forEach(e => drawEnemy(ctx, e, me, size, time, reduced));
    for(const shot of map.projectiles?.list||[]){
      const at=shotAt(shot,time),x=width/2+at.x-me.pos.x,y=height/2+at.y-me.pos.y;
      const mine=shot.owner==='player';
      circle(ctx,x,y,(shot.r||8)+4,mine?'#ffe4a433':'#9be07f33');
      circle(ctx,x,y,shot.r||8,mine?'#ffe4a4':'#9be07f',mine?'#fff6d8':'#2f5a2a',2);
    }
    // Blades that stand apart from the player: mirror clones, turrets, the boomerang.
    for(const c of me.blades||[]){
      if(c.x==null)continue;
      const x=width/2+c.x-me.pos.x,y=height/2+c.y-me.pos.y,kind=c.blade.split('-')[0];
      ctx.save();ctx.translate(x,y);
      if(kind==='clone'){ctx.globalAlpha=.45;circle(ctx,0,0,me.r,'#8fb8ff33','#8fb8ffaa',1.5);}
      if(kind==='turret'){
        sprite(ctx,'turretBase',-20,-20,40,40);
      }
      trailed(ctx,`${me.id}:${c.blade}`,c.sw_angle,me.r+c.sw_r,c.sw_w,c.sw_h,time,reduced,{length:kind==='boomerang'?90:120,alpha:kind==='clone'?.2:.3},paintSabre);
      ctx.restore();
    }
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
    const t = Math.max(0, time - fx.born) / 1000;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t);
    const impact=['impact','kill','hurt'].includes(fx.type);
    ctx.font=impact?'bold 18px system-ui, sans-serif':fx.type==='level'?'bold 20px system-ui, sans-serif':'12px system-ui, sans-serif';ctx.textAlign='center';ctx.shadowColor='#071018';ctx.shadowBlur=4;
    ctx.fillStyle=fx.type==='hurt'?'#ff9b87':fx.type==='kill'?'#fff0b8':fx.type==='burn'?'#ff9a52':'#e6c87f';
    if(fx.type==='burn')ctx.font='bold 13px system-ui, sans-serif';
    ctx.fillText(fx.text, Math.round(size.width / 2 + fx.x - me.pos.x), Math.round(size.height / 2 + fx.y - me.pos.y - 54 - (reduced ? 0 : t * 30)));
    ctx.restore();
  });
  ctx.restore();
}
