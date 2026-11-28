const {EnemyArena} = require('./enemies');
const playerModel = require('../models/player');
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
      const events = arena.step(players, Date.now());
      await Promise.all(arena.playerCorrections.map(c=>playerModel.updateOne({_id:c.id,hp:{$gt:0}},{$inc:{x:c.dx,y:c.dy,vx:c.dvx/30,vy:c.dvy/30,physicsX:c.dx,physicsY:c.dy,physicsVx:c.dvx,physicsVy:c.dvy,physicsSeq:1}})));
      await Promise.all(events.map(event => require('./progression').damage(event.id,event.amount)));
    } catch (err) { console.error('AI update failed:', err.message); }
    finally {ticking = false;}
  }, 50);
}
module.exports = {arena, start};
