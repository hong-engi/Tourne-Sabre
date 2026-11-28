import React, {useState} from 'react';
import {makePlayer} from './canvas';
import Loadout,{loadLoadout,saveLoadout} from './Loadout';

const adjectives=['fluffy','sleepy','tiny','brave','happy','cozy','sunny','bouncy','gentle','lucky','speedy','curious','frosty','mellow','fuzzy','golden','sneaky','clever','silly','cosmic'];
const nouns=['bunny','fox','otter','panda','tiger','badger','raven','gecko','koala','kitten','puppy','turtle','falcon','robin','hedgehog','ferret','hamster','sparrow','capybara','penguin'];
function randomNickname(){
  return adjectives[Math.floor(Math.random()*adjectives.length)]+nouns[Math.floor(Math.random()*nouns.length)];
}

export function Textbox({onJoin, disabled}) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('pve');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  // QWER skills and D/F spells, remembered between visits.
  const [loadout, setLoadout] = useState(loadLoadout);
  function change(next) {setLoadout(next);saveLoadout(next);}
  async function submit(event) {
    event.preventDefault();
    if (joining || disabled) return;
    setJoining(true);
    setError('');
    try {
      await makePlayer(name.trim() || randomNickname(), loadout, mode);
      setJoining(false);
      onJoin();
    } catch (err) {
      setError('The arena is unavailable. Please try again.');
      setJoining(false);
    }
  }
  return <form className="join-form" onSubmit={submit}>
    <label htmlFor="player-name">CHOOSE YOUR NAME</label>
    <input id="player-name" placeholder="Leave blank for a random name" maxLength={18} value={name} onChange={event => setName(event.target.value)} autoComplete="off" disabled={joining}/>
    <div className="mode-select" role="group" aria-label="게임 모드 선택">
      <button type="button" className={`mode-option ${mode==='pve'?'mode-selected':''}`} onClick={()=>setMode('pve')} disabled={joining}>
        <strong>PvE 솔로</strong>
        <span>혼자 플레이 · 증강 선택</span>
      </button>
      <button type="button" className={`mode-option ${mode==='pvp'?'mode-selected':''}`} onClick={()=>setMode('pvp')} disabled={joining}>
        <strong>PvP 멀티</strong>
        <span>경쟁 · 보스 쟁탈 · 증강 잠금</span>
      </button>
    </div>
    <Loadout loadout={loadout} onChange={change} disabled={joining}/>
    <button type="submit" disabled={disabled || joining}>{joining ? 'ENTERING…' : disabled ? 'CONNECTING…' : 'ENTER THE ARENA'}<span aria-hidden="true">↗</span></button>
    {error && <p className="join-error" role="alert">{error}</p>}
  </form>;
}
