import axios from 'axios';
import {MotionBuffer} from './motion';
import {API_ORIGIN} from './apiConfig';
const {modifiers,stats}=require('./gameRules');
const api=axios.create({baseURL:`${API_ORIGIN}/map`,timeout:3000});

const r2=v=>typeof v==='number'&&!Number.isInteger(v)?Math.round(v*100)/100:v;

export function compactPlayerSync(player){
  const cs={};
  if(player.combatState){
    for(const [k,v] of Object.entries(player.combatState)){
      if(v!==false&&v!=null)cs[k]=v;
    }
  }
  return {
    id:player.id,
    pos:{x:r2(player.pos.x),y:r2(player.pos.y)},
    speed:{x:r2(player.speed.x),y:r2(player.speed.y)},
    impactIntent:player.impactIntent?{x:r2(player.impactIntent.x),y:r2(player.impactIntent.y)}:undefined,
    sw_angle:r2(player.sw_angle),
    sw_r:r2(player.sw_r),
    sw_w:r2(player.sw_w),
    sw_h:r2(player.sw_h),
    sw_speed:r2(player.sw_speed),
    combatState:cs,
    augmentMenuOpen:!!player.augmentMenuOpen,
    xp:player.xp,
    physicsAck:player.physicsAck,
  };
}

