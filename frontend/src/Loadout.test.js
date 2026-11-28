import {render,screen,fireEvent,within} from '@testing-library/react';
import Loadout,{swapInto,loadLoadout,saveLoadout} from './Loadout';
import {DEFAULT_SKILLS,DEFAULT_SPELLS} from './gameRules';

afterEach(()=>window.localStorage.clear());
test('swapping a skill that sits on another key trades the two keys',()=>{
  const base={skills:DEFAULT_SKILLS,spells:DEFAULT_SPELLS};
  expect(swapInto(base,0,'dash').skills).toEqual(['dash','giant','accel','thrust']);
  expect(swapInto(base,0,'thrust').skills).toEqual(['thrust','giant','accel','reverse']);
  expect(swapInto(base,5,'blink').spells).toEqual(['heal','blink']);
  expect(swapInto(base,4,'smite').spells).toEqual(['smite','heal']);
});
test('saved loadouts are validated when read back',()=>{
  saveLoadout({skills:['dash','slam','turret','boomerang'],spells:['ignite','smite']});
  expect(loadLoadout()).toEqual({skills:['dash','slam','turret','boomerang'],spells:['ignite','smite']});
  window.localStorage.setItem('tourne-sabre-loadout','{"skills":["dash","dash","x","y"],"spells":["nope"]}');
  expect(loadLoadout()).toEqual({skills:DEFAULT_SKILLS,spells:DEFAULT_SPELLS});
});
test('each slot opens a picker for its row; choosing fills the slot and closes it',()=>{
  const change=jest.fn();
  render(<Loadout loadout={{skills:DEFAULT_SKILLS,spells:DEFAULT_SPELLS}} onChange={change}/>);
  const slots=screen.getAllByRole('button');
  expect(slots.map(b=>b.textContent)).toEqual(['Q회전 반전','W거대 검','E회전 가속','R찌르기','D점멸','F회복']);
  fireEvent.click(screen.getByRole('button',{name:/^E: 회전 가속/}));
  const dialog=screen.getByRole('dialog',{name:/스킬 고르기/});
  expect(within(dialog).getByRole('button',{name:/회전 가속.*장착 중/})).toHaveAttribute('aria-pressed','true');
  expect(within(dialog).getByRole('button',{name:/찌르기.*R와 교체/})).toBeInTheDocument();
  expect(within(dialog).queryByRole('button',{name:/점멸/})).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button',{name:/돌진 베기/}));
  expect(change).toHaveBeenCalledWith({skills:['reverse','giant','dash','thrust'],spells:DEFAULT_SPELLS});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/^F: 회복/}));
  const spells=screen.getByRole('dialog',{name:/주문 고르기/});
  expect(within(spells).getAllByRole('button').length).toBe(8);
  fireEvent.keyDown(spells,{key:'Escape'});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
