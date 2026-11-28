// The play build (served from frontend/build) can be rebuilt while someone
// is mid-run. Instead of interrupting the run, pick up a newer build only
// when a run ends: reload the page then, keeping the run summary.
const RUN_KEY='tourne-sabre-last-run';

export async function newerBuildAvailable(doc=document,load=fetch) {
  if (process.env.NODE_ENV!=='production') return false; // the dev server reloads by itself
  try {
    const manifest=await (await load('/asset-manifest.json',{cache:'no-store'})).json();
    const main=manifest.files&&manifest.files['main.js'];
    return !!main && ![...doc.scripts].some(script=>new URL(script.src,'http://x').pathname===main);
  } catch (err) {return false;}
}
export async function reloadIfUpdated(run,options={}) {
  const {doc=document,load=fetch,reload=()=>window.location.reload()}=options;
  if (!(await newerBuildAvailable(doc,load))) return false;
  try {window.sessionStorage.setItem(RUN_KEY,JSON.stringify(run));} catch (err) {/* the summary is optional */}
  reload();
  return true;
}
// The summary of the run that ended just before an update reload.
export function takeSavedRun() {
  try {
    const run=JSON.parse(window.sessionStorage.getItem(RUN_KEY)||'null');
    window.sessionStorage.removeItem(RUN_KEY);
    return run;
  } catch (err) {return null;}
}
