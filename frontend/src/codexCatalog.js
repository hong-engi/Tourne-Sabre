// Skill / spell / augment catalog for the Lab codex tabs and the
// tools/feedback page. Browser-safe CommonJS: the feedback server requires it
// with the current gameRules, the Lab imports it in the bundle.

// Rough preview sketches for the original abilities (no fx data in gameRules).
const L=o=>Object.assign({t:'hit',shape:'line',at:'self'},o),O=o=>Object.assign({t:'hit',shape:'circle',at:'self'},o);
const ORIGINAL={
  reverse:{classicReverse:true,spin:[-20/3,300],fx:[]}, giant:{length:[1.6,3000],fx:[]}, accel:{spin:[2.6,2400],fx:[]},
  thrust:{fx:[L({len:230,w:40})]}, dash:{move:{kind:'dash',dist:200,ms:180},fx:[{t:'hit',shape:'cone',at:'dest',len:150,spread:1.6}]},
  twinBlade:{twin:true,fx:[]}, turret:{turret:true,fx:[]}, boomerang:{fx:[L({len:300,w:50}),L({len:300,w:50,delay:450})]},
  slam:{fx:[O({r:180})]}, blink:{move:{kind:'blink',dist:200},fx:[]}, ghost:{speed:[1.45,2500],phase:2500,fx:[]},
  heal:{fx:[{t:'heal'}]}, barrier:{fx:[{t:'shield'}]}, exhaust:{fx:[O({r:200,power:0,status:{slow:[.4,3000]}})]},
  smite:{fx:[{t:'hit',shape:'circle',at:'nearest',r:60}]}, ignite:{fire:true,fx:[]},
};
const TIER_NAMES={silver:'실버',gold:'골드',prismatic:'프리즘',transcendent:'초월'};

// Every skill, spell and augment as a card: {id, section, kind, name, group,
// meta, description, fx (preview spec), tier?, requires?, requiresAll?}.
function catalog(r){
  const name=id=>(r.SKILLS.concat(r.SPELLS).find(s=>s.id===id)||{}).name||id;
  const trees={};
  r.TREES.forEach(t=>{trees[t.id]=t.name;});
  // Expansion skills use their real fx data (with an exclusive augment's patch
  // applied); the original 16 use the sketches above.
  const spec=(id,owned)=>r.specFor(id,owned||[])||ORIGINAL[id]||null;
  const previewOf=(a,needs)=>{
    if(a.id==='mirror')return {previewSkill:'blink',fx:Object.assign({},ORIGINAL.blink,{mirrorClone:true})};
    if(a.id==='xD01')return {previewSkill:'blink',fx:Object.assign({},ORIGINAL.blink,{fx:[{t:'hit',shape:'circle',at:'origin',r:60,ticks:5,every:200,power:1,last:1000,tag:'fold'}]})};
    if(a.id==='xR02')return {previewSkill:'turret',fx:Object.assign({},ORIGINAL.turret,{fx:[{t:'hit',shape:'line',at:'point',off:160,angle:Math.PI,len:160,w:70,delay:900,last:300}]})};
    if(a.id==='echoArt'||a.id==='timeSplitter'){
      const base=spec('crescent');
      return {previewSkill:'crescent',fx:Object.assign({},base,{fx:base.fx.concat(base.fx.map(f=>Object.assign({},f,{delay:(f.delay||0)+600,echo:a.id,echoLead:true})))})};
    }
    if(a.id==='workshopHeart')return {previewSkill:null,fx:{blades:{count:2,r:110,ms:3000,speed:1.6,doll:true},fx:[]}};
    if(a.id==='causalKnot')return {previewSkill:null,fx:{causalGhost:true,fx:[]}};
    return {previewSkill:needs[0],fx:needs.length?Object.assign({},spec(needs[0],[a.id]),a.id==='xQ01'?{afterSpin:true}:{}):null};
  };
  const skill=(s,kind,section)=>({id:s.id,section,kind,name:s.name,group:kind,fx:spec(s.id),
    meta:`대기 ${s.cooldown/1000}초${s.charges?` · 충전 ${s.charges}회`:''}`,description:s.description});
  return r.SKILLS.map(s=>skill(s,'스킬','skill'))
    .concat(r.SPELLS.map(s=>skill(s,'주문','spell')))
    .concat(r.AUGMENTS.map(a=>{
      const needs=[].concat(a.requiresAll||a.requires||[]);
      const pv=previewOf(a,needs);
      return {id:a.id,section:'augment',kind:'증강',name:a.name,tier:a.tier,
        requires:needs,requiresAll:!!a.requiresAll,previewSkill:pv.previewSkill,
        fx:pv.fx,
        group:TIER_NAMES[a.tier]+' 증강',
        meta:[trees[a.tree],a.code,a.requiresAll?'필요: '+a.requiresAll.map(name).join(' + '):a.requires?'필요: '+[].concat(a.requires).map(name).join(' 또는 '):''].filter(Boolean).join(' · '),
        description:a.description};
    }));
}
module.exports={ORIGINAL,TIER_NAMES,catalog};
