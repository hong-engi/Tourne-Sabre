const express = require("express");
const itemdb = require("../db/itemdb");
const playerdb = require("../db/playerdb");
const router  = express.Router();
const {arena} = require('../game/runtime');
const playerModel = require('../models/player');
router.get('/enemy', (req, res) => res.json(arena.state(Date.now())));
router.post('/enemy/attack', async (req, res) => {
  try {
    const player = await playerModel.findById(req.body.id).lean();
    // The client owns its position and blade; use the poses it actually drew.
    const pos=req.body.pos||{};
    if (player && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {player.x=pos.x;player.y=pos.y;}
    if (player) {player.poses=req.body.poses;player.bursts=req.body.bursts;}
    const result=arena.attack(player, Date.now());
    if (result.heal) await playerModel.updateOne({_id:player._id,hp:{$gt:0}},[{$set:{hp:{$min:['$hpmax',{$add:['$hp',result.heal]}]}}}]);
    if (result.shieldGained) {
      // Spoils stacks up to 80 but never shrinks a bigger shield (barrier).
      const active=player.shieldUntil>Date.now()?player.shield||0:0;
      await playerModel.updateOne({_id:player._id},{$set:{shield:Math.max(active,Math.min(80,active+result.shieldGained)),shieldUntil:Math.max(player.shieldUntil||0,Date.now()+5000)}});
    }
    res.json(result);
  } catch (err) {res.status(400).json({error:'Invalid attack'});}
});

router.post('/player/:id/spell', async (req,res)=>{
  try {res.json(await require('../game/progression').castSpell(req.params.id,req.body&&req.body.spell,arena));}
  catch(err) {res.status(400).json({error:err.message});}
});
router.post('/augment/reroll', async (req,res)=>{
  try {res.json(await require('../game/progression').reroll(req.body.id,req.body.index));}
  catch(err) {res.status(400).json({error:err.message});}
});
router.post('/augment', async (req,res)=>{
  try {res.json(await require('../game/progression').choose(req.body.id,req.body.augment));}
  catch(err) {res.status(400).json({error:err.message});}
});
router.get("/item", (req, res) => {
  itemdb.getAll((items) => {
    res.json(items);
  });
});

router.get("/player/:id", (req, res) => {
  playerdb.getOne(req.params.id, (item) => {
    res.json(item);
  });
});

router.get("/player", (req, res) => {
  playerdb.getAll((items) => {
    res.json(items);
  });
});

router.post("/item/add", (req, res) => {
  itemdb.add(req.body, (newItem) => {
    res.json(newItem);
  });
});

router.post("/test", (req, res) => {
  console.log('testing...')
});

router.post("/player/add", (req, res) => {
  playerdb.add(req.body, (newItem) => {
    res.json(newItem);
  });
});

router.post("/player/update", (req, res) => {
  playerdb.update(req.body, (newItem) => {
    res.json(newItem);
  });
});

router.delete("/all", (req, res) => {
  playerdb.removeAll(() => {
    res.status(200).send();
  });
  itemdb.removeAll(() => {
    res.status(200).send();
  });
})

router.delete("/player/:id/delete", (req, res) => {
  playerdb.remove(req.params.id, () => {
    res.status(200).send();
  });
});

router.post("/item/ate", (req, res) => {
  itemdb.update(req.body, async (newItem) => {
    try {await require('../game/progression').pickupHeal(req.body.playerId);} catch(err) {console.error(err.message);}
    res.json(newItem);
  });
});

router.delete("/player/:id/kill", (req, res) => {
  playerdb.remove(req.params.id, () => {
    res.status(200).send();
  });
});

router.put("/player/:id/damage",(req, res) => {
  playerdb.damage(req.params.id, req.body.dmg, () => {
    res.status(200).send();
  });
});

module.exports = router;
