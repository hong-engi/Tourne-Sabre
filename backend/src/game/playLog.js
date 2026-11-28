// Per-run play logs for balance tuning. The server already sees every tick,
// attack result and damage event, so it records one timeline per player and
// writes it to disk when the run ends (death, kill request or disconnect).
//
// File: <dir>/<startISO>_<name>_<id8>.json  (full timeline)
//       <dir>/index.jsonl                    (one summary line per run)
const fs=require('fs');
const path=require('path');
const {stats}=require('../../../frontend/src/gameRules');

const SAMPLE_MS=1000;          // one timeline row per second
const NEARBY_RADIUS=500;       // "enemies around me" radius
const LOW_HP=.3, RECOVERED_HP=.5;
const BURST_WINDOW_MS=3000, BURST_SHARE=.35;
const MAX_SAMPLES=3600*3;      // ~3 hours; older rows are dropped
const MAX_EVENTS=5000;

const round=(v,d=1)=>{const f=10**d;return Math.round((Number(v)||0)*f)/f;};
const emptyWindow=()=>({dealt:0,hits:0,kills:0,xp:0,taken:0,rawTaken:0,absorbed:0,hitsTaken:0,minHp:Infinity});

class PlayLogger {
  constructor({dir=process.env.PLAY_LOG_DIR||path.join(__dirname,'../../logs/play'),enabled=process.env.PLAY_LOG!=='0',write}={}) {
    this.dir=dir;this.enabled=enabled;this.sessions=new Map();
    this.write=write||((file,text,append)=>{
      fs.mkdirSync(path.dirname(file),{recursive:true});
      (append?fs.appendFileSync:fs.writeFileSync)(file,text);
    });
  }
  start(player,now=Date.now()) {
    if (!this.enabled || !player) return null;
    const id=String(player._id??player.id);
    if (this.sessions.has(id)) return this.sessions.get(id);
    const s={id,name:player.name||'',startedAt:now,lastSample:now,loadout:player.loadout||[],spells:player.spells||[],
      samples:[],events:[],window:emptyWindow(),recent:[],lastBurstAt:-Infinity,
      low:null,last:{hp:player.hp,hpmax:player.hpmax,lv:player.lv||1,xp:player.xp||0,augments:[...(player.augments||[])],reviveUsed:!!player.reviveUsed},
      totals:{dealt:0,hits:0,kills:0,xp:0,taken:0,rawTaken:0,absorbed:0,hitsTaken:0,heal:0,shieldGained:0,spells:{},takenBySource:{},killsByThreat:{}},
      peak:{lv:player.lv||1,threat:1,nearby:0,dps:0},minHpRatio:1,lowHpCount:0,lowHpMs:0,bursts:0,diedAt:null};
    this.sessions.set(id,s);
    this.event(s,now,'start',{loadout:s.loadout,spells:s.spells,hp:player.hp,hpmax:player.hpmax});
    return s;
  }
  get(id) {return this.sessions.get(String(id));}
  event(s,now,type,data={}) {
    if (!s) return;
    s.events.push({t:round((now-s.startedAt)/1000),at:new Date(now).toISOString(),type,...data});
    if (s.events.length>MAX_EVENTS) s.events.splice(0,s.events.length-MAX_EVENTS);
  }
  note(id,type,data,now=Date.now()) {this.event(this.get(id),now,type,data);}

