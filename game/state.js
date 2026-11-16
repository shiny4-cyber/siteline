// Single source of truth: constants, entity factories, economy and round lifecycle.
import {siteFor,siteHolds} from './map.js';
export const STEP=1/120;
export const ROUND_TIME=115, BUY_TIME=12, FUSE_TIME=40, PLANT_TIME=3.2, DEFUSE_TIME=5, END_TIME=6;
export const WEAPONS={
  rifle:{id:'rifle',name:'VARL-7',price:2700,damage:27,rpm:600,mag:30,reserve:90,reload:2.4,spread:0.0032,move:0.055,recoil:0.012,auto:true,range:70,role:'all-round rifle'},
  smg:{id:'smg',name:'Kestrel 9',price:1250,damage:18,rpm:900,mag:25,reserve:75,reload:2.1,spread:0.0055,move:0.045,recoil:0.007,auto:true,range:45,role:'cheap rush SMG'},
  dmr:{id:'dmr',name:'Warden 62',price:1700,damage:62,rpm:200,mag:10,reserve:30,reload:2.8,spread:0.0012,move:0.095,recoil:0.032,auto:false,range:95,role:'long-range marksman'},
  shotgun:{id:'shotgun',name:'Breacher 12',price:1400,damage:15,rpm:70,mag:6,reserve:24,reload:3.0,spread:0.021,move:0.075,recoil:0.06,auto:false,range:24,pellets:8,role:'close-quarters breacher'},
  lmg:{id:'lmg',name:'Vulcan 60',price:4750,damage:24,rpm:750,mag:60,reserve:120,reload:5.0,spread:0.0075,move:0.08,recoil:0.02,auto:true,range:64,role:'suppression LMG'},
};
export const GRENADES={
  frag:{id:'frag',name:'Frag charge',price:300,damage:92,radius:4.6,fuse:2.4},
  smoke:{id:'smoke',name:'Smoke canister',price:200,radius:4.4,duration:12,fuse:1.6},
  flash:{id:'flash',name:'Flash bang',price:250,radius:7,blind:2.6,fuse:1.2},
};
export const GRENADE=GRENADES.frag;
export const GRENADE_ORDER=['frag','smoke','flash'];
export const PRICES={armour:650,defuse:400,grenades:{frag:300,smoke:200,flash:250}};
export const ATTACK_SPAWNS=[[-11,18],[-13,19],[-9,19]];
export const DEFEND_SPAWNS=[[-2,-12],[2,-13],[5,-9],[-6,-7]];
export function makeWeapon(id){
  const w=WEAPONS[id]||WEAPONS.rifle;
  return {id:w.id,name:w.name,mag:w.mag,reserve:w.reserve};
}
export function createPlayer(){
  return {
    team:'attack',x:-11,z:18,y:0,vx:0,vz:0,radius:0.3,hp:100,armour:0,alive:true,
    yaw:0,pitch:0,crouch:false,onGround:true,vy:0,
    weapon:'rifle',mag:30,reserve:90,reload:0,cooldown:0,recoil:0,recoilPitch:0,sprayIndex:0,sinceShot:9,
    money:800,grenades:1,grenadeType:'frag',stock:{frag:1,smoke:0,flash:0},hasDefuse:false,
    kills:0,deaths:0,shots:0,hits:0,
    bob:0,landing:0,planting:0,
  };
}
export function createBot(id,team,x,z,yaw,loadout){
  return {
    id,team,x,z,y:0,vx:0,vz:0,radius:0.32,hp:100,armour:loadout==='dmr'?50:0,alive:true,yaw,pitch:0,
    weapon:loadout||'smg',mag:loadout==='dmr'?10:25,reserve:60,reload:0,cooldown:0,
    state:'hold',path:[],pathIndex:0,goal:-1,holdX:x,holdZ:z,stuck:0,lastX:x,lastZ:z,
    target:null,scan:0,alive_for:0,reaction:0.18+((id*37)%17)/100,defusing:0,blind:0,sprayIndex:0,sinceShot:9,
  };
}
export function createState(seed=0){
  return {
    seed,site:siteFor(seed),
    phase:'buy',phaseTimer:BUY_TIME,round:1,score:{attack:0,defend:0},winner:null,winReason:'',
    player:createPlayer(),actors:[],projectiles:[],smokes:[],bomb:null,noises:[],roundTime:ROUND_TIME,
    plantProgress:0,lastEvent:'',killFeed:[],summary:null,stats:{shots:0,hits:0,damage:0,killParts:{head:0,body:0}},
    streak:{attack:0,defend:0},economy:{winBase:3250,winStep:250,lossBase:1400,lossStep:500,lossCap:3400},
    input:{forward:0,strafe:0,jump:false,crouch:false,shoot:false,plant:false,defuse:false},
    debug:{god:false,nobots:false,paused:false},
    time:0,
  };
}
export function spawnRound(s,opts={}){
  s.debug.nobots=!!opts.nobots;
  if(opts.seed!==undefined)s.seed=opts.seed;
  s.site=siteFor(s.seed);
  const p=s.player;
  p.team='attack';p.x=ATTACK_SPAWNS[0][0];p.z=ATTACK_SPAWNS[0][1];p.y=0;p.vx=p.vz=0;
  p.hp=100;p.alive=true;p.yaw=0;p.pitch=0;p.reload=0;p.cooldown=0;p.recoil=0;p.sprayIndex=0;p.sinceShot=9;
  p.mag=Math.min(WEAPONS[p.weapon].mag,p.mag||WEAPONS[p.weapon].mag);
  if(opts.refill!==false){p.mag=WEAPONS[p.weapon].mag;p.reserve=WEAPONS[p.weapon].reserve;}
  s.actors.length=0;
  const botCount=opts.nobots?0:7;
  if(botCount){
    for(let i=0;i<3;i++)s.actors.push(createBot(i,'attack',ATTACK_SPAWNS[i][0],ATTACK_SPAWNS[i][1],0,'smg'));
    const holds=siteHolds(s.site);
    for(let i=0;i<4;i++){
      const h=holds[i];
      s.actors.push(createBot(3+i,'defend',h[0],h[1],Math.PI,i===3?'dmr':'rifle'));
    }
  }
  s.bomb=null;s.plantProgress=0;s.phase='buy';s.phaseTimer=BUY_TIME;s.roundTime=ROUND_TIME;
  s.winner=null;s.winReason='';s.lastEvent='';s.summary=null;
  s.projectiles.length=0;s.smokes.length=0;
  return s;
}
export function economyReward(s,winner){
  const win=s.economy.winBase+s.economy.winStep*(s.round-1);
  const loserStreak=s.streak[winner==='attack'?'defend':'attack'];
  const loss=Math.min(s.economy.lossCap,s.economy.lossBase+s.economy.lossStep*loserStreak);
  return {won:win,lost:loss};
}
export function roundOver(s,winner,reason){
  if(s.phase==='roundEnd'||s.phase==='matchEnd')return;
  s.phase='roundEnd';s.phaseTimer=END_TIME;s.winner=winner;s.winReason=reason;
  s.score[winner]++;
  const loser=winner==='attack'?'defend':'attack';
  const money=economyReward(s,winner);
  const p=s.player;
  const awarded=winner==='attack'?money.won:money.lost;
  p.money=Math.min(16000,p.money+awarded+((winner==='attack'&&p.alive)?300:0));
  s.streak[winner]=0;s.streak[loser]++;
  s.summary={round:s.round,winner,reason,score:{...s.score},kills:p.kills,deaths:p.deaths,
    income:awarded,nextIncome:s.economy.winBase+s.economy.winStep*s.round};
  s.lastEvent=`${winner==='attack'?'RELAY SECURED':'SITE HELD'} — ${reason}`;
  s.killFeed.unshift({t:s.time,text:s.lastEvent});
  if(s.killFeed.length>6)s.killFeed.length=6;
}
export function startRound(s,samePhase){
  s.round++;
  s.player.alive=true;s.player.hp=100;
  spawnRound(s,{refill:true,nobots:s.debug.nobots,seed:s.seed});
  if(samePhase){s.phase='live';s.phaseTimer=ROUND_TIME;}
}
