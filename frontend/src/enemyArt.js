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
// New enemies (ENEMIES.md): small procedural pixel sprites on a 16-cell grid,
// one big silhouette feature each. Up is the facing direction. At most four
// body tones plus outline, eye and one accent keep each well under 16 colors.
const OUTLINE='#101823';
function grid(n){return Array.from({length:n},()=>Array(n).fill(null));}
function ellipse(g,cx,cy,rx,ry,c){for(let y=0;y<g.length;y++)for(let x=0;x<g.length;x++)if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1)g[y][x]=c;}
function rect(g,x0,y0,w,h,c){for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)if(g[y]&&x>=0&&x<g.length)g[y][x]=c;}
function px(g,list,c){for(const [x,y] of list)if(g[y]&&x>=0&&x<g.length)g[y][x]=c;}
function line(g,x0,y0,x1,y1,c){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))||1;for(let i=0;i<=n;i++)px(g,[[Math.round(x0+(x1-x0)*i/n),Math.round(y0+(y1-y0)*i/n)]],c);}
function outline(g){
  const out=g.map(r=>r.slice());
  for(let y=0;y<g.length;y++)for(let x=0;x<g.length;x++)if(!g[y][x]&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>g[y+dy]&&g[y+dy][x+dx]&&g[y+dy][x+dx]!==OUTLINE))out[y][x]=OUTLINE;
  return out;
}
const eyes=(g,y,a,b,c='#ffdb76')=>px(g,[[a,y],[b,y]],c);
// [dark, mid, light, accent]
const ART={
  shellback:[['#3d3a2c','#6f6a48','#a59c66','#b7642f'],g=>{ellipse(g,8,9,6,5.5,1);ellipse(g,8,5,6.5,3,3);rect(g,2,4,12,2,0);px(g,[[4,4],[8,3],[12,4]],2);eyes(g,10,6,9);}],
  lancer:[['#2f3c52','#52688c','#9fb3d1','#d9dfe8'],g=>{ellipse(g,8,10,3,4,1);ellipse(g,8,6,2.5,2,2);line(g,12,1,12,14,3);px(g,[[11,1],[13,1],[12,0]],3);px(g,[[8,4]],0);eyes(g,6,7,9);}],
  sickler:[['#2c4630','#4d7d50','#8ccf7a','#e8d8a0'],g=>{ellipse(g,8,9,3.5,4.5,1);ellipse(g,8,5,2.5,2,2);px(g,[[12,3],[13,4],[14,6],[14,8],[13,10]],3);line(g,8,13,8,15,0);eyes(g,5,7,9);}],
  flea:[['#4b2b20','#8a4b2c','#d98c52','#f2d29b'],g=>{ellipse(g,8,8,4,3.5,1);line(g,4,10,1,14,0);line(g,12,10,15,14,0);line(g,5,11,3,15,2);line(g,11,11,13,15,2);eyes(g,6,6,10);px(g,[[7,7],[9,7]],2);}],
  shroom:[['#4a2440','#8b3f6f','#d27aa9','#c8f0a0'],g=>{ellipse(g,8,6,7,4.5,1);rect(g,6,9,4,5,'#e8d8b0');px(g,[[8,2],[8,3],[8,4],[8,5]],0);px(g,[[4,5],[11,4],[6,3]],3);eyes(g,11,7,9,'#3a2030');}],
  lantern:[['#2c4a5c','#4f8aa3','#9ce3f0','#fff2a8'],g=>{ellipse(g,8,7,6,5.5,1);ellipse(g,8,7,3,3,3);rect(g,2,7,12,1,0);line(g,5,12,4,15,2);line(g,8,12,8,15,2);line(g,11,12,12,15,2);}],
  leech:[['#3b2448','#6a4387','#b18ad8','#f0a0c0'],g=>{for(let i=0;i<5;i++)ellipse(g,8+Math.sin(i)*2,3+i*2.6,2.6,1.6,i%2?1:2);px(g,[[6,1],[10,1]],3);eyes(g,2,7,9);}],
  bell:[['#3e3a3a','#7a7066','#c5b9a5','#e8c06a'],g=>{rect(g,5,10,6,5,1);ellipse(g,8,6,5,4.5,3);rect(g,3,8,10,2,3);line(g,8,2,10,7,0);px(g,[[8,10]],2);eyes(g,12,6,9);}],
  banner:[['#5b2a20','#a8453a','#f0a070','#e8d8a0'],g=>{ellipse(g,8,11,3,3.5,'#6a5a4a');line(g,4,2,4,14,0);rect(g,5,2,7,5,1);px(g,[[6,3],[8,4],[10,3]],3);px(g,[[11,6],[9,6]],2);eyes(g,10,7,9);}],
  mender:[['#3a3a52','#6c6a92','#c7c3e8','#f0f0f0'],g=>{ellipse(g,8,9,4.5,5.5,1);ellipse(g,8,5,3.5,3,0);ellipse(g,13,11,2,2,3);line(g,13,9,10,6,3);eyes(g,5,7,9,'#c7f0ff');}],
  brood:[['#4a3a1e','#86703c','#d6c27a','#e8f0d0'],g=>{for(let i=0;i<4;i++)ellipse(g,8,3+i*3,3,1.8,i%2?1:2);ellipse(g,8,12,4.5,3.5,'#e8f0d088');px(g,[[7,12],[9,13]],3);eyes(g,2,7,9);}],
  magnet:[['#3a3a46','#6b6b7e','#b0b0c0','#e05048'],g=>{rect(g,4,5,8,9,1);rect(g,1,2,3,7,3);rect(g,12,2,3,7,3);px(g,[[1,2],[2,2],[3,2],[12,2],[13,2],[14,2]],'#dfe6f0');rect(g,7,7,2,3,0);eyes(g,6,6,9,'#ff9a6b');}],
  seeder:[['#3c3420','#6a6034','#a8a050','#70c060'],g=>{line(g,8,15,8,6,'#6a5a3a');line(g,8,10,4,8,1);line(g,8,10,12,8,1);ellipse(g,5,3,1.6,1.6,3);ellipse(g,8,2,1.6,1.6,3);ellipse(g,11,3,1.6,1.6,3);eyes(g,6,7,9);}],
  roller:[['#3a3026','#7a6250','#c0a080','#9aa0a8'],g=>{ellipse(g,8,4,5.5,3.5,3);ellipse(g,8,4,1.5,1.5,0);ellipse(g,8,11,3,3.5,'#4a8a3a');eyes(g,10,7,9);}],
  shotbug:[['#2a4048','#457080','#9ad8e8','#e8fbff'],g=>{ellipse(g,8,10,4.5,4.5,1);line(g,8,6,8,1,3);line(g,7,6,4,2,3);line(g,9,6,12,2,3);eyes(g,9,6,10);}],
  hound:[['#3a3a44','#6e6e80','#b8b8c8','#ff7a5a'],g=>{ellipse(g,8,9,3.5,5.5,1);ellipse(g,8,3,2,2.5,2);px(g,[[8,0]],3);px(g,[[5,5],[11,5]],0);line(g,8,13,8,15,2);eyes(g,3,7,9,'#ff7a5a');}],
  skeleton:[['#4a4a46','#9a9a90','#e8e6d8','#ffcf5a'],g=>{ellipse(g,8,5,3.5,3,2);for(let y=8;y<14;y+=2)rect(g,4,y,8,1,1);line(g,8,8,8,14,1);ellipse(g,8,10,1.5,1.5,3);eyes(g,5,7,9,OUTLINE);}],
  salamander:[['#5a1e14','#a8402a','#f08a4a','#ffd35a'],g=>{ellipse(g,8,8,3.5,5,1);ellipse(g,8,3,3.5,2,2);rect(g,6,8,4,3,3);line(g,8,13,8,15,1);line(g,4,7,2,9,1);line(g,12,7,14,9,1);eyes(g,3,6,10);}],
  sculptor:[['#4a3420','#7e5a38','#b88a5a','#d8c8a0'],g=>{ellipse(g,8,9,4.5,5,1);ellipse(g,8,4,3,2.5,2);line(g,13,2,13,12,3);rect(g,12,1,3,2,3);eyes(g,4,7,9);}],
  herald:[['#4a3020','#8a5a30','#e0a050','#ff6a3a'],g=>{ellipse(g,8,10,3,4,1);ellipse(g,8,6,2.5,2,2);rect(g,11,1,2,11,'#7a6a5a');rect(g,10,0,4,2,3);eyes(g,6,7,9);}],
  balloon:[['#3a3020','#7a6040','#c0a070','#4a4a5a'],g=>{ellipse(g,8,9,3,3.5,1);ellipse(g,8,13,2,1.5,3);line(g,8,6,5,2,0);line(g,8,6,11,2,0);eyes(g,9,7,9);}],
  snail:[['#2a4a5a','#4a88a0','#a8e8f8','#e8fbff'],g=>{ellipse(g,8,11,5,4,'#7a9aa0');ellipse(g,8,6,4.5,4.5,1);ellipse(g,8,6,2.5,2.5,2);px(g,[[8,6],[6,4],[10,8]],3);line(g,6,14,5,15,0);line(g,10,14,11,15,0);}],
  masker:[['#4a3a2a','#8a6a4a','#d8b890','#e8e0c8'],g=>{ellipse(g,8,10,3.5,4.5,1);ellipse(g,8,5,3.5,3.5,3);px(g,[[7,5],[9,5],[8,7]],0);line(g,12,6,12,11,'#c0c8d0');rect(g,6,14,4,2,0);}],
  warden:[['#2e3036','#5a5e68','#9aa0ad','#c8a050'],g=>{rect(g,3,5,10,9,1);ellipse(g,8,4,3.5,3,2);line(g,1,6,1,14,3);line(g,15,6,15,14,3);px(g,[[2,6],[14,6],[2,10],[14,10]],3);eyes(g,4,7,9,'#ff9a6b');}],
  gatekeeper:[['#30384a','#56648a','#a0b0d8','#e0c070'],g=>{ellipse(g,8,9,5,5,1);ellipse(g,8,4,3,2.5,2);ellipse(g,3,9,2.5,5,3);px(g,[[13,4],[14,5]],3);eyes(g,4,7,9);}],
  gatekeeperB:[['#4a2420','#8a4434','#e07858','#ffd480'],g=>{ellipse(g,8,9,5,5,1);ellipse(g,8,4,3,2.5,2);ellipse(g,13,9,2.5,5,3);px(g,[[2,4],[3,5]],3);eyes(g,4,7,9);}],
  duelist:[['#4a4e58','#8c929e','#e0e6ee','#9fd8ff'],g=>{ellipse(g,8,9,3.5,5,1);ellipse(g,8,4,2.5,2.5,2);line(g,12,0,12,10,3);px(g,[[11,0],[13,1]],'#ffffff');eyes(g,4,7,9,'#9fd8ff');}],
  alchemist:[['#3a2a4a','#6a4a8a','#b890e0','#80f0b0'],g=>{ellipse(g,8,9,4,5,1);ellipse(g,8,4,3,2.5,'#e8e0c8');ellipse(g,2,6,1.5,1.5,3);ellipse(g,14,6,1.5,1.5,'#ff9a6b');ellipse(g,8,14,1.5,1.5,'#9fd8ff');eyes(g,4,7,9,OUTLINE);}],
  swordsaint:[['#3a3640','#6e6878','#c0b8c8','#e8d070'],g=>{ellipse(g,8,9,5,5.5,1);ellipse(g,8,4,3,2.5,2);ellipse(g,8,11,3,3,3);line(g,8,9,8,11,0);line(g,8,11,10,11,0);eyes(g,4,7,9,'#ffdb76');}],
  rootcrown:[['#3a2a1a','#6a4a2a','#a87a4a','#ffe08a'],g=>{ellipse(g,8,9,6.5,6,1);ellipse(g,8,8,2.5,2.5,3);line(g,3,4,2,0,2);line(g,6,3,6,0,2);line(g,10,3,10,0,2);line(g,13,4,14,0,2);px(g,[[3,13],[12,14],[5,15],[10,15]],0);}],
  forge:[['#3a2a2a','#6a4a40','#a87a60','#ff8a3a'],g=>{ellipse(g,8,9,6,6,1);ellipse(g,8,3,3.5,2.5,2);rect(g,6,8,4,4,'#401a10');px(g,[[5,7],[8,7],[11,7]],3);rect(g,7,9,2,2,3);eyes(g,3,7,9,'#ffd35a');}],
  forgeTurret:[['#3a2a2a','#6a4a40','#a87a60','#ff8a3a'],g=>{ellipse(g,8,10,5,4,1);rect(g,6,3,4,6,2);px(g,[[7,2],[8,2],[7,9],[8,9]],3);}],
  stormray:[['#203040','#3a5a78','#8ab0d0','#e0f4ff'],g=>{ellipse(g,8,8,7.5,4.5,1);ellipse(g,8,8,3,5.5,2);line(g,8,13,8,15,0);px(g,[[2,7],[14,7],[4,9],[12,9]],3);eyes(g,5,7,9,'#e0f4ff');}],
  maestro:[['#1e1e2a','#3a3a52','#8a8ab0','#e8d070'],g=>{ellipse(g,8,9,4.5,5.5,1);rect(g,6,6,4,6,'#e8e8f0');ellipse(g,8,3,2.5,2.5,2);line(g,13,1,11,8,3);px(g,[[13,1]],'#ffffff');eyes(g,3,7,9,'#ffdb76');}],
  crab:[['#4a2620','#8a4430','#d07a50','#c0b090'],g=>{ellipse(g,8,9,6,5,1);rect(g,5,4,6,5,3);rect(g,7,2,2,3,3);ellipse(g,2,4,2,2.5,2);ellipse(g,14,4,2,2.5,2);eyes(g,8,6,10);}],
  centipede:[['#2a2a30','#55555f','#a0a0b0','#e05040'],g=>{ellipse(g,8,8,5.5,5,1);line(g,4,3,2,0,3);line(g,12,3,14,0,3);px(g,[[1,9],[15,9],[2,12],[14,12]],0);eyes(g,5,6,10,'#ff7a5a');}],
  segment:[['#2a2a30','#55555f','#a0a0b0','#e05040'],g=>{ellipse(g,8,8,5.5,4.5,1);rect(g,3,7,10,1,2);px(g,[[1,8],[15,8],[1,10],[15,10]],0);}],
  egg:[['#6a6a50','#b0b090','#e8e8c8','#ffffff'],g=>{ellipse(g,8,8,4.5,5.5,1);ellipse(g,7,6,2,2.5,2);line(g,9,9,10,11,0);}],
  pillar:[['#4a3420','#7e5a38','#b88a5a','#d8c8a0'],g=>{ellipse(g,8,8,6,6,1);ellipse(g,7,7,3.5,3.5,2);px(g,[[9,10],[10,9],[5,6]],0);}],
  debris:[['#3a3a3a','#6a6560','#a8a090','#7a5a3a'],g=>{rect(g,3,4,10,8,1);rect(g,4,5,5,3,2);line(g,3,12,12,4,0);}],
  balloonPart:[['#802a2a','#d84a4a','#ff9a8a','#ffffff'],g=>{ellipse(g,8,7,5,6,1);ellipse(g,6,5,2,2,2);line(g,8,13,8,15,0);}],
  decoy:null,
  stake:[['#3a3026','#6a5a46','#a89070','#c0c8d0'],g=>{ellipse(g,8,8,4,4,1);rect(g,7,2,2,12,2);px(g,[[8,1]],3);line(g,5,11,11,5,0);}],
  knot:[['#3a2a1a','#6a4a2a','#a87a4a','#80c060'],g=>{ellipse(g,8,8,6,6,1);ellipse(g,8,8,3,3,2);line(g,3,3,13,13,0);px(g,[[5,11],[11,5]],3);}],
  resobell:[['#4a4030','#9a8050','#f0d080','#ffffff'],g=>{ellipse(g,8,7,5,5,2);rect(g,3,10,10,2,1);ellipse(g,8,13,1.5,1.5,0);px(g,[[6,4]],3);}],
  cannon:[['#2a2a2a','#505050','#909090','#e05040'],g=>{ellipse(g,8,10,4.5,4.5,1);rect(g,6,1,4,9,2);rect(g,6,1,4,1,0);}],
};
ART.decoy=ART.masker;
export const NEW_ENEMY_ART=Object.keys(ART);
function proceduralSprite(type){
  const [tones,paint]=ART[type],g=grid(16);
  // Draw with tone indices, then resolve them to colors.
  const raw=grid(16);
  paint(raw);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(raw[y][x]!==null)g[y][x]=typeof raw[y][x]==='number'?tones[raw[y][x]]:raw[y][x];
  // Shade: top-left light rim on the main body tone.
  for(let y=1;y<16;y++)for(let x=1;x<16;x++)if(g[y][x]===tones[1]&&!g[y-1][x])g[y][x]=tones[2];
  const lined=outline(g),canvas=document.createElement('canvas');
  canvas.width=16;canvas.height=16;const ctx=canvas.getContext('2d');
  lined.forEach((row,y)=>row.forEach((c,x)=>{if(c){ctx.fillStyle=c;ctx.fillRect(x,y,1,1);}}));
  return canvas;
}
export function createEnemySprite(type) {
  if (!masks[type] && ART[type]) return proceduralSprite(type);
  const rows = masks[type];
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(...rows.map(row => row.length)); canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  rows.forEach((row,y) => [...row].forEach((char,x) => {
    if (palette[char]) {ctx.fillStyle = palette[char]; ctx.fillRect(x,y,1,1);}
  }));
  return canvas;
}
