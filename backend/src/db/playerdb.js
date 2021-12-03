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
    _id : player.id,
    name:player.name,
    x:player.pos.x,
    y:player.pos.y,
    vx:player.speed.x,
    vy:player.speed.y,
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
    if(error){
      console.log('error',error);
    } else {
      console.log('added',player.name)
      callback(result);
    }
  });
}

function removeAll(callback){
  playerModel.deleteMany({},(error) => {
    console.log(error)
    callback();
  })
}

function remove(player, callback) {
  playerModel.deleteOne({_id: player.id}, (error) => {
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

function update(player, callback) {
  playerModel.updateOne({_id: player.id}, 
    {
      x:player.pos.x,
      y:player.pos.y,
      r:player.r,
      vx:player.speed.x,
      vy:player.speed.y,
      sw_angle:player.sw_angle,
      sw_r:player.sw_r,
      hp:player.hp,
      xp:player.xp,
    },
    () => {
    callback();
  });
}

function damage(id, dhp, callback) {
  playerModel.findOne({_id: id}, (err, found) => {
    if(err){
      console.log(error);
      callback([]);
    } else {
      if(found == null){
        console.log(id)
        return;
      }
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
  removeAll,
  getOne,
  update,
  damage
};
