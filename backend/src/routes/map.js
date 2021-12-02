const express = require("express");
const itemdb = require("../db/itemdb");
const playerdb = require("../db/itemdb");
const router  = express.Router();

router.get("/item", (req, res) => {
  itemdb.getAll((items) => {
    res.json(items);
  });
});

router.get("/player", (req, res) => {
  playerdb.getAll((items) => {
    res.json(items);
  });
});

router.post("/item", (req, res) => {
  const {name} = req.body;
  itemdb.add(name, (newItem) => {
    res.json(newItem);
  });
});

router.post("/player", (req, res) => {
  const {name} = req.body;
  playerdb.add(name, (newItem) => {
    res.json(newItem);
  });
});

router.delete("/item/:id", (req, res) => {
  itemdb.remove(req.params.id, () => {
    res.status(200).send();
  });
});

router.delete("/player/:id", (req, res) => {
  playerdb.remove(req.params.id, () => {
    res.status(200).send();
  });
});

module.exports = router;
