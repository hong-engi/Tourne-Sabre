import React, {useCallback, useRef, useState} from 'react';
import Canvas, {activateSkill,setAugmentMenu,chooseAugment,rerollAugment,switchMode} from './canvas';
import AugmentPicker from './AugmentPicker';
import SkillBar from './SkillBar';
import {Textbox} from './textbox';
import './App.css';
import {reloadIfUpdated,takeSavedRun} from './updates';
import sabreSprite from './assets/pixel/sabre.png';
const {offerCount,xpForLevel}=require('./gameRules');

const clock=ms=>{const t=Math.max(0,Math.ceil((ms||0)/1000));return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;};

export default function App() {
  const myref = useRef({});
  const [active, setActive] = useState(false);
  const [lastRun, setLastRun] = useState(takeSavedRun);
  const [hud, setHud] = useState(null);
  const [connected, setConnected] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const onStatus = useCallback((next, online) => {
    setHud(next);
    setConnected(online);
  }, []);
  myref.current.appearThis = (result) => {
    setLastRun(result);
    setActive(false);
    setSwitching(false);
    setSwitchError('');
    // A run just ended: a good moment to switch to a newer build, if any.
    reloadIfUpdated(result);
  };
  const level = hud ? hud.lv : 1;
  const mode = (hud && hud.mode) || 'pve';
  const isPvp = mode === 'pvp';
  const pending = hud ? Math.max(0,offerCount(level)-(hud.augments||[]).length) : 0;
  const xpFloor = xpForLevel(level);
  const xpNext = xpForLevel(level + 1);
  const xpProgress = hud ? Math.min(100, Math.max(0, (hud.xp - xpFloor) / (xpNext - xpFloor) * 100)) : 0;
  const stealthLeft = (hud && hud.stealthLeft) || 0;
  const pveCooldownLeft = (hud && hud.pveCooldownLeft) || 0;
  const pveFreeLeft = (hud && hud.pveFreeLeft) || 0;
  const bossBuffLeft = (hud && hud.bossBuffLeft) || 0;
  const canExitPvp = pveFreeLeft > 0 || pveCooldownLeft <= 0;

  async function handleModeSwitch(target) {
    if (switching) return;
    setSwitching(true);
    setSwitchError('');
    try {
      await switchMode(target);
    } catch (err) {
      setSwitchError(err.message || '모드 전환에 실패했습니다.');
    } finally {
      setSwitching(false);
    }
  }

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

    {active && hud && <div className="mode-hud" aria-label="게임 모드 상태">
      <div className="mode-hud-row">
        <span className={`mode-badge ${isPvp?'mode-pvp':'mode-pve'}`}>{isPvp ? 'PvP 멀티' : 'PvE 솔로'}</span>
        {!isPvp ? (
          <button type="button" className="mode-switch-btn" disabled={switching} onClick={()=>handleModeSwitch('pvp')}>
            {switching ? '이동 중…' : 'PvP로 이동'}
          </button>
        ) : (
          <button type="button" className={`mode-switch-btn ${pveFreeLeft>0?'mode-switch-free':''}`} disabled={switching || !canExitPvp} onClick={()=>handleModeSwitch('pve')}>
            {switching ? '이동 중…' : pveFreeLeft > 0 ? `PvE로 이동 (무료 ${Math.ceil(pveFreeLeft/1000)}s)` : pveCooldownLeft > 0 ? `PvE 전환 ${clock(pveCooldownLeft)}` : 'PvE로 이동'}
          </button>
        )}
      </div>
      {stealthLeft > 0 && <div className="mode-pill mode-pill-stealth">은신 {(stealthLeft/1000).toFixed(1)}초 · 이동만 가능</div>}
      {bossBuffLeft > 0 && <div className="mode-pill mode-pill-buff">보스 처치 버프 {Math.ceil(bossBuffLeft/1000)}초 (+25% 공 · +15% 이속)</div>}
      {switchError && <div className="mode-pill mode-pill-error" role="alert">{switchError}</div>}
    </div>}

    {active && <SkillBar skills={hud && hud.skills} paused={(hud && hud.augmentMenuOpen && !hud.augmentLive) || stealthLeft > 0} onActivate={activateSkill}/>}
    {active && hud && <section className="experience-dock" aria-label="경험치 상태">
      {hud.threat&&<div className="threat-hud" title="레벨에 따라 적이 강해집니다"><span>위협 {hud.threat.level}</span><span>{isPvp ? '주변 최대 레벨 기준' : '내 레벨 기준'}</span></div>}
      <div className="experience-label">
        <span>Lv. {level} {isPvp ? (
          <button className="augment-open augment-locked" disabled title="PvP에서는 증강을 선택할 수 없습니다">증강 {pending?`+${pending}`:(hud.augments||[]).length} (PvE 전용)</button>
        ) : (
          <button className={`augment-open ${pending?"augment-pending":""}`} onClick={()=>setAugmentMenu(true)}>증강 {pending?`+${pending}`:(hud.augments||[]).length}</button>
        )}</span>
        <span>{hud.xp} / {xpNext} XP</span>
      </div>
      <div className="experience-track" role="progressbar" aria-label="Experience" aria-valuenow={hud.xp} aria-valuemin={xpFloor} aria-valuemax={xpNext} aria-valuetext={`레벨 ${level}, 다음 레벨까지 ${xpNext - hud.xp} 경험치`}>
        <span className="experience-fill" style={{width:`${xpProgress}%`}}/>
      </div>
    </section>}
    {active && hud && !isPvp && hud.augmentMenuOpen && <AugmentPicker hud={hud} onChoose={chooseAugment} onReroll={rerollAugment} onClose={()=>setAugmentMenu(false)}/>}
  </main>;
}
