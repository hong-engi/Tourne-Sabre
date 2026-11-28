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
      await makePlayer(name.trim() || randomNickname(), loadout);
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
    <Loadout loadout={loadout} onChange={change} disabled={joining}/>
    <button type="submit" disabled={disabled || joining}>{joining ? 'ENTERING…' : disabled ? 'CONNECTING…' : 'ENTER THE ARENA'}<span aria-hidden="true">↗</span></button>
    {error && <p className="join-error" role="alert">{error}</p>}
  </form>;
}