function compactPlayerJoin(player){
  return {
    id:player.id,
    name:player.name,
    pos:{x:player.pos.x,y:player.pos.y},
    speed:{x:player.speed.x,y:player.speed.y},
    r:player.r,
    sw_angle:player.sw_angle,
    sw_r:player.sw_r,
    sw_w:player.sw_w,
    sw_h:player.sw_h,
    sw_speed:player.sw_speed,
    hp:player.hp,
    hpmax:player.hpmax,
    xp:player.xp,
    lv:player.lv,
    color:player.color,
    spells:player.spells,
    loadout:player.loadout,
    mode:player.mode||'pve',
  };
}

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
    this.itemList=[];this.itemById=new Map();this.playerList=[];this.enemyList=[];this.pendingItems=new Set();
    this.syncPending=false;this.attackPending=false;this.nextSync=0;this.nextAttack=0;
    this.enemyMotion=new MotionBuffer(60);this.playerMotion=new MotionBuffer();
    this.enemyPending=false;this.nextEnemy=0;this.nextItems=0;
    this.projectiles={list:[],at:0};this.threat={level:1,elapsed:0};this.seenBlasts=new Set();this.hazards={list:[],at:0};this.skillZones={list:[],walls:[],decoys:[],at:0};
    this.socket=null;this.activePlayer=null;this.warnClock=new Map();this.clockOffset=0;
  }
  serverNow(){
    return Date.now()+(this.clockOffset||0);
  }
  reset(){
    this.nextSync=0;this.nextAttack=0;this.enemyList=[];this.enemyMotion.clear();this.playerMotion.clear();this.nextEnemy=0;this.nextItems=0;
    this.projectiles={list:[],at:0};this.threat={level:1,elapsed:0};this.seenBlasts.clear();this.warnClock.clear();this.hazards={list:[],at:0};this.skillZones={list:[],walls:[],decoys:[],at:0};
    this.attackPending=false;this.syncPending=false;this.enemyPending=false;
  }
  setActivePlayer(player){
    this.activePlayer=player||null;
  }
  applyItemList(rows){
    this.itemList=Array.isArray(rows)?rows:[];
    this.itemById=new Map();
    for(const row of this.itemList)this.itemById.set(row._id,row);
  }
  applyItemPatch(rows){
    if(!Array.isArray(rows))return;
    for(const row of rows){
      if(!row||!row._id)continue;
      const existing=this.itemById.get(row._id);
      if(existing){
        Object.assign(existing,row);
      }else{
        this.itemList.push(row);
        this.itemById.set(row._id,row);
      }
    }
  }
  applyArenaState(data,at=performance.now()){
    if(!data)return;
    const payload=Array.isArray(data)?{enemies:data}:data;
    this.enemyList=payload.enemies||[];
    this.stampWarnings(this.enemyList,at);
    this.enemyMotion.push(this.enemyList,at);
    if(Array.isArray(payload.players)){
      this.playerList=payload.players;
      this.playerMotion.push(payload.players.map(p=>({...p,vx:p.vx*30,vy:p.vy*30})),at);
    }
    const player=this.activePlayer;
    if(player){
      if(payload.me&&payload.me._id===player.id){
        this.applyRecord(player,payload.me);
      }else if(player.hp>0){
        this.applyPhysics(player,payload.physics?.[player.id]);
      }
    }
    this.projectiles=mergeShots(this.projectiles,payload.projectiles||[],at);
    if(payload.threat)this.threat={...payload.threat,at};
    this.hazards={list:payload.hazards||[],at};
    this.skillZones={list:payload.skillZones||[],walls:payload.walls||[],decoys:payload.decoys||[],at};
    for(const blast of payload.blasts||[]){
      if(this.seenBlasts.has(blast.id))continue;
      this.seenBlasts.add(blast.id);this.onBlast?.(blast);
    }
    if(this.seenBlasts.size>200)this.seenBlasts=new Set([...this.seenBlasts].slice(-50));
  }
  // Attack warnings run on the client's own clock: the first snapshot of a
  // windup fixes when it ends, so the gauge fills smoothly even if later
  // snapshots arrive late or are dropped. Re-anchor only on a real change
  // (new windup, or the room paused and the end moved).
  stampWarnings(rows,at){
    const live=new Set();
    for(const e of rows){
      if(!Number.isFinite(e.phaseLeft))continue;
      live.add(e.id);
      const end=at+e.phaseLeft,c=this.warnClock.get(e.id);
      if(!c||c.phase!==e.phase||c.total!==e.phaseTotal||Math.abs(c.endAt-end)>150)this.warnClock.set(e.id,{phase:e.phase,total:e.phaseTotal,endAt:end});
      e.phaseEndAt=this.warnClock.get(e.id).endAt;
    }
    for(const id of this.warnClock.keys())if(!live.has(id))this.warnClock.delete(id);
  }
  attachSocket(socket){
    if(this.socket===socket)return;
    this.socket=socket;
    if(!socket)return;
    socket.on('items:init',rows=>this.applyItemList(rows));
    socket.on('items:patch',rows=>this.applyItemPatch(rows));
    socket.on('arena:state',data=>this.applyArenaState(data,performance.now()));
    socket.on('arena:me',row=>{
      if(this.activePlayer&&row&&row._id===this.activePlayer.id)this.applyRecord(this.activePlayer,row);
    });
    socket.on('player:record',row=>{
      if(this.activePlayer&&row&&row._id===this.activePlayer.id)this.applyRecord(this.activePlayer,row);
    });
    socket.on('connect',()=>{
      const player=this.activePlayer;
      // After a reconnect, reclaim our player; rejoin if the server lost it.
      if(player)socket.emit('newplayer',player.id,res=>{if(res&&res.known===false)this.rejoin(player);});
      if(!this.itemList.length)socket.emit('items:sync',rows=>this.applyItemList(rows));
    });
    socket.on('player:missing',()=>{if(this.activePlayer)this.rejoin(this.activePlayer);});
  }
  // Re-register a living player the server no longer knows (server restart,
  // dropped connection), keeping its level, health and augments.
  async rejoin(player){
    if(this.rejoining||!player||player.hp<=0||!this.hasLiveSocket())return;
    this.rejoining=true;
    try{
      const res=await this.emitWithAck('player:join',{...compactPlayerJoin(player),augments:[...(player.augments||[])],rejoin:true});
      if(res&&res.ok&&this.activePlayer===player){
        this.playerList=res.players||this.playerList;
        if(res.player)this.applyRecord(player,res.player);
      }
    }catch(err){console.warn('Rejoin:',err.message);}
    finally{this.rejoining=false;}
  }
  // True when another living player shares the arena: the augment picker
  // then must not pause the game (PvP).
  sharedArena(id){
    if(this.activePlayer&&this.activePlayer.mode==='pvp')return true;
    return this.playerList.some(p=>p&&p.hp>0&&p._id!==id);
  }
  hasLiveSocket(){
    return !!(this.socket&&this.socket.connected);
  }
  emitWithAck(event,payload,timeoutMs=3000){
    return new Promise((resolve,reject)=>{
      if(!this.hasLiveSocket())return reject(new Error('Socket disconnected'));
      let settled=false;
      const timer=setTimeout(()=>{
        if(settled)return;
        settled=true;
        reject(new Error(`${event} timeout`));
      },timeoutMs);
      this.socket.emit(event,payload,response=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        resolve(response);
      });
    });
  }
  // Server knockback is a cumulative ledger; apply only what is not acked yet.
  applyPhysics(player,ledger){
    const ack=player.physicsAck||{seq:0,x:0,y:0,vx:0,vy:0};
    if(!ledger||(ledger.seq||0)<=ack.seq)return;
    const dx=(ledger.x||0)-ack.x,dy=(ledger.y||0)-ack.y;
    const dvx=(ledger.vx||0)-ack.vx,dvy=(ledger.vy||0)-ack.vy;
    player.pos.x+=dx;player.pos.y+=dy;player.speed.x+=dvx/30;player.speed.y+=dvy/30;
    player.physicsAck={seq:ledger.seq,x:ledger.x||0,y:ledger.y||0,vx:ledger.vx||0,vy:ledger.vy||0};
  }
  applyRecord(player,row){
    this.applyPhysics(player,{seq:row.physicsSeq,x:row.physicsX,y:row.physicsY,vx:row.physicsVx,vy:row.physicsVy});
    if((row.augments||[]).length>=(player.augments||[]).length){
      const twinBefore=modifiers(player.augments).twin;
      player.augments=row.augments||[];
      if(!twinBefore&&modifiers(player.augments).twin)player.skills.charges+=modifiers(player.augments).thrustCharges-1;
    }
    const nextHpmax=stats(player.lv,player.augments).hpmax;
    // If an in-flight server snapshot predates a local level-up, preserve the
    // level-up HP gain so the UI does not flash a phantom hurt effect.
    const pendingLevelGain=row.hp>0&&row.lv&&row.lv<player.lv?Math.max(0,nextHpmax-(row.hpmax||nextHpmax)):0;
    player.hp=row.hp>0?Math.min(nextHpmax,row.hp+pendingLevelGain):row.hp;
    player.shield=row.shieldUntil>Date.now()?row.shield:0;player.reviveUsed=row.reviveUsed;player.invulnerableUntil=row.invulnerableUntil;
    player.hpmax=nextHpmax;
    player.augmentOffer=row.augmentOffer||null;
    if(row.mode){
      player.mode=row.mode;
      if(row.mode==='pvp'){player.augmentMenuOpen=false;player.augmentPaused=false;}
    }
    player.stealthUntil=row.stealthUntil||0;
    player.stealthOrigin=row.stealthOrigin||null;
    player.pveCooldownUntil=row.pveCooldownUntil||0;
    player.pveFreeUntil=row.pveFreeUntil||0;
    player.bossBuffUntil=row.bossBuffUntil||0;
  }
  async addPlayer(player){
    this.activePlayer=player;
    if(this.hasLiveSocket()){
      const res=await this.emitWithAck('player:join',compactPlayerJoin(player));
      if(!res||!res.ok)throw new Error((res&&res.error)||'Failed to join arena');
      if(Number.isFinite(res.serverTime))this.clockOffset=res.serverTime-Date.now();
      this.playerList=res.players||[];
      if(Array.isArray(res.items))this.applyItemList(res.items);
      if(res.player)this.applyRecord(player,res.player);
      return;
    }
    await api.post('/player/add',compactPlayerJoin(player));
    this.playerList=(await api.get('/player')).data;
    if(!this.itemList.length)this.applyItemList((await api.get('/item')).data);
  }
  async switchMode(player,targetMode){
    if(!this.hasLiveSocket())throw new Error('소켓이 연결되어 있지 않습니다.');
    const res=await this.emitWithAck('mode:switch',{id:player.id,mode:targetMode});
    if(!res||!res.ok)throw new Error((res&&res.error)||'모드 전환에 실패했습니다.');
    if(Number.isFinite(res.serverTime))this.clockOffset=res.serverTime-Date.now();
    this.enemyList=[];this.enemyMotion.clear();this.playerMotion.clear();
    this.projectiles={list:[],at:0};this.hazards={list:[],at:0};
    this.skillZones={list:[],walls:[],decoys:[],at:0};this.warnClock.clear();
    if(res.pos){player.pos.x=res.pos.x;player.pos.y=res.pos.y;}
    player.speed.x=0;player.speed.y=0;
    player.physicsAck={seq:res.player?.physicsSeq||0,x:0,y:0,vx:0,vy:0};
    if(res.player)this.applyRecord(player,res.player);
    return res.player;
  }
  async chooseAugment(player,augment){
    if(this.hasLiveSocket()){
      const res=await this.emitWithAck('augment:choose',{id:player.id,augment,player:compactPlayerSync(player)});
      if(!res||!res.ok)throw new Error((res&&res.error)||'Augment failed');
      if(res.row)this.applyRecord(player,res.row);
      return res.row;
    }
    await api.post('/player/update',compactPlayerSync(player));
    const row=(await api.post('/augment',{id:player.id,augment})).data;
    this.applyRecord(player,row);return row;
  }
  async castSpell(player,spell){
    if(this.hasLiveSocket()){
      const res=await this.emitWithAck('player:spell',{id:player.id,spell});
      if(!res||!res.ok)throw new Error((res&&res.error)||'Spell failed');
      if(res.row)this.applyRecord(player,res.row);
      return res.row;
    }
    const row=(await api.post(`/player/${player.id}/spell`,{spell})).data;
    if(row)this.applyRecord(player,row);return row;
  }
  async rerollAugment(player,index){
    if(this.hasLiveSocket()){
      const res=await this.emitWithAck('augment:reroll',{id:player.id,index});
      if(!res||!res.ok)throw new Error((res&&res.error)||'Reroll failed');
      if(res.row)this.applyRecord(player,res.row);
      return res.row;
    }
    const row=(await api.post('/augment/reroll',{id:player.id,index})).data;
    this.applyRecord(player,row);return row;
  }
  sync(player,now){
    this.activePlayer=player;
    // Fast path: stream player state over WebSocket; arena/player/item updates
    // are pushed directly by the server with zero HTTP polling.
    if(this.hasLiveSocket()){
      if(now>=this.nextSync){
        this.nextSync=now+50;
        this.socket.emit('player:sync',compactPlayerSync(player));
      }
      return;
    }
    // Fallback HTTP polling if WebSocket is unavailable.
    if(!this.enemyPending&&now>=this.nextEnemy){
      this.nextEnemy=now+50;this.enemyPending=true;
      api.get('/enemy').then(r=>this.applyArenaState(r.data,performance.now())).catch(err=>console.warn('Enemy sync:',err.message)).finally(()=>{this.enemyPending=false;});
    }
    if(this.syncPending||now<this.nextSync)return;
    this.nextSync=now+100;this.syncPending=true;
    Promise.all([
      api.post('/player/update',compactPlayerSync(player)).then(r=>r.data||api.get(`/player/${player.id}`).then(g=>g.data)).then(row=>{if(row)this.applyRecord(player,row);}),
      api.get('/player').then(r=>{this.playerList=r.data;this.playerMotion.push(r.data.map(p=>({...p,vx:p.vx*30,vy:p.vy*30})),performance.now());}),
      now>=this.nextItems?(this.nextItems=now+500,api.get('/item').then(r=>{this.applyItemList(r.data);})):Promise.resolve(),
    ]).catch(err=>console.warn('Arena sync:',err.message)).finally(()=>{this.syncPending=false;});
  }
  attackEnemies(player,onResult,now){
    if(this.attackPending||now<this.nextAttack)return;
    const poses=(player.swordPoses||[]).splice(0),bursts=(player.skills?.bursts||[]).splice(0);
    const payload={id:player.id,pos:{x:player.pos.x,y:player.pos.y},poses,bursts};
    this.attackPending=true;
    if(this.hasLiveSocket()){
      this.nextAttack=now+50;
      this.emitWithAck('enemy:attack',payload,2500).then(result=>{
        if(player.hp>0&&result){
          if(result.record)this.applyRecord(player,result.record);
          onResult(result);
        }
      }).catch(err=>console.warn('Attack sync:',err.message)).finally(()=>{this.attackPending=false;});
      return;
    }
    this.nextAttack=now+180;
    api.post('/enemy/attack',payload).then(r=>{
      if(player.hp>0&&r.data){
        if(r.data.record)this.applyRecord(player,r.data.record);
        onResult(r.data);
      }
    }).catch(err=>console.warn('Attack sync:',err.message)).finally(()=>{this.attackPending=false;});
  }
  damage(player,dmg){
    if(this.hasLiveSocket()){
      this.socket.emit('player:damage',{id:player.id,dmg});
      return;
    }
    api.put(`/player/${player.id}/damage`,{dmg}).catch(err=>console.warn(err.message));
  }
  kill(player){
    this.activePlayer=null;
    this.playerList=this.playerList.filter(p=>p._id!==player.id);
    if(this.hasLiveSocket()){
      this.socket.emit('player:kill',{id:player.id});
      return Promise.resolve();
    }
    return api.delete(`/player/${player.id}/kill`).catch(err=>console.warn(err.message));
  }
  ate(item,player){
    this.pendingItems.add(item.id);
    const row=this.itemById.get(item.id);
    if(row)Object.assign(row,{x:item.pos.x,y:item.pos.y,color:item.color,xp:item.xp,r:item.r});
    const payload={id:item.id,pos:item.pos,color:item.color,xp:item.xp,r:item.r,playerId:player.id};
    if(this.hasLiveSocket()){
      this.socket.emit('item:ate',payload);
      this.pendingItems.delete(item.id);
      return;
    }
    api.post('/item/ate',payload).catch(err=>console.warn(err.message)).finally(()=>this.pendingItems.delete(item.id));
  }
}
export const map=new MapState();
export {MapState};
