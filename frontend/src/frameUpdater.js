function frameUpdate(player,pKeys){
  if(pKeys['w'])player.move(0,-3);
  if(pKeys['s'])player.move(0,3);
  if(pKeys['a'])player.move(-3,0);
  if(pKeys['d'])player.move(3,0);
  player.sw_rot(1*(2*Math.PI/180))
}
export default frameUpdate