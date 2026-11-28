const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose')
const http = require('http')
const path = require("path");
const bodyParser = require("body-parser");
const mapRouter = require("./routes/map");
const Object = require("./object.js")
const itemdb = require("./db/itemdb");
const playerdb = require("./db/playerdb");

const app2 = express();
const sockport = 8081;
const server = http.createServer(app2)
const socketIo = require("socket.io")
const io = socketIo(server)

io.on("connection", (socket) => {
  console.log('socket connected!')
  var pid;

  socket.on("newplayer", (playerid) =>{
    pid = playerid
  })

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    playerdb.remove(pid, () => {});
  });


});

server.listen(sockport, () => {
  console.log(`Listening on port ${sockport}`);
});

const app = express();
const port = 8080;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tourne_sabre_local';
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

db.once('open', function() {
  playerdb.removeAll(() => {});
  itemdb.removeAll(() => {});
  for(let i=0;i<1000;i++){
    itemdb.add(Object.Item.randomItem(),()=>{})
  }
  require("./game/runtime").start();
  console.log("DB ready!");
});

app.use("/map", mapRouter);

app.get("/", (req, res) => {
  res.status(418).send("Hi");
});

app.listen(port,() => {
  console.log(`Listening on port ${port}`);
})
