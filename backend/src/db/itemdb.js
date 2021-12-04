const itemModel = require("../models/item")

function getAll(callback) {
  itemModel.find({},(error,result)=>{
    if (error) {
      console.log('itemgetall',error);
      callback([]);
    } else {
      callback(result);
    }
  });
}

function add(item, callback) {
  const newItem = new itemModel({
    _id : item.id,
    x:item.pos.x,
    y:item.pos.y,
    color : item.color,
    xp : item.xp,
    r : item.r
  });
  newItem.save((error,result)=>{
    if(error){
      console.log('itemadd',error);
    } else {
      callback(result);
    }
  });
}

function update(item, callback) {
  itemModel.updateOne({_id: item.id}, 
    {
      x:item.pos.x,
      y:item.pos.y,
      color : item.color,
      xp : item.xp,
      r : item.r
    },
    () => {
    callback();
  });
}
function remove(id, callback) {
  itemModel.deleteOne({_id: id}, (error) => {
    if(error)
      console.log('itemremove',error)
    callback();
  });
}

function removeAll(callback){
  itemModel.deleteMany({},(error) => {
    if(error)
      console.log('itemremoveall',error)
    callback();
  })
}

function getOne(id, callback) {
  itemModel.findOne({_id: id}, (err, found) => {
    if(err){
      console.log('itemgetone',error);
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
  update,
  removeAll,
  getOne,
};
