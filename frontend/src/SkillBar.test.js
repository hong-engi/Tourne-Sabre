import {render,screen,fireEvent} from '@testing-library/react';
import SkillBar from './SkillBar';
import {Player} from './object';
import {createSkills,activate,skillSnapshot} from './skills';

test('ready, active, and cooldown states have distinct labels and button availability',()=>{
  const p=new Player('test');p.skills=createSkills();const cast=jest.fn();
  const view=render(<SkillBar skills={skillSnapshot(p,0)} onActivate={cast}/>);
  const q=()=>screen.getByRole('button',{name:'Q 역회전 베기'});
  expect(q()).toHaveAttribute('data-state','ready');expect(q()).toHaveTextContent('준비 완료');
  fireEvent.click(q());expect(cast).toHaveBeenCalledWith('KeyQ');
  activate(p,'KeyQ',100);
  view.rerender(<SkillBar skills={skillSnapshot(p,150)} onActivate={cast}/>);
  expect(q()).toHaveAttribute('data-state','active');expect(q()).toHaveTextContent('발동 중');expect(q()).toBeDisabled();
  view.rerender(<SkillBar skills={skillSnapshot(p,500)} onActivate={cast}/>);
  expect(q()).toHaveAttribute('data-state','cooldown');expect(q()).toHaveTextContent('재사용 대기');expect(q()).toHaveTextContent('0.5');
  view.rerender(<SkillBar skills={skillSnapshot(p,1000)} onActivate={cast}/>);
  expect(q()).toHaveAttribute('data-state','ready');expect(q()).toBeEnabled();
});
test('twin thrust blocks repeat casting during its animation, then exposes the remaining charge',()=>{
  const p=new Player('test');p.skills=createSkills();p.augments=['twin'];p.skills.charges=3;
  activate(p,'KeyR',100);
  const view=render(<SkillBar skills={skillSnapshot(p,200)} onActivate={jest.fn()}/>);
  expect(screen.getByRole('button',{name:'R 찌르기'})).toBeDisabled();
  view.rerender(<SkillBar skills={skillSnapshot(p,500)} onActivate={jest.fn()}/>);
  const r=screen.getByRole('button',{name:'R 찌르기'});
  expect(r).toBeEnabled();expect(r).toHaveTextContent('2 / 3회');expect(r).toHaveAttribute('data-state','ready');
});
