const itemModel = require("../models/item")

function getAll(callback) {
  itemModel.find({},(error,result)=>{
    if (error) {
      console.log(error);
      callback([]);
    } else {
      callback(result);
    }
  });
}

function add(item, callback) {
  const newItem = new itemModel({
    x:item.pos.x,
    y:item.pos.y,
    color : item.color,
    xp : item.xp,
    r : item.r
  });
  newItem.save((error,result)=>{
    if(error){
      console.log(error);
    } else {
      callback(result);
    }
  });
}

function remove(id, callback) {
  itemModel.deleteOne({_id: id}, (error) => {
    console.log(error)
    callback();
  });
}

function removeAll(callback){
  itemModel.deleteMany({},(error) => {
    console.log(error)
    callback();
  })
}

function getOne(id, callback) {
  itemModel.findOne({_id: id}, (err, found) => {
    if(err){
      console.log(error);
      callback([]);
    } else {
      callback(found);
    }
  });
}
module.exports = {
  getAll,
  add,
  remove,
  removeAll,
  getOne,
};
