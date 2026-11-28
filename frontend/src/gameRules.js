// Browser/server shared, dependency-free progression rules.
// Stays CommonJS for the backend, so avoid syntax that makes the production
// Babel build inject ES-module helpers: object/array spread and for...of.
// (shared-modules.test.js checks this.)
const TREES = [
  {id:'storm', name:'폭풍', color:'#8dd8cf'}, {id:'titan',name:'거신',color:'#e8bc77'},
  {id:'lance',name:'관통',color:'#b5b0f0'}, {id:'resolve',name:'불굴',color:'#a9ce91'},
  {id:'skill',name:'스킬',color:'#f2a7c3'},
];
const BOOK=require('./skillBook');
// Augment rarities, like an arena draft: each offer rolls one rarity and shows
// three random augments of it. Every offer starts from the same odds; each
// offer without gold (or prismatic) raises that tier's odds until it appears.
const TIERS = [
  {id:'silver',name:'실버',color:'#c9d4dc'},
  {id:'gold',name:'골드',color:'#f0c36a'},
  {id:'prismatic',name:'프리즘',color:'#d6a2ff'},
  {id:'transcendent',name:'초월',color:'#ffffff'},
];
const BASE_ODDS = {silver:40,gold:45,prismatic:15,transcendent:0};
// From level 15: prismatic starts at 20, gold at 43, transcendent at 2 (+1 per
// offer without one, up to 10). One transcendent per run.
const LATE_LEVEL = 15, LATE_ODDS = {gold:43,prismatic:20,transcendent:2};
const PITY_STEP = {gold:10,prismatic:5};
// Each of the three cards in an offer can be rerolled once.
const OFFER_SIZE = 3;
// Shared ceilings so no stack of augments breaks the game.
const CAPS = {cooldownReduction:.6, damageReduction:.65, length:2.8};
const DEFAULT_STACK = 3;
// `stack: true` augments can be taken up to `max` times (3 when unset).
// Flat bonuses add up; damage taken multiplies. Shared caps live in CAPS.
// Everything else can be owned once. `spell` limits an augment to players who
// brought that D/F spell.
const AUGMENTS = [
  // Silver: big, simple boosts and the build-defining tricks.
  {id:'spin',tree:'storm',name:'날쌘 궤도',tier:'silver',stack:true,max:3,description:'검 회전 속도 +20% (최대 3회, 합산)'},
  {id:'haste',tree:'storm',name:'바람의 호흡',tier:'silver',stack:true,max:3,description:'Q W E R 재사용 대기시간 -10% (최대 3회, 합산)'},
  {id:'top',tree:'storm',name:'팽이',tier:'silver',description:'2초간 멈춰 서면 검 회전 +80%까지 증가 · 움직이면 1초에 걸쳐 풀린다'},
  {id:'cyclone',tree:'storm',name:'회오리 베기',tier:'silver',requires:'reverse',description:'역회전 베기로 휘두르는 한 바퀴 동안 검이 2.5배로 길어진다'},
  {id:'length',tree:'titan',name:'장검',tier:'silver',stack:true,max:3,description:'검 길이 +15% (최대 3회, 합산)'},
  {id:'duration',tree:'titan',name:'거인의 호흡',tier:'silver',stack:true,max:2,requires:'giant',description:'거대 검 지속시간 +1초 (최대 2회)'},
  {id:'reach',tree:'lance',name:'긴 창끝',tier:'silver',stack:true,max:2,requires:'thrust',description:'찌르기 사거리 +25% (최대 2회)'},
  {id:'pierce',tree:'lance',name:'예리한 일격',tier:'silver',stack:true,max:2,requires:'thrust',description:'찌르기 피해 +25% (최대 2회)'},
  {id:'runner',tree:'lance',name:'질주 칼날',tier:'silver',description:'빠르게 달릴수록 검이 길어진다 (최대 +40%)'},
  {id:'vitality',tree:'resolve',name:'강인함',tier:'silver',stack:true,max:3,description:'최대 체력 +50 (증가량만큼 회복, 최대 3회)'},
  {id:'fleet',tree:'resolve',name:'가벼운 발',tier:'silver',stack:true,max:3,description:'이동 속도 +10% (최대 3회, 합산)'},
  {id:'armor',tree:'resolve',name:'단단한 피부',tier:'silver',stack:true,max:3,description:'받는 피해 ×0.9 (최대 3회)'},
  {id:'harvest',tree:'resolve',name:'수확의 칼날',tier:'silver',description:'검에 닿은 경험치 결정도 주워 담는다'},
  {id:'longThrow',tree:'storm',name:'먼 비행',tier:'silver',stack:true,max:2,requires:'boomerang',description:'부메랑 비거리 +25% · 칼날 크기 +15% (최대 2회)'},
  {id:'momentum',tree:'lance',name:'가속 돌진',tier:'silver',stack:true,max:2,requires:'dash',description:'돌진 베기 거리 +20% · 피해 +20% (최대 2회)'},
  {id:'reverse',tree:'storm',name:'역류',tier:'silver',requires:'reverse',description:'역회전 베기 후 다음 5회 적중 피해 +60%'},
  {id:'chain',tree:'storm',name:'연쇄',tier:'silver',requires:'accel',description:'적 적중마다 회전 가속 대기시간 0.3초 감소'},
  {id:'bloodlust',tree:'storm',name:'피의 갈증',tier:'silver',description:'처치할 때마다 4초간 검 회전 +35% (최대 5중첩)'},
  {id:'knockback',tree:'titan',name:'중량',tier:'silver',description:'적중한 적을 크게 밀쳐낸다'},
  {id:'tip',tree:'titan',name:'균열',tier:'silver',description:'칼날 끝부분 적중 피해 +40%'},
  {id:'vampire',tree:'titan',name:'흡혈',tier:'silver',stack:true,max:3,description:'적 처치 시 체력 8 회복 (최대 3회 · 한 번에 최대 5처치분)'},
  {id:'doubleEdge',tree:'titan',name:'쌍날검',tier:'silver',description:'짧은 칼날이 하나 더 돈다 (피해 80%)'},
  {id:'pursuit',tree:'lance',name:'추격',tier:'silver',requires:['thrust','dash'],description:'찌르기·돌진 베기 후 1.5초간 이동 속도 +60%'},
  {id:'execute',tree:'lance',name:'처형',tier:'silver',requires:'thrust',description:'찌르기로 처치하면 찌르기 대기시간 1초 감소 (한 번에 1회)'},
  {id:'riposte',tree:'lance',name:'반격',tier:'silver',description:'피격 후 3초 안의 다음 본체 검 적중 1회 피해 +100% (3초 간격)'},
  {id:'absorb',tree:'resolve',name:'흡수',tier:'silver',description:'경험치 결정 획득 시 체력 2 회복 (0.4초 간격)'},
  {id:'spoils',tree:'resolve',name:'전리품',tier:'silver',description:'적 처치 시 5초 보호막 +20 (최대 80)'},
  {id:'thorns',tree:'resolve',name:'가시 갑옷',tier:'silver',description:'몸으로 부딪혀 피해를 준 적에게 공격력의 150% 반격 (대상당 1초 간격)'},
  {id:'turretTwin',tree:'titan',name:'포병대',tier:'silver',requires:'turret',description:'검 포탑을 동시에 2개까지 세운다 · 지속시간 +3초'},
  {id:'aftershock',tree:'titan',name:'여진',tier:'silver',requires:'slam',description:'내려찍기 0.6초 뒤 같은 자리에 여진이 한 번 더 터진다 (공격력 150%)'},
  {id:'wildfire',tree:'storm',name:'들불',tier:'silver',requires:'ignite',description:'불타는 적이 죽으면 주변 적에게 불이 옮겨 붙는다'},
  {id:'frenzy',tree:'storm',name:'칼춤',tier:'silver',requires:'twinBlade',description:'쌍검이 떠 있는 동안 처치할 때마다 쌍검 지속시간 +0.5초 (한 번 시전에 최대 +4초)'},
  {id:'firstBeat',tree:'lance',name:'첫 박자',tier:'silver',description:'3초 동안 검을 맞히지 않았다면 다음 본체 검 적중 피해 +50%'},
  {id:'scent',tree:'resolve',name:'경험의 향기',tier:'silver',description:'경험치 결정을 줍는 반경 +35%'},
  {id:'breather',tree:'resolve',name:'숨 고르기',tier:'silver',description:'6초간 피해를 받지 않으면 초당 최대 체력 1% 회복'},
  {id:'parry',tree:'resolve',name:'반사',tier:'silver',description:'검으로 쳐낸 투사체가 되돌아가 적을 꿰뚫는다 (공격력 300%)'},

  // Gold: what used to be the rarest tier.
  {id:'tempest',tree:'storm',name:'태풍',tier:'gold',requires:'accel',description:'회전 가속 중 주변 적을 끌어당긴다'},
  {id:'nova',tree:'storm',name:'레벨업 폭발',tier:'gold',description:'주변 적에게 공격력 700% 피해'},
  {id:'quake',tree:'titan',name:'지각 붕괴',tier:'gold',requires:'giant',description:'거대 검 중 검 끝 적중 시 충격파 (0.6초 간격)'},
  {id:'colossus',tree:'titan',name:'거상',tier:'gold',description:'검 길이 ×1.6 · 최대 체력 +100'},
  {id:'glassCannon',tree:'titan',name:'유리 대포',tier:'gold',description:'최대 체력 ×0.75 · 모든 검 피해 ×1.55'},
  {id:'twin',tree:'lance',name:'쌍아',tier:'gold',requires:'thrust',description:'찌르기를 최대 3회 충전'},
  {id:'berserk',tree:'lance',name:'광전사',tier:'gold',description:'체력 50% 이하일 때 검 피해 ×1.5'},
  {id:'mirror',tree:'lance',name:'분신',tier:'gold',requires:['blink','thrust','dash'],description:'점멸·찌르기·돌진 베기 뒤 그 자리에 2초간 검을 휘두르는 분신이 남는다 (피해 80%)'},
  {id:'immortal',tree:'resolve',name:'불사',tier:'gold',description:'한 판에 한 번 치명상 생존 · 체력 1 · 2초 무적'},
  {id:'orb',tree:'storm',name:'수호 구슬',tier:'gold',stack:true,max:2,description:'반대로 도는 구슬이 주위를 돌며 적과 투사체를 친다 (피해 70%, 최대 2회)'},
  {id:'corpseBomb',tree:'titan',name:'시체 폭발',tier:'gold',description:'처치한 적이 터지며 주변 적에게 그 적 최대 체력의 15% 피해 (최대 공격력 300%, 폭발 처치는 다시 터지지 않음)'},
  {id:'guillotine',tree:'lance',name:'단두대',tier:'gold',description:'체력이 12% 이하인 적은 검에 닿는 즉시 처치'},
  {id:'blinkStrike',tree:'lance',name:'착지 충격',tier:'gold',requires:'blink',description:'점멸 도착 지점 반경 140에 충격파 (공격력 250%)'},
  {id:'accent',tree:'lance',name:'세 번째 악센트',tier:'gold',description:'같은 적을 검으로 3번 맞히면 공격력 120% 추가 피해 (대상당 3초 간격)'},
  {id:'critEdge',tree:'lance',name:'치명 검식',tier:'gold',description:'검 적중이 20% 확률로 치명타 (피해 ×1.5) · 번개·폭발 등 추가 피해는 제외'},
  {id:'debt',tree:'titan',name:'빚진 힘',tier:'gold',description:'모든 검 피해 ×1.25 · 모든 회복량 -20%'},
  {id:'chrono',tree:'resolve',name:'시간 왜곡',tier:'gold',description:'체력 35% 이하일 때 주변 적과 투사체가 60% 느려진다'},

  // Prismatic: run-changing.
  {id:'lightning',tree:'storm',name:'연쇄 번개',tier:'prismatic',description:'검 적중 시 30% 확률로 가까운 적 3명에게 번개 (공격력 60%, 0.6초 간격)'},
  {id:'bladeStorm',tree:'storm',name:'검의 폭풍',tier:'prismatic',description:'같은 크기의 검 2자루가 더 생긴다'},
  {id:'stormLord',tree:'storm',name:'뇌신',tier:'prismatic',description:'2초마다 가까운 적 3명에게 벼락 (공격력 150%)'},
  {id:'perpetual',tree:'storm',name:'영구 기관',tier:'prismatic',description:'Q W E R 재사용 대기시간 -30% (쿨다운 감소 합계 최대 60%)'},
  {id:'titanForm',tree:'titan',name:'거인화',tier:'prismatic',description:'검 길이 ×2 · 굵기 ×1.5 · 모든 검 피해 ×1.5 · 이동 속도 ×0.85'},
  {id:'chainReaction',tree:'titan',name:'연쇄 폭발',tier:'prismatic',description:'처치한 적이 폭발해 주변에 공격력 180% 피해 · 그 폭발로 죽은 적은 90% 폭발 1회 (이후 전파 없음)'},
  {id:'stormMath',tree:'storm',name:'폭풍의 계산',tier:'prismatic',description:'검 적중 10회마다 가까운 적 4명에게 벼락 (공격력 140%, 3초 간격)'},
  {id:'brink',tree:'resolve',name:'삶과 죽음의 경계',tier:'prismatic',description:'체력 30% 이하일 때 검 피해 ×1.35 · 회복량 +25%'},
  {id:'guardians',tree:'lance',name:'수호 검진',tier:'prismatic',description:'검 2자루가 넓은 원을 그리며 주위를 지킨다 (피해 80%)'},
  {id:'vampLord',tree:'resolve',name:'흡혈 군주',tier:'prismatic',description:'검으로 준 피해의 8%만큼 체력 회복 (초당 최대 체력 10%)'},
  {id:'gravity',tree:'resolve',name:'중력장',tier:'prismatic',description:'주변 320 안의 적을 계속 끌어당긴다'},
].concat(BOOK.NEW_AUGMENTS);
// Q W E R skills. Any four different ones can sit on the four keys.
const SKILLS = [
  {id:'reverse',name:'역회전 베기',cooldown:900,duration:300,description:'검이 0.3초 만에 반대 방향으로 한 바퀴를 휘두른다'},
  {id:'giant',name:'거대 검',cooldown:8000,duration:3000,description:'3초간 검이 크고 길어진다 · 피해 ×1.4'},
  {id:'accel',name:'회전 가속',cooldown:7000,duration:2400,description:'2.4초간 검 회전 속도 ×2.6'},
  {id:'thrust',name:'찌르기',cooldown:3500,duration:350,description:'검을 멈추고 그 방향으로 길게 찔러 넣는다 · 피해 ×2.4'},
  {id:'dash',name:'돌진 베기',cooldown:6000,duration:260,distance:230,description:'이동 방향으로 돌진하며 앞쪽을 크게 벤다 · 피해 ×1.8, 맞은 적을 멀리 날려 보낸다'},
  {id:'twinBlade',name:'쌍검',cooldown:14000,duration:6000,description:'6초간 같은 크기의 검이 하나 더 돈다'},
  {id:'turret',name:'검 포탑',cooldown:12000,duration:6000,description:'6초간 스킬을 함께 쓰는 분신 포탑을 세운다 · 돌진은 제자리 베기 (피해 80%)'},
  {id:'boomerang',name:'부메랑',cooldown:5000,duration:900,distance:320,description:'회전하는 칼날을 이동 방향으로 던진다 (피해 120%)'},
  {id:'slam',name:'내려찍기',cooldown:9000,duration:0,radius:170,description:'주변 땅을 내리쳐 공격력 250% 피해를 주고 적을 밀쳐낸다'},
].concat(BOOK.NEW_SKILLS);
const DEFAULT_SKILLS = ['reverse','giant','accel','thrust'];
// D/F summoner-style spells. Players bring two.
const SPELLS = [
  {id:'blink',name:'점멸',cooldown:12000,duration:0,distance:210,description:'이동 방향으로 순간이동'},
  {id:'ghost',name:'유체화',cooldown:18000,duration:2500,description:'2.5초간 이동 속도 ×1.45 · 적을 통과하고 몸 충돌 피해를 받지 않는다'},
  {id:'heal',name:'회복',cooldown:25000,duration:0,amount:.3,description:'최대 체력의 30% 회복'},
  {id:'ignite',name:'점화',cooldown:20000,duration:5000,description:'5초간 검에 불이 붙는다 · 벤 적은 3초간 불타며 매초 공격력 40% 피해'},
  {id:'barrier',name:'방벽',cooldown:22000,duration:3000,amount:.25,description:'3초간 최대 체력 25%만큼 피해를 막는 보호막'},
  {id:'exhaust',name:'탈진',cooldown:20000,duration:3000,radius:300,description:'주변 적을 3초간 60% 느리게 하고, 그 적이 주는 피해를 40% 줄인다'},
  {id:'smite',name:'강타',cooldown:15000,duration:0,radius:400,description:'가장 가까운 적에게 벼락 (50 + 레벨×10 고정 피해)'},
].concat(BOOK.NEW_SPELLS);
// Spell pairs that cannot be brought together.
const SPELL_CONFLICTS = [];
const DEFAULT_SPELLS = ['blink','heal'];
function pickDistinct(list,pool,count,fallback) {
  const ids=Array.isArray(list)?list.filter(id=>pool.some(s=>s.id===id)):[];
  return ids.length===count && new Set(ids).size===count ? ids : fallback.slice();
}
const validSpells=list=>{
  const ids=pickDistinct(list,SPELLS,2,DEFAULT_SPELLS);
  return SPELL_CONFLICTS.some(pair=>pair.every(id=>ids.includes(id)))?DEFAULT_SPELLS.slice():ids;
};
const validSkills=list=>pickDistinct(list,SKILLS,4,DEFAULT_SKILLS);
// Everything the player brought (QWER skills and D/F spells), for augment
// requirements. Accepts {skills,spells} or a bare spell list.
function kitOf(loadout) {
  if (Array.isArray(loadout)) return DEFAULT_SKILLS.concat(loadout);
  return validSkills(loadout&&loadout.skills).concat(validSpells(loadout&&loadout.spells));
}
function rank(owned,id) {return (owned || []).filter(x=>x===id).length;}
function stackMax(a) {return a.stack ? (a.max || DEFAULT_STACK) : 1;}
// Reaching level L+1 from L costs 40 + 20*(L-1) XP: 40, 60, 80, ...
// so the total to reach level L is 10(L-1)^2 + 30(L-1).
function xpForLevel(level) {const n=Math.max(0,level-1);return 10*n*n+30*n;}
function levelForXp(xp) {
  xp=Math.max(0,Number(xp)||0);
  let level=1+Math.floor((-30+Math.sqrt(900+40*xp))/20+1e-9);
  while (xpForLevel(level+1)<=xp) level++;
  while (level>1 && xpForLevel(level)>xp) level--;
  return level;
}
function offerCount(level) {return Math.floor(level/3);}
function available(a,owned,loadout) {
  const kit=kitOf(loadout);
  if (a.tier==='transcendent' && (owned||[]).some(id=>{const o=AUGMENTS.find(x=>x.id===id);return o&&o.tier==='transcendent';})) return false;
  if (a.requiresAll && !a.requiresAll.every(id=>kit.includes(id))) return false;
  if (a.needsMove && !kit.some(id=>MOVERS.includes(id))) return false;
  return rank(owned,a.id)<stackMax(a) && (!a.requires || [].concat(a.requires).some(id=>kit.includes(id)));
}
const MOVERS=['dash','blink','hookStep','afterimage','chainRush','magnetLeap','retreatGust','beatWalk','anchor','twinGate','markShot'];
function canChoose(owned,level,id,offer) {
  owned=owned || [];
  const a=AUGMENTS.find(a=>a.id===id);
  if (!a || owned.length>=offerCount(level) || rank(owned,id)>=stackMax(a)) return false;
  return !!offer && (offer.options || []).includes(id);
}
// `late` is {level, owned}: transcendent odds only from LATE_LEVEL and only
// while the player owns none; once owned its base share goes to prismatic.
function tierOdds(pity,late) {
  const lv=(late&&late.level)||0,isLate=lv>=LATE_LEVEL;
  const ownsT=!!(late&&late.owned&&late.owned.some(id=>{const a=AUGMENTS.find(x=>x.id===id);return a&&a.tier==='transcendent';}));
  const base=isLate?LATE_ODDS:BASE_ODDS;
  const transcendent=isLate&&!ownsT?Math.min(10,LATE_ODDS.transcendent+((pity&&pity.transcendent)||0)):0;
  const prismatic=Math.min(100-transcendent,Math.min(45,base.prismatic+PITY_STEP.prismatic*((pity&&pity.prismatic)||0))+(isLate&&ownsT?LATE_ODDS.transcendent:0));
  const gold=Math.min(100-prismatic-transcendent,base.gold+PITY_STEP.gold*((pity&&pity.gold)||0));
  return {silver:100-prismatic-gold-transcendent,gold,prismatic,transcendent};
}
// A gold resets the gold counter, a prismatic (or transcendent) resets both.
function nextPity(pity,tier,late) {
  const gold=(pity&&pity.gold)||0,prismatic=(pity&&pity.prismatic)||0,t=(pity&&pity.transcendent)||0;
  const nextT=tier==='transcendent'?0:(late&&late.level>=LATE_LEVEL?t+1:t);
  if (tier==='prismatic'||tier==='transcendent') return {gold:0,prismatic:0,transcendent:nextT};
  if (tier==='gold') return {gold:0,prismatic:prismatic+1,transcendent:nextT};
  return {gold:gold+1,prismatic:prismatic+1,transcendent:nextT};
}
function rollTier(pity,random,late) {
  const odds=tierOdds(pity,late);
  let roll=random()*100;
  const hit=TIERS.find(t=>(roll-=odds[t.id])<0);
  return (hit||TIERS[0]).id;
}
// Pick OFFER_SIZE augments of one tier the player can still take. `avoid`
// (the previous options on a reroll) is skipped while enough others remain.
function offerOptions(owned,tier,random,avoid=[],loadout) {
  const open=AUGMENTS.filter(a=>a.tier===tier && available(a,owned,loadout));
  const fresh=open.filter(a=>!avoid.includes(a.id));
  const pool=(fresh.length>=OFFER_SIZE?fresh:open).map(a=>a.id);
  for (let i=pool.length-1;i>0;i--) {const j=Math.floor(random()*(i+1));const swap=pool[i];pool[i]=pool[j];pool[j]=swap;}
  const pick=pool.slice(0,OFFER_SIZE);
  // At least one card for an equipped skill whenever this tier has one.
  const isExclusive=id=>{const a=AUGMENTS.find(x=>x.id===id);return !!(a&&(a.exclusive||a.requires));};
  if (tier!=='transcendent' && !pick.some(isExclusive)) {
    const extra=pool.slice(OFFER_SIZE).find(isExclusive);
    if (extra) pick[pick.length-1]=extra;
  }
  return pick;
}
function rollOffer(owned,random=Math.random,loadout,pity,level=0) {
  owned=owned || [];
  const tier=rollTier(pity,random,{level,owned});
  // Fall back to another tier if this one has nothing left to offer.
  const order=[tier].concat(TIERS.map(t=>t.id).filter(id=>id!==tier));
  for (let k=0;k<order.length;k++) {
    const id=order[k];
    const options=offerOptions(owned,id,random,[],loadout);
    if (options.length) return {tier:id,options,rerolled:options.map(()=>false),seen:[]};
  }
  return null;
}
// Replace one card of the offer with another augment of the same tier that
// is not on the table and was not rerolled away. Each card rerolls once;
// returns null when that card was already rerolled or nothing else is left.
function rerollOffer(owned,offer,index,random=Math.random,loadout) {
  const options=(offer&&offer.options)||[],rerolled=(offer&&offer.rerolled)||options.map(()=>false);
  if (!Number.isInteger(index) || index<0 || index>=options.length || rerolled[index]) return null;
  const seen=(offer.seen||[]).concat([options[index]]);
  const pool=AUGMENTS.filter(a=>a.tier===offer.tier && available(a,owned||[],loadout) && !options.includes(a.id) && !seen.includes(a.id));
  if (!pool.length) return null;
  const pick=pool[Math.floor(random()*pool.length)].id;
  return Object.assign({},offer,{options:options.map((id,i)=>i===index?pick:id),rerolled:rerolled.map((done,i)=>done||i===index),seen});
}
function modifiers(owned) {
  const n=id=>{const a=AUGMENTS.find(a=>a.id===id);return Math.min(rank(owned,id),a?stackMax(a):0);},has=id=>n(id)>0;
  const own={};(owned||[]).forEach(id=>{own[id]=true;});
  return {own, spin:1+.2*n('spin'),
    hasteCooldown:Math.max(1-CAPS.cooldownReduction,1-.1*n('haste')-(has('perpetual')?.3:0)-(has('timeSplitter')?.15:0)),
    length:Math.min(CAPS.length,(1+.15*n('length'))*(has('colossus')?1.6:1)*(has('titanForm')?2:1)), width:has('titanForm')?1.5:1,
    giantDuration:3000+1000*n('duration'), reach:1+.25*n('reach'), pierce:1+.25*n('pierce'),
    maxHealth:50*n('vitality')+100*n('colossus'), healthScale:has('glassCannon')?.75:1,
    movement:(1+.1*n('fleet'))*(has('titanForm')?.85:1),
    damageTaken:Math.max(1-CAPS.damageReduction,.9**n('armor')), thornsPower:has('thorns')?1.5:0,
    lightningChance:has('lightning')?.3:0, corpseBomb:has('corpseBomb')?.15:0, orbs:n('orb'),
    vampireHeal:8*n('vampire'), longThrow:1+.25*n('longThrow'), throwSize:1+.15*n('longThrow'),
    momentum:1+.2*n('momentum'), momentumDamage:1+.2*n('momentum'),
    damageScale:(has('glassCannon')?1.55:1)*(has('titanForm')?1.5:1)*(has('debt')?1.25:1),
    healScale:has('debt')?.8:1, pickupRange:has('scent')?1.35:1,
    thrustCharges:has('twin')?3:1,
    reverse:has('reverse'),chain:has('chain'),tempest:has('tempest'),knockback:has('knockback'),
    tip:has('tip'),quake:has('quake'),pursuit:has('pursuit'),execute:has('execute'),
    twin:has('twin'),absorb:has('absorb'),spoils:has('spoils'),immortal:has('immortal'),
    thorns:has('thorns'),vampire:has('vampire'),berserk:has('berserk'),
    harvest:has('harvest'),top:has('top'),cyclone:has('cyclone'),runner:has('runner'),
    lightning:has('lightning'),orb:has('orb'),bloodlust:has('bloodlust'),doubleEdge:has('doubleEdge'),
    guillotine:has('guillotine'),riposte:has('riposte'),blinkStrike:has('blinkStrike'),parry:has('parry'),
    turretTwin:has('turretTwin'),aftershock:has('aftershock'),wildfire:has('wildfire'),frenzy:has('frenzy'),
    nova:has('nova'),glassCannon:has('glassCannon'),mirror:has('mirror'),chrono:has('chrono'),
    bladeStorm:has('bladeStorm'),stormLord:has('stormLord'),perpetual:has('perpetual'),titanForm:has('titanForm'),
    chainReaction:has('chainReaction'),firstBeat:has('firstBeat'),breather:has('breather'),accent:has('accent'),critEdge:has('critEdge'),stormMath:has('stormMath'),brink:has('brink'),guardians:has('guardians'),vampLord:has('vampLord'),gravity:has('gravity')};
}
function stats(level,owned) {
  const mod=modifiers(owned);
  return {hpmax:Math.round((100+(level-1)*10+mod.maxHealth)*mod.healthScale), damage:10+(level-1)};
}
function resolveDamage(p,amount,now) {
  let shield=p.shieldUntil>now ? p.shield || 0 : 0;
  if (p.hp<=0 || p.invulnerableUntil>now || p.choosingAugment) return {hp:p.hp,shield,reviveUsed:!!p.reviveUsed,invulnerableUntil:p.invulnerableUntil || 0};
  amount=Math.round(amount*modifiers(p.augments).damageTaken);
  const absorbed=Math.min(shield,amount); shield-=absorbed;
  let hp=p.hp-(amount-absorbed), reviveUsed=!!p.reviveUsed, invulnerableUntil=p.invulnerableUntil || 0;
  if (hp<=0 && modifiers(p.augments).immortal && !reviveUsed) {hp=1;reviveUsed=true;invulnerableUntil=now+2000;}
  return {hp:Math.max(0,hp),shield,reviveUsed,invulnerableUntil};
}
const CHARGE={speed:520,duration:550,distance:286};
function chargeDestination(x,y,dx,dy){
  const wallX=dx>0?(2950-x)/dx:dx<0?(-2950-x)/dx:Infinity;
  const wallY=dy>0?(2950-y)/dy:dy<0?(-2950-y)/dy:Infinity;
  const length=Math.max(0,Math.min(CHARGE.distance,wallX,wallY));
  return {x:x+dx*length,y:y+dy*length};
}
function chargeTelegraph(enemy){
  if(enemy.type!=='charger'||!['windup','charge'].includes(enemy.phase)||!Number.isFinite(enemy.chargeEndX)||!Number.isFinite(enemy.chargeEndY))return null;
  const dx=enemy.chargeEndX-enemy.x,dy=enemy.chargeEndY-enemy.y;
  return {length:Math.hypot(dx,dy),angle:Math.atan2(dy,dx),endX:enemy.chargeEndX,endY:enemy.chargeEndY};
}
module.exports={specFor:BOOK.specFor,CODES:BOOK.CODES,LATE_LEVEL,MOVERS,CAPS,stackMax,CHARGE,chargeDestination,chargeTelegraph,TREES,TIERS,BASE_ODDS,tierOdds,nextPity,AUGMENTS,SKILLS,DEFAULT_SKILLS,validSkills,SPELLS,DEFAULT_SPELLS,validSpells,kitOf,rollOffer,rerollOffer,rank,levelForXp,xpForLevel,offerCount,canChoose,modifiers,stats,resolveDamage};
