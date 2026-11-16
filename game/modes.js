// Match rules: one place that decides round count, buy phase and economy per mode.
export const MODES={
  standard:{
    id:'standard',name:'STANDARD',rounds:0,buy:true,economy:true,
    roundTime:115,buyTime:12,endTime:6,
    blurb:'Full match · economy, buy phase, both sites',
    rules:'Best-of rounds: plant at the active site or hold it. Win rounds to fund better guns.',
  },
  rush:{
    id:'rush',name:'SITE RUSH',rounds:3,buy:false,economy:false,
    roundTime:70,buyTime:0.6,endTime:4,
    blurb:'3 rounds · no economy · fixed rifle loadout',
    rules:'Three short rounds, no purchases: everyone starts with a rifle, armour and one frag.',
  },
};
export function modeOf(id){return MODES[id]||MODES.standard;}
export function matchOver(s){
  return s.mode.rounds>0&&(s.score.attack+s.score.defend)>=s.mode.rounds;
}
export function matchWinner(s){
  if(s.score.attack===s.score.defend)return 'draw';
  return s.score.attack>s.score.defend?'attack':'defend';
}