  // Called every AI tick with the living players and the arena.
  tick(players,arena,now=Date.now()) {
    if (!this.enabled) return;
    const threat=arena.threat(now);
    for (const p of players) {
      const s=this.get(p._id)||this.start(p,now);
      if (!s) continue;
      s.window.minHp=Math.min(s.window.minHp,p.hp);
      this.watchHealth(s,p,now);
      if (p.lv>s.last.lv) this.event(s,now,'levelUp',{lv:p.lv,threat:threat.level});
      if ((p.augments||[]).length>s.last.augments.length) {
        for (const a of (p.augments||[]).slice(s.last.augments.length)) this.event(s,now,'augment',{augment:a,lv:p.lv});
      }
      s.last={hp:p.hp,hpmax:p.hpmax,lv:p.lv||1,xp:p.xp||0,augments:[...(p.augments||[])],reviveUsed:!!p.reviveUsed,shield:p.shieldUntil>now?p.shield||0:0};
      s.peak.lv=Math.max(s.peak.lv,p.lv||1);s.peak.threat=Math.max(s.peak.threat,threat.level);
      if (now-s.lastSample>=SAMPLE_MS) this.sample(s,p,arena,threat,now);
    }
  }
  watchHealth(s,p,now) {
    const ratio=p.hpmax>0?p.hp/p.hpmax:1;
    s.minHpRatio=Math.min(s.minHpRatio,ratio);
    if (!s.low && ratio>0 && ratio<LOW_HP) {
      s.low={since:now,minHp:p.hp,minRatio:ratio};s.lowHpCount++;
      this.event(s,now,'danger',{kind:'lowHp',hp:p.hp,hpmax:p.hpmax,ratio:round(ratio,2)});
    } else if (s.low) {
      if (p.hp<s.low.minHp) {s.low.minHp=p.hp;s.low.minRatio=ratio;}
      if (ratio>=RECOVERED_HP) this.closeLow(s,now,'recovered',p);
    }
  }
  closeLow(s,now,how,p) {
    const ms=now-s.low.since;s.lowHpMs+=ms;
    this.event(s,now,how==='recovered'?'recovered':'dangerEnd',{kind:'lowHp',durationSec:round(ms/1000),minHp:s.low.minHp,minRatio:round(s.low.minRatio,2),hp:p?.hp});
    s.low=null;
  }
  sample(s,p,arena,threat,now) {
    const w=s.window,sec=Math.max(.001,(now-s.lastSample)/1000);
    const near={};let nearby=0,shotsNear=0;
    for (const e of arena.enemies) if (e.hp>0 && Math.hypot(e.x-p.x,e.y-p.y)<NEARBY_RADIUS) {nearby++;near[e.type]=(near[e.type]||0)+1;}
    for (const sh of arena.projectiles) if (sh.owner==='enemy' && Math.hypot(sh.x-p.x,sh.y-p.y)<NEARBY_RADIUS) shotsNear++;
    const dps=w.dealt/sec;
    s.peak.nearby=Math.max(s.peak.nearby,nearby);s.peak.dps=Math.max(s.peak.dps,dps);
    s.samples.push({
      t:round((now-s.startedAt)/1000),at:new Date(now).toISOString(),
      lv:p.lv||1,xp:p.xp||0,hp:p.hp,hpmax:p.hpmax,minHp:Number.isFinite(w.minHp)?Math.min(w.minHp,p.hp):p.hp,
      shield:p.shieldUntil>now?p.shield||0:0,attack:stats(p.lv||1,p.augments).damage,augments:(p.augments||[]).length,
      threat:threat.level,enemies:arena.enemies.length,nearby,nearbyTypes:near,shotsNear,
      dealt:w.dealt,dps:round(dps),hits:w.hits,kills:w.kills,xpGain:w.xp,
      taken:w.taken,rawTaken:w.rawTaken,absorbed:w.absorbed,hitsTaken:w.hitsTaken,
      paused:!!p.choosingAugment,danger:!!s.low,
    });
    if (s.samples.length>MAX_SAMPLES) s.samples.splice(0,s.samples.length-MAX_SAMPLES);
    s.window=emptyWindow();s.lastSample=now;
  }

  // Result of arena.attack() for one player.
  attack(id,result,now=Date.now(),threatLevel) {
    const s=this.get(id);if (!s || !result) return;
    const hits=(result.hits||[]).filter(h=>h.damage>0);
    const dealt=hits.reduce((a,h)=>a+h.damage,0),kills=hits.filter(h=>h.killed).length;
    s.window.dealt+=dealt;s.window.hits+=hits.length;s.window.kills+=kills;s.window.xp+=result.xp||0;
    const t=s.totals;t.dealt+=dealt;t.hits+=hits.length;t.kills+=kills;t.xp+=result.xp||0;
    t.heal+=result.heal||0;t.shieldGained+=result.shieldGained||0;
    if (kills && threatLevel) t.killsByThreat[threatLevel]=(t.killsByThreat[threatLevel]||0)+kills;
  }
  // One resolved damage event: before/after come from progression.damage().
  damage(id,{source='unknown',raw=0,before,after}={},now=Date.now()) {
    const s=this.get(id);if (!s || !before || !after) return;
    const lost=Math.max(0,before.hp-after.hp),absorbed=Math.max(0,(before.shield||0)-(after.shield||0));
    if (!lost && !absorbed) return;
    const w=s.window,t=s.totals;
    w.taken+=lost;w.rawTaken+=raw;w.absorbed+=absorbed;w.hitsTaken++;w.minHp=Math.min(w.minHp,after.hp);
    t.taken+=lost;t.rawTaken+=raw;t.absorbed+=absorbed;t.hitsTaken++;
    t.takenBySource[source]=(t.takenBySource[source]||0)+lost;
    const hpmax=before.hpmax||s.last.hpmax||100;
    // Burst: a big share of max HP lost within a few seconds.
    s.recent.push({at:now,lost});s.recent=s.recent.filter(r=>now-r.at<=BURST_WINDOW_MS);
    const burst=s.recent.reduce((a,r)=>a+r.lost,0);
    if (burst>=hpmax*BURST_SHARE && now-s.lastBurstAt>BURST_WINDOW_MS) {
      s.lastBurstAt=now;s.bursts++;
      this.event(s,now,'danger',{kind:'burst',lost:burst,windowSec:BURST_WINDOW_MS/1000,hp:after.hp,hpmax,lastSource:source});
    }
    if (after.reviveUsed && !before.reviveUsed) this.event(s,now,'danger',{kind:'revive',source,hp:after.hp,hpmax});
    const ratio=hpmax>0?after.hp/hpmax:1;
    s.minHpRatio=Math.min(s.minHpRatio,ratio);
    if (!s.low && after.hp>0 && ratio<LOW_HP) {
      s.low={since:now,minHp:after.hp,minRatio:ratio};s.lowHpCount++;
      this.event(s,now,'danger',{kind:'lowHp',hp:after.hp,hpmax,ratio:round(ratio,2),source});
    } else if (s.low && after.hp<s.low.minHp) {s.low.minHp=after.hp;s.low.minRatio=ratio;}
    s.last.hp=after.hp;
    if (after.hp<=0 && !s.diedAt) {s.diedAt=now;this.event(s,now,'death',{source,raw,lv:s.last.lv,hpmax});}
  }
  spell(id,spellId,now=Date.now()) {
    const s=this.get(id);if (!s) return;
    s.totals.spells[spellId]=(s.totals.spells[spellId]||0)+1;
    this.event(s,now,'spell',{spell:spellId,hp:s.last.hp,hpmax:s.last.hpmax});
  }

