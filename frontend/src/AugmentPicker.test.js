import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import AugmentPicker from './AugmentPicker';

test('shows the offered rarity with three cards, picks one, and rerolls a single card once',async()=>{
  const choose=jest.fn(()=>Promise.resolve()),reroll=jest.fn(()=>Promise.resolve());
  const hud={lv:3,augments:[],augmentOffer:{tier:'silver',options:['thorns','tip','vampire'],rerolled:[false,true,false]}};
  render(<AugmentPicker hud={hud} onChoose={choose} onReroll={reroll} onClose={jest.fn()}/>);
  expect(screen.getByRole('dialog')).toHaveTextContent('실버');
  const cards=screen.getAllByRole('button',{name:/실버/});
  expect(cards).toHaveLength(3);expect(cards[0]).toHaveTextContent('가시 갑옷');
  fireEvent.click(cards[0]);
  await waitFor(()=>expect(choose).toHaveBeenCalledWith('thorns'));
  expect(screen.getAllByRole('button',{name:/다시 뽑기/})).toHaveLength(3);
  expect(screen.getByRole('button',{name:'균열 · 다시 뽑기 사용함'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'흡혈 다시 뽑기'}));
  await waitFor(()=>expect(reroll).toHaveBeenCalledWith(2));
  expect(screen.queryByText(/다음 확률/)).not.toBeInTheDocument();
});
test('without a pending pick it lists owned augments only',()=>{
  render(<AugmentPicker hud={{lv:4,augments:['armor','armor'],augmentOffer:null}} onChoose={jest.fn()} onReroll={jest.fn()} onClose={jest.fn()}/>);
  expect(screen.getByRole('heading',{name:'획득한 증강'})).toBeInTheDocument();
  expect(screen.getByText('단단한 피부')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/다시 뽑기/})).not.toBeInTheDocument();
});
test('arrow keys held for movement do not scroll the panel',()=>{
  render(<AugmentPicker hud={{lv:4,augments:['armor'],augmentOffer:null}} onChoose={jest.fn()} onReroll={jest.fn()} onClose={jest.fn()}/>);
  const close=screen.getByRole('button',{name:'닫기'});
  ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].forEach(key=>expect(fireEvent.keyDown(close,{key,code:key})).toBe(false));
});
test('while choosing, owned augments collapse into chips with stack counts',()=>{
  const hud={lv:6,augments:['armor'],augmentOffer:{tier:'silver',options:['thorns','tip','vampire'],rerolled:[]}};
  render(<AugmentPicker hud={hud} onChoose={jest.fn()} onReroll={jest.fn()} onClose={jest.fn()}/>);
  const owned=screen.getByRole('region',{name:'보유 증강'});
  expect(owned.querySelectorAll('.augment-chip')).toHaveLength(1);
  fireEvent.mouseEnter(owned.querySelector('.augment-chip'));
  expect(owned).toHaveTextContent('단단한 피부');
});
