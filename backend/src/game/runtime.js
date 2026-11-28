const {EnemyArena} = require('./enemies');
const playerModel = require('../models/player');
const {playLog} = require('./playLog');
const arena = new EnemyArena();
let ticking = false;
let timer;
function start() {
  if (timer) return;
  timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      const players = await playerModel.find({hp: {$gt: 0}}).lean();
      const now = Date.now();
      const events = arena.step(players, now);
      playLog.tick(players, arena, now);
      // Mirror each player's knockback ledger (DB value + this tick) in memory
      // so clients get it on the 50ms /enemy poll instead of waiting for the
      // DB write and the slower player sync. Both fields move together, so a
      // client acking a value before the DB write lands stays consistent.
      const ledger=new Map(players.map(p=>[String(p._id),{seq:p.physicsSeq||0,x:p.physicsX||0,y:p.physicsY||0,vx:p.physicsVx||0,vy:p.physicsVy||0}]));
      for(const c of arena.playerCorrections){
        const l=ledger.get(String(c.id));if(!l)continue;
        l.seq+=1;l.x+=c.dx;l.y+=c.dy;l.vx+=c.dvx;l.vy+=c.dvy;
      }
      arena.physicsLedger=ledger;
      await Promise.all(arena.playerCorrections.map(c=>playerModel.updateOne({_id:c.id,hp:{$gt:0}},{$inc:{x:c.dx,y:c.dy,vx:c.dvx/30,vy:c.dvy/30,physicsX:c.dx,physicsY:c.dy,physicsVx:c.dvx,physicsVy:c.dvy,physicsSeq:1}})));
      await Promise.all(events.map(async event => {
        const change=await require('./progression').damage(event.id,event.amount);
        if (change) playLog.damage(event.id,{source:event.source,raw:event.amount,...change});
      }));
    } catch (err) { console.error('AI update failed:', err.message); }
    finally {ticking = false;}
  }, 50);
}
module.exports = {arena, start};
