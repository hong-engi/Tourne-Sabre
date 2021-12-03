import {Player,Item} from './object.js'
import {map} from './map.js'
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
    if(!item.eatenflag && player.trytoeat(item)){
      item.eaten(player)
      console.log(player.xp)
      map.ate(item)
    }
  }

  for(let i=0;i<map.playerList.length;i++){
    let player2 = Player.schemaPlayer(map.playerList[i])
    if(player.trytohit(player2)){
      console.log('hit',player2.name)
      map.damage(player2,10)
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