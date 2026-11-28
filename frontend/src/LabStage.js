// Live Lab arena shared by the enemy and codex (skill/spell/augment) tabs:
// the knight is driven locally with the real skill code while the private
// server simulation (backend/src/game/lab.js) owns enemies and damage.
import React, {useEffect, useRef, useState} from 'react';
import {addEffect, drawLabPortrait, drawLabScene} from './mapdraw';
import {Player} from './object';
import {createSkills, updateWeapon} from './skills';
import {ENEMY_NAMES} from './enemyNames';
const {predictPlayer}=require('./bodyPhysics');
const {hazardForces}=require('./hazardGeometry');
const {modifiers}=require('./gameRules');

export const POLL_MS=33;
export const INTERP_DELAY=90;
const DEFAULT_HINT='방향키 이동 · Q 역회전 · W 가속 · E 찌르기 · R 거대화 · D/F 주문 · ⌘+방향키 적 전환';

export function makeLabPlayer(kit={}){
  const me=new Player('나',0,0);
  me.id='lab-dummy';
  if(kit.loadout)me.loadout=[...kit.loadout];
  if(kit.spells)me.spells=[...kit.spells];
  me.augments=[...(kit.augments||[])];
  me.lv=5;me.hp=150;me.hpmax=150;
  me.skills=createSkills();
  me.swordPoses=[];
  me.blades=[];
  return me;
}

// Same hit feedback as the game (frameUpdater's hitEffect).
export function showLabHit(hit){
  if(hit.burst)return addEffect(hit.burst,hit,'');
  if(hit.blocked)return addEffect('shield',hit,'방어');
  if(hit.smite)addEffect('smite',hit,'');
  if(hit.burn)return addEffect(hit.killed?'kill':'burn',hit,hit.killed?'처치':`${hit.damage}`);
  if(hit.deflect&&!hit.damage)return addEffect('deflect',hit,'');
  if(hit.lightning)addEffect('lightning',{...hit,fromX:hit.fromX,fromY:hit.fromY},'');
  if(hit.shockwave)return addEffect('shockwave',hit,'');
  if(hit.killed)return addEffect('kill',hit,'처치');
  if(hit.damage>0)addEffect('impact',hit,`${hit.damage}`);
}

// Static still portrait for the grid (drawn once; zero polling or rAF overhead).
export const LabPortrait=React.memo(function LabPortrait({info,width,height}){
  const ref=useRef(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    const ctx=canvas.getContext('2d',{alpha:false});
    let alive=true;
    const paint=()=>{
      if(!alive)return;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      drawLabPortrait(ctx,info,{width,height},paint);
    };
    paint();
    return ()=>{alive=false;};
  },[info,width,height]);
  return <canvas ref={ref} style={{width,height}} className="lab-canvas" aria-label={`${ENEMY_NAMES[info.type]||info.type} 모습`}/>;
});

