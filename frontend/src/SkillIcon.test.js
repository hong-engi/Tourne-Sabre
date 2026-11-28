import {render,waitFor,act} from '@testing-library/react';
import SkillIcon from './SkillIcon';
import {prepareIcon} from './skillIconOutline';

jest.mock('./skillIconOutline',()=>({prepareIcon:jest.fn()}));
const originalObserver=global.ResizeObserver;
let observers;
beforeEach(()=>{
  observers=[];
  global.ResizeObserver=class {
    constructor(callback){this.callback=callback;this.disconnect=jest.fn();observers.push(this);}
    observe(){}
  };
  prepareIcon.mockImplementation((src,size)=>Promise.resolve(`prepared:${size}:${src}`));
});
afterEach(()=>{global.ResizeObserver=originalObserver;jest.clearAllMocks();});

test('prepares each display size separately instead of shrinking the previous outline',async()=>{
  const view=render(<SkillIcon id="giant"/>),image=view.container.querySelector('img');
  await waitFor(()=>expect(image).toHaveAttribute('data-outline-size','40'));
  image.getBoundingClientRect=()=>({width:32});
  act(()=>observers[0].callback());
  await waitFor(()=>expect(image).toHaveAttribute('data-outline-size','32'));
  expect(image.src).toContain('prepared:32:');
});

test('queued resize notifications and image work are ignored after picker unmount',async()=>{
  let resolveImage;
  prepareIcon.mockImplementation(()=>new Promise(resolve=>{resolveImage=resolve;}));
  const view=render(<SkillIcon id="ghost"/>),observer=observers[0];
  view.unmount();
  expect(observer.disconnect).toHaveBeenCalled();
  expect(()=>observer.callback()).not.toThrow();
  await act(async()=>resolveImage('late-image'));
});
