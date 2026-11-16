// Bot brain: A* routes, throttled perception, noise investigation, cover reloads, stuck re-paths.
import {findPath,nearestNode,graph} from './nav.js';
import {moveBody,visible,blocked,SOLIDS,siteHolds} from './map.js';
import {fire,reload,tickWeapon,pushNoise,smokeBlocks} from './combat.js';
import {WEAPONS} from './state.js';
const ROUTE_A=[[-10,6],[-8,-2],[-3,-6.4]];
const ROUTE_B=[[10,6],[9,-2],[8,-10]];
const tmpPath=[];
export function scanTarget(s,b){
  if((b.blind||0)>0)return null;
  let best=null,bestD=Infinity;
  for(let i=-1;i<s.actors.length;i++){
    const a=i<0?s.player:s.actors[i];
    if(a===b||!a.alive||a.team===b.team)continue;
    const dx=a.x-b.x,dz=a.z-b.z,d=Math.hypot(dx,dz);
    if(d>52||d>=bestD)continue;
    const fx=-Math.sin(b.yaw),fz=-Math.cos(b.yaw);
    const facing=d>0.01?(dx*fx+dz*fz)/d:1;
    if(facing<0.15&&d>3)continue;
    if(!visible(b.x,b.z,a.x,a.z,1.45))continue;
    if(smokeBlocks(s,b.x,b.z,a.x,a.z))continue;
    best=a;bestD=d;
  }
  return best;
}
function routeTo(s,b,targetX,targetZ){
  const start=nearestNode(b.x,b.z),end=nearestNode(targetX,targetZ);
  findPath(start,end,tmpPath);
  b.path.length=0;
  for(let i=0;i<tmpPath.length;i++)b.path.push(tmpPath[i]);
  b.goal=end;b.pathIndex=0;
}
function followPath(b,dt,speed){
  if(b.pathIndex>=b.path.length)return true;
  const id=b.path[b.pathIndex],node=graph[id];
  const last=b.pathIndex===b.path.length-1;
  const tx=node.x+(last?0:0),tz=node.z;
  const dx=tx-b.x,dz=tz-b.z,d=Math.hypot(dx,dz);
  if(d<0.55){b.pathIndex++;return b.pathIndex>=b.path.length;}
  const step=Math.min(speed*dt,d);
  moveBody(b,dx/d*step,dz/d*step);
  b.yaw=Math.atan2(-dx,-dz);
  return false;
}
export function botThink(s,b,dt){
  if(!b.alive){b.defusing=0;return;}
  b.blind=Math.max(0,(b.blind||0)-dt);
  b.alive_for+=dt;
  b.scan-=dt;
  if(b.scan<=0){
    b.scan=0.09+((b.id*13)%7)/100;
    const found=scanTarget(s,b);
    if(found&&!b.target){b.reaction=Math.min(1.1,b.reaction+0.12);}
    b.target=found;
  }
  tickWeapon(b,dt);
  if(b.reload>0){b.state='cover';}
  const t=b.target;
  const tx=t?t.x:0,tz=t?t.z:0;
  if(t&&t.alive){
    b.defusing=0;
    const dx=tx-b.x,dz=tz-b.z,d=Math.hypot(dx,dz);
    b.yaw=Math.atan2(-dx,-dz);
    b.pitch=Math.atan2(1.5-(t.y||0)-1.2,Math.max(0.5,d))*0.35;
    if(b.reload<=0&&b.mag>0&&d<50&&b.reaction<0.9){b.reaction+=dt*0.9;}
    if(b.reaction>=0.55&&d<46&&Math.abs(dx)<90){
      b.cooldown-=dt*0.35;
      const shot=fire(s,b);
      b.recoil=Math.min(1.4,b.recoil+0.2);
      if(shot)b.lastShot=s.time;
    }
    if(b.mag<=0)reload(b);
    if(d>26){routeTo(s,b,tx,tz);followPath(b,dt,3.4);}
    else if(d<4.5){moveBody(b,-dx/d*1.4*dt,-dz/d*1.4*dt);}
    b.state='engage';
    return;
  }
  b.reaction=Math.max(0.2,b.reaction-dt*0.6);
  if(b.reload>0){
    b.defusing=0;
    // Back off behind the nearest cover point while the magazine is out.
    let cx=b.x,cz=b.z,best=1e9;
    const holds=siteHolds(s.site);
    for(let i=0;i<holds.length;i++){
      const hx=holds[i][0],hz=holds[i][1],d=(hx-b.x)**2+(hz-b.z)**2;
      if(d<best&&visible(hx,hz,b.x,b.z)===false){best=d;cx=hx;cz=hz;}
    }
    if(best<1e9){routeTo(s,b,cx,cz);followPath(b,dt,3.6);}
    b.state='cover';
    return;
  }
  for(let i=s.noises.length-1;i>=0;i--){
    const n=s.noises[i];
    if(n.team===b.team||s.time-n.t>1.4)continue;
    const d=Math.hypot(n.x-b.x,n.z-b.z);
    if(d>26)continue;
    if(b.state!=='investigate'||b.noiseId!==n.t){
      b.noiseId=n.t;b.state='investigate';routeTo(s,b,n.x,n.z);
    }
    break;
  }
  if(s.bomb&&s.bomb.state==='armed'&&b.team==='defend'){
    const d=Math.hypot(s.bomb.x-b.x,s.bomb.z-b.z);
    b.state='defuse';
    if(d>1.5){b.defusing=0;routeTo(s,b,s.bomb.x,s.bomb.z);followPath(b,dt,4.2);}
    else{
      b.yaw=Math.atan2(-(s.bomb.x-b.x),-(s.bomb.z-b.z));
      b.defusing+=dt;
      if(b.defusing>=5){s.bomb.state='defused';}
    }
    return;
  }
  if(s.bomb&&s.bomb.state==='armed'&&b.team==='attack'){
    const d=Math.hypot(s.bomb.x-b.x,s.bomb.z-b.z);
    if(d>4.5){routeTo(s,b,s.bomb.x,s.bomb.z);followPath(b,dt,4);b.state='guard';return;}
    b.state='guard';return;
  }
  if(b.state==='investigate'&&b.pathIndex<b.path.length){followPath(b,dt,4);return;}
  if(b.team==='attack'){
    const lane=b.id%2===0?ROUTE_B:ROUTE_A;
    const stage=Math.min(lane.length,Math.floor((s.time/7+b.id)%(lane.length+1)));
    const wp=stage<lane.length?lane[stage]:[s.site.x,s.site.z];
    if(b.pathIndex>=b.path.length||b.goal!==nearestNode(wp[0],wp[1])){
      routeTo(s,b,wp[0],wp[1]);
    }
    followPath(b,dt,3.9);
    b.state='advance';
    return;
  }
  const holds=siteHolds(s.site);
  const hold=holds[b.id%holds.length];
  if(b.state!=='hold'){
    routeTo(s,b,hold[0],hold[1]);b.state='hold';
  }
  if(b.pathIndex<b.path.length)followPath(b,dt,3.6);
  else{
    b.yaw+=Math.sin(s.time*0.6+b.id)*dt*0.7;
    b.stuck+=dt;
    if(b.stuck>7){b.stuck=0;b.yaw+=1.2;}
  }
}
export function stepBots(s,dt){
  for(let i=0;i<s.actors.length;i++)botThink(s,s.actors[i],dt);
  // Stuck recovery for every bot: sub-30 cm of travel over a second means re-path.
  s.botTick=(s.botTick||0)+dt;
  if(s.botTick>=1){
    s.botTick=0;
    for(let i=0;i<s.actors.length;i++){
      const b=s.actors[i];
      if(!b.alive)continue;
      const moved=Math.hypot(b.x-b.lastX,b.z-b.lastZ);
      b.lastX=b.x;b.lastZ=b.z;
      if(moved<0.3&&b.state!=='hold'&&b.state!=='engage'&&b.state!=='defuse'){
        b.path.length=0;b.pathIndex=0;b.goal=-1;
        b.yaw+=1.7;
      }
    }
  }
}
export {blocked,SOLIDS,WEAPONS};
