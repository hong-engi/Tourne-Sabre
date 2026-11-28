// Shared (browser + backend) data for the expansion skills, spells and
// augments from AUGMENT.md. Plain CommonJS: no spread, no for...of, no rest
// destructuring, so the production build adds no Babel helpers.
//
// Effect vocabulary (`fx`), read by the server skill engine
// (backend/src/game/skillEngine.js):
//   hit    shape circle|line|cone at self|front|point, delay ms, power ×A,
//          ticks/every for damage over time, status {slow:[factor,ms],
//          root:ms, stun:ms, burn:[power,ms], bleed:[power,ms]}, pull,
//          push, low:[hpFraction,bonusPower], angle (radians offset),
//          follow (moves with the caster), last (ms the zone is drawn/lives)
//   shield pct of max health for ms      heal pct      hot pct per s, ticks
//   guard  dr (damage reduction) for ms  parry block window + counter power
//   buff   dmg bonus for ms (lifesteal optional)        cost pct of current hp
//   shots  destroy enemy projectiles within r for ms (max)
//   undying ms   anchor ms (lethal save)   decoy ms r   wall len ms
//   record ms (heal back a share of damage taken)
// Client-only parts: `move` (dash|blink|nearest|turret|anchor|rewind|gate),
// `speed` [mult,ms], `phase` ms, `spin` [mult,ms], `blades` (orbiting swords),
// `recast` window ms. Numbers follow AUGMENT.md section 5-9, with the red-team
// fixes from section 2.3 (E10 retreats along the move direction, W02/W07
// guard all around, Q07/Q12/D05 hit boxes are wider).
const R=Math.PI/180;
function hit(o){o.t='hit';return o;}

