const GAME_CODES = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyW','KeyE','KeyR','KeyD','KeyF']);
export function bindGameInput(target, isPlaying, onSkill) {
  const keys = {};
  const blur = () => Object.keys(keys).forEach(key => delete keys[key]);
  const keydown = event => {
    if (!isPlaying() || !GAME_CODES.has(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    const held = keys[event.code];
    keys[event.code] = true;
    // code identifies the physical key even when key is ㅂ/ㅈ/ㄷ/ㄱ/ㅇ/ㄹ or Process.
    if (event.code.startsWith('Key') && !held && !event.repeat) onSkill(event.code);
  };
  const keyup = event => { delete keys[event.code]; };
  target.addEventListener('keydown', keydown);
  target.addEventListener('keyup', keyup);
  target.addEventListener('blur', blur);
  return {keys, clear:blur, dispose() {
    target.removeEventListener('keydown', keydown);
    target.removeEventListener('keyup', keyup);
    target.removeEventListener('blur', blur);
  }};
}
