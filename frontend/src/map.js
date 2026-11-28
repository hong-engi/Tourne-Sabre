import axios from 'axios';
import {MotionBuffer} from './motion';
const {modifiers,stats}=require('./gameRules');
const api=axios.create({baseURL:'http://localhost:8080/map',timeout:3000});
// Shots fly straight at a constant speed, so the client moves them itself.
// The server only says when one appears, turns (a parry) or disappears; a
// known shot keeps its own smooth path unless it drifted far from the server.
export function mergeShots(previous,rows,at){
  const known=new Map((previous.list||[]).map(s=>[s.id,s]));
  const list=rows.map(row=>{
    const old=known.get(row.id);
    // The server holds shots still while the room is paused (augment choice).
    // Two polls can land in one server tick, so only a position unchanged
    // for 150ms counts as paused.
    if(old&&row.x===old.sx&&row.y===old.sy){
      if(old.frozen||at-old.st<150)return old;
      return {...row,sx:row.x,sy:row.y,st:old.st,t:at,frozen:true};
    }
    if(old&&!old.frozen&&old.owner===row.owner&&old.vx===row.vx&&old.vy===row.vy){
      const t=(at-old.t)/1000,drift=Math.hypot(old.x+old.vx*t-row.x,old.y+old.vy*t-row.y);
      if(drift<40)return {...old,sx:row.x,sy:row.y,st:at};
    }
    return {...row,sx:row.x,sy:row.y,st:at,t:at};
  });
  return {list,at};
}
// Where a shot is at a given performance.now() time.
export function shotAt(shot,time){if(shot.frozen)return {x:shot.x,y:shot.y};const t=Math.max(0,(time-shot.t)/1000);return {x:shot.x+shot.vx*t,y:shot.y+shot.vy*t};}
class MapState {
  constructor(){
    this.itemList=[];this.playerList=[];this.enemyList=[];this.pendingItems=new Set();
    this.syncPending=false;this.attackPending=false;this.nextSync=0;this.nextAttack=0;
    this.enemyMotion=new MotionBuffer(60);this.playerMotion=new MotionBuffer();
    this.enemyPending=false;this.nextEnemy=0;this.nextItems=0;
    this.projectiles={list:[],at:0};this.threat={level:1,elapsed:0};this.seenBlasts=new Set();
  }
  reset(){this.nextSync=0;this.nextAttack=0;this.enemyList=[];this.enemyMotion.clear();this.playerMotion.clear();this.nextEnemy=0;this.nextItems=0;
    this.projectiles={list:[],at:0};this.threat={level:1,elapsed:0};this.seenBlasts.clear();}
  applyRecord(player,row){
    const ack=player.physicsAck||{seq:0,x:0,y:0,vx:0,vy:0};
    if((row.physicsSeq||0)>ack.seq){
      const dx=(row.physicsX||0)-ack.x,dy=(row.physicsY||0)-ack.y;
      const dvx=(row.physicsVx||0)-ack.vx,dvy=(row.physicsVy||0)-ack.vy;
      player.pos.x+=dx;player.pos.y+=dy;player.speed.x+=dvx/30;player.speed.y+=dvy/30;
      player.physicsAck={seq:row.physicsSeq,x:row.physicsX||0,y:row.physicsY||0,vx:row.physicsVx||0,vy:row.physicsVy||0};
    }
    player.hp=row.hp;player.shield=row.shieldUntil>Date.now()?row.shield:0;player.reviveUsed=row.reviveUsed;player.invulnerableUntil=row.invulnerableUntil;
    if((row.augments||[]).length>=(player.augments||[]).length){
      const twinBefore=modifiers(player.augments).twin;
      player.augments=row.augments||[];
      if(!twinBefore&&modifiers(player.augments).twin)player.skills.charges+=modifiers(player.augments).thrustCharges-1;
    }
    player.hpmax=stats(player.lv,player.augments).hpmax;
    player.augmentOffer=row.augmentOffer||null;
  }
  async addPlayer(player){await api.post('/player/add',player);this.playerList=(await api.get('/player')).data;}
  async chooseAugment(player,augment){
    await api.post('/player/update',player);
    const row=(await api.post('/augment',{id:player.id,augment})).data;
    this.applyRecord(player,row);return row;
  }
  async castSpell(player,spell){
    const row=(await api.post(`/player/${player.id}/spell`,{spell})).data;
    if(row)this.applyRecord(player,row);return row;
  }
  async rerollAugment(player,index){
    const row=(await api.post('/augment/reroll',{id:player.id,index})).data;
    this.applyRecord(player,row);return row;
  }
  sync(player,now){
    if(!this.enemyPending&&now>=this.nextEnemy){
      this.nextEnemy=now+50;this.enemyPending=true;
      api.get('/enemy').then(r=>{
        const data=Array.isArray(r.data)?{enemies:r.data}:r.data,at=performance.now();
        this.enemyList=data.enemies||[];this.enemyMotion.push(this.enemyList,at);
        this.projectiles=mergeShots(this.projectiles,data.projectiles||[],at);
        if(data.threat)this.threat={...data.threat,at};
        for(const blast of data.blasts||[]){
          if(this.seenBlasts.has(blast.id))continue;
          this.seenBlasts.add(blast.id);this.onBlast?.(blast);
        }
        if(this.seenBlasts.size>200)this.seenBlasts=new Set([...this.seenBlasts].slice(-50));
      }).catch(err=>console.warn('Enemy sync:',err.message)).finally(()=>{this.enemyPending=false;});
    }
    if(this.syncPending||now<this.nextSync)return;
    this.nextSync=now+100;this.syncPending=true;
    Promise.all([
      api.post('/player/update',player).then(()=>api.get(`/player/${player.id}`)).then(r=>{if(r.data)this.applyRecord(player,r.data);}),
      api.get('/player').then(r=>{this.playerList=r.data;this.playerMotion.push(r.data.map(p=>({...p,vx:p.vx*30,vy:p.vy*30})),performance.now());}),
      now>=this.nextItems?(this.nextItems=now+500,api.get('/item').then(r=>{this.itemList=r.data;})):Promise.resolve(),
    ]).catch(err=>console.warn('Arena sync:',err.message)).finally(()=>{this.syncPending=false;});
  }
  attackEnemies(player,onResult,now){
    if(this.attackPending||now<this.nextAttack)return;
    this.nextAttack=now+180;this.attackPending=true;
    const poses=(player.swordPoses||[]).splice(0),bursts=(player.skills?.bursts||[]).splice(0);
    api.post('/enemy/attack',{id:player.id,pos:{x:player.pos.x,y:player.pos.y},poses,bursts}).then(r=>{if(player.hp>0)onResult(r.data);}).catch(err=>console.warn('Attack sync:',err.message)).finally(()=>{this.attackPending=false;});
  }
  damage(player,dmg){api.put(`/player/${player.id}/damage`,{dmg}).catch(err=>console.warn(err.message));}
  kill(player){this.playerList=this.playerList.filter(p=>p._id!==player.id);return api.delete(`/player/${player.id}/kill`).catch(err=>console.warn(err.message));}
  ate(item,player){
    this.pendingItems.add(item.id);
    const row=this.itemList.find(row=>row._id===item.id);
    if(row)Object.assign(row,{x:item.pos.x,y:item.pos.y,xp:item.xp,r:item.r});
    api.post('/item/ate',{...item,playerId:player.id}).catch(err=>console.warn(err.message)).finally(()=>this.pendingItems.delete(item.id));
  }
}
export const map=new MapState();
