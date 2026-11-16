// First-run briefing: one overlay per match, dismissed by click or Enter, never shown twice.
const $=id=>document.getElementById(id);
let open=false,onClose=null;
export function createBriefing(close){
  onClose=close;
  const el=$('briefing');
  if(!el)return {open:()=>{},close:()=>{},isOpen:()=>false};
  el.addEventListener('click',e=>{
    if(e.target===el||e.target.closest('[data-briefing-close]'))dismiss();
  });
  return {open:()=>openBriefing(),close:()=>dismiss(),isOpen:()=>open};
}
export function openBriefing(site,mode){
  const el=$('briefing');
  if(!el)return false;
  $('briefObjective').textContent=mode.economy
    ?`Plant the charge at ${site.name} (objective ${site.short}) or hold it as Custodian.`
    :`${mode.name}: plant at ${site.name} (objective ${site.short}) inside ${mode.roundTime}s, or stop the plant.`;
  $('briefFlow').textContent=mode.economy
    ?'Buy phase → live round → win by detonation, defuse, elimination or timeout → next round with the money you earned.'
    :`${mode.rounds} rounds, no purchases. First to win ${Math.ceil((mode.rounds+1)/2)} takes the match.`;
  $('briefMode').textContent=`${mode.name} · ${mode.blurb}`;
  el.classList.add('on');open=true;
  return true;
}
export function isBriefingOpen(){return open;}
export function dismiss(){
  const el=$('briefing');
  if(!el||!open)return false;
  el.classList.remove('on');open=false;
  if(onClose)onClose();
  return true;
}
