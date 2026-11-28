// Enemy lab: one private EnemyArena per enemy type, separate from the real
// arena, so the bestiary page can show every enemy moving and attacking with
// the actual server AI. A dummy player circles the enemy; it never dies, and
// it can optionally swing its sword so reactions (shields, cores, parts)
// show up. Nothing here touches the database.
const fs=require('fs');
const path=require('path');
const {EnemyArena,TYPES}=require('./enemies');

const MAX_STEP_MS=150,IDLE_DROP_MS=60000;
// Sword pose of the dummy, matching the player's default blade.
const SWORD={sw_r:65,sw_w:40,sw_h:100};

class EnemyLab {
  constructor({random=Math.random}={}) {this.random=random;this.sims=new Map();}
  types() {
    return Object.entries(TYPES).filter(([,s])=>s.tier!=='part').map(([type,s])=>({type,tier:s.tier||'normal',unlock:Number.isFinite(s.unlock)?s.unlock:null,
      r:s.r,hp:s.hp,speed:s.speed,xp:s.xp,contact:s.contact}));
  }
  reset(type,now=Date.now()) {
    if (!TYPES[type]) throw new Error(`unknown enemy type ${type}`);
    const arena=new EnemyArena(this.random);
    // Only the chosen enemy: no random spawns, no elite/boss encounters.
    arena.nextSpawn=Infinity;arena.startedAt=now;arena.lastTime=now;
    for (let l=1;l<=200;l++) arena.encounters.add(l);
    const dummy={_id:'lab-dummy',name:'dummy',x:0,y:0,r:25,hp:100,hpmax:100,lv:5,augments:[],sw_angle:0,...SWORD};
    const sim={type,arena,dummy,clock:now,last:now,seen:now,angle:0,hits:0,damage:0};
    this.sims.set(type,sim);
    this.spawnSubject(sim,now);
    return sim;
  }
  spawnSubject(sim,now) {
    const tier=TYPES[sim.type].tier,d=tier==='boss'?330:260;
    if (sim.type==='stalker') {
      for (let i=0;i<3;i++) sim.arena.spawn(sim.dummy,'stalker',now,{x:d+i*28,y:-70+i*38});
      return;
    }
    if (sim.type==='mender') {
      sim.arena.spawn(sim.dummy,'mender',now,{x:d+90,y:-40});
      const ally1=sim.arena.spawn(sim.dummy,'shellback',now,{x:d-90,y:20});
      ally1.hp=Math.max(1,Math.round(ally1.hpmax*.45));
      const ally2=sim.arena.spawn(sim.dummy,'lancer',now,{x:d-20,y:-110});
      ally2.hp=Math.max(1,Math.round(ally2.hpmax*.55));
      return;
    }
    if (sim.type==='banner') {
      sim.arena.spawn(sim.dummy,'banner',now,{x:d+70,y:-40});
      sim.arena.spawn(sim.dummy,'shellback',now,{x:d-50,y:-20});
      sim.arena.spawn(sim.dummy,'spitter',now,{x:d+10,y:85});
      return;
    }
    sim.arena.spawn(sim.dummy,sim.type,now,{x:d,y:-40});
  }
  // Advance a type's simulation to `now` (bounded steps) and return its state.
  step(type,now=Date.now(),{attack=false,move=true}={}) {
    let sim=this.sims.get(type);
    if (!sim) sim=this.reset(type,now);
    const {arena,dummy}=sim;
    sim.seen=now;
    // A tab that stopped polling resumes from now instead of replaying.
    if (now-sim.clock>1500) sim.clock=now-100;
    let t=sim.clock;
    const target=Math.min(now,t+1500);
    while (t<target) {
      const dt=Math.min(33,target-t);t+=dt;
      if (move) {
        // Walk a slow circle so aimed attacks have to lead or miss.
        sim.angle+=dt/1000*.45;
        const R=TYPES[type].tier==='boss'?170:120;
        const nx=Math.cos(sim.angle)*R,ny=Math.sin(sim.angle)*R*.7;
        dummy.vx=(nx-dummy.x)/(dt/1000);dummy.vy=(ny-dummy.y)/(dt/1000);dummy.x=nx;dummy.y=ny;
      } else {dummy.vx=0;dummy.vy=0;}
      const prev=dummy.sw_angle;dummy.sw_angle+=dt/1000*3.1;
      dummy.hp=dummy.hpmax;
      arena.startedAt=t;// stay at threat 1
      const events=arena.step([dummy],t);
      for (const e of events) {sim.hits++;sim.damage+=e.amount;}
      if (attack) {
        const poses=[];for (let k=1;k<=4;k++) poses.push({sw_angle:prev+(dummy.sw_angle-prev)*k/4,...SWORD});
        arena.lastAttack.delete(String(dummy._id));
        arena.attack({...dummy,poses},t);
      }
      // Bring the subject back when it dies so the page never goes empty.
      if (!arena.enemies.some(e=>e.type===type&&e.hp>0)) {
        if (!sim.respawnAt) sim.respawnAt=t+1200;
        else if (t>=sim.respawnAt) {sim.respawnAt=0;arena.enemies=[];arena.hazards=[];arena.projectiles=[];this.spawnSubject(sim,t);}
      }
    }
    sim.clock=t;
    for (const [key,other] of this.sims) if (now-other.seen>IDLE_DROP_MS) this.sims.delete(key);
    const state=arena.state(t);
    return {...state,type,dummy:{x:dummy.x,y:dummy.y,vx:dummy.vx||0,vy:dummy.vy||0,r:dummy.r,sw_angle:dummy.sw_angle,...SWORD},hits:sim.hits,damage:sim.damage};
  }
  // Playable lab step: the user directly controls the knight and fights the spawned enemy.
  stepPlay(type,now=Date.now(),input={}) {
    let sim=this.sims.get(type);
    if (!sim) sim=this.reset(type,now);
    const {arena,dummy}=sim;
    sim.seen=now;
    if (now-sim.clock>1500) sim.clock=now-100;
    if (Number.isFinite(input.x)) dummy.x=Math.max(-2900,Math.min(2900,input.x));
    if (Number.isFinite(input.y)) dummy.y=Math.max(-2900,Math.min(2900,input.y));
    if (Number.isFinite(input.vx)) dummy.vx=input.vx;
    if (Number.isFinite(input.vy)) dummy.vy=input.vy;
    if (Number.isFinite(input.sw_angle)) dummy.sw_angle=input.sw_angle;
    if (Number.isFinite(input.sw_r)) dummy.sw_r=input.sw_r;
    if (Number.isFinite(input.sw_w)) dummy.sw_w=input.sw_w;
    if (Number.isFinite(input.sw_h)) dummy.sw_h=input.sw_h;
    dummy.skillState=input.skillState||{};
    dummy.hp=dummy.hpmax;
    let t=sim.clock,damageTaken=0;
    const target=Math.min(now,t+1500);
    while (t<target) {
      const dt=Math.min(33,target-t);t+=dt;
      arena.startedAt=t;// stay at threat 1
      const events=arena.step([dummy],t);
      for (const e of events) {sim.hits++;sim.damage+=e.amount;damageTaken+=e.amount;}
      if (!arena.enemies.some(e=>e.type===type&&e.hp>0)) {
        if (!sim.respawnAt) sim.respawnAt=t+1200;
        else if (t>=sim.respawnAt) {sim.respawnAt=0;arena.enemies=[];arena.hazards=[];arena.projectiles=[];this.spawnSubject(sim,t);}
      }
    }
    const poses=Array.isArray(input.poses)?input.poses:[];
    const bursts=Array.isArray(input.bursts)?input.bursts:[];
    let attackResult={hits:[],xp:0};
    if (poses.length||bursts.length) {
      arena.lastAttack.delete(String(dummy._id));
      attackResult=arena.attack({...dummy,poses,bursts},t);
      if (!arena.enemies.some(e=>e.type===type&&e.hp>0)&&!sim.respawnAt) sim.respawnAt=t+1200;
    }
    sim.clock=t;
    for (const [key,other] of this.sims) if (now-other.seen>IDLE_DROP_MS) this.sims.delete(key);
    const state=arena.state(t);
    return {...state,type,dummy:{x:dummy.x,y:dummy.y,vx:dummy.vx||0,vy:dummy.vy||0,r:dummy.r,sw_angle:dummy.sw_angle,sw_r:dummy.sw_r,sw_w:dummy.sw_w,sw_h:dummy.sw_h},
      hits:sim.hits,damage:sim.damage,damageTaken,attackHits:attackResult.hits||[]};
  }
}

// Notes the user writes per enemy, kept in the repository so later work can
// read them (ENEMY_NOTES.json at the repo root).
const NOTES_FILE=process.env.ENEMY_NOTES_FILE||path.join(__dirname,'../../../ENEMY_NOTES.json');
const STATUSES=['note','todo','done'];
function readNotes(file=NOTES_FILE) {
  try {return JSON.parse(fs.readFileSync(file,'utf8'));} catch (err) {return {};}
}
function writeNote(type,{text='',status='note'}={},file=NOTES_FILE,now=new Date()) {
  if (!TYPES[type]) throw new Error(`unknown enemy type ${type}`);
  const notes=readNotes(file);
  const clean=String(text).slice(0,20000);
  if (!clean.trim()) delete notes[type];
  else notes[type]={text:clean,status:STATUSES.includes(status)?status:'note',updatedAt:now.toISOString()};
  const sorted=Object.fromEntries(Object.keys(notes).sort().map(k=>[k,notes[k]]));
  fs.writeFileSync(file,JSON.stringify(sorted,null,2)+'\n');
  return notes[type]||null;
}
module.exports={EnemyLab,readNotes,writeNote,NOTES_FILE,STATUSES};
