import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import EnemyLab from './EnemyLab';
import CodexLab, {filterItems} from './CodexLab';
import {scenarioFor} from './codexScenario';
import {addEffect} from './mapdraw';
const {catalog}=require('./codexCatalog');
const rules=require('./gameRules');

jest.mock('./mapdraw', () => ({
  addEffect: jest.fn(),
  drawLabPortrait: jest.fn(),
  drawLabScene: jest.fn(),
  resetEffects: jest.fn(),
}));

const ITEMS=catalog(rules);
const item=id=>ITEMS.find(i=>i.id===id);
let steps;

beforeEach(() => {
  steps=[];
  addEffect.mockClear();
  // Any 2D call is a no-op so card sketches and the stage can draw.
  const ctx=new Proxy({}, {get: (t, k) => (k in t ? t[k] : () => ({width: 0})), set: (t, k, v) => {t[k]=v; return true;}});
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  global.fetch = jest.fn((url, opts) => {
    const u=String(url);
    if (u.endsWith('/feedback')) return Promise.resolve({ok: true, json: () => Promise.resolve({vampire: {text: '회복 숫자가 잘 안 보임', at: 'x'}})});
    if (u.includes('/feedback/')) return Promise.resolve({ok: true, json: () => Promise.resolve({text: JSON.parse(opts.body).text, at: 'y'})});
    if (u.includes('/codex/')) {
      steps.push({url: u, body: opts && opts.body ? JSON.parse(opts.body) : null});
      return Promise.resolve({ok: true, json: () => Promise.resolve({enemies: [], projectiles: [], hits: 0, damage: 0, damageTaken: 0, attackHits: [], attack: {}})});
    }
    if (u.endsWith('/types')) return Promise.resolve({ok: true, json: () => Promise.resolve([])});
    if (u.endsWith('/notes')) return Promise.resolve({ok: true, json: () => Promise.resolve({})});
    return Promise.resolve({ok: true, json: () => Promise.resolve({})});
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('catalog covers every skill, spell and augment in its own section', () => {
  expect(ITEMS.filter(i=>i.section==='skill')).toHaveLength(rules.SKILLS.length);
  expect(ITEMS.filter(i=>i.section==='spell')).toHaveLength(rules.SPELLS.length);
  expect(ITEMS.filter(i=>i.section==='augment')).toHaveLength(rules.AUGMENTS.length);
  const fb={vampire:{text:'x'}};
  expect(filterItems(ITEMS,{tier:'silver'},fb).every(i=>i.tier==='silver')).toBe(true);
  expect(filterItems(ITEMS,{written:'done'},fb).map(i=>i.id)).toEqual(['vampire']);
});

test('scenarios equip the needed kit and build the trigger situation', () => {
  const berserk=scenarioFor(item('berserk'));
  expect(berserk.hpRatio).toBeLessThanOrEqual(.5);
  expect(berserk.setup.augments).toEqual(['berserk']);
  const guillotine=scenarioFor(item('guillotine'));
  expect(guillotine.setup.enemyHp).toBeLessThanOrEqual(.12);
  expect(guillotine.hpRatio).toBe(1);
  const xq02=scenarioFor(item('xQ02'));
  expect(xq02.loadout[0]).toBe('thrust');
  expect(xq02.autoCodes).toEqual(['KeyQ']);
  const blink=scenarioFor(item('blink'));
  expect(blink.spells[0]).toBe('blink');
  expect(blink.autoCodes).toEqual(['KeyD']);
  expect(scenarioFor(item('xE04')).setup.boss).toBe(true);
  expect(scenarioFor(item('nova')).levelUp).toBe(true);
  expect(scenarioFor(item('scarCollector')).spells).toContain('ignite');
  for(const id of ['mirror','xD01','echoArt','timeSplitter','workshopHeart','causalKnot']){
    expect(item(id).fx).toBeTruthy();
  }
  const echo=scenarioFor(item('echoArt'));
  expect(echo.loadout).toContain('crescent');
  expect(echo.autoCodes).toEqual(['KeyQ']);
  const ts=scenarioFor(item('timeSplitter'));
  expect(ts.loadout).toContain('crescent');
  expect(ts.autoCodes).toEqual(['KeyQ']);
});

test('Lab header switches between 몬스터/스킬/주문/증강 and keeps the tab in the URL', async () => {
  window.history.replaceState(null, '', '/?lab');
  render(<EnemyLab />);
  expect(screen.getByRole('tab', {name: '몬스터'})).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('tab', {name: '증강'}));
  expect(window.location.search).toContain('tab=augment');
  expect(await screen.findByText('회복 숫자가 잘 안 보임')).toBeInTheDocument();
  expect(screen.getByRole('tab', {name: /프리즘/})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', {name: '주문'}));
  expect(window.location.search).toContain('tab=spell');
  expect(screen.getByText(item('blink').name)).toBeInTheDocument();
});

test('opening an augment runs its training ground with the augment and situation', async () => {
  window.history.replaceState(null, '', '/?lab&tab=augment');
  render(<CodexLab section="augment" />);
  fireEvent.change(screen.getByLabelText('증강 검색'), {target: {value: 'berserk'}});
  fireEvent.click(screen.getByText(item('berserk').name).closest('button'));
  await waitFor(() => expect(steps.length).toBeGreaterThan(0));
  const body=steps[0].body;
  expect(steps[0].url).toContain('/codex/berserk/step');
  expect(body.setup.augments).toEqual(['berserk']);
  expect(body.hp).toBeLessThanOrEqual(body.setup.hpmax*.5);
  expect(screen.getByRole('dialog')).toHaveTextContent('내 체력을 낮게 유지');
  expect(window.location.search).toContain('item=berserk');
  fireEvent.change(screen.getByLabelText('피드백'), {target: {value: '좋아요'}});
  fireEvent.keyDown(screen.getByLabelText('피드백'), {key: 's', metaKey: true});
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/feedback/berserk'), expect.objectContaining({method: 'PUT'})));
});

test('spell keys cast by physical code even with Korean characters (ㅇ on KeyD)', async () => {
  window.history.replaceState(null, '', '/?lab&tab=spell&item=blink');
  render(<CodexLab section="spell" />);
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('자동 시전'));
  fireEvent.keyDown(window, {key: 'ㅇ', code: 'KeyD'});
  expect(addEffect).toHaveBeenCalledWith('blink', expect.anything(), '');
  fireEvent.keyDown(window, {key: 'Escape', code: 'Escape'});
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('training setup and stats start folded so the memo box stays in view, and remember being opened', async () => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/?lab&tab=augment&item=berserk');
  const {unmount}=render(<CodexLab section="augment" />);
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  const folds=screen.getByRole('dialog').querySelectorAll('details.lab-fold');
  expect(folds).toHaveLength(2);
  folds.forEach(d=>expect(d.open).toBe(false));
  expect(screen.getByLabelText('피드백')).toBeVisible();
  folds[0].open=true;
  fireEvent(folds[0], new Event('toggle'));
  expect(window.localStorage.getItem('lab-fold-codex-situation')).toBe('1');
  unmount();
  render(<CodexLab section="augment" />);
  await waitFor(() => expect(screen.getByRole('dialog').querySelector('details.lab-fold').open).toBe(true));
});
