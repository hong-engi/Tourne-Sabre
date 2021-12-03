const mongoose = require( "mongoose" );
const playerSchema = new mongoose.Schema({
    _id:String,
    name:String,
    x:Number,
    y:Number,
    r:Number,
    sw_angle:Number,
    sw_r:Number,
    sw_w:Number,
    sw_h:Number,
    sw_speed:Number,
    hp:Number,
    xp:Number,
    color:String,
});
const playerModel = mongoose.model("player", playerSchema);

module.exports = playerModel;