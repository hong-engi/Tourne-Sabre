const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const mapRouter = require('./routes/map');
const GameObject = require('./object.js');
const itemdb = require('./db/itemdb');
const playerdb = require('./db/playerdb');
const progression = require('./game/progression');
const runtime = require('./game/runtime');
const { playLog } = require('./game/playLog');

// A dropped socket (network blip, Render instance swap) keeps its player for a
// short grace period so the reconnecting client can reclaim it.
const RECONNECT_GRACE_MS = 8000;

function createServer({ reconnectGraceMs = RECONNECT_GRACE_MS } = {}) {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.use('/map', mapRouter);
  app.use('/lab', require('./routes/lab'));
  app.get('/healthz', (req, res) => {
    res.json({ ok: true, dbReady: true, storage: 'memory' });
  });

  // Serve the production React build from the same port when available.
  const buildDir = path.join(__dirname, '../../frontend/build');
  if (fs.existsSync(path.join(buildDir, 'index.html'))) {
    app.use(express.static(buildDir));
    app.get('/', (req, res) => {
      res.sendFile(path.join(buildDir, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.status(418).send('Hi');
    });
  }

  const server = http.createServer(app);
  const io = socketIo(server, {
    cors: { origin: '*' },
    perMessageDeflate: false,
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Broadcast incremental item respawns to all connected clients instead of
  // polling 1,000 items over HTTP every 500ms.
  itemdb.setOnChange(row => {
    if (io.engine.clientsCount > 0) io.emit('items:patch', [row]);
  });

  const leaving = new Map();
  const claimed = (pid, except) => [...io.sockets.sockets.values()].some(s => s !== except && s.data && s.data.pid === pid);
  const keep = pid => {
    const timer = pid && leaving.get(pid);
    if (timer) clearTimeout(timer);
    if (pid) leaving.delete(pid);
  };

  io.on('connection', socket => {
    socket.data = { pid: null, missingAt: 0 };

    // Send the full item list once on connection; updates arrive via items:patch.
    socket.emit('items:init', itemdb.list());

    socket.on('items:sync', ack => {
      const list = itemdb.list();
      if (typeof ack === 'function') ack(list);
      else socket.emit('items:init', list);
    });

    // Reconnect: reclaim the player. known=false tells the client to rejoin.
    socket.on('newplayer', (playerid, ack) => {
      socket.data.pid = playerid ? String(playerid) : null;
      keep(socket.data.pid);
      if (typeof ack === 'function') ack({ known: !!playerdb.get(socket.data.pid) });
    });

    socket.on('player:join', (payload, ack) => {
      try {
        const id = payload && String(payload.id ?? payload._id);
        keep(id);
        const existing = payload && payload.rejoin ? playerdb.get(id) : null;
        const record = existing || playerdb.addSync(payload);
        socket.data.pid = record._id;
        if (!existing) playLog.start(record);
        const players = playerdb.list().map(progression.playerPublic);
        const items = itemdb.list();
        if (typeof ack === 'function') {
          ack({ ok: true, player: progression.playerRecord(record), players, items });
        }
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('player:sync', payload => {
      if (!payload) return;
      const known = playerdb.get(payload.id ?? payload._id);
      if (!known) {
        // The server lost this player (restart or expired grace): ask for a rejoin.
        const now = Date.now();
        if (now - socket.data.missingAt > 1000) {
          socket.data.missingAt = now;
          socket.emit('player:missing');
        }
        return;
      }
      const beforeOffer = known.augmentOffer;
      const row = progression.syncSync(payload);
      // Push immediately when a new augment offer opens so the picker appears without delay.
      if (row && !beforeOffer && row.augmentOffer) {
        socket.emit('player:record', progression.playerRecord(row));
      }
    });

    socket.on('enemy:attack', (payload, ack) => {
      try {
        const result = runtime.handleAttack(payload, Date.now());
        if (typeof ack === 'function') ack(result);
      } catch (err) {
        if (typeof ack === 'function') ack({ hits: [], xp: 0, error: 'Invalid attack' });
      }
    });

    socket.on('item:ate', payload => {
      if (!payload) return;
      // Broadcast to other clients; the picker already applied it optimistically.
      const row = itemdb.updateSync(payload, { notify: false });
      socket.broadcast.emit('items:patch', [row]);
      try {
        progression.pickupHealSync(payload.playerId);
      } catch (err) {
        console.error(err.message);
      }
    });

    socket.on('player:damage', payload => {
      if (!payload || !payload.id) return;
      const change = progression.damageSync(payload.id, payload.dmg);
      if (change) playLog.damage(payload.id, { source: 'pvp', raw: Number(payload.dmg) || 0, ...change });
    });

    socket.on('player:kill', payload => {
      const id = payload && (payload.id || payload);
      if (!id) return;
      playLog.end(id, 'kill');
      playerdb.removeSync(id);
      if (socket.data.pid === String(id)) socket.data.pid = null;
    });

    socket.on('player:spell', (payload, ack) => {
      try {
        const id = payload && payload.id;
        const spell = payload && payload.spell;
        const row = progression.castSpellSync(id, spell, runtime.arena);
        playLog.spell(id, spell);
        if (typeof ack === 'function') ack({ ok: true, row: progression.playerRecord(row) });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('augment:choose', (payload, ack) => {
      try {
        if (payload && payload.player) progression.syncSync(payload.player);
        const row = progression.chooseSync(payload.id, payload.augment);
        if (typeof ack === 'function') ack({ ok: true, row: progression.playerRecord(row) });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('augment:reroll', (payload, ack) => {
      try {
        const row = progression.rerollSync(payload.id, payload.index);
        if (typeof ack === 'function') ack({ ok: true, row: progression.playerRecord(row) });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      const pid = socket.data && socket.data.pid;
      if (!pid || claimed(pid, socket)) return;
      keep(pid);
      const remove = () => {
        leaving.delete(pid);
        if (claimed(pid, socket) || !playerdb.get(pid)) return;
        playLog.end(pid, 'disconnect');
        playerdb.removeSync(pid);
      };
      if (!(reconnectGraceMs > 0)) return remove();
      const timer = setTimeout(remove, reconnectGraceMs);
      if (timer.unref) timer.unref();
      leaving.set(pid, timer);
    });
  });

  return { app, server, io };
}

function boot() {
  // Flush unfinished runs to disk when the server is stopped.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      playLog.endAll('shutdown');
      runtime.stop();
      process.exit(0);
    });
  }

  playerdb.clear();
  itemdb.seed(1000, () => GameObject.Item.randomItem());

  const { server, io } = createServer();
  runtime.start(io);

  const port = Number(process.env.PORT) || 8080;
  server.listen(port, () => {
    console.log(`Listening on port ${port} (in-memory store ready, 1000 items seeded)`);
  });
  return { server, io };
}

if (require.main === module) boot();

module.exports = { createServer, boot };