  summary(s,now,reason) {
    const sec=Math.max(.001,((s.diedAt||now)-s.startedAt)/1000),t=s.totals;
    return {id:s.id,name:s.name,reason,startedAt:new Date(s.startedAt).toISOString(),endedAt:new Date(s.diedAt||now).toISOString(),
      durationSec:round(sec),died:!!s.diedAt,finalLv:s.last.lv,finalXp:s.last.xp,peakLv:s.peak.lv,peakThreat:s.peak.threat,
      loadout:s.loadout,spells:s.spells,augments:s.last.augments,
      kills:t.kills,killsPerMin:round(t.kills/sec*60,2),damageDealt:t.dealt,avgDps:round(t.dealt/sec),peakDps:round(s.peak.dps),
      damageTaken:t.taken,rawDamageTaken:t.rawTaken,shieldAbsorbed:t.absorbed,hitsTaken:t.hitsTaken,takenPerMin:round(t.taken/sec*60),
      takenBySource:t.takenBySource,killsByThreat:t.killsByThreat,healFromAttacks:t.heal,shieldGained:t.shieldGained,spellsCast:t.spells,
      danger:{lowHpCount:s.lowHpCount,lowHpSec:round(s.lowHpMs/1000),bursts:s.bursts,minHpRatio:round(s.minHpRatio,2),peakNearby:s.peak.nearby}};
  }
  // Ends a run and writes its log. Safe to call more than once.
  end(id,reason='end',now=Date.now()) {
    const s=this.get(id);if (!s) return null;
    this.sessions.delete(String(id));
    if (s.low) this.closeLow(s,s.diedAt||now,'dangerEnd');
    const summary=this.summary(s,now,s.diedAt?'death':reason);
    this.event(s,s.diedAt||now,'end',{reason:summary.reason});
    // Drop accidental runs (joined and left immediately).
    if (summary.durationSec<3 && !s.samples.length) return summary;
    const stamp=new Date(s.startedAt).toISOString().replace(/[:.]/g,'-');
    const safe=String(s.name||'player').replace(/[^\w가-힣-]+/g,'_').slice(0,24)||'player';
    const file=path.join(this.dir,`${stamp}_${safe}_${s.id.slice(0,8)}.json`);
    try {
      this.write(file,JSON.stringify({version:1,sampleMs:SAMPLE_MS,summary,events:s.events,samples:s.samples},null,1));
      this.write(path.join(this.dir,'index.jsonl'),JSON.stringify({...summary,file:path.basename(file)})+'\n',true);
    } catch (err) {console.error('Play log write failed:',err.message);}
    return summary;
  }
  endAll(reason='shutdown',now=Date.now()) {for (const id of [...this.sessions.keys()]) this.end(id,reason,now);}
}

const playLog=new PlayLogger();
module.exports={PlayLogger,playLog,SAMPLE_MS,LOW_HP,RECOVERED_HP};
