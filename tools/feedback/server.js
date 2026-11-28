// Skill/augment feedback page: http://localhost:3002
// Lists every skill, spell and augment straight from gameRules and saves
// feedback to tools/feedback/feedback.json (re-read on every request, so the
// list follows the current code).
const http=require('http'),fs=require('fs'),path=require('path');
const RULES=path.join(__dirname,'../../frontend/src/gameRules');
const CATALOG=path.join(__dirname,'../../frontend/src/codexCatalog');
const OUT=path.join(__dirname,'feedback.json');
const PAGE=path.join(__dirname,'index.html');

// The catalog (and the original-ability sketches) live in
// frontend/src/codexCatalog.js, shared with the Lab codex tabs.
function catalog(){
  Object.keys(require.cache).forEach(k=>{if(k.includes('frontend/src/'))delete require.cache[k];});
  return require(CATALOG).catalog(require(RULES));
}
const load=()=>{try{return JSON.parse(fs.readFileSync(OUT,'utf8'));}catch(e){return {};}};

http.createServer((req,res)=>{
  const send=(code,body,type='application/json')=>{res.writeHead(code,{'Content-Type':type+'; charset=utf-8'});res.end(body);};
  if(req.method==='GET'&&req.url==='/') return send(200,fs.readFileSync(PAGE),'text/html');
  // Canvas helpers shared with the game and the Lab, served as plain scripts.
  if(req.method==='GET'&&['/skillZoneFx.js','/reverseAfterimage.js','/codexPreview.js'].includes(req.url))
    return send(200,fs.readFileSync(path.join(__dirname,'../../frontend/src',req.url)),'application/javascript');
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
