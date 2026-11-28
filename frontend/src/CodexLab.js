// Lab codex tabs (?lab&tab=skill|spell|augment): every skill, spell and
// augment as a card with a looping effect sketch; clicking one opens a live
// training ground where the knight carries it and the real skill engine
// (client skills.js + server skillEngine.js) draws its effects. Situations the
// effect needs (low health, weak enemies, a boss, a crowd…) are set up from
// codexScenario.js. Feedback is saved to tools/feedback/feedback.json.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {addEffect, resetEffects} from './mapdraw';
import {MotionBuffer} from './motion';
import {mergeShots} from './map';
import {bindGameInput} from './input';
import {activate, addKills, skillSnapshot} from './skills';
import {LabFold, LabStage, makeLabPlayer, showLabHit, POLL_MS, INTERP_DELAY} from './LabStage';
import {scenarioFor, SKILL_CODES, SPELL_CODES} from './codexScenario';
const rules=require('./gameRules');
const {catalog}=require('./codexCatalog');
const preview=require('./codexPreview');
const {setWorld,applyBookResult}=require('./skillCasts');

const API='http://localhost:8080/lab';
const AUTO_EVERY=350;
const LEVEL_UP_EVERY=3000;
const SECTION_NAMES={skill:'스킬',spell:'주문',augment:'증강'};
const TIER_ORDER=['silver','gold','prismatic','transcendent'];
const TIER_LABEL={silver:'실버',gold:'골드',prismatic:'프리즘',transcendent:'초월'};
const nameOf=id=>[...rules.SKILLS,...rules.SPELLS].find(s=>s.id===id)?.name||id;

export function filterItems(items,{query='',tier='all',written='all'},feedback){
  const q=query.trim().toLowerCase();
  return items.filter(i=>{
    if(tier!=='all'&&i.tier!==tier)return false;
    if(written==='done'&&!feedback[i.id])return false;
    if(written==='todo'&&feedback[i.id])return false;
    if(!q)return true;
    return [i.id,i.name,i.description,i.meta,feedback[i.id]?.text].some(s=>s&&s.toLowerCase().includes(q));
  });
}

// One requestAnimationFrame loop for every card canvas on screen.
function usePreviewLoop(reduced){
  const visible=useRef(new Set());
  const observer=useRef(null);
  // Card refs attach before effects run, so the observer is created lazily.
  const observe=useCallback(canvas=>{
    if(typeof IntersectionObserver==='undefined')return;
    if(!observer.current)observer.current=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting?visible.current.add(e.target):visible.current.delete(e.target)));
    observer.current.observe(canvas);
  },[]);
  useEffect(()=>{
    let frame=0;
    const loop=now=>{
      frame=requestAnimationFrame(loop);
      if(document.hidden)return;
      visible.current.forEach(cv=>{
        if(!cv.isConnected){visible.current.delete(cv);observer.current?.unobserve(cv);return;}
        preview.draw(cv._ctx,cv._item,reduced?900:now,{reduced,scale:cv._scale});
      });
    };
    frame=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(frame);
  },[reduced]);
  useEffect(()=>()=>{observer.current?.disconnect();observer.current=null;visible.current.clear();},[]);
  return useCallback((canvas,item)=>{
    if(!canvas||canvas._item===item)return;
    const scale=Math.min(window.devicePixelRatio||1,2);
    canvas.width=preview.W*scale;canvas.height=preview.H*scale;
    canvas._ctx=canvas.getContext('2d');canvas._item=item;canvas._scale=scale;
    if(!canvas._ctx)return;
    preview.draw(canvas._ctx,item,900,{reduced:true,scale});
    observe(canvas);
  },[observe]);
}

