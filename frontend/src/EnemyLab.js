// Enemy lab: static bestiary grid; clicking an enemy opens a fullscreen live
// simulation driven by the real server AI (backend/src/game/lab.js), with notes
// saved to ENEMY_NOTES.json at the repository root. Open with ?lab.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {drawLabPortrait, drawLabScene} from './mapdraw';
import {MotionBuffer} from './motion';
import {mergeShots} from './map';
import {ENEMY_NAMES, ENEMY_SUMMARY, BOSS_PATTERNS} from './enemyNames';
import {API_ORIGIN} from './apiConfig';
import './EnemyLab.css';

const API=`${API_ORIGIN}/lab`;
const TIERS=[['all','전체'],['legacy','기존'],['normal','일반'],['elite','정예'],['boss','보스'],['noted','메모 있음']];
const STATUS=[['note','메모'],['todo','수정 요청'],['done','반영됨']];
const LEGACY=new Set(['spinner','charger','stalker','bomber','spitter','splitter','mite']);
const POLL_MS=33;
const INTERP_DELAY=90;
const CAMERA_MODES=[['fixed','카메라 고정'],['enemy','적 시점'],['mid','중간 추적']];

export const labGroup=t=>LEGACY.has(t.type)?'legacy':t.tier;
export function filterTypes(types,filter,notes,query){
  const q=query.trim().toLowerCase();
  return types.filter(t=>{
    if(filter==='noted'&&!notes[t.type])return false;
    if(!['all','noted'].includes(filter)&&labGroup(t)!==filter)return false;
    if(!q)return true;
    return [t.type,ENEMY_NAMES[t.type],ENEMY_SUMMARY[t.type],notes[t.type]?.text].some(s=>s&&s.toLowerCase().includes(q));
  });
}

// Static still portrait for the grid (drawn once; zero polling or rAF overhead).
const LabPortrait=React.memo(function LabPortrait({info,width,height}){
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

// Fullscreen live simulation canvas for the single selected enemy at 60fps.
const LabStage=React.memo(function LabStage({type,tier,scenes,reduced,cameraMode}){
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
      const dt=lastTime===undefined?1/60:Math.min(.1,Math.max(0,(time-lastTime)/1000));
      lastTime=time;
      const entry=scenes.current[type];
      if(entry?.resetCamera){camera.ready=false;entry.resetCamera=false;}
      ctx.setTransform(dpr,0,0,dpr,0,0);
      if(entry&&entry.scene){
        const enemies=entry.enemyMotion.sample(time);
        const dummy=entry.dummyMotion.sample(time)[0]||entry.scene.dummy;
        drawLabScene(ctx,entry.scene,{width,height},time,{
          at:entry.at,zoom,reduced,enemies,dummy,projectiles:entry.projectiles,camera,cameraMode,dt,delay:INTERP_DELAY,
        });
      }else{
        drawLabScene(ctx,null,{width,height},time,{zoom,reduced});
      }
    };
    frame=requestAnimationFrame(loop);
    return ()=>{
      cancelAnimationFrame(frame);
      if(ro)ro.disconnect();else window.removeEventListener('resize',resize);
    };
  },[type,tier,scenes,reduced,cameraMode]);
  return <div className="lab-stage" ref={wrapRef}>
    <canvas ref={canvasRef} className="lab-stage-canvas" aria-label={`${ENEMY_NAMES[type]||type} 실시간 움직임`}/>
  </div>;
});

