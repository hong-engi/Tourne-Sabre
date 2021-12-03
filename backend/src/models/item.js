const mongoose = require( "mongoose" );
const itemSchema = new mongoose.Schema({
    _id:String,
    x:Number,
    y:Number,
    color:String,
    xp:Number,
    r:Number,
});
const itemModel = mongoose.model("item", itemSchema);

module.exports = itemModel;