function FeedbackEditor({id,entry,onSave}){
  const [text,setText]=useState(entry?.text||'');
  const [saved,setSaved]=useState('saved');
  const timer=useRef(null),latest=useRef(text);
  latest.current=text;
  useEffect(()=>{setText(entry?.text||'');setSaved('saved');},[id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save=useCallback(async(next=latest.current)=>{
    clearTimeout(timer.current);setSaved('saving');
    try{await onSave(id,next);setSaved('saved');}catch(err){setSaved('error');}
  },[onSave,id]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return <div className="lab-note">
    <div className="lab-note-head">
      <label htmlFor="codex-feedback">피드백</label>
      <span className={`lab-saved ${saved}`}>{{saved:'저장됨',saving:'저장 중…',dirty:'입력 중',error:'저장 실패'}[saved]}</span>
    </div>
    <textarea id="codex-feedback" value={text} placeholder="예: 이펙트가 너무 작아서 안 보임. 범위 그대로 두고 잔상을 더 길게."
      onChange={e=>{setText(e.target.value);setSaved('dirty');clearTimeout(timer.current);const v=e.target.value;timer.current=setTimeout(()=>save(v),700);}}
      onBlur={()=>saved==='dirty'&&save()}
      onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&(e.key==='s'||e.key==='Enter')){e.preventDefault();save();}}}/>
    <p className="lab-hint">자동 저장 · ⌘/Ctrl+S · 저장 위치 <code>tools/feedback/feedback.json</code></p>
  </div>;
}

// Situation toggles start from the scenario and can be changed by hand.
function initialOptions(sc){
  return {auto:sc.autoCodes.length>0,lowHp:sc.hpRatio<1,hpRatio:sc.hpRatio<1?sc.hpRatio:.3,
    enemyLow:sc.setup.enemyHp<1,enemyHp:sc.setup.enemyHp<1?sc.setup.enemyHp:.3,
    crowd:sc.setup.pack>4,boss:sc.setup.boss,far:sc.setup.far,frozen:sc.setup.frozen,levelUp:sc.levelUp};
}
function setupFrom(sc,o){
  return {...sc.setup,pack:o.crowd?7:4,enemyHp:o.enemyLow?o.enemyHp:1,boss:o.boss,far:o.far,frozen:o.frozen};
}

function nearestEnemy(me,enemies){
  let best=null,dist=Infinity;
  for(const e of enemies||[]){if(!(e.hp>0))continue;const d=Math.hypot(e.x-me.pos.x,e.y-me.pos.y);if(d<dist){dist=d;best=e;}}
  return best;
}

