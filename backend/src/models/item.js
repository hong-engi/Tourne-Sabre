const mongoose = require( "mongoose" );
const itemSchema = new mongoose.Schema({
    id:String,
    pos:[Number],
    color:String,
    xp:Number,
    r:Number,
});
const itemModel = mongoose.model("todo", itemSchema);

module.exports = itemModel;