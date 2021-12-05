import {Player,Item} from './object.js'
import {map} from './map.js'
import {death} from './canvas.js'

var ateItemid = null
var killedPlayerid = null
var delflag = true
function frameUpdate(me,pKeys,myRef){
  if(me==null)return
  if(me.dead()){map.kill(me);death(myRef);return}
  if(pKeys['w'])me.addSpeed(0,-1);
  if(pKeys['s'])me.addSpeed(0,1);
  if(pKeys['a'])me.addSpeed(-1,0);
  if(pKeys['d'])me.addSpeed(1,0);
  me.move();
  me.sw_rot(6*(Math.PI/180))
  map.getItems()
  map.getPlayers()
  map.playerUpdateBack(me)
  map.playerUpdate(me)

  for(let i=0;i<map.itemList.length;i++){
    let item = Item.schemaItem(map.itemList[i])
    if(me.trytoeat(item)&&ateItemid != item.id){
      ateItemid = item.id
      item.eaten(me)
      map.ate(item)
    }
  }

  for(let i=0;i<map.playerList.length;i++){
    let player = Player.schemaPlayer(map.playerList[i])
    if(me.trytohit(player)){
      let dmg = me.lv+5
      //todo : 이거 옮기기
      map.damage(player,dmg)
      if(player.dead() && killedPlayerid != player.id){
        killedPlayerid = player.id
        me.xpup(50)
      }
    }
  }
  if(pKeys['q']&&pKeys['w']&&pKeys['e']&&pKeys['r'] && delflag){
    map.deleteAll()
    console.log('deleteall')
    delflag = false
  }
}
export default frameUpdate