const NEW_SKILLS = [
  // Q: precise strikes
  {id:'crescent',code:'Q04',line:'Q',name:'초승달 베기',cooldown:4500,duration:0,description:'앞쪽으로 넓은 부채꼴(100도) 검기를 휘둘러, 범위 안의 모든 적에게 공격력의 140% 피해를 준다. 가까이 몰려온 적을 한 번에 정리할 때 좋다.',
    fx:[hit({shape:'cone',at:'self',len:220,spread:100*R,power:1.4})]},
  {id:'crossScar',code:'Q05',line:'Q',name:'십자 검흔',cooldown:6000,duration:0,description:'앞쪽으로 X자 모양의 검흔 두 줄을 긋는다. 각 줄은 공격력의 110% 피해를 주고, 두 줄이 겹치는 정면의 적은 두 번 맞는다.',
    fx:[hit({shape:'line',at:'self',len:280,w:60,angle:-22*R,power:1.1}),hit({shape:'line',at:'self',len:280,w:60,angle:22*R,power:1.1})]},
  {id:'needleRain',code:'Q07',line:'Q',name:'바늘비',cooldown:8000,duration:500,description:'0.5초 동안 작은 검 5개를 앞쪽으로 연달아 쏜다. 검마다 공격력의 50% 피해를 주며 멀리(검 길이 약 4배)까지 날아간다.',
    fx:[-2,-1,0,1,2].map(function(k,i){return hit({shape:'line',at:'self',len:420,w:44,angle:k*6*R,delay:i*100,power:.5,tag:'needle'+i});})},
  {id:'iaido',code:'Q08',line:'Q',name:'발도',cooldown:9000,duration:600,description:'0.6초 동안 칼을 뽑을 준비를 한 뒤(이 동안 이동이 30% 느려짐) 앞쪽 일직선을 크게 벤다. 공격력의 300% 피해. 바닥의 경고선을 보고 적을 몰아넣자.',
    speed:[.7,600],fx:[hit({shape:'line',at:'self',len:320,w:110,delay:600,power:3,warn:true})]},
  {id:'sawThrow',code:'Q10',line:'Q',name:'톱날 투척',cooldown:9000,duration:1200,description:'앞쪽(검 길이 약 3배 거리)에 회전 톱날을 던져 1.2초 동안 그 자리에 머물게 한다. 톱날은 0.3초마다 공격력의 70% 피해를 4번 준다.',
    fx:[hit({shape:'circle',at:'point',off:300,r:70,delay:300,ticks:4,every:300,power:.7,tag:'saw'})]},
  {id:'bloodSeal',code:'Q11',line:'Q',name:'혈인',cooldown:7000,duration:0,description:'가까운 적 하나에게 공격력의 120% 피해를 주고 4초 동안 핏빛 표식을 남긴다. 표식이 남은 적을 검으로 3번 베면 표식이 터져 200% 피해를 추가로 준다.',
    fx:[hit({shape:'circle',at:'nearest',range:300,r:30,power:1.2,mark:{ms:4000,hits:3,power:2}})]},
  {id:'horizon',code:'Q12',line:'Q',name:'지평선 절단',cooldown:12000,duration:800,description:'0.8초 동안 화면 끝까지 이어지는 경고선을 그린 뒤, 그 직선 전체를 베어 공격력의 420% 피해를 준다. 느리지만 가장 길고 강한 일격.',
    fx:[hit({shape:'line',at:'self',len:600,w:120,delay:800,power:4.2,warn:true})]},
  // W: defence and blade buffs
  {id:'parryStance',code:'W02',line:'W',name:'받아치기',cooldown:9000,duration:750,description:'0.75초 동안 받는 피해가 60% 줄어든다. 사용 직후 0.18초 안에 공격을 받으면 그 피해를 완전히 막고, 주변 적에게 공격력의 120%로 반격한다.',
    fx:[{t:'guard',dr:.6,ms:750},{t:'parry',ms:180,power:1.2,r:150}]},
  {id:'bladeVeil',code:'W03',line:'W',name:'검막',cooldown:12000,duration:4000,description:'4초 동안 최대 체력의 18%만큼 피해를 대신 막아 주는 보호막을 두르고, 그동안 검이 15% 더 빨리 돈다.',
    spin:[1.15,4000],fx:[{t:'shield',pct:.18,ms:4000,src:'veil'}]},
  {id:'ironStance',code:'W04',line:'W',name:'철갑 자세',cooldown:11000,duration:3000,description:'3초 동안 받는 피해가 35% 줄어든다. 대신 이동 속도가 10% 느려진다. 위험한 순간을 버티는 기본 방어 스킬.',
    speed:[.9,3000],fx:[{t:'guard',dr:.35,ms:3000}]},
  {id:'frostMail',code:'W05',line:'W',name:'서리 갑주',cooldown:14000,duration:3000,description:'3초 동안 냉기를 둘러 주변 적을 35% 느리게 만들고, 최대 체력의 12% 보호막을 얻는다.',
    fx:[{t:'shield',pct:.12,ms:3000,src:'frost'},hit({shape:'circle',at:'self',follow:true,r:150,ticks:6,every:500,power:0,status:{slow:[.65,600]},tag:'frost',last:3000})]},
  {id:'bloodPact',code:'W06',line:'W',name:'혈갑 계약',cooldown:16000,duration:4000,description:'현재 체력의 10%를 바쳐서, 4초 동안 최대 체력 15% 보호막과 직접 주는 피해 +35%를 얻는다. 체력이 넉넉할 때 쓰는 공격형 방어.',
    fx:[{t:'cost',pct:.1},{t:'shield',pct:.15,ms:4000,src:'pact'},{t:'buff',dmg:.35,ms:4000}]},
  {id:'mirrorShield',code:'W07',line:'W',name:'거울 방패',cooldown:13000,duration:2000,description:'2초 동안 내 주변으로 날아오는 적의 투사체를 최대 4개까지 지워 준다. 원거리 적이 많을 때 쓴다.',
    fx:[{t:'shots',r:120,ms:2000,max:4}]},
  {id:'swordWall',code:'W08',line:'W',name:'검벽',cooldown:16000,duration:3000,description:'앞쪽에 검으로 된 벽을 3초 동안 세운다. 일반 적은 벽을 지나오지 못하고 투사체도 막힌다. 보스는 막지 못한다.',
    fx:[{t:'wall',off:120,len:220,ms:3000}]},
  {id:'thornCloak',code:'W09',line:'W',name:'가시 외투',cooldown:15000,duration:4000,description:'4초 동안 받는 피해가 20% 줄어들고, 나를 때린 적에게 공격력의 60% 피해를 되돌려 준다(같은 적에게는 0.5초에 한 번).',
    fx:[{t:'guard',dr:.2,ms:4000,thorns:.6}]},
  {id:'sanctuary',code:'W10',line:'W',name:'수호 성역',cooldown:18000,duration:5000,description:'발밑에 5초 동안 성역을 편다. 성역 안에 있으면 매초 최대 체력의 3%를 회복하고 받는 피해가 15% 줄어든다.',
    fx:[{t:'sanctum',r:160,ms:5000,heal:.03,dr:.15}]},
  {id:'timeShell',code:'W11',line:'W',name:'시간 갑피',cooldown:20000,duration:3000,description:'3초 동안 시간을 감아 둔다. 그동안 잃은 체력의 30%를 끝날 때 되돌려 받는다(최대 체력의 20%까지).',
    fx:[{t:'record',ms:3000,share:.3,max:.2}]},
  {id:'fortress',code:'W12',line:'W',name:'움직이는 성채',cooldown:24000,duration:5000,description:'5초 동안 검이 50% 길어지고 최대 체력 30% 보호막을 얻지만, 이동이 15% 느려진다. 보호막이 깨지면 검 길이도 원래대로 돌아온다.',
    speed:[.85,5000],length:[1.5,5000],fx:[{t:'shield',pct:.3,ms:5000,src:'fortress'}]},
  // E: movement and spin
  {id:'hookStep',code:'E04',line:'E',name:'갈고리 발걸음',cooldown:8000,duration:200,description:'앞쪽 가까운 적에게 순식간에 달려가 공격력의 80% 피해를 준다. 주변에 적이 없으면 발동하지 않고 대기시간도 쓰지 않는다.',
    move:{kind:'nearest',range:400,stop:70},fx:[hit({shape:'circle',at:'dest',r:70,power:.8})]},
  {id:'afterimage',code:'E05',line:'E',name:'잔영 보법',cooldown:7000,duration:1000,description:'이동 방향으로 짧게 순간 이동한다. 출발한 자리에 남은 잔영이 0.6초 뒤 주변을 베어 공격력의 100% 피해를 준다.',
    move:{kind:'dash',dist:180,ms:180},fx:[hit({shape:'circle',at:'origin',r:100,delay:600,power:1,tag:'echo'})]},
  {id:'chainRush',code:'E08',line:'E',name:'연쇄 돌입',cooldown:11000,duration:200,description:'이동 방향으로 돌진하며 부딪힌 적에게 공격력의 110% 피해를 준다. 적을 맞혔다면 2초 안에 한 번 더 돌진할 수 있다.',
    move:{kind:'dash',dist:180,ms:200},recast:2000,fx:[hit({shape:'line',at:'origin',len:180,w:80,power:1.1})]},
  {id:'magnetLeap',code:'E09',line:'E',name:'자력 도약',cooldown:12000,duration:200,description:'가까운 내 검 포탑 위치로 날아간다(포탑이 없으면 앞으로 짧게 도약). 착지한 곳 주변에 공격력의 120% 피해를 준다.',
    move:{kind:'turret',range:500,dist:160},fx:[hit({shape:'circle',at:'dest',r:100,power:1.2})]},
  {id:'retreatGust',code:'E10',line:'E',name:'후퇴 검풍',cooldown:9000,duration:180,description:'이동 방향으로 물러나면서, 반대편(원래 바라보던 쪽)에 검풍을 날려 공격력의 180% 피해를 준다. 치고 빠지기용.',
    move:{kind:'dash',dist:180,ms:180},fx:[hit({shape:'cone',at:'origin',len:240,spread:60*R,angle:Math.PI,power:1.8})]},
  {id:'beatWalk',code:'E11',line:'E',name:'박자 걷기',cooldown:10000,duration:3000,description:'3초 동안 짧은 순간 이동을 2번 쓸 수 있다. 이동 직후 0.7초 안에 검으로 적을 맞히면 공격력의 60% 피해가 추가된다.',
    move:{kind:'dash',dist:150,ms:120},recast:3000,recasts:1,fx:[{t:'beat',ms:700,power:.6}]},
  {id:'stormTrail',code:'E12',line:'E',name:'폭풍의 궤적',cooldown:18000,duration:3000,description:'3초 동안 이동 속도가 30% 빨라지고, 지나간 길에 2초 동안 검풍이 남아 그 위의 적에게 매초 공격력의 90% 피해를 준다.',
    speed:[1.3,3000],fx:[{t:'trail',ms:3000,r:55,last:2000,power:.9}]},
  // R: summons and areas
  {id:'bladeRain',code:'R06',line:'R',name:'검우',cooldown:24000,duration:4000,description:'앞쪽 넓은 영역에 4초 동안 검의 비를 내린다. 0.5초마다 범위 안 적에게 공격력의 55% 피해(최대 8번).',
    fx:[hit({shape:'circle',at:'point',off:260,r:180,delay:500,ticks:8,every:500,power:.55,tag:'rain',last:4000})]},
  {id:'gravityWell',code:'R07',line:'R',name:'중력 우물',cooldown:22000,duration:3000,description:'앞쪽에 3초 동안 중력 우물을 만들어 주변 적을 가운데로 끌어당긴다. 끝날 때 폭발하여 공격력의 220% 피해를 준다.',
    fx:[hit({shape:'circle',at:'point',off:250,r:240,ticks:15,every:200,power:0,pull:80,tag:'well',last:3000}),hit({shape:'circle',at:'point',off:250,r:240,delay:3000,power:2.2,tag:'wellEnd'})]},
  {id:'phoenix',code:'R09',line:'R',name:'불사조 검무',cooldown:28000,duration:0,description:'앞쪽으로 세 갈래 불꽃 검풍을 날린다. 갈래마다 공격력의 150% 피해를 주고, 맞은 적은 3초 동안 불타며 매초 40% 피해를 받는다.',
    fx:[-1,0,1].map(function(k){return hit({shape:'line',at:'self',len:360,w:60,angle:k*20*R,power:1.5,status:{burn:[.4,3000]},tag:'phoenix'});})},
  {id:'execCircle',code:'R10',line:'R',name:'집행 원',cooldown:30000,duration:900,description:'0.9초 경고 후 원형 범위에 공격력의 420% 피해를 준다. 체력이 30% 이하인 적은 150% 피해를 더 받는다. 마무리용.',
    fx:[hit({shape:'circle',at:'self',r:190,delay:900,power:4.2,low:[.3,1.5],warn:true})]},
  {id:'timeGarden',code:'R11',line:'R',name:'시간 정원',cooldown:32000,duration:5000,description:'발밑에 5초 동안 시간 정원을 편다. 안에 있으면 QWER 대기시간이 25% 더 빨리 돌아오고, 안에 들어온 적은 30% 느려진다.',
    garden:{r:220,ms:5000,rate:1.25},fx:[hit({shape:'circle',at:'self',r:220,ticks:10,every:500,power:0,status:{slow:[.7,600]},tag:'garden',last:5000})]},
  {id:'kingsMarch',code:'R12',line:'R',name:'검왕의 행진',cooldown:36000,duration:7000,description:'7초 동안 작은 검 5개가 내 주위를 넓게 돌며, 닿은 적에게 공격력의 65% 피해를 준다.',
    blades:{count:5,r:230,w:26,h:60,power:.65,ms:7000,speed:1.8},fx:[]},
];
const NEW_SPELLS = [
  {id:'decoy',code:'D04',line:'D',name:'미끼',cooldown:20000,duration:2500,description:'2.5초 동안 그 자리에 미끼를 둔다. 주변의 일반 적은 나 대신 미끼를 쫓아간다(보스는 속지 않음).',fx:[{t:'decoy',ms:2500,r:220}]},
  {id:'markShot',code:'D05',line:'D',name:'눈표',cooldown:18000,duration:0,description:'앞쪽으로 표식 화살을 쏜다. 처음 맞은 적은 공격력의 60% 피해를 입고 1.5초 동안 40% 느려진다. 3초 안에 다시 누르면 그 적 앞까지 돌진한다.',
    recast:3000,fx:[hit({shape:'line',at:'self',len:500,w:60,power:.6,first:true,status:{slow:[.6,1500]},mark:{ms:3000,tag:'eye'}})]},
  {id:'anchor',code:'D06',line:'D',name:'귀환 닻',cooldown:20000,duration:4000,description:'그 자리에 닻을 내리고 앞으로 짧게 순간 이동한다. 4초 안에 다시 누르면 닻 위치로 돌아온다. 들어갔다 빠지기용.',
    move:{kind:'blink',dist:180},recast:4000,fx:[]},
  {id:'warBanner',code:'D10',line:'D',name:'전투 깃발',cooldown:25000,duration:5000,description:'5초 동안 깃발을 꽂는다. 깃발 주변(반경 200)에 있으면 주는 피해와 이동 속도가 15%씩 오른다.',banner:{r:200,ms:5000},fx:[{t:'banner',r:200,ms:5000,dmg:.15}]},
  {id:'twinGate',code:'D12',line:'D',name:'쌍문',cooldown:30000,duration:6000,description:'지금 위치와 앞쪽에 문 두 개를 6초 동안 연다. 문에 닿으면 반대쪽 문으로 이동한다(한 번 쓰면 3초 뒤 다시 사용 가능).',move:{kind:'gate',dist:320,ms:6000},fx:[]},
  {id:'bloodFuel',code:'F07',line:'F',name:'피의 연료',cooldown:24000,duration:6000,description:'6초 동안 직접 주는 피해가 10% 오르고, 준 피해의 15%만큼 체력을 회복한다.',fx:[{t:'buff',dmg:.1,ms:6000,steal:.15}]},
  {id:'freezeWave',code:'F08',line:'F',name:'동결 파동',cooldown:24000,duration:0,description:'주변(반경 260) 적을 0.75초 동안 얼려 움직이지 못하게 하고, 그 뒤 2초 동안 45% 느리게 만든다.',
    fx:[hit({shape:'circle',at:'self',r:260,power:0,status:{root:750,slow:[.55,2750]},tag:'freeze'})]},
  {id:'oath',code:'F09',line:'F',name:'불굴의 맹세',cooldown:30000,duration:1000,description:'1초 동안 어떤 공격을 받아도 체력이 1 아래로 내려가지 않는다. 죽기 직전의 순간에 쓴다.',fx:[{t:'undying',ms:1000}]},
  {id:'emberBloom',code:'F10',line:'F',name:'잿불 꽃',cooldown:24000,duration:0,description:'주변(반경 250)에 불꽃을 터뜨려 공격력의 160% 피해를 주고, 3초 동안 불태워 매초 35% 피해를 준다.',
    fx:[hit({shape:'circle',at:'self',r:250,power:1.6,status:{burn:[.35,3000]},tag:'ember'})]},
  {id:'lifeAnchor',code:'F11',line:'F',name:'생명의 닻',cooldown:34000,duration:6000,description:'6초 동안 생명의 닻을 내린다. 그 사이에 죽을 피해를 받으면 닻 위치로 돌아가 최대 체력 20%로 살아나고, 0.5초 동안 무적이 된다.',fx:[{t:'anchor',ms:6000}]},
  {id:'secondDawn',code:'F12',line:'F',name:'두 번째 새벽',cooldown:40000,duration:4000,description:'즉시 최대 체력의 20%를 회복하고, 20% 보호막(4초)을 얻으며, 걸려 있던 둔화를 풀고, 4초 동안 이동 속도가 20% 오른다.',
    speed:[1.2,4000],cleanse:300,fx:[{t:'heal',pct:.2},{t:'shield',pct:.2,ms:4000,src:'dawn'}]},
];
// Codes of the original 16 abilities, for exclusive augments.
const CODES={Q01:'reverse',Q02:'thrust',Q03:'boomerang',W01:'giant',E01:'accel',E02:'dash',R01:'twinBlade',R02:'turret',R03:'slam',
  D01:'blink',D02:'ghost',D03:'smite',F01:'heal',F02:'barrier',F03:'exhaust',F04:'ignite'};
