const express = require('express');
const itemdb = require('../db/itemdb');
const playerdb = require('../db/playerdb');
const router = express.Router();
const { arena, handleAttack } = require('../game/runtime');
const progression = require('../game/progression');
const { playLog } = require('../game/playLog');

router.get('/enemy', (req, res) => res.json(arena.state(Date.now())));

router.post('/enemy/attack', (req, res) => {
  try {
    res.json(handleAttack(req.body, Date.now()));
  } catch (err) {
    res.status(400).json({ error: 'Invalid attack' });
  }
});

router.post('/player/:id/spell', (req, res) => {
  try {
    const row = progression.castSpellSync(req.params.id, req.body && req.body.spell, arena);
    playLog.spell(req.params.id, req.body && req.body.spell);
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/augment/reroll', (req, res) => {
  try {
    res.json(progression.rerollSync(req.body.id, req.body.index));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/augment', (req, res) => {
  try {
    res.json(progression.chooseSync(req.body.id, req.body.augment));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/item', (req, res) => {
  res.json(itemdb.list());
});

router.get('/player/:id', (req, res) => {
  res.json(playerdb.get(req.params.id));
});

router.get('/player', (req, res) => {
  res.json(playerdb.list());
});

router.post('/item/add', (req, res) => {
  res.json(itemdb.addSync(req.body, { notify: true }));
});

router.post('/test', (req, res) => {
  console.log('testing...');
  res.status(200).send();
});

router.post('/player/add', (req, res) => {
  const newItem = playerdb.addSync(req.body);
  playLog.start(newItem);
  res.json(newItem);
});

router.post('/player/update', (req, res) => {
  res.json(progression.syncSync(req.body));
});

router.delete('/all', (req, res) => {
  playerdb.clear();
  itemdb.clear();
  res.status(200).send();
});

router.delete('/player/:id/delete', (req, res) => {
  playLog.end(req.params.id, 'delete');
  playerdb.removeSync(req.params.id);
  res.status(200).send();
});

router.post('/item/ate', (req, res) => {
  const newItem = itemdb.updateSync(req.body, { notify: true });
  try {
    progression.pickupHealSync(req.body.playerId);
  } catch (err) {
    console.error(err.message);
  }
  res.json(newItem);
});

router.delete('/player/:id/kill', (req, res) => {
  playLog.end(req.params.id, 'kill');
  playerdb.removeSync(req.params.id);
  res.status(200).send();
});

router.put('/player/:id/damage', (req, res) => {
  const change = progression.damageSync(req.params.id, req.body.dmg);
  if (change) playLog.damage(req.params.id, { source: 'pvp', raw: Number(req.body.dmg) || 0, ...change });
  res.status(200).send();
});

module.exports = router;
