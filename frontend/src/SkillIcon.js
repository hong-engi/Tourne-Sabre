import {useEffect,useRef,useState} from 'react';
import {prepareIcon} from './skillIconOutline';
import reverse from './assets/pixel/skills/reverse.png';
import giant from './assets/pixel/skills/giant.png';
import accel from './assets/pixel/skills/accel.png';
import thrust from './assets/pixel/skills/thrust.png';
import dash from './assets/pixel/skills/dash.png';
import twinBlade from './assets/pixel/skills/twin-blade.png';
import turret from './assets/pixel/skills/turret.png';
import boomerang from './assets/pixel/skills/boomerang.png';
import slam from './assets/pixel/skills/slam.png';
import blink from './assets/pixel/skills/blink.png';
import ghost from './assets/pixel/skills/ghost.png';
import heal from './assets/pixel/skills/heal.png';
import ignite from './assets/pixel/skills/ignite.png';
import barrier from './assets/pixel/skills/barrier.png';
import exhaust from './assets/pixel/skills/exhaust.png';
import smite from './assets/pixel/skills/smite.png';
import crescent from './assets/pixel/skills/crescent.png';
import decoy from './assets/pixel/skills/decoy.png';
import crossScar from './assets/pixel/skills/cross-scar.png';
import needleRain from './assets/pixel/skills/needle-rain.png';
import iaido from './assets/pixel/skills/iaido.png';
import sawThrow from './assets/pixel/skills/saw-throw.png';
import bloodSeal from './assets/pixel/skills/blood-seal.png';
import horizon from './assets/pixel/skills/horizon.png';
import parryStance from './assets/pixel/skills/parry-stance.png';
import bladeVeil from './assets/pixel/skills/blade-veil.png';
import ironStance from './assets/pixel/skills/iron-stance.png';
import frostMail from './assets/pixel/skills/frost-mail.png';
import bloodPact from './assets/pixel/skills/blood-pact.png';
const {SKILLS:SKILL_DEFS,SPELLS:SPELL_DEFS}=require('./gameRules');
const ALL_DEFS=SKILL_DEFS.concat(SPELL_DEFS);

// Bind artwork to ability identity, so changing QWER / DF loadouts follows it.
const ICONS = {reverse,giant,accel,thrust,dash,twinBlade,turret,boomerang,slam,
  blink,ghost,heal,ignite,barrier,exhaust,smite,crescent,decoy,
  crossScar,needleRain,iaido,sawThrow,bloodSeal,horizon,parryStance,bladeVeil,ironStance,frostMail,bloodPact};
const DEFAULT_KEYS = {KeyQ:'reverse',KeyW:'giant',KeyE:'accel',KeyR:'thrust'};
export default function SkillIcon({id,code}) {
  const image=useRef(null);
  const [prepared,setPrepared]=useState(null);
  const iconId = id || DEFAULT_KEYS[code] || code;
  const src = ICONS[iconId];
  useEffect(()=>{
    if(!src||!image.current)return;
    let disposed=false,request=0,lastSize=0;
    const update=()=>{
      if(disposed||!image.current)return;
      const size=Math.max(16,Math.min(64,Math.round(image.current.getBoundingClientRect().width)||40));
      if(size===lastSize)return;
      lastSize=size;const version=++request;
      prepareIcon(src,size).then(url=>{if(!disposed&&version===request)setPrepared({src,url,size});});
    };
    update();
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(update):null;
    observer?.observe(image.current);
    return ()=>{disposed=true;observer?.disconnect();};
  },[src]);
  // Expansion skills have no pixel art yet: show a lettered placeholder.
  if (!src) {
    const def=ALL_DEFS.find(d=>d.id===iconId);
    if (!def) return null;
    return <span className="skill-icon skill-icon-glyph" data-skill-icon={iconId} aria-hidden="true" data-line={def.line||''}>{def.name.slice(0,1)}</span>;
  }
  const ready=prepared?.src===src;
  return <img ref={image} className="skill-icon" src={ready?prepared.url:src} alt="" aria-hidden="true" draggable={false} data-skill-icon={iconId} data-outline-size={ready?prepared.size:undefined} width="40" height="40"/>;
}
