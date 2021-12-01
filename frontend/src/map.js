import { Player,Item } from "./object";

//나중에 데이터베이스로 이전
var map = [];
for(let i=0;i<40;i++)
    map.push(Player.randomPlayer())
for(let i=0;i<1000;i++)
    map.push(Item.randomItem())

export {map}