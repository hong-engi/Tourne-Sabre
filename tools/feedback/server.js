// Skill/augment feedback page: http://localhost:3002
// Lists every skill, spell and augment straight from gameRules and saves
// feedback to tools/feedback/feedback.json (re-read on every request, so the
// list follows the current code).
const http=require('http'),fs=require('fs'),path=require('path');
const RULES=path.join(__dirname,'../../frontend/src/gameRules');
const OUT=path.join(__dirname,'feedback.json');
const PAGE=path.join(__dirname,'index.html');

// Rough preview sketches for the original abilities (no fx data in gameRules).
const L=(o)=>Object.assign({t:'hit',shape:'line',at:'self'},o),O=(o)=>Object.assign({t:'hit',shape:'circle',at:'self'},o);
const ORIGINAL={
  reverse:{classicReverse:true,spin:[-20/3,300],fx:[]}, giant:{length:[1.6,3000],fx:[]}, accel:{spin:[2.6,2400],fx:[]},
  thrust:{fx:[L({len:230,w:40})]}, dash:{move:{kind:'dash',dist:200,ms:180},fx:[{t:'hit',shape:'cone',at:'dest',len:150,spread:1.6}]},
  twinBlade:{twin:true,fx:[]}, turret:{turret:true,fx:[]}, boomerang:{fx:[L({len:300,w:50}),L({len:300,w:50,delay:450})]},
  slam:{fx:[O({r:180})]}, blink:{move:{kind:'blink',dist:200},fx:[]}, ghost:{speed:[1.45,2500],phase:2500,fx:[]},
  heal:{fx:[{t:'heal'}]}, barrier:{fx:[{t:'shield'}]}, exhaust:{fx:[O({r:200,power:0,status:{slow:[.4,3000]}})]},
  smite:{fx:[{t:'hit',shape:'circle',at:'nearest',r:60}]}, ignite:{fire:true,fx:[]},
};
function catalog(){
  Object.keys(require.cache).forEach(k=>{if(k.includes('frontend/src/'))delete require.cache[k];});
  const r=require(RULES);
  const name=id=>([...r.SKILLS,...r.SPELLS].find(s=>s.id===id)||{}).name||id;
  const trees=Object.fromEntries(r.TREES.map(t=>[t.id,t.name]));
  // Preview spec: expansion skills use their real fx data (with an exclusive
  // augment's patch applied); the original 16 use the sketches below.
  const spec=(id,owned)=>r.specFor(id,owned||[])||ORIGINAL[id]||null;
  const skill=(s,kind)=>({id:s.id,kind,name:s.name,group:kind,fx:spec(s.id),meta:`대기 ${s.cooldown/1000}초${s.charges?` · 충전 ${s.charges}회`:''}`,description:s.description});
  return [
    ...r.SKILLS.map(s=>skill(s,'스킬')),
    ...r.SPELLS.map(s=>skill(s,'주문')),
    ...r.AUGMENTS.map(a=>({id:a.id,kind:'증강',name:a.name,tier:a.tier,
      previewSkill:[].concat(a.requiresAll||a.requires||[])[0],
      fx:a.requires||a.requiresAll?{...spec([].concat(a.requiresAll||a.requires)[0],[a.id]),...(a.id==='xQ01'?{afterSpin:true}:{})}:null,
      group:{silver:'실버',gold:'골드',prismatic:'프리즘',transcendent:'초월'}[a.tier]+' 증강',
      meta:[trees[a.tree],a.code,a.requiresAll?'필요: '+a.requiresAll.map(name).join(' + '):a.requires?'필요: '+[].concat(a.requires).map(name).join(' 또는 '):''].filter(Boolean).join(' · '),
      description:a.description})),
  ];
}
const load=()=>{try{return JSON.parse(fs.readFileSync(OUT,'utf8'));}catch(e){return {};}};

http.createServer((req,res)=>{
  const send=(code,body,type='application/json')=>{res.writeHead(code,{'Content-Type':type+'; charset=utf-8'});res.end(body);};
  if(req.method==='GET'&&req.url==='/') return send(200,fs.readFileSync(PAGE),'text/html');
  if(req.method==='GET'&&req.url==='/skillZoneFx.js') return send(200,fs.readFileSync(path.join(__dirname,'../../frontend/src/skillZoneFx.js')),'application/javascript');
  if(req.method==='GET'&&req.url==='/reverseAfterimage.js') return send(200,fs.readFileSync(path.join(__dirname,'../../frontend/src/reverseAfterimage.js')),'application/javascript');
  if(req.method==='GET'&&req.url==='/api/items') return send(200,JSON.stringify({items:catalog(),feedback:load()}));
  if(req.method==='POST'&&req.url==='/api/feedback'){
    let body='';req.on('data',c=>{body+=c;if(body.length>2e6)req.destroy();});
    req.on('end',()=>{
      try{
        const {id,text,verdict}=JSON.parse(body);const all=load();
        if(!text&&!verdict) delete all[id]; else all[id]={text:text||'',verdict:verdict||'',at:new Date().toISOString()};
        fs.writeFileSync(OUT,JSON.stringify(all,null,1));send(200,JSON.stringify({ok:true}));
      }catch(e){send(400,JSON.stringify({error:String(e)}));}
    });
    return;
  }
  send(404,'{}');
}).listen(3002,'127.0.0.1',()=>console.log('feedback: http://localhost:3002'));
