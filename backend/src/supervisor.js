// Runs app.js and restarts it when its code changes, but only once the arena
// is empty: a restart wipes every player, so nobody's run is cut short.
// Start with `npm run watch` (from backend/).
const {spawn}=require('child_process');
const fs=require('fs');
const path=require('path');

const BACKEND=path.join(__dirname,'..');
const SHARED=path.join(BACKEND,'..','frontend','src');
// Frontend modules the backend requires (CommonJS, shared rules/physics).
const SHARED_FILES=new Set(['gameRules.js','bodyPhysics.js']);
const PLAYERS_URL=process.env.SUPERVISOR_PLAYERS_URL||'http://127.0.0.1:8080/map/player';

// A change matters if it is backend source (not a test) or a shared module.
function relevant(dir,file) {
  if (!file || !file.endsWith('.js') || file.endsWith('.test.js')) return false;
  if (dir===SHARED) return SHARED_FILES.has(path.basename(file));
  return true;
}
// Restart only when a change is waiting and the server answered with no players.
// An unreachable server (still booting, or stuck) is left alone.
function shouldRestart(pending,players) {
  return !!pending && Array.isArray(players) && players.length===0;
}
async function fetchPlayers(url=PLAYERS_URL) {
  try {
    const res=await fetch(url,{signal:AbortSignal.timeout(1500)});
    return res.ok ? await res.json() : null;
  } catch (err) {return null;}
}

function supervise({log=(...a)=>console.log('[supervisor]',...a),interval=2000}={}) {
  let child=null,pending=null,stopping=false,restarting=false,crashes=0,startedAt=0;
  function start() {
    startedAt=Date.now();pending=null;
    child=spawn(process.execPath,[path.join('src','app.js')],{cwd:BACKEND,stdio:'inherit'});
    child.on('exit',(code,signal)=>{
      child=null;
      if (stopping) return process.exit(0);
      if (restarting) {restarting=false;crashes=0;return start();}
      // Crashed: back off so a broken edit does not spin.
      crashes=Date.now()-startedAt<10000?crashes+1:0;
      const wait=Math.min(30000,1000*2**crashes);
      log(`app.js exited (${signal||code}); restarting in ${wait/1000}s`);
      setTimeout(start,wait);
    });
  }
  function changed(dir,file) {
    if (!relevant(dir,file)) return;
    if (!pending) log(`${path.relative(path.join(BACKEND,'..'),path.join(dir,file))} changed; restarting once the arena is empty`);
    pending=file;
  }
  for (const dir of [path.join(BACKEND,'src'),SHARED])
    fs.watch(dir,{recursive:dir!==SHARED},(event,file)=>changed(dir,file));
  const timer=setInterval(async ()=>{
    if (!pending || !child || restarting) return;
    if (!shouldRestart(pending,await fetchPlayers())) return;
    log('arena empty; restarting app.js with the new code');
    restarting=true;child.kill('SIGTERM');
  },interval);
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>{
    stopping=true;clearInterval(timer);
    if (child) child.kill(signal); else process.exit(0);
  });
  start();
}

if (require.main===module) supervise();
module.exports={relevant,shouldRestart,fetchPlayers,supervise,SHARED,BACKEND};