NEW_SKILLS.concat(NEW_SPELLS).forEach(function(s){CODES[s.code]=s.id;});
const byCode=function(code){return CODES[code];};

// Exclusive augments. `patch` edits the skill's fx/spec (applied by specFor);
// anything else is a named hook the engine checks by id.
function X(code,name,tier,description,extra){
  const a={id:'x'+code,code:'X-'+code,tree:'skill',name:name,tier:tier,requires:byCode(code),exclusive:true,description:description};
  if (extra) Object.keys(extra).forEach(function(k){a[k]=extra[k];});
  return a;
}
const EXCLUSIVE = [
  X('Q01','역회전 잔상','gold','역회전 베기가 끝나면 잔상 검이 한 바퀴 더 돌아 주변 적에게 공격력의 80% 피해를 준다.'),
  X('Q02','꿰맨 상처','gold','찌르기의 끝부분(앞쪽 30%)으로 맞힌 적은 3초 동안 피를 흘려 매초 공격력의 45% 피해를 받는다.'),
  X('Q03','손끝 조종','gold','돌아오는 부메랑이 적을 맞힐 때마다 부메랑 대기시간이 0.25초 줄어든다(한 번 던질 때 최대 1초).'),
  X('Q04','이지러진 달','silver','초승달 베기 양 끝에서 뒤쪽으로 작은 검풍 두 개가 함께 나가 각각 공격력의 60% 피해를 준다. 등 뒤의 적도 함께 벤다.',{patch:{addFx:[hit({shape:'cone',at:'self',len:150,spread:40*R,angle:Math.PI-55*R,power:.6,tag:'wane'}),hit({shape:'cone',at:'self',len:150,spread:40*R,angle:-Math.PI+55*R,power:.6,tag:'wane'})]}}),
  X('Q05','정확한 교점','gold','십자 검흔의 두 줄을 모두 맞은 적(교차점 근처)은 0.6초 동안 움직이지 못한다.'),
  X('Q07','마지막 바늘','gold','바늘비의 마지막 5번째 검이 공격력의 150% 피해를 준다. 앞의 4개 중 3개 이상 맞은 적은 0.5초 기절한다.',{patch:{setTag:{needle4:{power:1.5}}}}),
  X('Q08','납도','gold','발도로 적을 맞히면 2초 안에 한 번 더 눌러 같은 길을 공격력의 150%로 다시 벨 수 있다.',{patch:{recast:2000}}),
  X('Q10','이빨의 왕','prismatic','톱날이 사라질 때 그 자리에서 폭발하여 주변 적에게 공격력의 180% 피해를 준다.',{patch:{addFx:[hit({shape:'circle',at:'point',off:300,r:100,delay:1200,power:1.8,tag:'sawKing'})]}}),
  X('Q11','붉은 서명','gold','혈인 표식이 터질 때 주변의 다른 적에게도 공격력의 100% 피해가 퍼진다.'),
  X('Q12','두 번째 수평선','prismatic','지평선 절단 양옆에 보조 검선 두 줄이 0.4초 늦게 내려와 각각 공격력의 100% 피해를 준다. 피하기 훨씬 어려워진다.',{patch:{addFx:[hit({shape:'line',at:'self',len:600,w:60,side:70,delay:1200,power:1}),hit({shape:'line',at:'self',len:600,w:60,side:-70,delay:1200,power:1})]}}),
  X('W01','거인의 뒷날','gold','거대 검을 쓰는 동안 반대편에 조금 작은 검(길이 70%)이 하나 더 생겨 공격력의 65% 피해를 준다.'),
  X('W02','완벽한 박자','gold','받아치기로 공격을 완전히 막았을 때 반격이 공격력의 240%로 강해지고, 반격 맞은 적은 1초 동안 40% 느려진다.',{patch:{setT:{parry:{power:2.4,slow:[.6,1000]}}}}),
  X('W03','깨지는 칼집','silver','검막 보호막이 적의 공격으로 깨지면 파편이 터져 주변 적에게 공격력의 100% 피해를 준다.'),
  X('W04','철의 관성','gold','철갑 자세를 써도 느려지지 않는다. 자세가 끝나면 1.5초 동안 오히려 이동 속도가 25% 빨라진다.',{patch:{speed:null,after:[1.25,1500]}}),
  X('W05','얼음 가시','gold','서리 갑주가 끝날 때 얼음 가시가 솟아 주변 적에게 공격력의 160% 피해를 준다.',{patch:{addFx:[hit({shape:'circle',at:'self',follow:true,r:150,delay:3000,power:1.6,tag:'icicle'})]}}),
  X('W06','계약 만기','gold','혈갑 계약이 끝날 때 남아 있던 보호막의 70%만큼 체력을 회복한다. 바친 체력을 되찾을 수 있다.'),
  X('W07','오목 거울','prismatic','거울 방패가 투사체를 하나 지울 때마다 가까운 적에게 공격력의 80% 피해를 돌려준다.'),
  X('W08','문 있는 검벽','gold','검벽을 세운 뒤 3초 안에 다시 누르면 벽을 거두면서 벽 앞뒤로 공격력의 120% 피해를 준다.',{patch:{recast:3000}}),
  X('W09','접힌 가시','gold','가시 외투로 반격을 5번 할 때마다 외투 지속시간이 0.5초 늘어난다(최대 2초).'),
  X('W10','성역의 종','prismatic','성역 안에서 체력을 10% 잃을 때마다 종이 울려 주변 적에게 공격력의 120% 피해를 준다(한 번에 최대 3회).'),
  X('W11','되돌린 충격','gold','시간 갑피가 끝나며 체력을 되돌려 받을 때, 회복한 양의 2배만큼 주변 적에게 피해를 준다(최대 공격력의 300%).'),
  X('W12','이동 요새','prismatic','움직이는 성채를 쓰는 동안 주변으로 날아오는 투사체를 6개까지 막아 준다.',{patch:{addFx:[{t:'shots',r:110,ms:5000,max:6}]}}),
  X('E01','삼박자 가속','gold','회전 가속 중 서로 다른 적 3명을 맞히면 가속이 0.8초 더 이어진다(한 번만).'),
  X('E02','급정거','gold','돌진 베기가 끝난 자리 주변에 공격력의 100% 피해를 주고 1초 동안 40% 느리게 만든다.'),
  X('E04','역갈고리','gold','갈고리 발걸음으로 붙은 적을 내 뒤쪽으로 넘겨 버린다. 보스는 넘기지 못하는 대신 80% 피해를 더 받는다.'),
  X('E05','남겨진 검객','gold','잔영이 한 번이 아니라 두 번(0.6초, 1초 뒤) 베고, 각각 공격력의 80% 피해를 준다.',{patch:{setTag:{echo:{power:.8}},addFx:[hit({shape:'circle',at:'origin',r:100,delay:1000,power:.8,tag:'echo2'})]}}),
  X('E08','세 번째 발걸음','prismatic','연쇄 돌입의 두 번째 돌진도 적을 맞히면 세 번째 돌진(공격력의 90%)을 한 번 더 쓸 수 있다.',{patch:{recasts:2}}),
  X('E09','자리 교대','gold','자력 도약으로 포탑에 날아가면 포탑이 내가 있던 자리로 옮겨지고 1초 더 남는다. 위치를 맞바꾸는 셈.'),
  X('E10','추격 금지','gold','후퇴 검풍을 쓴 자리에 2초 동안 바람이 남아, 그 안의 적이 45% 느려진다. 쫓아오는 적을 따돌린다.',{patch:{addFx:[hit({shape:'circle',at:'origin',r:100,ticks:4,every:500,power:0,status:{slow:[.55,600]},tag:'noChase',last:2000})]}}),
  X('E11','정박','gold','박자 걷기의 두 번 이동 모두 추가 적중에 성공하면 대기시간 2초를 돌려받는다.'),
  X('E12','길 위의 폭풍','prismatic','폭풍의 궤적이 남기는 길의 피해가 60% 늘어난다.',{patch:{setT:{trail:{power:1.45}}}}),
  X('R01','엇박 쌍검','gold','쌍검의 추가 검이 반대 방향으로 돌고, 적을 처음 맞힐 때 150% 피해를 준다.'),
  X('R02','회수 명령','gold','검 포탑 스킬을 다시 누르면 포탑이 나에게 날아오며 지나는 길의 적에게 공격력의 140% 피해를 준다.'),
  X('R03','중심 타격','gold','내려찍기의 한가운데(반경 70) 맞은 적은 피해를 60% 더 받는다.'),
  X('R06','장마전선','gold','검우가 내리는 영역이 바라본 방향으로 천천히 이동한다(초당 45). 도망가는 적을 쫓아간다.',{patch:{setTag:{rain:{drift:45}}}}),
  X('R07','사건의 테두리','gold','중력 우물 가장자리를 지나가는 적이 0.5초마다 공격력의 50% 피해를 받는다.',{patch:{addFx:[hit({shape:'circle',at:'point',off:250,r:240,ring:40,ticks:6,every:500,power:.5,tag:'rim',last:3000})]}}),
  X('R09','잿빛 귀환','gold','불사조 검풍이 날아간 뒤 한 번 돌아오며 다시 공격력의 80% 피해를 준다.',{patch:{addFx:[-1,0,1].map(function(k){return hit({shape:'line',at:'self',len:360,w:60,angle:k*20*R,delay:500,power:.8,tag:'ash'});})}}),
  X('R10','집행 유예','prismatic','집행 원을 맞고도 살아남은 적에게 2초 표식을 남긴다. 그동안 그 적에게 준 피해의 20%를 모았다가 터뜨린다(최대 공격력의 200%).'),
  X('R11','느린 초침','gold','시간 정원 안으로 들어온 적 투사체가 35% 느려진다.'),
  X('R12','왕의 대열','prismatic','검왕의 행진 검들의 피해가 80% 늘어난다.',{patch:{blades:{power:1.17}}}),
  X('D01','접힌 출발점','gold','점멸로 떠난 자리에 1초 동안 검 흔적이 남아, 닿은 적에게 공격력의 100% 피해를 준다.'),
  X('D02','긴 보폭','silver','유체화 지속시간이 1.2초 늘어난다.'),
  X('D03','정밀 강타','gold','강타가 체력 40% 이하인 적에게 피해를 40% 더 준다. 강타로 적을 처치하면 대기시간 3초를 돌려받는다.'),
  X('D04','가짜의 최후','gold','미끼가 사라질 때 폭발하여 주변 적에게 공격력의 180% 피해를 주고 1초 동안 30% 느리게 만든다.',{patch:{addFx:[hit({shape:'circle',at:'self',r:180,delay:2500,power:1.8,status:{slow:[.7,1000]},tag:'fake'})]}}),
  X('D05','눈길 개척','gold','눈표로 돌진한 길에 2초 동안 냉기가 남아, 그 위의 적이 40% 느려진다.'),
  X('D06','닻의 파문','gold','귀환 닻으로 돌아올 때 닻 주변 적에게 공격력의 160% 피해를 준다.'),
  X('D10','들고 가는 깃발','prismatic','전투 깃발이 한 자리에 꽂히지 않고 나를 따라다닌다.',{patch:{follow:true}}),
  X('D12','문지기','prismatic','쌍문 근처에 적이 처음 다가오면 공격력의 120% 피해를 준다.'),
  X('F01','남겨 둔 약','silver','회복으로 최대 체력을 넘친 양의 절반을 3초 보호막으로 바꾼다(최대 최대 체력의 12%).'),
  X('F02','방벽 파편','gold','방벽 보호막이 적의 공격으로 깨지면 가까운 적 4명에게 공격력의 80% 피해를 준다.'),
  X('F03','탈진 고리','gold','탈진에 걸린 적 주변에 2초 동안 장판이 생겨, 근처의 다른 적도 35% 느려진다.'),
  X('F04','재점화','gold','점화로 불타는 적을 3번 베면 불꽃이 터져 공격력의 100% 피해를 준다.'),
  X('F07','불완전 연소','gold','피의 연료 지속시간이 1초 늘어난다.',{patch:{setT:{buff:{ms:7000}}}}),
  X('F08','빙판 깨기','gold','동결 파동에 얼어붙은 적을 처음 검으로 벨 때 공격력의 120% 피해를 더 준다.'),
  X('F09','맹세의 값','prismatic','불굴의 맹세로 죽음을 버텨 냈다면, 맹세가 끝날 때 최대 체력의 12%를 회복한다.'),
  X('F10','잿불 번식','gold','잿불 꽃의 화상으로 죽은 적의 불이 주변 적 2명에게 옮겨붙는다.'),
  X('F11','튼튼한 닻줄','prismatic','생명의 닻으로 살아난 뒤 2초 동안 최대 체력 15% 보호막을 얻는다.'),
  X('F12','동틀 무렵','prismatic','두 번째 새벽의 보호막이 끝까지 남아 있으면, 남은 양의 절반만큼 체력을 회복한다(최대 10%).'),
];
function C(n,name,tier,a,b,description){return {id:'combo'+n,code:'C-'+(n<10?'0':'')+n,tree:'skill',name:name,tier:tier,requiresAll:[byCode(a),byCode(b)],exclusive:true,description:description};}
const COMBOS = [
  C(1,'역방향 초승달','gold','Q01','Q04','역회전 베기를 쓴 뒤 1초 안에 초승달 베기를 쓰면 반대쪽(뒤)에도 초승달이 하나 더 나가 공격력의 100% 피해를 준다.'),
  C(2,'성벽 포대','gold','W08','R02','내 검 포탑이 검벽 가까이 있으면 포탑의 검이 25% 길어진다.'),
  C(4,'받아치고 물러서기','gold','W02','E10','받아치기로 공격을 완전히 막은 뒤 2초 안에 후퇴 검풍을 쓰면 검풍 피해가 60% 늘어난다.'),
  C(5,'눈표 처형식','gold','D05','Q02','눈표로 돌진한 뒤 1초 안에 찌르기로 그 적을 맞히면 공격력의 120% 피해를 더 준다.'),
  C(9,'핏빛 조항','prismatic','W06','Q11','혈갑 계약 중 혈인 표식이 터지면, 그 피해의 20%만큼 혈갑 보호막이 다시 차오른다.'),
  C(11,'닻에 맺힌 서리','prismatic','D06','F08','동결 파동이 내 위치뿐 아니라 귀환 닻 위치에서도 함께 퍼진다.'),
  C(12,'왕의 쌍문','prismatic','R12','D12','검왕의 행진 중 쌍문을 지나면, 들어간 문에 작은 검이 남아 회전하며 공격력의 35% 피해를 준다.'),
];
function U(id,code,name,tier,tree,description,extra){const a={id:id,code:code,tree:tree,name:name,tier:tier,description:description};if(extra)Object.keys(extra).forEach(function(k){a[k]=extra[k];});return a;}
const COMMONS = [
  U('sheath','U-S02','검집의 여유','silver','resolve','3초 동안 스킬을 쓰지 않고 버티면 최대 체력 6% 보호막을 3초 동안 얻는다(6초에 한 번).'),
  U('outStep','U-S03','바깥 걸음','silver','lance','검으로 적을 맞히면 1초 동안 이동 속도가 12% 빨라진다(2초에 한 번).'),
  U('toughen','U-S04','아픈 만큼 단단하게','silver','resolve','피해를 받으면 2초 동안 받는 피해가 8% 줄어든다(5초에 한 번).'),
  U('kindling','U-S05','마른 장작','silver','storm','같은 적을 4번 베면 그 적이 3초 동안 불타며 매초 공격력의 20% 피해를 받는다.'),
  U('frostlet','U-S06','작은 서리','silver','storm','2초마다 다음 검 적중이 차가워져, 맞은 적이 0.8초 동안 20% 느려진다.'),
  U('glance','U-S08','빗겨 맞히기','silver','resolve','검의 안쪽(손잡이 쪽)으로 적을 맞히면 최대 체력 4% 보호막을 2초 동안 얻는다(4초에 한 번).'),
  U('tidy','U-S09','빠른 수습','silver','resolve','8초마다 최대 체력의 2%를 자동으로 회복한다.'),
  U('balance','U-S11','무게 중심','silver','titan','적을 밀치거나 끌어당긴 뒤 다음 검 적중이 공격력의 40% 피해를 더 준다(2초에 한 번).'),
  U('smallWin','U-S12','작은 승리','silver','resolve','적을 15명 처치할 때마다 체력을 5 회복한다(최대 10번).'),
  U('heatLeft','U-G02','남겨진 열기','gold','lance','돌진이나 순간 이동이 끝난 자리에서 0.5초 뒤 열기가 터져 주변 적에게 공격력의 100% 피해를 준다(2초에 한 번). 이동 스킬이 있어야 나온다.',{needsMove:true}),
  U('scarCollector','U-G03','상처 수집가','gold','resolve','불타거나 피 흘리는 적을 처치하면 최대 체력의 3%를 회복한다.'),
  U('fillGap','U-G05','빈틈 채우기','gold','resolve','서로 다른 QWER 스킬 두 개를 2초 안에 이어 쓰면 최대 체력 8% 보호막을 3초 동안 얻는다(6초에 한 번).'),
  U('spoilsOrb','U-G06','흩어진 전리품','gold','resolve','적을 처치할 때마다 최대 체력의 2%를 회복한다(1초에 최대 2번).'),
  U('tipWatch','U-G07','끝을 보는 자','gold','lance','검 끝으로 적을 5번 맞힐 때마다 4초 안에 쓰는 다음 스킬의 피해가 35% 늘어난다.'),
  U('escape','U-G08','피할 자리','gold','resolve','체력이 35% 아래로 떨어지면 주변 적을 밀어내고 크게(70%) 느리게 만든다. 탈출할 틈을 준다(20초에 한 번).'),
  U('turnEconomy','U-G10','회전의 경제','gold','storm','서로 다른 적 5명을 베면, 대기시간이 가장 많이 남은 QWER 스킬의 대기시간이 1초 줄어든다(4초에 한 번).'),
  U('shards','U-G11','반짝이는 파편','gold','storm','날아오는 적 투사체를 검으로 쳐내면 파편이 튀어 가까운 적 2명에게 공격력의 80% 피해를 준다.'),
  U('crisisSplit','U-G12','위기 분할','gold','resolve','한 번에 최대 체력의 15% 이상 큰 피해를 받으면 그중 25%를 막아 준다(8초에 한 번).'),
  U('echoArt','U-P01','메아리 검술','prismatic','storm','8초마다, 다음에 쓰는 공격 스킬이 0.6초 뒤 같은 자리에서 45% 위력으로 한 번 더 터진다.'),
  U('nebula','U-P02','칼날 성운','prismatic','storm','검으로 8번 맞힐 때마다 3초 동안 작은 위성 검 2개가 내 주위를 돌며 공격력의 45% 피해를 준다.'),
  U('healToHarm','U-P03','회복의 반대편','prismatic','resolve','체력을 회복한 뒤 다음 검 적중에 공격력의 250% 피해가 더해진다(5초에 한 번).'),
  U('weakSpot','U-P04','선명한 약점','prismatic','lance','검 적중이 15% 확률로 치명타(피해 1.5배)가 된다. 치명타를 맞은 적은 3초 동안 모든 피해를 15% 더 받는다.'),
  U('doom','U-P07','지연된 파국','prismatic','titan','10초마다, 다음에 처치한 적의 자리에서 1초 뒤 큰 폭발이 일어나 주변에 공격력의 350% 피해를 준다.'),
  U('fourBreaths','U-P08','네 가지 호흡','prismatic','storm','장착한 QWER 4개를 6초 안에 모두 쓰면, 대기시간이 가장 많이 남은 스킬의 남은 시간이 40% 줄어든다(12초에 한 번).'),
];
function T(id,code,name,description){return {id:id,code:code,tree:'skill',name:name,tier:'transcendent',description:description};}
const TRANSCENDENT = [
  T('rainbowKing','T-01','일곱 빛의 검왕','무지개빛 검 3개가 더 생겨 함께 돈다(길이 80%, 피해 60%). 본체 검으로 7번 맞힐 때마다 주변에 공격력의 160% 파동이 퍼진다.'),
  T('timeSplitter','T-02','시간을 가르는 자','모든 QWER 대기시간이 15% 짧아진다. 공격 스킬을 쓰면 0.6초 뒤 같은 자리에서 70% 위력으로 한 번 더 터진다.'),
  T('endlessDance','T-03','끝나지 않는 검무','서로 다른 QWER 3개를 4초 안에 쓰면 4초 동안 검무 상태가 된다: 검 회전 +60%, 피해 +25%, 그리고 모든 스킬 대기시간 2초 환급.'),
  T('workshopHeart','T-04','무한 공방의 심장','8초마다 작은 검 인형 2개가 3초 동안 나타나 싸운다(공격력의 55%). 검 포탑과 인형의 피해가 35% 늘어난다.'),
  T('causalKnot','T-05','인과의 매듭','한 판에 단 한 번, 죽을 피해를 받으면 3초 전에 있던 자리로 돌아가 최대 체력 35%로 살아나고 1초 동안 무적이 된다.'),
  T('devourerStar','T-06','포식하는 별','2초마다 주변 적 최대 5명을 끌어당기며 공격력의 90% 피해를 준다. 가만히 있어도 적이 빨려 든다.'),
  T('dawnForge','T-07','여명의 용광로','체력을 회복할 때마다 힘을 모아 둔다. 다음 스킬을 쓰면 주변에 공격력의 400% 폭발이 일어난다(2초에 한 번).'),
  T('chaosConcert','T-08','혼돈의 합주','장착한 QWER 4개를 8초 안에 모두 쓰면 6방향으로 검풍(공격력의 100%)이 터지고 최대 체력 20% 보호막을 4초 동안 얻는다(16초에 한 번).'),
];
const NEW_AUGMENTS = EXCLUSIVE.concat(COMBOS,COMMONS,TRANSCENDENT);

