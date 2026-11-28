import React,{useState,useRef,useEffect} from 'react';
const {TREES,TIERS,AUGMENTS,rank,offerCount}=require('./gameRules');

const find=id=>AUGMENTS.find(a=>a.id===id);
const treeOf=a=>TREES.find(t=>t.id===a.tree);
const tierOf=id=>TIERS.find(t=>t.id===id)||TIERS[0];

function AugmentCard({augment,owned,disabled,onClick}){
  const tree=treeOf(augment),tier=tierOf(augment.tier),count=rank(owned,augment.id);
  const Tag=onClick?'button':'div';
  return <Tag className={`augment-card augment-${augment.tier}`} style={{'--tier-color':tier.color,'--tree-color':tree.color}} disabled={onClick?disabled:undefined} onClick={onClick}>
    <span className="augment-card-meta"><span className="augment-card-tree">{tree.name}</span><span>{tier.name}</span></span>
    <span className="augment-card-name">{augment.name}</span>
    <span className="augment-card-description">{augment.description}</span>
    {augment.stack&&<span className="augment-card-rank">{onClick?(count?`중첩 · ${count}개 보유 중`:'중첩 가능'):`×${count}`}</span>}
  </Tag>;
}

export default function AugmentPicker({hud,onChoose,onReroll,onClose}){
  const panel=useRef(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[rerolledAt,setRerolledAt]=useState(null);
  const owned=hud.augments||[],pending=Math.max(0,offerCount(hud.lv)-owned.length);
  const offer=pending?hud.augmentOffer:null,tier=offer&&tierOf(offer.tier);
  const offerKey=offer?offer.options.join():'';
  useEffect(()=>{const old=document.activeElement;return()=>old?.focus();},[]);
  // Keep focus on the card that was just rerolled, else the first card.
  useEffect(()=>{
    const fresh=rerolledAt!==null&&panel.current.querySelectorAll('.augment-choice .augment-card')[rerolledAt];
    (fresh||panel.current.querySelector('.augment-card:not(:disabled), button'))?.focus();
  },[offerKey]); // eslint-disable-line react-hooks/exhaustive-deps
  async function run(action){
    if(busy)return;setBusy(true);setError('');
    try{await action();}catch(err){setError(err.response?.data?.error||'저장하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}
  }
  return <div className="augment-overlay"><section ref={panel} className="augment-panel" style={tier?{'--tier-color':tier.color}:undefined} onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();onClose();}
    if(event.key==='Tab'){
      const buttons=[...panel.current.querySelectorAll('button:not(:disabled)')];
      if(event.shiftKey && document.activeElement===buttons[0]){event.preventDefault();buttons[buttons.length-1]?.focus();}
      else if(!event.shiftKey && document.activeElement===buttons[buttons.length-1]){event.preventDefault();buttons[0]?.focus();}
    }
  }} role="dialog" aria-modal="true" aria-labelledby="augment-title">
    <header className="augment-header">
      <div>
        <h2 id="augment-title">{pending?<>증강 선택 {tier&&<span className="augment-tier-badge">{tier.name}</span>}</>:'획득한 증강'}</h2>
        <p>Lv. {hud.lv} · {pending?`남은 선택 ${pending}회`:`${owned.length}개 보유`}</p>
      </div>
      <button className="augment-close" onClick={onClose}>{pending?'나중에 선택':'닫기'}</button>
    </header>
    {error&&<p role="alert" className="join-error">{error}</p>}
    {pending>0&&!offer&&<p className="augment-waiting" role="status">증강을 준비하는 중…</p>}
    {offer&&<>
      <div className="augment-offer">{offer.options.map((id,i)=>{
        const a=find(id),used=!!(offer.rerolled||[])[i];
        if(!a)return null;
        return <div className="augment-choice" key={a.id}>
          <AugmentCard augment={a} owned={owned} disabled={busy} onClick={()=>run(()=>onChoose(a.id))}/>
          <button className="augment-reroll" disabled={busy||used} aria-label={used?`${a.name} · 다시 뽑기 사용함`:`${a.name} 다시 뽑기`}
            onClick={()=>run(async()=>{setRerolledAt(i);await onReroll(i);})}>{used?'다시 뽑기 사용함':'↻ 다시 뽑기'}</button>
        </div>;
      })}</div>
    </>}
    {owned.length>0&&<section className="augment-owned-list" aria-label="보유 증강">
      {pending>0&&<h3>보유 증강</h3>}
      <div className="augment-owned-grid">{[...new Set(owned)].map(id=>find(id)).filter(Boolean).map(a=>
        <AugmentCard key={a.id} augment={a} owned={owned}/>)}</div>
    </section>}
    {!pending&&!owned.length&&<p className="augment-waiting">3레벨마다 증강을 고를 수 있어요.</p>}
  </section></div>;
}