// Fullscreen live arena canvas for the single selected enemy at 60fps.
export const LabStage=React.memo(function LabStage({type,tier,scenes,reduced,cameraMode,playable,meRef,keysRef,label,hint=DEFAULT_HINT}){
  const wrapRef=useRef(null);
  const canvasRef=useRef(null);
  useEffect(()=>{
    const wrap=wrapRef.current,canvas=canvasRef.current;
    if(!wrap||!canvas)return;
    const ctx=canvas.getContext('2d',{alpha:false});
    let width=640,height=420,dpr=Math.min(window.devicePixelRatio||1,2);
    const resize=()=>{
      const rect=wrap.getBoundingClientRect();
      width=Math.max(240,Math.floor(rect.width));
      height=Math.max(220,Math.floor(rect.height));
      dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.round(width*dpr);
      canvas.height=Math.round(height*dpr);
    };
    resize();
    let ro;
    if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(resize);ro.observe(wrap);}
    else window.addEventListener('resize',resize);
    const zoom=tier==='boss'?.78:1;
    const camera={x:0,y:0,ready:false};
    let frame=0,lastTime;
    const loop=time=>{
      frame=requestAnimationFrame(loop);
      if(document.hidden){lastTime=undefined;return;}
      const dt=lastTime===undefined?1/60:Math.min(.06,Math.max(0,(time-lastTime)/1000));
      lastTime=time;
      const entry=scenes.current[type];
      if(entry?.resetCamera){camera.ready=false;entry.resetCamera=false;}
      ctx.setTransform(dpr,0,0,dpr,0,0);
      if(entry&&entry.scene){
        const enemies=entry.enemyMotion.sample(time);
        if(playable&&meRef.current){
          const me=meRef.current,keys=keysRef.current||{};
          const elapsed=Math.max(0,time-(entry.at||time));
          const ghost=time<(me.skills.spellUntil.ghost||0)||!!me.combatState?.ghost;
          const mod=modifiers(me.augments);
          const forces=ghost?{slow:1,px:0,py:0}:hazardForces((entry.scene.hazards||[]).map(h=>({...h,armIn:h.armIn-elapsed,left:h.left-elapsed})),me.pos.x,me.pos.y,me.r);
          me.hazardSlow=forces.slow;
          let dx=Number(!!keys.ArrowRight)-Number(!!keys.ArrowLeft);
          let dy=Number(!!keys.ArrowDown)-Number(!!keys.ArrowUp);
          const len=Math.hypot(dx,dy);
          if(len){
            dx/=len;dy/=len;
            const move=mod.movement*(me.skills.pursuitUntil>time?1.6:1)*(time<(me.skills.spellUntil.ghost||0)?1.45:1)*forces.slow*(me.skillSpeed||1);
            me.addSpeed(dx*dt*30*move,dy*dt*30*move);
            me.skills.facing={x:dx,y:dy};
          }
          me.move(dt);
          if(forces.px||forces.py)me.pos.move(forces.px*dt,forces.py*dt);
          me.impactIntent={x:me.speed.x*30,y:me.speed.y*30};
          if(!ghost)predictPlayer(me,enemies.filter(e=>e.hp>0&&!e.passThrough));
          updateWeapon(me,time,dt);
          for(const ev of me.skills.events.splice(0))addEffect(ev.type,ev,'');
          me.swordPoses=me.swordPoses||[];
          for(const b of me.blades||[])me.swordPoses.push(b);
          if(me.swordPoses.length>400)me.swordPoses.splice(0,me.swordPoses.length-400);
          drawLabScene(ctx,entry.scene,{width,height},time,{
            at:entry.at,zoom,reduced,enemies,player:me,projectiles:entry.projectiles,camera,cameraMode,dt,delay:INTERP_DELAY,
          });
        }else{
          const dummy=entry.dummyMotion.sample(time)[0]||entry.scene.dummy;
          drawLabScene(ctx,entry.scene,{width,height},time,{
            at:entry.at,zoom,reduced,enemies,dummy,projectiles:entry.projectiles,camera,cameraMode,dt,delay:INTERP_DELAY,
          });
        }
      }else{
        drawLabScene(ctx,null,{width,height},time,{zoom,reduced});
      }
    };
    frame=requestAnimationFrame(loop);
    return ()=>{
      cancelAnimationFrame(frame);
      if(ro)ro.disconnect();else window.removeEventListener('resize',resize);
    };
  },[type,tier,scenes,reduced,cameraMode,playable,meRef,keysRef]);
  return <div className="lab-stage" ref={wrapRef}>
    <canvas ref={canvasRef} className="lab-stage-canvas" aria-label={label||`${ENEMY_NAMES[type]||type} 실시간 전투`}/>
    {playable&&hint&&<div className="lab-controls-hint">{hint}</div>}
  </div>;
});


// Collapsible sidebar section; open/closed is remembered per id so the memo
// box stays easy to reach (training setup, stats and patterns start folded).
export function LabFold({id,title,children,defaultOpen=false}){
  const key=`lab-fold-${id}`;
  const [open,setOpen]=useState(()=>{
    try{const v=window.localStorage.getItem(key);return v==null?defaultOpen:v==='1';}catch(err){return defaultOpen;}
  });
  return <details className="lab-fold" open={open} onToggle={e=>{
    const next=e.currentTarget.open;if(next===open)return;
    setOpen(next);try{window.localStorage.setItem(key,next?'1':'0');}catch(err){/* private mode */}
  }}>
    <summary>{title}</summary>
    <div className="lab-fold-body">{children}</div>
  </details>;
}
