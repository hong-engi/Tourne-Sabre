import React from 'react';
import {SKILLS} from './skills';
import SkillIcon from './SkillIcon';

export default function SkillBar({skills,onActivate,paused}){
  const list=skills&&skills.length?skills:SKILLS;
  return <section className="skill-bar" aria-label="전투 스킬">{list.map(spec=>{
    const skill=skills && skills.find(s=>s.code===spec.code);
    const remaining=skill?skill.remaining:0;
    const active=skill && skill.active;
    const state=paused?'paused':active?'active':remaining>0?'cooldown':'ready';
    const label=state==='paused'?'일시 정지':state==='active'?'발동 중':state==='cooldown'?'재사용 대기':'준비 완료';
    const cooldown=skill?skill.cooldown:spec.cooldown;
    const duration=skill?skill.duration:spec.duration;
    const activeRemaining=skill?skill.activeRemaining:0;
    const recharge=skill?skill.rechargeRemaining:0;
    const progress=state==='active'?Math.max(0,Math.min(1,activeRemaining/(duration||1))):state==='cooldown'?1-remaining/cooldown:skill && skill.charges!==undefined && recharge>0?1-recharge/cooldown:1;
    const blocked=paused||remaining>0||((spec.id||spec.icon)==='thrust' && active);
    const timer=state==='active'?`${(activeRemaining/1000).toFixed(1)}s`:state==='cooldown'?`${(remaining/1000).toFixed(1)}`:null;
    return <button key={spec.code} className={`skill-slot skill-${state}${spec.spell?' skill-spell':''}`} data-state={state} onClick={()=>onActivate(spec.code)} disabled={blocked} aria-label={`${spec.key} ${spec.name}`} aria-describedby={`skill-status-${spec.code}`} title={`${spec.name} · 재사용 ${(cooldown/1000).toFixed(1)}초`}>
      <kbd>{spec.key}</kbd><span className="skill-state-mark" aria-hidden="true">{state==='ready'?'✓':state==='active'?'●':state==='paused'?'Ⅱ':'◷'}</span>
      <span className="skill-visual" aria-hidden="true"><SkillIcon id={spec.icon||spec.id} code={spec.code}/>{state==='cooldown'&&<span className="skill-cooldown-count">{timer}</span>}</span>
      <span className="skill-name">{spec.name}</span>
      <span id={`skill-status-${spec.code}`} className="skill-state-label">{label}</span>
      <span className="skill-detail">{state==='active'?timer:skill && skill.charges!==undefined?`${skill.charges} / ${skill.maxCharges||2}회`:state==='cooldown'?'초':' '}</span>
      <span className="skill-timer-track" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(1,progress))*100}%`}}/></span>
    </button>;
  })}</section>;
}
