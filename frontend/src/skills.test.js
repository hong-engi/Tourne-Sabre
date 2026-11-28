import {Player} from './object';
import {createSkills, activate, updateWeapon, skillSnapshot} from './skills';
function player() {const p = new Player('test'); p.skills = createSkills(); return p;}
test('reversal persists, cooldown prevents repeated toggles', () => {
  const p = player();
  expect(activate(p,'KeyQ',100)).toBe('reverse');
  expect(activate(p,'KeyQ',101)).toBe(false);
  updateWeapon(p,200,1/30);
  expect(p.sw_angle).toBeGreaterThan(0);
  expect(activate(p,'KeyQ',1001)).toBe('reverse');
  expect(p.skills.direction).toBe(1);
});
test('giant and haste stack and expire without permanently changing the weapon', () => {
  const p = player(); activate(p,'KeyW',100); activate(p,'KeyE',100);
  updateWeapon(p,200,1/30);
  expect(p.sw_h).toBe(165); expect(p.sw_speed).toBeGreaterThan(Math.PI*2);
  updateWeapon(p,3300,1/30);
  expect(p.sw_h).toBe(100); expect(p.sw_w).toBe(40); expect(p.sw_speed).toBe(Math.PI);
});
test('thrust locks the current sword angle, independent of movement direction', () => {
  const p = player(); p.sw_angle=-Math.PI/2; p.skills.facing={x:0,y:-1}; activate(p,'KeyR',100);
  updateWeapon(p,275,1/30);
  const enemy = new Player('target',270,0);
  expect(p.trytohit(enemy)).toBe(true);
  expect(p.attackMultiplier).toBe(2.4);
  updateWeapon(p,500,0);
  expect(p.trytohit(enemy)).toBe(false);
  expect(p.sw_r).toBe(65);
});

