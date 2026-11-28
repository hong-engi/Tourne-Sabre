import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import App from './App';
import {makePlayer, activateSkill} from './canvas';
import {DEFAULT_SKILLS, DEFAULT_SPELLS} from './gameRules';
const defaults = {skills: DEFAULT_SKILLS, spells: DEFAULT_SPELLS};

jest.mock('./canvas', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function MockCanvas({onStatus, myref}) {
      React.useEffect(() => {onStatus({name: 'Sabre', hp: 80, hpmax: 125, xp: 60, lv: 2}, true);}, [onStatus]);
      return <button onClick={() => myref.current.appearThis({lv: 3, xp: 210})}>Simulate death</button>;
    },
    makePlayer: jest.fn(() => Promise.resolve()),
    activateSkill: jest.fn(),
    switchMode: jest.fn(() => Promise.resolve()),
  };
});

afterEach(() => {jest.clearAllMocks();jest.restoreAllMocks();window.localStorage.clear();});

test('a blank name joins with a random adjective+noun nickname and allows re-entry', async () => {
  jest.spyOn(Math,'random').mockReturnValue(0);
  render(<App/>);
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('One blade.');
  const enter = screen.getByRole('button', {name: /enter the arena/i});
  expect(enter).toBeEnabled();
  expect(screen.getByLabelText('CHOOSE YOUR NAME')).not.toBeRequired();
  fireEvent.click(enter);
  await waitFor(() => expect(screen.queryByLabelText('CHOOSE YOUR NAME')).not.toBeInTheDocument());
  expect(makePlayer).toHaveBeenCalledWith('fluffybunny', defaults, 'pve');
  expect(screen.getByRole('region', {name:'전투 스킬'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name:'Q 역회전 베기'}));
  expect(activateSkill).toHaveBeenCalledWith('KeyQ');
  expect(screen.queryByRole('progressbar', {name: 'Health'})).not.toBeInTheDocument();
  expect(screen.queryByRole('region', {name: 'Player status'})).not.toBeInTheDocument();
  expect(screen.getByRole('progressbar', {name: 'Experience'})).toHaveAttribute('aria-valuemax', '100');
  fireEvent.click(screen.getByRole('button', {name: 'Simulate death'}));
  expect(screen.getByRole('status')).toHaveTextContent('Level 3 · 210 XP');
  expect(screen.getByLabelText('CHOOSE YOUR NAME')).toBeInTheDocument();
});

test('keeps the join form available when the backend rejects entry and supports selecting PvP mode', async () => {
  makePlayer.mockRejectedValueOnce(new Error('offline'));
  render(<App/>);
  fireEvent.click(screen.getByRole('button', {name: /PvP 멀티/i}));
  fireEvent.change(screen.getByLabelText('CHOOSE YOUR NAME'), {target: {value: '  Sabre  '}});
  fireEvent.click(screen.getByRole('button', {name: /enter the arena/i}));
  expect(makePlayer).toHaveBeenCalledWith('Sabre', defaults, 'pvp');
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
  expect(screen.getByRole('button', {name: /enter the arena/i})).toBeEnabled();
});