function NoteEditor({type,note,onSave}){
  const [text,setText]=useState(note?.text||'');
  const [status,setStatus]=useState(note?.status||'note');
  const [saved,setSaved]=useState('saved');
  const timer=useRef(null),latest=useRef({text,status});
  latest.current={text,status};
  useEffect(()=>{setText(note?.text||'');setStatus(note?.status||'note');setSaved('saved');},[type]); // eslint-disable-line react-hooks/exhaustive-deps
  const save=useCallback(async(next=latest.current)=>{
    clearTimeout(timer.current);setSaved('saving');
    try{await onSave(type,next);setSaved('saved');}catch(err){setSaved('error');}
  },[onSave,type]);
  const schedule=next=>{setSaved('dirty');clearTimeout(timer.current);timer.current=setTimeout(()=>save(next),700);};
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return <div className="lab-note">
    <div className="lab-note-head">
      <label htmlFor="lab-note-text">수정 메모</label>
      <select value={status} aria-label="메모 상태" onChange={e=>{setStatus(e.target.value);save({text,status:e.target.value});}}>
        {STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
      <span className={`lab-saved ${saved}`}>{{saved:'저장됨',saving:'저장 중…',dirty:'입력 중',error:'저장 실패'}[saved]}</span>
    </div>
    <textarea id="lab-note-text" value={text} placeholder="예: 창 찌르기 예고가 너무 짧음. 0.8초 → 1.1초로. 회복 중 피격 판정 커지게."
      onChange={e=>{setText(e.target.value);schedule({text:e.target.value,status});}}
      onBlur={()=>saved==='dirty'&&save()}
      onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();save();}}}/>
    <p className="lab-hint">자동 저장 · ⌘/Ctrl+S · 저장 위치 <code>ENEMY_NOTES.json</code></p>
  </div>;
}

