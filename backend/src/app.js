const express = require("express");
const mongoose = require('mongoose')
const path = require("path");
const bodyParser = require("body-parser");
const mapRouter = require("./routes/map");

const app = express();
const port = 8080;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));


mongoose.connect('mongodb://localhost:27017/map', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.once('open', function() {
  console. log("DB connected!");
});

app.use("/map", mapRouter);

app.get("/", (req, res) => {
  res.status(418).send("Hi");
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Listening on port ${port}`);
});
