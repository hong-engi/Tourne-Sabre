import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import EnemyLab from './EnemyLab';

jest.mock('./mapdraw', () => ({
  addEffect: jest.fn(),
  drawLabPortrait: jest.fn(),
  drawLabScene: jest.fn(),
  resetEffects: jest.fn(),
}));

const MOCK_TYPES = [
  {type: 'spinner', tier: 'normal', hp: 100, speed: 3, xp: 10, contact: 5, r: 20},
  {type: 'charger', tier: 'normal', hp: 120, speed: 4, xp: 12, contact: 8, r: 22},
  {type: 'stalker', tier: 'normal', hp: 90, speed: 5, xp: 11, contact: 6, r: 18},
];

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({setTransform: jest.fn()});
  window.history.replaceState(null, '', '/?lab&enemy=spinner');
  global.fetch = jest.fn(url => {
    if (String(url).endsWith('/types')) return Promise.resolve({ok: true, json: () => Promise.resolve(MOCK_TYPES)});
    if (String(url).endsWith('/notes')) return Promise.resolve({ok: true, json: () => Promise.resolve({})});
    return Promise.resolve({ok: true, json: () => Promise.resolve({enemies: [], dummy: {x: 0, y: 0}, projectiles: [], hits: 0, damage: 0})});
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('Cmd + Arrow keys switch enemies even in playable mode without stealing textarea shortcuts', async () => {
  render(<EnemyLab />);
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(screen.getByRole('dialog').querySelector('code').textContent).toBe('spinner');

  // Plain ArrowRight in playable mode moves the character, not the selected enemy.
  fireEvent.keyDown(window, {key: 'ArrowRight', code: 'ArrowRight'});
  expect(screen.getByRole('dialog').querySelector('code').textContent).toBe('spinner');

  // Cmd + ArrowRight switches to the next enemy and calls preventDefault.
  const nextEv = new KeyboardEvent('keydown', {key: 'ArrowRight', code: 'ArrowRight', metaKey: true, bubbles: true, cancelable: true});
  window.dispatchEvent(nextEv);
  expect(nextEv.defaultPrevented).toBe(true);
  await waitFor(() => expect(screen.getByRole('dialog').querySelector('code').textContent).toBe('charger'));

  // Cmd + ArrowDown also moves to the next enemy.
  fireEvent.keyDown(window, {key: 'ArrowDown', code: 'ArrowDown', metaKey: true});
  await waitFor(() => expect(screen.getByRole('dialog').querySelector('code').textContent).toBe('stalker'));

  // Cmd + ArrowLeft moves to the previous enemy.
  fireEvent.keyDown(window, {key: 'ArrowLeft', code: 'ArrowLeft', metaKey: true});
  await waitFor(() => expect(screen.getByRole('dialog').querySelector('code').textContent).toBe('charger'));

  // Cmd + ArrowUp moves to the previous enemy.
  fireEvent.keyDown(window, {key: 'ArrowUp', code: 'ArrowUp', metaKey: true});
  await waitFor(() => expect(screen.getByRole('dialog').querySelector('code').textContent).toBe('spinner'));

  // Note status selector (메모/수정 요청/반영됨) is removed.
  expect(screen.queryByLabelText('메모 상태')).not.toBeInTheDocument();

  // Cmd + Arrow inside the note textarea does not switch enemies.
  const noteArea = screen.getByLabelText('수정 메모');
  fireEvent.keyDown(noteArea, {key: 'ArrowRight', code: 'ArrowRight', metaKey: true});
  expect(screen.getByRole('dialog').querySelector('code').textContent).toBe('spinner');
});