export default function EnemyLab(){
  const [types,setTypes]=useState([]);
  const [notes,setNotes]=useState({});
  const [filter,setFilter]=useState('all');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState(()=>new URLSearchParams(window.location.search).get('enemy')||null);
  const [attack,setAttack]=useState(false);
  const [still,setStill]=useState(false);
  const [cameraMode,setCameraMode]=useState('fixed');
  const [reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false);
  const [error,setError]=useState(null);
  const [showAll,setShowAll]=useState(false);
  const scenes=useRef({});
  const [stats,setStats]=useState({});

  useEffect(()=>{
    Promise.all([fetch(`${API}/types`).then(r=>r.json()),fetch(`${API}/notes`).then(r=>r.json())])
      .then(([t,n])=>{setTypes(t);setNotes(n);setError(null);})
      .catch(()=>setError('백엔드(8080)에 연결할 수 없습니다. `npm start --prefix backend`가 실행 중인지 확인하세요.'));
  },[]);

  // Poll the live server simulation ONLY for the currently open fullscreen enemy.
  useEffect(()=>{
    if(!selected)return;
    delete scenes.current[selected];
    let stop=false,timer;
    const poll=async()=>{
      const started=performance.now();
      if(!document.hidden){
        try{
          const params=new URLSearchParams({types:selected,attack:attack?'1':'0',still:still?'1':'0'});
          const data=await fetch(`${API}/state?${params}`).then(r=>r.json()),at=performance.now();
          if(stop)return;
          const scene=data[selected];
          if(scene){
            let entry=scenes.current[selected];
            if(!entry){
              entry={enemyMotion:new MotionBuffer(INTERP_DELAY),dummyMotion:new MotionBuffer(INTERP_DELAY),projectiles:{list:[],at:0}};
              scenes.current[selected]=entry;
            }
            entry.scene=scene;
            entry.at=at;
            entry.enemyMotion.push(scene.enemies||[],at);
            entry.dummyMotion.push([{id:'lab-dummy',...scene.dummy,sw_speed:-3.1}],at);
            entry.projectiles=mergeShots(entry.projectiles,scene.projectiles||[],at);
            const next={hits:scene.hits,damage:scene.damage};
            setStats(s=>{
              const prev=s[selected];
              if(prev&&prev.hits===next.hits&&prev.damage===next.damage)return s;
              return {...s,[selected]:next};
            });
          }
          setError(null);
        }catch(err){if(!stop)setError('시뮬레이션 응답이 없습니다. 백엔드를 확인하세요.');}
      }
      if(!stop)timer=setTimeout(poll,Math.max(0,POLL_MS-(performance.now()-started)));
    };
    poll();
    return ()=>{stop=true;clearTimeout(timer);};
  },[attack,still,selected]);

  useEffect(()=>{
    const url=new URL(window.location.href);
    if(selected)url.searchParams.set('enemy',selected);else url.searchParams.delete('enemy');
    window.history.replaceState(null,'',url);
  },[selected]);

  const shown=useMemo(()=>filterTypes(types,filter,notes,query),[types,filter,notes,query]);
  const current=types.find(t=>t.type===selected);
  const currentIdx=current?shown.findIndex(t=>t.type===current.type):-1;
  const counts=useMemo(()=>Object.fromEntries(TIERS.map(([k])=>[k,filterTypes(types,k,notes,'').length])),[types,notes]);
  const noted=Object.entries(notes);

  useEffect(()=>{
    const onKey=e=>{
      if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;
      if(e.key==='Escape')setSelected(null);
      else if(selected&&shown.length>1&&e.key==='ArrowLeft'){
        const idx=shown.findIndex(t=>t.type===selected);
        if(idx>=0)setSelected(shown[(idx-1+shown.length)%shown.length].type);
      } else if(selected&&shown.length>1&&e.key==='ArrowRight'){
        const idx=shown.findIndex(t=>t.type===selected);
        if(idx>=0)setSelected(shown[(idx+1)%shown.length].type);
      }
    };
    window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);
  },[selected,shown]);

  const saveNote=useCallback(async(type,note)=>{
    const res=await fetch(`${API}/notes/${type}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(note)});
    if(!res.ok)throw new Error('save failed');
    const saved=await res.json();
    setNotes(n=>{const next={...n};if(saved)next[type]=saved;else delete next[type];return next;});
  },[]);
  const reset=type=>{
    const entry=scenes.current[type];
    if(entry){entry.enemyMotion.clear();entry.dummyMotion.clear();entry.projectiles={list:[],at:0};entry.resetCamera=true;}
    return fetch(`${API}/reset/${type}`,{method:'POST'});
  };

  const stepSelected=delta=>{
    if(currentIdx<0||shown.length<2)return;
    setSelected(shown[(currentIdx+delta+shown.length)%shown.length].type);
  };

  return <div className="lab">
    <header className="lab-header">
      <div>
        <h1>적 도감 <span>· 수정 메모</span></h1>
        <p>몬스터를 클릭하면 전체화면에서 실제 서버 AI로 움직이는 모습을 볼 수 있습니다.</p>
      </div>
      <a className="lab-back" href={window.location.pathname}>게임으로 ↗</a>
    </header>
    <div className="lab-toolbar">
      <div className="lab-tabs" role="tablist">
        {TIERS.map(([k,l])=><button key={k} role="tab" aria-selected={filter===k} className={filter===k?'on':''} onClick={()=>setFilter(k)}>{l}<em>{counts[k]||0}</em></button>)}
      </div>
      <input className="lab-search" type="search" placeholder="이름·설명·메모 검색" value={query} onChange={e=>setQuery(e.target.value)} aria-label="적 검색"/>
      <button className="lab-ghost" onClick={()=>setShowAll(v=>!v)}>메모 전체 {noted.length}</button>
    </div>
    {error&&<p className="lab-error" role="alert">{error}</p>}
    {showAll&&<section className="lab-allnotes" aria-label="모든 메모">
      {noted.length?noted.map(([t,n])=><button key={t} onClick={()=>{setSelected(t);setShowAll(false);}}>
        <b>{ENEMY_NAMES[t]||t}</b><span className={`lab-status ${n.status}`}>{STATUS.find(s=>s[0]===n.status)?.[1]}</span><p>{n.text}</p></button>)
        :<p className="lab-hint">아직 메모가 없습니다.</p>}
    </section>}
    <ul className={`lab-grid${current?' hidden':''}`}>
      {shown.map(t=>{
        const note=notes[t.type];
        return <li key={t.type}>
          <button className={`lab-card ${selected===t.type?'on':''}`} onClick={()=>setSelected(t.type)} aria-pressed={selected===t.type}>
            <LabPortrait info={t} width={232} height={150}/>
            <span className="lab-card-title">
              <b>{ENEMY_NAMES[t.type]||t.type}</b>
              {note&&<i className={`lab-dot ${note.status}`} title={STATUS.find(s=>s[0]===note.status)?.[1]}/>}
              <span className={`lab-tier ${labGroup(t)}`}>{TIERS.find(x=>x[0]===labGroup(t))?.[1]}</span>
            </span>
            <span className="lab-card-sub">{ENEMY_SUMMARY[t.type]}</span>
          </button>
        </li>;
      })}
      {!shown.length&&!error&&<li className="lab-hint">조건에 맞는 적이 없습니다.</li>}
    </ul>
    {current&&<div className="lab-modal" role="dialog" aria-modal="true" aria-label={`${ENEMY_NAMES[current.type]||current.type} 실시간 미리보기`}>
      <header className="lab-modal-bar">
        <div className="lab-modal-title">
          <h2>{ENEMY_NAMES[current.type]||current.type}</h2>
          <code>{current.type}</code>
          <span className={`lab-tier ${labGroup(current)}`}>{TIERS.find(x=>x[0]===labGroup(current))?.[1]}</span>
        </div>
        <div className="lab-modal-controls">
          <select value={cameraMode} aria-label="카메라 모드" onChange={e=>setCameraMode(e.target.value)}>
            {CAMERA_MODES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
          <label><input type="checkbox" checked={attack} onChange={e=>setAttack(e.target.checked)}/> 더미가 공격</label>
          <label><input type="checkbox" checked={still} onChange={e=>setStill(e.target.checked)}/> 더미 정지</label>
          <label><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/> 모션 감소</label>
          <button className="lab-ghost" onClick={()=>reset(current.type)}>처음부터</button>
          {shown.length>1&&<div className="lab-nav">
            <button className="lab-ghost" onClick={()=>stepSelected(-1)} aria-label="이전 적">←</button>
            <button className="lab-ghost" onClick={()=>stepSelected(1)} aria-label="다음 적">→</button>
          </div>}
          <button className="lab-close" onClick={()=>setSelected(null)} aria-label="목록으로">×</button>
        </div>
      </header>
      <div className="lab-modal-body">
        <LabStage type={current.type} tier={current.tier} scenes={scenes} reduced={reduced} cameraMode={cameraMode}/>
        <aside className="lab-sidebar">
          <p className="lab-summary">{ENEMY_SUMMARY[current.type]}</p>
          {BOSS_PATTERNS[current.type]&&<section className="lab-patterns" aria-label="보스 패턴 목록">
            <h3>보스 패턴 상세</h3>
            <ul>
              {BOSS_PATTERNS[current.type].map(p=><li key={p.name}><b>{p.name}</b><p>{p.desc}</p></li>)}
            </ul>
          </section>}
          <dl className="lab-stats">
            <div><dt>체력</dt><dd>{current.hp}</dd></div><div><dt>속도</dt><dd>{current.speed}</dd></div>
            <div><dt>경험치</dt><dd>{current.xp}</dd></div><div><dt>충돌</dt><dd>{current.contact}</dd></div>
            <div><dt>반경</dt><dd>{current.r}</dd></div><div><dt>등장</dt><dd>{current.tier==='boss'?'위협 5배수':current.tier==='elite'?'위협 3·8·13…':current.unlock?`위협 ${current.unlock}+`:'소환'}</dd></div>
            <div><dt>더미 피격</dt><dd>{stats[current.type]?.hits??0}회 / {stats[current.type]?.damage??0}</dd></div>
          </dl>
          <NoteEditor key={current.type} type={current.type} note={notes[current.type]} onSave={saveNote}/>
        </aside>
      </div>
    </div>}
  </div>;
}
