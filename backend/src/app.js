const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose');
const http = require('http');
const fs = require('fs');
const path = require("path");
const bodyParser = require("body-parser");
const socketIo = require("socket.io");
const mapRouter = require("./routes/map");
const Object = require("./object.js");
const itemdb = require("./db/itemdb");
const playerdb = require("./db/playerdb");
const {playLog} = require('./game/playLog');

// Flush unfinished runs to disk when the server is stopped.
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => {playLog.endAll('shutdown'); process.exit(0);});

const app = express();
const port = Number(process.env.PORT) || 8080;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tourne_sabre_local';

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true,
}));

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.once('open', function() {
  playerdb.removeAll(() => {});
  itemdb.removeAll(() => {});
  for (let i = 0; i < 1000; i++) {
    itemdb.add(Object.Item.randomItem(), () => {});
  }
  require("./game/runtime").start();
  console.log("DB ready!");
});

app.use("/map", mapRouter);
app.use("/lab", require("./routes/lab"));
app.get("/healthz", (req, res) => {
  res.json({ ok: true, dbReady: mongoose.connection.readyState === 1 });
});

// Serve the production React build from the same port when available.
const buildDir = path.join(__dirname, "../../frontend/build");
if (fs.existsSync(path.join(buildDir, "index.html"))) {
  app.use(express.static(buildDir));
  app.get("/", (req, res) => {
    res.sendFile(path.join(buildDir, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.status(418).send("Hi");
  });
}

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' },
});

io.on("connection", (socket) => {
  console.log('socket connected!');
  var pid;

  socket.on("newplayer", (playerid) => {
    pid = playerid;
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    if (pid) playLog.end(pid, 'disconnect');
    playerdb.remove(pid, () => {});
  });
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
