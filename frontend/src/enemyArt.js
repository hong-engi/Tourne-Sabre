// Native low-resolution masks extend the arena's existing code-drawn icon art.
// Their prepared images use the same display-resolution transform path as PNGs.
const palette = {o:'#101823',r:'#713d35',b:'#b86848',h:'#e8c897',e:'#ffdb76',p:'#665187',v:'#a58acc',s:'#3b3157',i:'#f3dae7',
  k:'#6e2a24',f:'#d9623a',y:'#ffd35a',g:'#3f7a45',l:'#86c96c',d:'#24452a',t:'#2f6f7c',c:'#6cc4cf',n:'#c9f1ef'};
// Round blob with a dark crack down the middle: the splitter and its mites.
function blob(size,crack) {
  const rows=[],c=(size-1)/2,r=size/2-.3;
  for (let y=0;y<size;y++) {
    let row='';
    for (let x=0;x<size;x++) {
      const d=Math.hypot(x-c,y-c);
      if (d>r) row+='.';
      else if (d>r-1.2) row+='t';
      else if (crack && Math.abs(x-c+(y%2?.5:-.5))<.6) row+='o';
      else if (x<c-1 && y<c-1 && d<r*.55) row+='n';
      else row+='c';
    }
    rows.push(row);
  }
  const eye=Math.round(c*.55),ey=Math.round(c-1);
  for (const ex of [Math.floor(c)-eye,Math.ceil(c)+eye]) rows[ey]=rows[ey].slice(0,ex)+'e'+rows[ey].slice(ex+1);
  return rows;
}
const masks = {
  charger: [
    '......hh......', '.....hhhh.....', '.....hooh.....', '....orbbro....',
    '..oorbbbbroo..', '.obbbbeebbbbo.', 'obbrbbbbbb rbbo'.replace(/ /g,''),
    'obrbbbbbbbbrbo', 'obrbrrbbrrbrbo', '.orbbbbbbbbro.', '..orbbbbbbro..',
    '.hhorrrrrrohh.', '.hh..oooo..hh.',
  ],
  stalker: [
    '.pp........pp.', 'pvp........pvp', 'pvsp......psvp', 'pvvsp.oo.psvvp',
    '.pvvsoii osvv p'.replace(/ /g,''), '..pvsviivsvp..', '...psvppvsp...',
    '..pvvpee pvvp..'.replace(/ /g,''), '.pvvsppppsvvp.', 'pvvsp.oo.psvvp',
    'pssp......pssp', '.pp........pp.',
  ],
  bomber: [
    '......y.....', '.....yf.....', '......f.....', '....okko....',
    '..okkffkko..', '.okffffffko.', '.kffeffeffk.', '.kffffffffk.',
    '.kfffkkfffk.', '.okffffffko.', '..okkffkko..', '....okko....',
  ],
  spitter: [
    '....o..o....', '...oggggo...', '..ogllllgo..', '.ogllddllgo.',
    '.gllddddllg.', 'oglleddellgo', 'ogllllllllgo', 'oggllllllggo',
    '.oggllllggo.', '..og.gg.go..', '.og..gg..go.', '.o........o.',
  ],
  splitter: blob(14,true),
  mite: blob(8,false),
};
export function createEnemySprite(type) {
  const rows = masks[type];
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(...rows.map(row => row.length)); canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  rows.forEach((row,y) => [...row].forEach((char,x) => {
    if (palette[char]) {ctx.fillStyle = palette[char]; ctx.fillRect(x,y,1,1);}
  }));
  return canvas;
}
