// Training-ground setup for one codex item: which kit the knight carries,
// which keys auto-cast, and the situation the effect needs to show up
// (low health, weak enemies, a boss, a crowd, standing still, a level-up…).
const {DEFAULT_SKILLS,DEFAULT_SPELLS,SKILLS,SPELLS}=require('./gameRules');

export const SKILL_CODES=['KeyQ','KeyW','KeyE','KeyR'];
export const SPELL_CODES=['KeyD','KeyF'];
const isSkill=id=>SKILLS.some(s=>s.id===id);
const isSpell=id=>SPELLS.some(s=>s.id===id);

// Situations the training ground can build. Each item may switch several on.
export const SITUATIONS={
  lowHp:'내 체력을 낮게 유지',
  nearDeath:'죽기 직전 체력',
  enemyLowHp:'적 체력이 낮은 상태로 등장',
  crowd:'적 무리(7마리)',
  boss:'보스 함께 등장',
  far:'멀리 있는 적 섞기',
  frozen:'적 고정(허수아비)',
  levelUp:'3초마다 레벨업',
  bigHit:'큰 피해를 받도록 최대 체력 낮춤',
};

// Hand-picked situations, on top of what the description implies.
const OVERRIDES={
  berserk:{lowHp:.45},brink:{lowHp:.28},chrono:{lowHp:.3,crowd:true},
  causalKnot:{nearDeath:true},guillotine:{enemyLowHp:.1},xD03:{enemyLowHp:.35},
  crisisSplit:{bigHit:true},breather:{frozen:true},top:{frozen:true},
  nova:{levelUp:true,crowd:true},xE04:{boss:true},
  wildfire:{crowd:true},tempest:{crowd:true},corpseBomb:{crowd:true},chainReaction:{crowd:true},
  devourerStar:{crowd:true,far:true},reach:{far:true},longThrow:{far:true},momentum:{far:true},
  scarCollector:{spells:['ignite'],enemyLowHp:.5},kindling:{frozen:true},
  echoArt:{skills:['crescent']},timeSplitter:{skills:['crescent']},
};

function fromDescription(text=''){
  const s={};
  if(/(^|[^적])\s?체력[^.]{0,8}(\d+)%\s?(이하|미만)/.test(text)&&!/체력이 \d+% 이하인 적/.test(text)){
    const pct=Number(text.match(/체력[^.]{0,8}?(\d+)%/)[1]);s.lowHp=Math.max(.1,pct/100-.05);
  }
  if(/체력이 \d+% 이하인 적|체력 \d+% 이하인 적/.test(text)){const pct=Number(text.match(/(\d+)% 이하인 적/)[1]);s.enemyLowHp=Math.max(.05,pct/100-.02);}
  if(/(\d+)마리|여러 적|주변 적 최대/.test(text))s.crowd=true;
  if(/보스|정예/.test(text))s.boss=true;
  if(/멈춰|가만히/.test(text))s.frozen=true;
  return s;
}

// -> {loadout, spells, augments, autoCodes, setup, situations:[label]}
export function scenarioFor(item){
  const needs=item.section==='augment'?(item.requires||[]):[item.id];
  const extra={...fromDescription(item.description),...(OVERRIDES[item.id]||{})};
  const wantSkills=[...needs.filter(isSkill),...(extra.skills||[])],wantSpells=[...needs.filter(isSpell),...(extra.spells||[])];
  const loadout=[...wantSkills,...DEFAULT_SKILLS.filter(id=>!wantSkills.includes(id))].slice(0,4);
  const spells=[...wantSpells,...DEFAULT_SPELLS.filter(id=>!wantSpells.includes(id))].slice(0,2);
  // Augments with "A or B" need only one of them on the bar to cast.
  const castSkills=item.section==='augment'&&!item.requiresAll?wantSkills.slice(0,1):wantSkills;
  const castSpells=item.section==='augment'&&!item.requiresAll&&castSkills.length?(extra.spells||[]):wantSpells;
  const autoCodes=[
    ...castSkills.map(id=>SKILL_CODES[loadout.indexOf(id)]),
    ...castSpells.map(id=>SPELL_CODES[spells.indexOf(id)]),
  ].filter(Boolean);
  const situations=[];
  const setup={loadout,spells,augments:item.section==='augment'?[item.id]:[],lv:10,hpmax:150,pack:4,enemyHp:1,boss:false,far:false,frozen:false};
  let hpRatio=1;
  if(extra.lowHp){hpRatio=extra.lowHp;situations.push(`${SITUATIONS.lowHp} (${Math.round(hpRatio*100)}%)`);}
  if(extra.nearDeath){hpRatio=.06;situations.push(SITUATIONS.nearDeath);}
  if(extra.enemyLowHp){setup.enemyHp=extra.enemyLowHp;situations.push(`${SITUATIONS.enemyLowHp} (${Math.round(extra.enemyLowHp*100)}%)`);}
  if(extra.crowd){setup.pack=7;situations.push(SITUATIONS.crowd);}
  if(extra.boss){setup.boss=true;situations.push(SITUATIONS.boss);}
  if(extra.far){setup.far=true;situations.push(SITUATIONS.far);}
  if(extra.frozen){setup.frozen=true;situations.push(SITUATIONS.frozen);}
  if(extra.bigHit){setup.hpmax=60;situations.push(SITUATIONS.bigHit);}
  if(extra.levelUp)situations.push(SITUATIONS.levelUp);
  if(extra.spells)situations.push(`${extra.spells.map(id=>SPELLS.find(s=>s.id===id)?.name||id).join('·')} 주문 자동 시전`);
  return {loadout,spells,augments:setup.augments,autoCodes,setup,hpRatio,levelUp:!!extra.levelUp,situations};
}