test('thrust angle stays locked throughout extension and resumes rotation afterward',()=>{
  const p=player();p.sw_angle=.83;activate(p,'KeyR',100);
  for(const now of [101,200,300,449]){p.skills.facing={x:-1,y:0};updateWeapon(p,now,1/60);expect(p.sw_angle).toBe(.83);}
  updateWeapon(p,451,1/60);expect(p.sw_angle).not.toBe(.83);
});
test('HUD snapshots distinguish instant cast, cooldown, and ready with augmented timings',()=>{
  const p=player();activate(p,'KeyQ',100);
  expect(skillSnapshot(p,150)[0].state).toBe('active');
  expect(skillSnapshot(p,500)[0].state).toBe('cooldown');
  expect(skillSnapshot(p,1000)[0].state).toBe('ready');
  p.augments=['haste','duration'];activate(p,'KeyE',1200);activate(p,'KeyW',1200);
  const bar=skillSnapshot(p,1300);
  expect(bar[2].cooldown).toBe(5250);expect(bar[1].duration).toBe(6000);expect(bar[1].activeRemaining).toBe(5900);
});
test('Q whips one full turn in the reversed direction, then keeps the normal speed',()=>{
  const {Player}=require('./object');const {createSkills,activate,updateWeapon,Q_SPIN_MS}=require('./skills');
  const p=new Player('test');p.skills=createSkills();p.augments=[];p.sw_angle=0;
  activate(p,'KeyQ',0);
  let travelled=0;for(let t=0;t<Q_SPIN_MS;t+=10){const before=p.sw_angle;updateWeapon(p,t,.01);travelled+=Math.atan2(Math.sin(p.sw_angle-before),Math.cos(p.sw_angle-before));}
  expect(p.skills.direction).toBe(-1);
  expect(Math.abs(travelled)).toBeCloseTo(Math.PI*2,1);expect(travelled).toBeGreaterThan(0);
  updateWeapon(p,Q_SPIN_MS+10,.01);expect(p.sw_speed).toBeCloseTo(-Math.PI);
});
const loadoutPlayer=(skills,spells=['blink','heal'])=>{const p=player();p.loadout=skills;p.spells=spells;p.augments=[];p.sw_angle=0;return p;};
test('skills follow the loadout: any skill on any key, state keyed by skill id',()=>{
  const p=loadoutPlayer(['slam','thrust','dash','turret']);
  expect(activate(p,'KeyW',100)).toBe('thrust');expect(p.skills.until.thrust).toBe(450);
  const bar=skillSnapshot(p,200);
  expect(bar.map(s=>`${s.key}:${s.id}`)).toEqual(['Q:slam','W:thrust','E:dash','R:turret','D:blink','F:heal']);
  expect(bar[1].state).toBe('active');
  expect(activate(p,'KeyQ',300)).toBe('slam');
  expect(p.skills.bursts).toEqual([{kind:'slam',x:p.pos.x,y:p.pos.y}]);
});
test('dash lunges along the facing direction and sweeps the blade across the front',()=>{
  const p=loadoutPlayer(['dash','giant','accel','thrust']);p.pos.x=0;p.pos.y=0;p.skills.facing={x:1,y:0};
  activate(p,'KeyQ',0);
  const angles=[];
  for(let t=10;t<=250;t+=20){updateWeapon(p,t,.02);angles.push(p.sw_angle);expect(p.combatState.dash).toBe(true);}
  expect(p.pos.x).toBeGreaterThan(200);expect(p.pos.y).toBeCloseTo(0);
  // The blade starts on one side of the facing direction and ends on the other.
  const side=a=>-Math.cos(a);
  expect(Math.sign(side(angles[0]-Math.PI/2))).not.toBe(0);
  expect(angles[0]).toBeGreaterThan(angles[angles.length-1]);
  expect(p.attackMultiplier).toBeCloseTo(1.8);
  updateWeapon(p,300,.02);expect(p.combatState.dash).toBe(false);const x=p.pos.x;updateWeapon(p,320,.02);expect(p.pos.x).toBe(x);
});
test('turret stands where it was placed, twin blade mirrors the sword, boomerang flies out and back',()=>{
  const p=loadoutPlayer(['turret','twinBlade','boomerang','thrust']);p.pos.x=50;p.pos.y=60;p.skills.facing={x:0,y:-1};
  activate(p,'KeyQ',0);activate(p,'KeyW',0);activate(p,'KeyE',0);
  p.pos.x=400;updateWeapon(p,450,.02);
  const blade=name=>p.blades.find(b=>b.blade.startsWith(name));
  expect(blade('turret')).toMatchObject({x:50,y:60});
  expect(blade('twin').sw_angle).toBeCloseTo(p.sw_angle+Math.PI);
  expect(blade('boomerang').y).toBeLessThan(60-300);expect(blade('boomerang').x).toBe(400);
  updateWeapon(p,950,.02);expect(blade('boomerang')).toBeUndefined();
  updateWeapon(p,6100,.02);expect(blade('turret')).toBeUndefined();expect(blade('twin')).toBeUndefined();
});
test('haste shortens every QWER cooldown multiplicatively, never to zero',()=>{
  const p=loadoutPlayer(['slam','dash','turret','boomerang']);p.augments=Array(30).fill('haste');
  const bar=skillSnapshot(p,0);
  expect(bar[0].cooldown).toBeCloseTo(9000*.75**30);expect(bar[0].cooldown).toBeGreaterThan(0);
});
test('extra swords share the circle evenly instead of overlapping',()=>{
  const p=loadoutPlayer(['twinBlade','giant','accel','thrust']);p.augments=['doubleEdge'];
  activate(p,'KeyQ',0);updateWeapon(p,100,.02);
  const angle=name=>p.blades.find(b=>b.blade===name).sw_angle-p.sw_angle;
  expect(angle('twin')).toBeCloseTo(Math.PI*2/3);expect(angle('back')).toBeCloseTo(Math.PI*4/3);
});
test('turrets copy the player sword, including giant size',()=>{
  const p=loadoutPlayer(['turret','giant','accel','thrust']);
  activate(p,'KeyQ',0);activate(p,'KeyW',0);updateWeapon(p,100,.02);
  const t=p.blades.find(b=>b.blade.startsWith('turret'));
  expect(t.sw_h).toBe(p.sw_h);expect(t.sw_w).toBe(58);
});