function CodexArena({item,onClose,onStep,canStep,feedback,onSave}){
  const scenario=useMemo(()=>scenarioFor(item),[item]);
  const [opts,setOpts]=useState(()=>initialOptions(scenario));
  const [reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false);
  const [error,setError]=useState(null);
  const [run,setRun]=useState(0);
  const [hud,setHud]=useState({hp:0,hpmax:1,hits:0,taken:0});
  const scenes=useRef({});
  const meRef=useRef(null);
  const keysRef=useRef({});
  const pendingSpells=useRef([]);
  const key=`codex:${item.id}`;
  const setup=useMemo(()=>setupFrom(scenario,opts),[scenario,opts]);
  const setupKey=JSON.stringify(setup);
  const optsRef=useRef(opts);optsRef.current=opts;
  const lockHp=me=>{
    const o=optsRef.current;
    if(o.lowHp){const cap=Math.max(1,Math.round(me.hpmax*o.hpRatio));if(me.hp>cap||me.hp<=0)me.hp=cap;}
    else if(me.hp<=0)me.hp=me.hpmax;
  };

  // Fresh knight with this item's kit whenever the setup or run changes.
  useEffect(()=>{
    const me=makeLabPlayer(scenario);
    me.lv=setup.lv;me.hpmax=setup.hpmax;me.hp=setup.hpmax;lockHp(me);
    meRef.current=me;
    resetEffects();pendingSpells.current=[];
    delete scenes.current[key];
    const cast=code=>{
      const me=meRef.current;if(!me)return;
      const from={x:me.pos.x,y:me.pos.y},id=activate(me,code,performance.now());
      if(!id)return;
      if(id==='blink'){addEffect('blink',from,'');addEffect('blink',me.pos,'');}
      if(id==='ghost')addEffect('ghost',me.pos,'유체화');
      if(id==='slam')addEffect('slam',from,'');
      if(id==='turret')addEffect('turret',from,'');
      if(id==='ignite')addEffect('ignite',me.pos,'점화');
      if(id==='exhaust')addEffect('exhaust',me.pos,'탈진');
      if(id==='barrier')addEffect('shield',me.pos,'방벽');
      if(id==='heal'){
        const mod=rules.modifiers(me.augments),before=me.hp;
        me.hp=Math.min(me.hpmax,me.hp+Math.round(me.hpmax*.3*mod.healScale));
        addEffect('heal',me.pos,`+${me.hp-before}`);lockHp(me);
      }
      if(['ignite','exhaust','smite'].includes(id))pendingSpells.current.push(id);
    };
    meRef.current.cast=cast;
    const input=bindGameInput(window,()=>true,cast);
    keysRef.current=input.keys;
    return ()=>{input.dispose();keysRef.current={};};
  },[item.id,setupKey,run]); // eslint-disable-line react-hooks/exhaustive-deps

  // Server step loop + auto-cast + level-up situation.
  useEffect(()=>{
    let stop=false,timer;
    const nextTry={};let nextLevel=performance.now()+1200;
    const poll=async()=>{
      const started=performance.now(),me=meRef.current;
      if(!document.hidden&&me){
        const o=optsRef.current,entry=scenes.current[key];
        const enemies=entry?.scene?.enemies||[];
        if(o.auto)for(const code of scenario.autoCodes){
          if(started<(nextTry[code]||0))continue;
          nextTry[code]=started+AUTO_EVERY;
          const target=nearestEnemy(me,enemies);
          if(target){const dx=target.x-me.pos.x,dy=target.y-me.pos.y,l=Math.hypot(dx,dy)||1;me.skills.facing={x:dx/l,y:dy/l};}
          me.cast(code);
        }
        if(o.levelUp&&started>=nextLevel){
          nextLevel=started+LEVEL_UP_EVERY;me.lv+=1;
          addEffect('levelUp',{...me.pos,id:me.id},`Lv. ${me.lv}`);
          if(rules.modifiers(me.augments).nova){me.skills.bursts.push({kind:'nova',x:me.pos.x,y:me.pos.y});addEffect('nova',me.pos,'');}
        }
        try{
          const body={x:me.pos.x,y:me.pos.y,vx:me.speed.x*30,vy:me.speed.y*30,
            sw_angle:me.sw_angle,sw_r:me.sw_r,sw_w:me.sw_w,sw_h:me.sw_h,
            poses:me.swordPoses.splice(0),bursts:me.skills.bursts.splice(0),skillState:skillSnapshot(me,started),
            hp:me.hp,setup,spellCasts:pendingSpells.current.splice(0)};
          const res=await fetch(`${API}/codex/${item.id}/step`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
          if(!res.ok)throw new Error('step failed');
          const scene=await res.json(),at=performance.now();
          if(stop)return;
          setWorld(scene.enemies||[]);
          (scene.attackHits||[]).forEach(showLabHit);
          const result={...(scene.attack||{}),hits:scene.attackHits||[]};
          applyBookResult(me,result,at);
          addKills(me,result.hits.filter(h=>h.killed).length,at);
          if(result.heal>0){me.hp=Math.min(me.hpmax,me.hp+result.heal);addEffect('heal',me.pos,`+${result.heal}`);}
          if(result.hpCost>0)me.hp=Math.max(1,me.hp-result.hpCost);
          if(result.shieldGained||result.shield||result.shieldAdd)addEffect('shield',me.pos,'보호막');
          for(const c of scene.corrections||[]){me.pos.x+=c.dx||0;me.pos.y+=c.dy||0;me.speed.x+=(c.dvx||0)/30;me.speed.y+=(c.dvy||0)/30;}
          if(scene.damageTaken>0){addEffect('hurt',me.pos,`−${scene.damageTaken}`);me.hp-=scene.damageTaken;}
          lockHp(me);
          let next=scenes.current[key];
          if(!next){next={enemyMotion:new MotionBuffer(INTERP_DELAY),dummyMotion:new MotionBuffer(INTERP_DELAY),projectiles:{list:[],at:0},seenBlasts:new Set()};scenes.current[key]=next;}
          next.scene=scene;next.at=at;
          next.enemyMotion.push(scene.enemies||[],at);
          next.projectiles=mergeShots(next.projectiles,scene.projectiles||[],at);
          for(const blast of scene.blasts||[]){if(next.seenBlasts.has(blast.id))continue;next.seenBlasts.add(blast.id);addEffect('bomb',blast,'');}
          if(next.seenBlasts.size>200)next.seenBlasts=new Set([...next.seenBlasts].slice(-50));
          setHud(h=>{const n={hp:Math.round(me.hp),hpmax:me.hpmax,hits:scene.hits,taken:scene.damage};
            return h.hp===n.hp&&h.hpmax===n.hpmax&&h.hits===n.hits&&h.taken===n.taken?h:n;});
          setError(null);
        }catch(err){if(!stop)setError('훈련장 응답이 없습니다. 백엔드(8080)가 실행 중인지 확인하세요.');}
      }
      if(!stop)timer=setTimeout(poll,Math.max(0,POLL_MS-(performance.now()-started)));
    };
    poll();
    return ()=>{stop=true;clearTimeout(timer);};
  },[item.id,setupKey,run,scenario]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    const onKey=e=>{
      if(['TEXTAREA','INPUT','SELECT'].includes(e.target.tagName))return;
      if(e.key==='Escape')onClose();
      else if(e.metaKey&&canStep&&['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.key)){
        e.preventDefault();onStep(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1);
      }
    };
    window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);
  },[onClose,onStep,canStep]);

  const restart=()=>{
    fetch(`${API}/codex/${item.id}/reset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({setup})}).catch(()=>{});
    setRun(r=>r+1);
  };
  const toggle=k=>e=>setOpts(o=>({...o,[k]:e.target.checked}));
  const keyHint=['방향키 이동',
    ...scenario.loadout.map((id,i)=>`${SKILL_CODES[i].slice(3)} ${nameOf(id)}`),
    ...scenario.spells.map((id,i)=>`${SPELL_CODES[i].slice(3)} ${nameOf(id)}`)].join(' · ');
  const needs=item.requires?.length?item.requires.map(nameOf).join(item.requiresAll?' + ':' 또는 '):null;

  return <div className="lab-modal" role="dialog" aria-modal="true" aria-label={`${item.name} 실전 미리보기`}>
    <header className="lab-modal-bar">
      <div className="lab-modal-title">
        <h2>{item.name}</h2>
        <code>{item.id}</code>
        <span className={`lab-tier codex-${item.tier||item.section}`}>{item.group}</span>
      </div>
      <div className="lab-modal-controls">
        {scenario.autoCodes.length>0&&<label><input type="checkbox" checked={opts.auto} onChange={toggle('auto')}/> 자동 시전</label>}
        <label><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/> 모션 감소</label>
        <button className="lab-ghost" onClick={restart}>처음부터</button>
        {canStep&&<div className="lab-nav">
          <button className="lab-ghost" onClick={()=>onStep(-1)} aria-label="이전 항목" title="이전 (⌘+←/↑)">←</button>
          <button className="lab-ghost" onClick={()=>onStep(1)} aria-label="다음 항목" title="다음 (⌘+→/↓)">→</button>
        </div>}
        <button className="lab-close" onClick={onClose} aria-label="목록으로">×</button>
      </div>
    </header>
    {error&&<p className="lab-error codex-error" role="alert">{error}</p>}
    <div className="lab-modal-body">
      <LabStage type={key} tier={opts.boss?'boss':'normal'} scenes={scenes} reduced={reduced} cameraMode="player" playable
        meRef={meRef} keysRef={keysRef} label={`${item.name} 실전 미리보기`} hint={keyHint}/>
      <aside className="lab-sidebar">
        <p className="lab-summary">{item.description}</p>
        {item.meta&&<p className="lab-hint">{item.meta}</p>}
        <LabFold id="codex-situation" title={`훈련장 상황${scenario.situations.length?` · ${scenario.situations.length}개 적용`:''}`}>
        <section className="codex-situation" aria-label="발동 상황">
          <p className="lab-hint">{needs?`필요 스킬 ${needs}을(를) 장착했습니다. `:''}
            {scenario.autoCodes.length?'자동 시전이 켜져 있으면 대기시간마다 가장 가까운 적을 향해 씁니다.':'검이 돌며 적을 베는 동안 효과가 발동합니다.'}</p>
          {scenario.situations.length>0&&<ul>{scenario.situations.map(s=><li key={s}>{s}</li>)}</ul>}
          <div className="codex-toggles">
            <label><input type="checkbox" checked={opts.lowHp} onChange={toggle('lowHp')}/> 내 체력 {Math.round(opts.hpRatio*100)}%</label>
            <label><input type="checkbox" checked={opts.enemyLow} onChange={toggle('enemyLow')}/> 적 체력 {Math.round(opts.enemyHp*100)}%</label>
            <label><input type="checkbox" checked={opts.crowd} onChange={toggle('crowd')}/> 적 무리</label>
            <label><input type="checkbox" checked={opts.boss} onChange={toggle('boss')}/> 보스</label>
            <label><input type="checkbox" checked={opts.far} onChange={toggle('far')}/> 멀리 있는 적</label>
            <label><input type="checkbox" checked={opts.frozen} onChange={toggle('frozen')}/> 적 고정</label>
            <label><input type="checkbox" checked={opts.levelUp} onChange={toggle('levelUp')}/> 레벨업 연출</label>
          </div>
        </section>
        </LabFold>
        <LabFold id="codex-stats" title={`통계 · 체력 ${hud.hp}/${hud.hpmax}`}>
        <dl className="lab-stats">
          <div><dt>내 체력</dt><dd>{hud.hp} / {hud.hpmax}</dd></div>
          <div><dt>받은 피해</dt><dd>{hud.hits}회 / {hud.taken}</dd></div>
        </dl>
        </LabFold>
        <FeedbackEditor key={item.id} id={item.id} entry={feedback} onSave={onSave}/>
      </aside>
    </div>
  </div>;
}

export default function CodexLab({section}){
  const items=useMemo(()=>catalog(rules).filter(i=>i.section===section),[section]);
  const [feedback,setFeedback]=useState({});
  const [query,setQuery]=useState('');
  const [tier,setTier]=useState('all');
  const [written,setWritten]=useState('all');
  const [selected,setSelected]=useState(()=>new URLSearchParams(window.location.search).get('item'));
  const [error,setError]=useState(null);
  const reduced=useMemo(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false,[]);
  const attach=usePreviewLoop(reduced);

  useEffect(()=>{
    fetch(`${API}/feedback`).then(r=>r.json()).then(f=>{setFeedback(f||{});setError(null);})
      .catch(()=>setError('백엔드(8080)에 연결할 수 없어 피드백을 불러오지 못했습니다. 카드 미리보기는 그대로 볼 수 있습니다.'));
  },[]);
  useEffect(()=>{
    const url=new URL(window.location.href);
    if(selected)url.searchParams.set('item',selected);else url.searchParams.delete('item');
    window.history.replaceState(null,'',url);
  },[selected]);

  const shown=useMemo(()=>filterItems(items,{query,tier,written},feedback),[items,query,tier,written,feedback]);
  const current=items.find(i=>i.id===selected);
  const tiers=section==='augment'?[['all','전체'],...TIER_ORDER.map(t=>[t,TIER_LABEL[t]])]:null;
  const count=items.filter(i=>feedback[i.id]).length;

  const saveFeedback=useCallback(async(id,text)=>{
    const res=await fetch(`${API}/feedback/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    if(!res.ok)throw new Error('save failed');
    const saved=await res.json();
    setFeedback(f=>{const next={...f};if(saved)next[id]=saved;else delete next[id];return next;});
  },[]);
  const step=useCallback(delta=>{
    const list=shown.length?shown:items,idx=list.findIndex(i=>i.id===selected);
    if(idx>=0)setSelected(list[(idx+delta+list.length)%list.length].id);
  },[shown,items,selected]);
  const close=useCallback(()=>setSelected(null),[]);

  let lastGroup='';
  return <>
    <div className="lab-toolbar">
      {tiers&&<div className="lab-tabs" role="tablist" aria-label="증강 등급">
        {tiers.map(([k,l])=><button key={k} role="tab" aria-selected={tier===k} className={tier===k?'on':''} onClick={()=>setTier(k)}>
          {l}<em>{k==='all'?items.length:items.filter(i=>i.tier===k).length}</em></button>)}
      </div>}
      <input className="lab-search" type="search" placeholder="이름·설명·피드백 검색" value={query} onChange={e=>setQuery(e.target.value)} aria-label={`${SECTION_NAMES[section]} 검색`}/>
      <select className="lab-select" value={written} onChange={e=>setWritten(e.target.value)} aria-label="피드백 작성 여부">
        <option value="all">모두</option><option value="todo">피드백 없음</option><option value="done">피드백 있음</option>
      </select>
      <span className="lab-hint codex-count">피드백 {count} / {items.length}</span>
    </div>
    {error&&<p className="lab-error" role="alert">{error}</p>}
    <ul className={`lab-grid codex-grid${current?' hidden':''}`}>
      {shown.map(i=>{
        const head=section==='augment'&&i.group!==lastGroup&&tier==='all'?(lastGroup=i.group):null;
        return <React.Fragment key={i.id}>
          {head&&<li className="codex-group"><h2>{head}</h2></li>}
          <li>
            <button className="lab-card codex-card" onClick={()=>setSelected(i.id)}>
              <canvas ref={el=>attach(el,i)} className="lab-canvas codex-canvas" style={{width:preview.W,height:preview.H}} aria-label={`${i.name} 이펙트 미리보기`}/>
              <span className="codex-body">
                <span className="lab-card-title">
                  <b>{i.name}</b>
                  {feedback[i.id]&&<i className="lab-dot" title="피드백 있음"/>}
                  <span className={`lab-tier codex-${i.tier||i.section}`}>{i.tier?TIER_LABEL[i.tier]:i.kind}</span>
                </span>
                <span className="lab-card-sub codex-meta">{i.id}{i.meta?` · ${i.meta}`:''}</span>
                <span className="lab-card-sub codex-desc">{i.description}</span>
                {feedback[i.id]?.text&&<span className="codex-fb">{feedback[i.id].text}</span>}
              </span>
            </button>
          </li>
        </React.Fragment>;
      })}
      {!shown.length&&<li className="lab-hint">조건에 맞는 항목이 없습니다.</li>}
    </ul>
    {current&&<CodexArena key={current.id} item={current} onClose={close} onStep={step} canStep={(shown.length||items.length)>1}
      feedback={feedback[current.id]} onSave={saveFeedback}/>}
  </>;
}
