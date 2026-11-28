// Enemy lab (bestiary page): live per-type simulations and editable notes.
const express=require('express');
const {EnemyLab,readNotes,writeNote,readFeedback,writeFeedback}=require('../game/lab');
const router=express.Router();
const lab=new EnemyLab();

router.get('/types',(req,res)=>res.json(lab.types()));
// Several types per request: ?types=lancer,flea&attack=1&still=1
router.get('/state',(req,res)=>{
  try {
    const types=String(req.query.types||'').split(',').filter(Boolean).slice(0,60);
    const opts={attack:req.query.attack==='1',move:req.query.still!=='1'},now=Date.now();
    res.json(Object.fromEntries(types.map(t=>[t,lab.step(t,now,opts)])));
  } catch (err) {res.status(400).json({error:err.message});}
});
router.post('/step/:type',(req,res)=>{
  try {res.json(lab.stepPlay(req.params.type,Date.now(),req.body||{}));} catch (err) {res.status(400).json({error:err.message});}
});
router.post('/reset/:type',(req,res)=>{
  try {lab.reset(req.params.type);res.json({ok:true});} catch (err) {res.status(400).json({error:err.message});}
});
router.get('/notes',(req,res)=>res.json(readNotes()));
router.put('/notes/:type',(req,res)=>{
  if (process.env.NODE_ENV==='production') return res.status(403).json({error:'Notes are read-only in production'});
  try {res.json(writeNote(req.params.type,req.body||{}));} catch (err) {res.status(400).json({error:err.message});}
});
// Skill/spell/augment codex: live training ground and feedback (tools/feedback/feedback.json).
router.post('/codex/:id/step',(req,res)=>{
  try {res.json(lab.codexStep(req.params.id,Date.now(),req.body||{}));} catch (err) {res.status(400).json({error:err.message});}
});
router.post('/codex/:id/reset',(req,res)=>{
  try {lab.codexReset(req.params.id,(req.body||{}).setup||{});res.json({ok:true});} catch (err) {res.status(400).json({error:err.message});}
});
router.get('/feedback',(req,res)=>res.json(readFeedback()));
router.put('/feedback/:id',(req,res)=>{
  if (process.env.NODE_ENV==='production') return res.status(403).json({error:'Feedback is read-only in production'});
  try {res.json(writeFeedback(req.params.id,req.body||{}));} catch (err) {res.status(400).json({error:err.message});}
});
module.exports=router;