// The skill spec with the owner's exclusive augments applied. Returns a fresh
// object (never mutates the tables above).
function clone(o){return JSON.parse(JSON.stringify(o));}
const ALL=NEW_SKILLS.concat(NEW_SPELLS);
function specFor(id,owned){
  const base=ALL.find(function(s){return s.id===id;});
  if (!base) return null;
  const spec=clone(base);
  (owned||[]).forEach(function(aid){
    const a=EXCLUSIVE.find(function(x){return x.id===aid&&x.requires===id;});
    if (!a||!a.patch) return;
    const p=a.patch;
    if (p.addFx) spec.fx=spec.fx.concat(clone(p.addFx));
    if (p.setTag) Object.keys(p.setTag).forEach(function(tag){spec.fx.forEach(function(f){if(f.tag===tag)Object.assign(f,p.setTag[tag]);});});
    if (p.setT) Object.keys(p.setT).forEach(function(t){spec.fx.forEach(function(f){if(f.t===t)Object.assign(f,p.setT[t]);});});
    if (p.blades) Object.assign(spec.blades,p.blades);
    ['recast','recasts','follow','after'].forEach(function(k){if(p[k]!==undefined)spec[k]=p[k];});
    if (p.speed===null) delete spec.speed;
  });
  return spec;
}
module.exports={NEW_SKILLS,NEW_SPELLS,NEW_AUGMENTS,EXCLUSIVE,COMBOS,COMMONS,TRANSCENDENT,CODES,specFor};
