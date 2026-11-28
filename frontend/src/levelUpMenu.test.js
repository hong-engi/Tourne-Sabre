import frameUpdate,{gainXp,LEVEL_UP_MENU_DELAY,NOVA_MENU_DELAY} from './frameUpdater';
import {addEffect} from './mapdraw';
jest.mock('./map',()=>({map:{sync:jest.fn(),kill:jest.fn()}}));
jest.mock('./canvas',()=>({death:jest.fn()}));
jest.mock('./mapdraw',()=>({addEffect:jest.fn()}));
jest.mock('./skills',()=>({updateWeapon:jest.fn(),addKills:jest.fn(),bladeTouches:jest.fn()}));

const hero=augments=>({id:'hero',lv:2,augments,pos:{x:0,y:0},skills:{bursts:[]},augmentMenuOpen:false,dead:()=>false,xpup(){this.lv=3;}});
beforeEach(()=>jest.clearAllMocks());

test('a plain milestone leaves time to see the level-up before opening the picker',()=>{
  const me=hero([]);
  gainXp(me,100,1000);
  expect(me.augmentMenuOpen).toBe(false);
  expect(me.augmentMenuAt).toBe(1000+LEVEL_UP_MENU_DELAY);
  expect(addEffect).toHaveBeenCalledWith('levelUp',{x:0,y:0,id:'hero'},'Lv. 3',1000);
  frameUpdate(me,{},null,1000+LEVEL_UP_MENU_DELAY);
  expect(me.augmentMenuOpen).toBe(true);
  expect(me.augmentMenuAt).toBe(0);
});
test('with the level-up explosion, the picker waits until the blast has played',()=>{
  const me=hero(['nova']);
  gainXp(me,100,1000);
  expect(me.skills.bursts).toEqual([{kind:'nova',x:0,y:0}]);
  expect(me.augmentMenuOpen).toBe(false);
  frameUpdate(me,{},null,1000+NOVA_MENU_DELAY);
  expect(me.augmentMenuOpen).toBe(true);
  expect(me.augmentMenuAt).toBe(0);
});

test('ordinary levels show the effect without scheduling an augment picker',()=>{
  const me=hero([]);me.lv=1;me.xpup=function(){this.lv=2;};
  gainXp(me,40,1000);
  expect(addEffect).toHaveBeenCalledWith('levelUp',{x:0,y:0,id:'hero'},'Lv. 2',1000);
  expect(me.augmentMenuOpen).toBe(false);
  expect(me.augmentMenuAt).toBeUndefined();
});

test('XP without a level-up does not emit the level-up effect',()=>{
  const me=hero([]);me.xpup=()=>{};
  gainXp(me,1,1000);
  expect(addEffect).not.toHaveBeenCalled();
  expect(me.augmentMenuAt).toBeUndefined();
});

test('further XP does not postpone an already scheduled picker',()=>{
  const me=hero([]);
  gainXp(me,100,1000);
  me.xpup=function(){this.lv=6;};
  gainXp(me,300,1200);
  expect(me.augmentMenuAt).toBe(1000+LEVEL_UP_MENU_DELAY);
  expect(addEffect).toHaveBeenLastCalledWith('levelUp',{x:0,y:0,id:'hero'},'Lv. 6',1200);
});
