import {useRef, useEffect} from 'react';
import {Player} from './object';
import draw, {resetEffects, addEffect} from './mapdraw';
import {map} from './map';
import frameUpdate from './frameUpdater';
import socketIOClient from 'socket.io-client';
import {bindGameInput} from './input';
import {createSkills, activate, skillSnapshot} from './skills';
import {API_ORIGIN} from './apiConfig';
const {offerCount,DEFAULT_SPELLS,DEFAULT_SKILLS}=require('./gameRules');

const socket = socketIOClient(API_ORIGIN, {transports: ['websocket']});
map.attachSocket(socket);
let player = null;
const isStealthed = p => Boolean(p && (p.stealthUntil || 0) > map.serverNow());
const makePlayer = async (name, loadout={skills:DEFAULT_SKILLS,spells:DEFAULT_SPELLS}, mode='pve') => {
  const next = new Player(name);
  next.loadout = [...loadout.skills];
  next.spells = [...loadout.spells];
  next.skills = createSkills();
  next.mode = mode === 'pvp' ? 'pvp' : 'pve';
  next.augmentMenuOpen=false;
  map.reset();
  map.onBlast=blast=>addEffect('bomb',blast,'');
  await map.addPlayer(next);
  player = next;
  map.setActivePlayer(player);
  resetEffects();
};
function death(myref) {
  const result = player && {lv: player.lv, xp: player.xp};
  player = null;
  map.setActivePlayer(null);
  resetEffects();
  myref.current.appearThis(result);
}

export function activateSkill(code) {
  if (!player || isStealthed(player)) return;
  const from={x:player.pos.x,y:player.pos.y};
  const cast=activate(player, code, performance.now());
  if (cast==='blink') {addEffect('blink',from,'');addEffect('blink',player.pos,'');}
  if (cast==='ghost') addEffect('ghost',player.pos,'유체화');
  if (cast==='slam') addEffect('slam',from,'');
  if (cast==='turret') addEffect('turret',from,'');
  if (cast==='ignite') addEffect('ignite',player.pos,'점화');
  if (cast==='exhaust') addEffect('exhaust',player.pos,'탈진');
  // Spells whose effect the server owns.
  if (['heal','barrier','ignite','exhaust','smite'].includes(cast)) {
    const current=player,before=current.hp;
    map.castSpell(current,cast).then(()=>{
      if (cast==='heal') addEffect('heal',current.pos,`+${Math.max(0,current.hp-before)}`);
      if (cast==='barrier') addEffect('shield',current.pos,'방벽');
    }).catch(err=>console.warn('Spell:',err.message));
  }
}
export function setAugmentMenu(open) {
  if(!player)return;
  if(open && player.mode === 'pvp') return;
  player.augmentMenuOpen=open;player.augmentMenuAt=0;
  player.augmentPaused=open&&!map.sharedArena(player.id);
}
export async function switchMode(targetMode) {
  if(!player)return;
  await map.switchMode(player, targetMode);
  resetEffects();
  addEffect('level', player.pos, targetMode === 'pvp' ? 'PvP 진입 · 5초 은신' : '새 PvE 아레나 시작');
}
export async function chooseAugment(id) {
  if(!player)return;
  const current=player;
  await map.chooseAugment(current,id);
  current.augmentMenuOpen=current.augments.length<offerCount(current.lv);
  current.augmentPaused=current.augmentMenuOpen&&!map.sharedArena(current.id);
  addEffect('level',current.pos,'증강 획득');
}
export async function rerollAugment(index) {
  if(player)await map.rerollAugment(player,index);
}
export default function Canvas({myref, onStatus}) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let size = {width: 0, height: 0, dpr: 1};
    let animation;
    let previousTime;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resize = () => {
      size = {width: window.innerWidth, height: window.innerHeight, dpr: Math.min(window.devicePixelRatio || 1, 2)};
      canvas.width = Math.round(size.width * size.dpr);
      canvas.height = Math.round(size.height * size.dpr);
    };
    const input = bindGameInput(window, () => !!player && !player.augmentPaused, activateSkill);
    resize();
    window.addEventListener('resize', resize);
    const status = setInterval(() => {
      const sNow = map.serverNow();
      onStatus(player ? {
        name: player.name, hp: player.hp, hpmax: player.hpmax, xp: player.xp, lv: player.lv,
        skills: skillSnapshot(player, performance.now()), direction: player.skills.direction,
        enemies: map.enemyList.length, augments: [...player.augments],
        augmentMenuOpen: player.augmentMenuOpen, augmentLive: !!player.augmentMenuOpen && !player.augmentPaused,
        augmentOffer: player.augmentOffer || null, spells: player.spells, threat: map.threat,
        mode: player.mode || 'pve',
        stealthLeft: Math.max(0, (player.stealthUntil || 0) - sNow),
        pveCooldownLeft: Math.max(0, (player.pveCooldownUntil || 0) - sNow),
        pveFreeLeft: Math.max(0, (player.pveFreeUntil || 0) - sNow),
        bossBuffLeft: Math.max(0, (player.bossBuffUntil || 0) - sNow),
      } : null, socket.connected);
    }, 100);
    const render = time => {
      const dt=previousTime===undefined?1/60:Math.min(1/30,Math.max(0,(time-previousTime)/1000));
      previousTime=time;
      if(player)frameUpdate(player,input.keys,myref,time,dt);
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      draw(ctx, player, size, time, reducedMotion.matches);
      animation = window.requestAnimationFrame(render);
    };
    animation = window.requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animation);
      clearInterval(status);
      window.removeEventListener('resize', resize);
      input.dispose();
    };
  }, [myref, onStatus]);
  return <canvas ref={canvasRef} className="arena-canvas" id="gameboard" aria-label="Game arena. Use arrow keys to move and Q W E R for skills, including with a Korean keyboard."/>;
}
export {makePlayer, death};
