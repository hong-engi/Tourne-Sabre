import {Player,Item} from './object.js'
import {map} from './map.js'
var flag = true
var delflag = true
function frameUpdate(player,pKeys){
  if(pKeys['w'])player.move(0,-3);
  if(pKeys['s'])player.move(0,3);
  if(pKeys['a'])player.move(-3,0);
  if(pKeys['d'])player.move(3,0);
  console.log(player.pos.x,player.pos.y)
  map.playerUpdate(player)
  map.getItems()
  map.getPlayers()
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
  player.sw_rot(1*(2*Math.PI/180))
}
export default frameUpdate