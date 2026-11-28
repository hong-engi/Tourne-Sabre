import {AUGMENTS,SKILLS,SPELLS,canChoose,offerCount,modifiers,stats,resolveDamage,levelForXp,xpForLevel,rollOffer} from './gameRules';
import {Player} from './object';
import {createSkills,activate,updateWeapon} from './skills';
test('normal levels grow stats; only milestone levels grant augmentation choices',()=>{
  const p=new Player('test');p.xpup(100);
  expect(p.lv).toBe(3);expect(p.hpmax).toBe(120);expect(p.r).toBe(25);
  expect(stats(3,[]).damage).toBe(12);
  expect([40,99,100,180,400].map(levelForXp)).toEqual([2,2,3,4,6]);
  expect([1,2,3,6].map(xpForLevel)).toEqual([0,40,100,400]);
  expect([2,3,5,6,15,18].map(offerCount)).toEqual([0,1,1,2,5,6]);
});
test('augments across three rarities; offers come from one rarity and only offered picks are valid',()=>{
  expect(new Set(AUGMENTS.map(a=>a.id)).size).toBe(AUGMENTS.length);
  // Every requirement names a real skill or spell.
  const kit=new Set([...SKILLS,...SPELLS].map(s=>s.id));
  AUGMENTS.filter(a=>a.requires).forEach(a=>[].concat(a.requires).forEach(id=>expect(kit.has(id)).toBe(true)));
  expect(new Set(AUGMENTS.map(a=>a.tier))).toEqual(new Set(['silver','gold','prismatic','transcendent']));
  expect(AUGMENTS.find(a=>a.id==='thorns')).toMatchObject({tree:'resolve',tier:'silver'});
  const offer=rollOffer([],()=>.5);
  expect(offer.options).toHaveLength(3);
  expect(offer.options.every(id=>AUGMENTS.find(a=>a.id===id).tier===offer.tier)).toBe(true);
  expect(canChoose([],3,offer.options[0],offer)).toBe(true);
  expect(canChoose([],3,AUGMENTS.find(a=>!offer.options.includes(a.id)).id,offer)).toBe(false);
  expect(canChoose([],2,offer.options[0],offer)).toBe(false);
});
test('giant, rotation and reach augmentations modify the real weapon envelope',()=>{
  const p=new Player('test');p.skills=createSkills();p.augments=['length','spin','reach','duration'];
  activate(p,'KeyW',0);activate(p,'KeyR',0);updateWeapon(p,175,1/60);
  expect(p.sw_h).toBeCloseTo(165*1.15);expect(p.sw_r).toBeCloseTo(65+155*1.25);
  expect(p.skills.until.giant).toBe(4000);expect(p.sw_speed).toBeCloseTo(Math.PI*1.2);
});
test('twin thrust supports three charges then sequential recharge',()=>{
  const p=new Player('test');p.augments=['twin'];p.skills=createSkills();p.skills.charges=3;
  expect(activate(p,'KeyR',100)).toBe('thrust');
  expect(activate(p,'KeyR',500)).toBe('thrust');
  expect(activate(p,'KeyR',900)).toBe('thrust');
  expect(activate(p,'KeyR',1300)).toBe(false);
  updateWeapon(p,3600,0);expect(p.skills.charges).toBe(1);
  updateWeapon(p,7100,0);expect(p.skills.charges).toBe(2);
  updateWeapon(p,10600,0);expect(p.skills.charges).toBe(3);
});
test('shield absorption and immortal are real defenses; last stand triggers once',()=>{
  const p={hp:10,shield:12,shieldUntil:5000,augments:['immortal']};
  expect(resolveDamage(p,15,1000).hp).toBe(7);
  const survived=resolveDamage(p,50,1000);
  expect(survived.hp).toBe(1);expect(survived.reviveUsed).toBe(true);
  expect(resolveDamage({...p,...survived},50,2000).hp).toBe(1);
  expect(resolveDamage({...p,...survived},50,4000).hp).toBe(0);
  expect(modifiers(['vitality','vitality']).maxHealth).toBe(100);
});
