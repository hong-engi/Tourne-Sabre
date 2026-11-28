import {Player,Item} from './object';
import {map} from './map';
import {death} from './canvas';
import {addEffect} from './mapdraw';
import {updateWeapon,addKills,bladeTouches} from './skills';
const {modifiers,offerCount}=require('./gameRules');
const {predictPlayer}=require('./bodyPhysics');
const {hazardForces}=require('./hazardGeometry');
const {setWorld,applyBookResult}=require('./skillCasts');
// Let the level-up burst (and any nova damage numbers) land before the picker.
export const LEVEL_UP_MENU_DELAY=800;
export const NOVA_MENU_DELAY=LEVEL_UP_MENU_DELAY;
export function gainXp(me,xp,now=performance.now()){
  const before=me.lv,offers=offerCount(before);
  me.xpup(xp);
  if(me.lv>before){
    addEffect('levelUp',{...me.pos,id:me.id},`Lv. ${me.lv}`,now);
    // Nova: every level-up detonates around the player (the server checks it).
    const nova=!!modifiers(me.augments).nova;
    if(nova){me.skills.bursts.push({kind:'nova',x:me.pos.x,y:me.pos.y});addEffect('nova',me.pos,'');}
  }
  if(offerCount(me.lv)<=offers)return;
  // Opening the picker covers the arena, so leave the visual cue time to read.
  me.augmentMenuAt=me.augmentMenuAt||now+LEVEL_UP_MENU_DELAY;
}
function hitEffect(hit){
  if(hit.burst)return addEffect(hit.burst,hit,'');
  if(hit.blocked)return addEffect('shield',hit,'방어');
  if(hit.smite)addEffect('smite',hit,'');
  if(hit.burn)return addEffect(hit.killed?'kill':'burn',hit,hit.killed?'처치':`${hit.damage}`);
  if(hit.deflect&&!hit.damage)return addEffect('deflect',hit,'');
  if(hit.lightning)addEffect('lightning',{...hit,fromX:hit.fromX,fromY:hit.fromY},'');
  if(hit.shockwave)return addEffect('shockwave',hit,'');
  addEffect(hit.killed?'kill':'impact',hit,hit.killed?'처치':`${hit.damage}`);
}
export default function frameUpdate(me,keys,myref,now=performance.now(),dt=1/30){
  if(!me)return;
  if(me.dead()){map.kill(me);death(myref);return;}
  if(me.augmentMenuAt&&now>=me.augmentMenuAt){me.augmentMenuAt=0;me.augmentMenuOpen=true;}
  if(me.augmentMenuOpen){map.sync(me,now);return;}
  const mod=modifiers(me.augments);
  const ghost=now<(me.skills.spellUntil.ghost||0)||!!me.combatState?.ghost;
  setWorld(map.enemyList);
  let dx=Number(!!keys.ArrowRight)-Number(!!keys.ArrowLeft),dy=Number(!!keys.ArrowDown)-Number(!!keys.ArrowUp);
  const length=Math.hypot(dx,dy);
  // Frost trails, magnet pulls and wind lanes act on the local body; the
  // server only decides damage. Hazard timing is relative to the last poll.
  const elapsed=now-(map.hazards.at||now);
  const forces=ghost?{slow:1,px:0,py:0}:hazardForces((map.hazards.list||[]).map(h=>({...h,armIn:h.armIn-elapsed,left:h.left-elapsed})),me.pos.x,me.pos.y,me.r);
  if(me.cleansing)forces.slow=1;
  me.hazardSlow=forces.slow;
  if(length){
    dx/=length;dy/=length;
    const movement=mod.movement*(me.skills.pursuitUntil>now?1.6:1)*(now<(me.skills.spellUntil.ghost||0)?1.45:1)*forces.slow*(me.skillSpeed||1);
    me.addSpeed(dx*dt*30*movement,dy*dt*30*movement);me.skills.facing={x:dx,y:dy};
  }
  me.move(dt);
  if(forces.px||forces.py)me.pos.move(forces.px*dt,forces.py*dt);
  me.impactIntent={x:me.speed.x*30,y:me.speed.y*30};
  // Ghost walks through bodies; otherwise slide around them locally.
  if(!ghost){
    const obstacles=[...map.enemyMotion.sample(now+map.enemyMotion.delay),...map.playerMotion.sample(now+map.playerMotion.delay)];
    predictPlayer(me,obstacles);
  }
  updateWeapon(me,now,dt);
  for(const event of me.skills.events.splice(0))addEffect(event.type,event,'');
  // Every drawn blade pose is sent with the next attack so the server can
  // sweep the whole arc of every blade instead of one sampled angle.
  me.swordPoses=me.swordPoses||[];
  for(const blade of me.blades)me.swordPoses.push(blade);
  if(me.swordPoses.length>400)me.swordPoses.splice(0,me.swordPoses.length-400);
  map.sync(me,now);
  map.attackEnemies(me,result=>{
    result.hits.forEach(hitEffect);
    applyBookResult(me,result,performance.now());
    const count=result.hits.filter(h=>h.damage>0).length,kills=result.hits.filter(h=>h.killed).length;
    const cooldowns=me.skills.cooldowns;
    if(mod.chain)cooldowns.accel=Math.max(performance.now(),(cooldowns.accel||0)-count*300);
    if(mod.execute&&result.thrustKills)cooldowns.thrust=Math.max(performance.now(),(cooldowns.thrust||0)-1000);
    addKills(me,kills,performance.now());
    if(result.xp){addEffect('pickup',me.pos,`+${result.xp} XP`);gainXp(me,result.xp);}
    if(result.heal)addEffect('heal',me.pos,`+${result.heal}`);
    if(result.shieldGained)addEffect('shield',me.pos,'보호막');
  },now);
  for(const row of map.itemList){
    const item=Item.schemaItem(row);
    const touching=Math.hypot(item.pos.x-me.pos.x,item.pos.y-me.pos.y)<=(me.r+item.r)*mod.pickupRange||
      (mod.harvest&&me.blades.some(b=>bladeTouches(b,me.pos,me.r,{x:item.pos.x,y:item.pos.y,r:item.r})));
    if(touching&&!map.pendingItems.has(item.id)){
      const xp=item.xp;addEffect('pickup',item.pos,`+${xp} XP`);
      item.init(Item.randomItem().pos);gainXp(me,xp);map.ate(item,me);
    }
  }
  me.lastPvpHit=me.lastPvpHit||{};
  for(const row of map.playerList){
    const other=Player.schemaPlayer(row);
    if(other.hp>0&&me.trytohit(other)&&now-(me.lastPvpHit[other.id]||-Infinity)>=250){
      me.lastPvpHit[other.id]=now;map.damage(other,Math.round((me.lv+9)*me.attackMultiplier));
    }
  }
}
