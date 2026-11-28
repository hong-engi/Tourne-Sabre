import {bindGameInput} from './input';
test('Korean character and composing events still activate the physical QWER DF keys once', () => {
  const skill=jest.fn(); const input=bindGameInput(window,()=>true,skill);
  ['KeyQ','KeyW','KeyE','KeyR','KeyD','KeyF'].forEach((code,i)=>{
    const event=new KeyboardEvent('keydown',{key:['ㅂ','ㅈ','ㄷ','ㄱ','ㅇ','ㄹ'][i],code,isComposing:true,bubbles:true,cancelable:true});
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    document.body.dispatchEvent(new KeyboardEvent('keydown',{code,repeat:true,bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{code}));
  });
  expect(skill.mock.calls.map(call=>call[0])).toEqual(['KeyQ','KeyW','KeyE','KeyR','KeyD','KeyF']);
  input.dispose();
});
test('arrows prevent scrolling, blur clears movement, typing and shortcuts are untouched', () => {
  const skill=jest.fn(); const input=bindGameInput(window,()=>true,skill);
  const event=new KeyboardEvent('keydown',{code:'ArrowUp',bubbles:true,cancelable:true});
  document.body.dispatchEvent(event);
  expect(input.keys.ArrowUp).toBe(true); expect(event.defaultPrevented).toBe(true);
  window.dispatchEvent(new Event('blur')); expect(input.keys.ArrowUp).toBeUndefined();
  const field=document.createElement('input'); document.body.appendChild(field);
  field.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',bubbles:true}));
  document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',ctrlKey:true,bubbles:true}));
  expect(skill).not.toHaveBeenCalled();
  field.remove(); input.dispose();
});
