import {newerBuildAvailable,reloadIfUpdated,takeSavedRun} from './updates';
const manifest=main=>()=>Promise.resolve({json:()=>Promise.resolve({files:{'main.js':main}})});
const page=src=>({scripts:[{src:'http://localhost:3001/static/js/runtime-main.1.js'},{src:`http://localhost:3001${src}`}]});
const env=process.env.NODE_ENV;
beforeEach(()=>{process.env.NODE_ENV='production';});
afterEach(()=>{process.env.NODE_ENV=env;window.sessionStorage.clear();});

test('only a different main bundle counts as a newer build',async()=>{
  expect(await newerBuildAvailable(page('/static/js/main.a.chunk.js'),manifest('/static/js/main.a.chunk.js'))).toBe(false);
  expect(await newerBuildAvailable(page('/static/js/main.a.chunk.js'),manifest('/static/js/main.b.chunk.js'))).toBe(true);
  expect(await newerBuildAvailable(page('/x'),()=>Promise.reject(new Error('offline')))).toBe(false);
  process.env.NODE_ENV='development';
  expect(await newerBuildAvailable(page('/x'),manifest('/y'))).toBe(false);
});
test('when a run ends on an old build, reload and keep the run summary',async()=>{
  const reload=jest.fn();
  expect(await reloadIfUpdated({lv:7,xp:900},{doc:page('/static/js/main.a.chunk.js'),load:manifest('/static/js/main.a.chunk.js'),reload})).toBe(false);
  expect(reload).not.toHaveBeenCalled();
  expect(await reloadIfUpdated({lv:7,xp:900},{doc:page('/static/js/main.a.chunk.js'),load:manifest('/static/js/main.b.chunk.js'),reload})).toBe(true);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(takeSavedRun()).toEqual({lv:7,xp:900});
  expect(takeSavedRun()).toBe(null);
});
