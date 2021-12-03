const express = require("express");
const itemdb = require("../db/itemdb");
const playerdb = require("../db/playerdb");
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

router.delete("/player/delete", (req, res) => {
  playerdb.remove(req.body, () => {
    res.status(200).send();
  });
});

router.post("/item/ate", (req, res) => {
  itemdb.update(req.body, (newItem) => {
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
