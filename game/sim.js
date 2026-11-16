// Fixed-step simulation: phase clock, planting/defusing, grenades and win conditions.
import {STEP,ROUND_TIME,BUY_TIME,FUSE_TIME,PLANT_TIME,DEFUSE_TIME,WEAPONS,PRICES,roundOver,spawnRound,startRound} from './state.js';
import {stepPlayer} from './movement.js';
import {stepBots} from './bots.js';
import {fire,reload,tickWeapon,throwGrenade,explode,GRENADES} from './combat.js';
export function buy(s,item){
  const p=s.player;
  if(s.phase!=='buy'||!s.mode.buy)return false;
  if(item==='armour'){if(p.money<PRICES.armour||p.armour>=100)return false;p.money-=PRICES.armour;p.armour=100;return true;}
  if(item==='defuse'){if(p.money<PRICES.defuse||p.hasDefuse)return false;p.money-=PRICES.defuse;p.hasDefuse=true;return true;}
  if(item&&item.startsWith('grenade:')){
    const kind=item.slice(8),g=GRENADES[kind];
    if(!g||p.money<g.price||(p.stock[kind]||0)>=2)return false;
    p.money-=g.price;p.stock[kind]=(p.stock[kind]||0)+1;
    if(!p.stock[p.grenadeType])p.grenadeType=kind;
    return true;
  }
  if(item==='grenade')return buy(s,'grenade:frag');
  const w=WEAPONS[item];
  if(!w||p.money<w.price)return false;
  p.money-=w.price;p.weapon=w.id;p.mag=w.mag;p.reserve=w.reserve;p.reload=0;p.sprayIndex=0;
  return true;
}
function nearSite(t,site){return Math.hypot(t.x-site.x,t.z-site.z)<=site.radius;}
function tickGrenades(s,dt){
  for(let i=s.projectiles.length-1;i>=0;i--){
    const g=s.projectiles[i];
    g.vy-=18*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.z+=g.vz*dt;
    if(g.y<0.12){g.y=0.12;g.vy*=-0.42;g.vx*=0.72;g.vz*=0.72;}
    g.fuse-=dt;
    if(g.fuse<=0){explode(s,g.x,g.z,g.type||'frag');s.projectiles.splice(i,1);}
  }
  for(let i=s.smokes.length-1;i>=0;i--)if(s.smokes[i].until<=s.time)s.smokes.splice(i,1);
}
function aliveOf(s,team){
  let n=0;
  for(let i=0;i<s.actors.length;i++)if(s.actors[i].alive&&s.actors[i].team===team)n++;
  if(team==='attack'&&s.player.alive)n++;
  return n;
}
export function tick(s,dt){
  if(s.phase==='matchEnd')return;
  s.time+=dt;
  if(s.phase==='roundEnd'){
    s.phaseTimer-=dt;
    if(s.phaseTimer<=0)startRound(s,false);
    return;
  }
  if(s.phase==='buy'){
    stepPlayer(s,dt);
    tickWeapon(s.player,dt);
    s.phaseTimer-=dt;
    if(s.phaseTimer<=0){s.phase='live';s.phaseTimer=ROUND_TIME;}
    return;
  }
  if(s.phase!=='live')return;
  const p=s.player;
  s.phaseTimer-=dt;
  stepPlayer(s,dt);
  tickWeapon(p,dt);
  if(s.input.shoot&&WEAPONS[p.weapon].auto)fire(s,p);
  if(s.input.crouch)p.crouch=true;
  stepBots(s,dt);
  for(let i=0;i<s.actors.length;i++)tickWeapon(s.actors[i],dt);
  tickGrenades(s,dt);
  if(s.bomb){
    if(s.bomb.state==='defused'){roundOver(s,'defend','charge defused');return;}
    if(s.bomb.state==='armed'){
      if(p.team==='defend'&&p.alive&&p.hasDefuse&&s.input.defuse&&Math.hypot(p.x-s.bomb.x,p.z-s.bomb.z)<1.6){
        s.bomb.defuse=(s.bomb.defuse||0)+dt;
        if(s.bomb.defuse>=DEFUSE_TIME)s.bomb.state='defused';
      }else s.bomb.defuse=0;
      s.bomb.timer-=dt;
      if(s.bomb.state==='defused'){roundOver(s,'defend','charge defused');return;}
      if(s.bomb.timer<=0){roundOver(s,'attack','charge detonated');explode(s,s.bomb.x,s.bomb.z);return;}
    }
  }else if(p.alive&&s.input.plant&&nearSite(p,s.site)){
    s.plantProgress+=dt;
    if(s.plantProgress>=PLANT_TIME){
      s.bomb={x:p.x,z:p.z,timer:FUSE_TIME,state:'armed',defuse:0,site:s.site.id};
      s.lastEvent='CHARGE PLANTED';s.plantProgress=0;
    }
  }else s.plantProgress=Math.max(0,s.plantProgress-dt*0.6);
  if(p.mag===0&&p.reload<=0&&s.input.shoot)reload(p);
  if(!s.debug.nobots){
    if(!s.bomb){
      if(aliveOf(s,'defend')===0){roundOver(s,'attack','defenders eliminated');return;}
      if(aliveOf(s,'attack')===0){roundOver(s,'defend','attackers eliminated');return;}
    }
  }
  if(s.phaseTimer<=0){
    if(!s.bomb)roundOver(s,'defend','time expired');
  }
}
export function advance(s,seconds){
  const n=Math.round(seconds/STEP);
  for(let i=0;i<n;i++)tick(s,STEP);
  return s;
}
export {STEP,ROUND_TIME,BUY_TIME,FUSE_TIME,PLANT_TIME,DEFUSE_TIME,throwGrenade,reload,fire,spawnRound};
