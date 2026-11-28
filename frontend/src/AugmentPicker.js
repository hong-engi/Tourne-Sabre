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

const ARROWS=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);

function OwnedAugments({owned,compact}){
  const [hover,setHover]=useState(null);
  const list=[...new Set(owned)].map(find).filter(Boolean);
  const style=a=>({'--tier-color':tierOf(a.tier).color,'--tree-color':treeOf(a).color});
  const count=a=>a.stack&&rank(owned,a.id)>1?<span className="augment-owned-count">×{rank(owned,a.id)}</span>:null;
  // While choosing, owned augments shrink to one-line chips; details show on hover.
  if(compact){
    const shown=hover&&find(hover);
    return <section className="augment-owned-list" aria-label="보유 증강" onMouseLeave={()=>setHover(null)}>
      <h3>보유 증강 <span>{owned.length}</span></h3>
      <ul className="augment-chips">{list.map(a=>
        <li key={a.id} className="augment-chip" style={style(a)} title={a.description} onMouseEnter={()=>setHover(a.id)}>
          <span className="augment-chip-dot"/>{a.name}{count(a)}</li>)}</ul>
      <p className="augment-chip-detail">{shown?<><b>{shown.name}</b> {shown.description}</>:'증강에 마우스를 올리면 효과가 보여요'}</p>
    </section>;
  }
  const groups=TREES.map(t=>({tree:t,items:list.filter(a=>a.tree===t.id)})).filter(g=>g.items.length);
  return <section className="augment-owned-list augment-owned-trees" aria-label="보유 증강">
    {groups.map(({tree,items})=><div key={tree.id} className="augment-tree-col" style={{'--tree-color':tree.color}}>
      <h3>{tree.name}</h3>
      <ul>{items.map(a=><li key={a.id} className="augment-owned-row" style={style(a)}>
        <span className="augment-owned-name">{a.name}{count(a)}</span>
        <span className="augment-owned-desc">{a.description}</span>
      </li>)}</ul>
    </div>)}
  </section>;
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
  const live=!!hud.augmentLive;
  return <div className={`augment-overlay${live?' augment-overlay-live':''}`}><section ref={panel} className="augment-panel" style={tier?{'--tier-color':tier.color}:undefined} onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();onClose();}
    // Held movement keys must not scroll the panel.
    if(ARROWS.has(event.key))event.preventDefault();
    if(event.key==='Tab'){
      const buttons=[...panel.current.querySelectorAll('button:not(:disabled)')];
      if(event.shiftKey && document.activeElement===buttons[0]){event.preventDefault();buttons[buttons.length-1]?.focus();}
      else if(!event.shiftKey && document.activeElement===buttons[buttons.length-1]){event.preventDefault();buttons[0]?.focus();}
    }
  }} role="dialog" aria-modal={!live} aria-labelledby="augment-title">
    <header className="augment-header">
      <div>
        <h2 id="augment-title">{pending?<>증강 선택 {tier&&<span className="augment-tier-badge">{tier.name}</span>}</>:'획득한 증강'}</h2>
        <p>Lv. {hud.lv} · {pending?`남은 선택 ${pending}회`:`${owned.length}개 보유`}</p>
      </div>
      <button className="augment-close" onClick={onClose}>{pending?'나중에 선택':'닫기'}</button>
    </header>
    {live&&<p className="augment-live-note" role="status">다른 플레이어가 있어 게임이 멈추지 않아요. 고르는 동안에도 움직이고 싸울 수 있어요.</p>}
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
    {owned.length>0&&<OwnedAugments owned={owned} compact={pending>0}/>}
    {!pending&&!owned.length&&<p className="augment-waiting">3레벨마다 증강을 고를 수 있어요.</p>}
  </section></div>;
}
