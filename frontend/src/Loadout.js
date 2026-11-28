import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {SLOTS} from './skills';
import SkillIcon from './SkillIcon';
const {SKILLS,SPELLS,DEFAULT_SKILLS,DEFAULT_SPELLS,validSkills,validSpells}=require('./gameRules');

const STORAGE_KEY='tourne-sabre-loadout';
export const DEFAULT_LOADOUT={skills:DEFAULT_SKILLS,spells:DEFAULT_SPELLS};
export function loadLoadout() {
  try {
    const saved=JSON.parse(window.localStorage.getItem(STORAGE_KEY)||'null');
    return {skills:validSkills(saved&&saved.skills),spells:validSpells(saved&&saved.spells)};
  } catch (err) {return DEFAULT_LOADOUT;}
}
export function saveLoadout(loadout) {
  try {window.localStorage.setItem(STORAGE_KEY,JSON.stringify(loadout));} catch (err) {/* private mode */}
}
// Put `id` in slot `slot` (0-3 skills, 4-5 spells). If it already sits in
// another slot of the same row, the two trade places.
export function swapInto(loadout,slot,id) {
  const spell=slot>=4,list=[...(spell?loadout.spells:loadout.skills)],index=spell?slot-4:slot;
  const from=list.indexOf(id);
  if (from>=0) list[from]=list[index];
  list[index]=id;
  return spell?{...loadout,spells:list}:{...loadout,skills:list};
}
const defAt=(loadout,slot)=>slot>=4?SPELLS.find(s=>s.id===loadout.spells[slot-4]):SKILLS.find(s=>s.id===loadout.skills[slot]);

function SkillPicker({slot,loadout,onPick,onClose}) {
  const panel=useRef(null);
  const spell=slot>=4,pool=spell?SPELLS:SKILLS,row=spell?loadout.spells:loadout.skills;
  const current=defAt(loadout,slot).id;
  useEffect(()=>{
    const old=document.activeElement;
    panel.current.querySelector('.skill-card-selected')?.focus();
    return ()=>old?.focus();
  },[]);
  function keys(event) {
    if (event.key==='Escape') {event.stopPropagation();onClose();}
    if (event.key==='Tab') {
      const buttons=[...panel.current.querySelectorAll('button')];
      if (event.shiftKey && document.activeElement===buttons[0]) {event.preventDefault();buttons[buttons.length-1].focus();}
      else if (!event.shiftKey && document.activeElement===buttons[buttons.length-1]) {event.preventDefault();buttons[0].focus();}
    }
  }
  // Portal: the popup sits outside the lobby form and its button styles.
  return createPortal(<div className="skill-picker-overlay" onMouseDown={event=>{if (event.target===event.currentTarget) onClose();}}>
    <section ref={panel} className={`skill-picker${spell?' skill-picker-spell':''}`} role="dialog" aria-modal="true" aria-labelledby="skill-picker-title" onKeyDown={keys}>
      <header>
        <div>
          <h2 id="skill-picker-title"><kbd>{SLOTS[slot].key}</kbd>{spell?'주문 고르기':'스킬 고르기'}</h2>
        </div>
        <button type="button" className="skill-picker-close" onClick={onClose}>닫기</button>
      </header>
      <div className="skill-picker-grid">{pool.map(def=>{
        const at=row.indexOf(def.id),selected=def.id===current;
        const tag=selected?'장착 중':at>=0?`${SLOTS[spell?at+4:at].key}와 교체`:null;
        return <button type="button" key={def.id} className={`skill-card${selected?' skill-card-selected':''}`} aria-pressed={selected} onClick={()=>onPick(def.id)}>
          <span className="skill-card-icon"><SkillIcon id={def.id} label={def.name}/></span>
          <span className="skill-card-body">
            <span className="skill-card-title">{def.name}{tag&&<span className="skill-card-tag">{tag}</span>}</span>
            <span className="skill-card-desc">{def.description}</span>
            <span className="skill-card-meta">재사용 {def.cooldown/1000}초{def.duration>0?` · 지속 ${def.duration/1000}초`:''}</span>
          </span>
        </button>;
      })}</div>
    </section>
  </div>,document.body);
}

export default function Loadout({loadout,onChange,disabled}) {
  const [open,setOpen]=useState(null);
  return <div className="loadout">
    <div className="loadout-label" id="loadout-label">LOADOUT <span>· 칸을 눌러 스킬 바꾸기</span></div>
    <div className="loadout-slots" role="group" aria-labelledby="loadout-label">{SLOTS.map((slot,i)=>{
      const def=defAt(loadout,i);
      return <button type="button" key={slot.code} className={`loadout-slot${slot.spell?' loadout-spell':''}`} disabled={disabled}
        aria-haspopup="dialog" aria-label={`${slot.key}: ${def.name} — 바꾸기`} title={def.description} onClick={()=>setOpen(i)}>
        <kbd>{slot.key}</kbd>
        <SkillIcon id={def.id} label={def.name}/>
        <span className="loadout-slot-name">{def.name}</span>
      </button>;
    })}</div>
    {open!==null && <SkillPicker slot={open} loadout={loadout} onClose={()=>setOpen(null)}
      onPick={id=>{onChange(swapInto(loadout,open,id));setOpen(null);}}/>}
  </div>;
}
