const playerModel = require("../models/player")

function getAll(callback) {
  playerModel.find({},(error,result)=>{
    if (error) {
      console.log(error);
      callback([]);
    } else {
      callback(result);
    }
  });
}

function add(player, callback) {
  const newItem = new playerModel({
    name:player.name,
    pos:[player.pos.x,player.pos.y],
    r:player.r,
    sw_angle:player.sw_angle,
    sw_r:player.sw_r,
    sw_w:player.sw_w,
    sw_h:player.sw_h,
    sw_speed:player.sw_speed,
    hp:player.hp,
    xp:player.xp,
    color:player.color,
  });
  newItem.save((error,result)=>{
    callback(result);
  });
}

function remove(id, callback) {
  playerModel.deleteOne({_id: id}, (error) => {
    console.log(error)
    callback();
  });
}

function getOne(id, callback) {
  playerModel.findOne({_id: id}, (err, found) => {
    if(err){
      console.log(error);
      callback([]);
    } else {
      callback(found);
    }
  });
}

function changeHp(id, dhp, callback) {
  playerModel.findOne({_id: id}, (err, found) => {
    if(err){
      console.log(error);
      callback([]);
    } else {
      playerModel.updateOne({_id: id}, {hp: found.hp-dhp}, () => {
        callback();
      });  
    }
  });
}

module.exports = {
  getAll,
  add,
  remove,
  getOne,
  changeHp
};
