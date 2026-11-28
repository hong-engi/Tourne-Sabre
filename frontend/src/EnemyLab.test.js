import {filterTypes, labGroup} from './EnemyLab';
import {ENEMY_NAMES, ENEMY_SUMMARY} from './enemyNames';

const types=[
  {type:'spinner',tier:'normal'},{type:'lancer',tier:'normal'},
  {type:'warden',tier:'elite'},{type:'forge',tier:'boss'},
];

test('legacy enemies get their own group', ()=>{
  expect(labGroup(types[0])).toBe('legacy');
  expect(labGroup(types[1])).toBe('normal');
});

test('filters by group, notes and search text in Korean', ()=>{
  const notes={forge:{text:'증기 예고 더 길게',status:'todo'}};
  expect(filterTypes(types,'all',notes,'').length).toBe(4);
  expect(filterTypes(types,'normal',notes,'').map(t=>t.type)).toEqual(['lancer']);
  expect(filterTypes(types,'noted',notes,'').map(t=>t.type)).toEqual(['forge']);
  expect(filterTypes(types,'all',notes,'장창').map(t=>t.type)).toEqual(['lancer']);
  expect(filterTypes(types,'all',notes,'증기').map(t=>t.type)).toEqual(['forge']);
});

test('every listed enemy has a name and a summary', ()=>{
  for (const type of Object.keys(ENEMY_NAMES)) expect(ENEMY_SUMMARY[type]).toBeTruthy();
});
