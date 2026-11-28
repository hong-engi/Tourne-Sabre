import React, {useCallback, useRef, useState} from 'react';
import Canvas, {activateSkill,setAugmentMenu,chooseAugment,rerollAugment} from './canvas';
import AugmentPicker from './AugmentPicker';
import SkillBar from './SkillBar';
import {Textbox} from './textbox';
import './App.css';
import {reloadIfUpdated,takeSavedRun} from './updates';
import sabreSprite from './assets/pixel/sabre.png';
const {offerCount,xpForLevel}=require('./gameRules');

const clock=ms=>{const t=Math.floor((ms||0)/1000);return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;};

export default function App() {
  const myref = useRef({});
  const [active, setActive] = useState(false);
  const [lastRun, setLastRun] = useState(takeSavedRun);
  const [hud, setHud] = useState(null);
  const [connected, setConnected] = useState(false);
  const onStatus = useCallback((next, online) => {
    setHud(next);
    setConnected(online);
  }, []);
  myref.current.appearThis = (result) => {
    setLastRun(result);
    setActive(false);
    // A run just ended: a good moment to switch to a newer build, if any.
    reloadIfUpdated(result);
  };
  const level = hud ? hud.lv : 1;
  const pending = hud ? Math.max(0,offerCount(level)-(hud.augments||[]).length) : 0;
  const xpFloor = xpForLevel(level);
  const xpNext = xpForLevel(level + 1);
  const xpProgress = hud ? Math.min(100, Math.max(0, (hud.xp - xpFloor) / (xpNext - xpFloor) * 100)) : 0;

  return <main className="game-shell">
    <Canvas myref={myref} onStatus={onStatus}/>
    {!active && <div className="lobby-layer"><section className="lobby-card" aria-labelledby="lobby-title">
      <div className="eyebrow lobby-kicker"><span/> MULTIPLAYER SURVIVAL</div>
      <div className="lobby-emblem" aria-hidden="true"><img className="pixel-sprite" src={sabreSprite} alt=""/><img className="pixel-sprite" src={sabreSprite} alt=""/></div>
      <h1 id="lobby-title">One blade.<br/><em>Endless motion.</em></h1>
      {lastRun && <p className="run-summary" role="status">REIGN ENDED <strong>Level {lastRun.lv} · {lastRun.xp} XP</strong></p>}
      <Textbox disabled={!connected} onJoin={() => {setActive(true); setLastRun(null);}}/>
      <div className="lobby-rules"><span><b>01</b> Move with ↑ ← ↓ →</span><span><b>02</b> QWER · DF 스킬</span></div>
    </section></div>}

    {active && <SkillBar skills={hud && hud.skills} paused={hud && hud.augmentMenuOpen && !hud.augmentLive} onActivate={activateSkill}/>}
    {active && hud && <section className="experience-dock" aria-label="경험치 상태">
      {hud.threat&&<div className="threat-hud" title="40초마다 적이 강해집니다"><span>위협 {hud.threat.level}</span><span>{clock(hud.threat.elapsed)}</span></div>}
      <div className="experience-label"><span>Lv. {level} <button className={`augment-open ${pending?"augment-pending":""}`} onClick={()=>setAugmentMenu(true)}>증강 {pending?`+${pending}`:(hud.augments||[]).length}</button></span><span>{hud.xp} / {xpNext} XP</span></div>
      <div className="experience-track" role="progressbar" aria-label="Experience" aria-valuenow={hud.xp} aria-valuemin={xpFloor} aria-valuemax={xpNext} aria-valuetext={`레벨 ${level}, 다음 레벨까지 ${xpNext - hud.xp} 경험치`}>
        <span className="experience-fill" style={{width:`${xpProgress}%`}}/>
      </div>
    </section>}
    {active && hud && hud.augmentMenuOpen && <AugmentPicker hud={hud} onChoose={chooseAugment} onReroll={rerollAugment} onClose={()=>setAugmentMenu(false)}/>}
  </main>;
}
