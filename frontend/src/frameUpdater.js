import {Player,Item} from './object.js'
import {map} from './map.js'
var ateItemid = null
var flag = true
var delflag = true
function frameUpdate(player,pKeys){
  if(pKeys['w'])player.addSpeed(0,-1);
  if(pKeys['s'])player.addSpeed(0,1);
  if(pKeys['a'])player.addSpeed(-1,0);
  if(pKeys['d'])player.addSpeed(1,0);
  player.move();
  player.sw_rot(6*(Math.PI/180))
  map.playerUpdate(player)
  map.getItems()
  map.getPlayers()

  for(let i=0;i<map.itemList.length;i++){
    let item = Item.schemaItem(map.itemList[i])
    if(player.trytoeat(item)&&ateItemid != item.id){
      ateItemid = item.id
      item.eaten(player)
      console.log(player.xp)
      map.ate(item)
    }
  }

  for(let i=0;i<map.playerList.length;i++){
    let player2 = Player.schemaPlayer(map.playerList[i])
    if(player.trytohit(player2)){
      map.damage(player2,5)
    }
  }

  if(pKeys['.'] && flag){
    var p = new Player('Jane Doe',100,100)
    flag = false
    map.addPlayer(p)
  }
  if(pKeys[',']){
    map.addItem()
    console.log('addItem')
  }
  if(pKeys['q'] && delflag){
    map.deleteAll()
    console.log('deleteall')
    delflag = false
  }
}
export default frameUpdate