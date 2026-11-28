import chip from './assets/pixel/xp-chip.png';
import gem from './assets/pixel/xp-gem.png';
import cluster from './assets/pixel/xp-cluster.png';
import crown from './assets/pixel/xp-crown.png';

export const XP_PICKUPS = [
  {key:'xp-chip', url:chip, min:1, max:3, height:14, name:'조각'},
  {key:'xp-gem', url:gem, min:4, max:7, height:22, name:'보석'},
  {key:'xp-cluster', url:cluster, min:8, max:11, height:30, name:'삼중 결정'},
  {key:'xp-crown', url:crown, min:12, max:Infinity, height:40, name:'왕관 결정'},
];
export function getXpPickup(value) {
  return XP_PICKUPS.find(tier => value <= tier.max) || XP_PICKUPS[XP_PICKUPS.length-1];
}
