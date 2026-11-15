// Weapons, hit traces, damage and grenades. No three.js import: testable under Node.
import {WEAPONS,GRENADE} from './state.js';
import {rayBox,wallDistance,SOLIDS} from './map.js';
const HEAD=[0.24,1.42,0.24],TORSO=[0.34,0.55,0.34],LEGS=[0.3,0.05,0.3];
function partBox(ox,oy,oz,dx,dy,dz,a,half,lo,hi){
  return rayBox(ox,oy,oz,dx,dy,dz,a.x-half[0],a.y+lo,a.z-half[2],a.x+half[0],a.y+hi,a.z+half[2]);
}
export function traceBody(ox,oy,oz,dx,dy,dz,a){
  const head=partBox(ox,oy,oz,dx,dy,dz,a,HEAD,1.42,1.86);
  const torso=partBox(ox,oy,oz,dx,dy,dz,a,TORSO,0.55,1.42);
  const legs=partBox(ox,oy,oz,dx,dy,dz,a,LEGS,0.05,0.55);
  let best=Infinity,part=null;
  if(head<best){best=head;part='head';}
  if(torso<best){best=torso;part='body';}
  if(legs<best){best=legs;part='legs';}
  return {part,dist:best};
}
export function applyDamage(s,target,base,part,attacker){
  if(!target.alive)return 0;
  const mult=part==='head'?4:part==='legs'?0.75:1;
  let dmg=base*mult;
  if(target.armour>0&&part!=='head'){
    const absorbed=Math.min(target.armour,dmg*0.5);
    target.armour-=absorbed;dmg-=absorbed;
  }
  target.hp-=dmg;
  if(attacker&&attacker.team==='attack'&&attacker===s.player)s.stats.damage+=dmg;
  if(target.hp<=0){
    target.hp=0;target.alive=false;
    if(attacker){attacker.kills=(attacker.kills||0)+1;if(attacker===s.player){
      s.player.kills++;s.stats.killParts[part]++;s.player.money=Math.min(16000,s.player.money+300);
    }}
    if(target===s.player)s.player.deaths++;
  }
  return dmg;
}
function forward(yaw,pitch,spread,out){
  const cp=Math.cos(pitch),sp=Math.sin(pitch);
  let dx=-Math.sin(yaw)*cp,dy=sp,dz=-Math.cos(yaw)*cp;
  if(spread>0){
    dx+=(Math.random()-0.5)*spread*2;dy+=(Math.random()-0.5)*spread*2;dz+=(Math.random()-0.5)*spread*2;
    const l=Math.hypot(dx,dy,dz);dx/=l;dy/=l;dz/=l;
  }
  out[0]=dx;out[1]=dy;out[2]=dz;return out;
}
const DIR=[0,0,0];
export function spreadOf(t){
  const w=WEAPONS[t.weapon]||WEAPONS.rifle;
  const speed=Math.hypot(t.vx||0,t.vz||0);
  const move=Math.min(1,speed/5.2)*w.move;
  const crouch=t.crouch?0.55:1;
  const air=t.onGround===false?2.2:1;
  return (w.spread+move*2.1+t.recoil*0.4)*crouch*air;
}
export function fire(s,t){
  if(!t.alive||s.phase!=='live')return false;
  const w=WEAPONS[t.weapon]||WEAPONS.rifle;
  if(t.reload>0||t.cooldown>0||t.mag<=0)return false;
  t.mag--;t.cooldown=60/w.rpm;t.shots=(t.shots||0)+1;
  if(t===s.player)s.stats.shots++;
  t.recoil=Math.min(1.6,t.recoil+0.34);
  t.recoilPitch=Math.min(0.09,t.recoilPitch+0.017);
  t.pitch=Math.min(1.45,(t.pitch||0)+0.0045);
  forward(t.yaw,t.pitch+t.recoilPitch*0.35,spreadOf(t),DIR);
  const ox=t.x,oy=t.y+1.55,oz=t.z;
  let hitActor=null,hitPart=null,hitDist=w.range;
  for(let i=0;i<s.actors.length;i++){
    const a=s.actors[i];
    if(!a.alive||a.team===t.team)continue;
    const r=traceBody(ox,oy,oz,DIR[0],DIR[1],DIR[2],a);
    if(r.part&&r.dist<hitDist){hitDist=r.dist;hitActor=a;hitPart=r.part;}
  }
  const wall=wallDistance(ox,oy,oz,DIR[0],DIR[1],DIR[2]);
  if(hitActor&&hitDist<wall){
    applyDamage(s,hitActor,w.damage*(1-Math.min(0.35,hitDist/260)),hitPart,t);
    if(t===s.player){s.stats.hits++;s.lastEvent=hitPart==='head'?'HEADSHOT':'HIT';}
    pushNoise(s,t.x,t.z,t.team,'gunfire');
    return {hit:true,actor:hitActor,part:hitPart,dist:hitDist,x:ox+DIR[0]*hitDist,y:oy+DIR[1]*hitDist,z:oz+DIR[2]*hitDist};
  }
  pushNoise(s,t.x,t.z,t.team,'gunfire');
  const d=Math.min(wall,w.range);
  return {hit:false,dist:d,x:ox+DIR[0]*d,y:oy+DIR[1]*d,z:oz+DIR[2]*d};
}
export function reload(t){
  const w=WEAPONS[t.weapon]||WEAPONS.rifle;
  if(t.reload>0||t.mag>=w.mag||t.reserve<=0)return false;
  t.reload=w.reload;return true;
}
export function tickWeapon(t,dt){
  if(t.cooldown>0)t.cooldown=Math.max(0,t.cooldown-dt);
  if(t.recoil>0)t.recoil=Math.max(0,t.recoil-dt*2.4);
  if(t.recoilPitch>0)t.recoilPitch=Math.max(0,t.recoilPitch-dt*0.16);
  if(t.reload>0){
    t.reload-=dt;
    if(t.reload<=0){
      const w=WEAPONS[t.weapon]||WEAPONS.rifle,need=w.mag-t.mag,take=Math.min(need,t.reserve);
      t.mag+=take;t.reserve-=take;t.reload=0;
    }
  }
}
const NOISE_CAP=24;
export function pushNoise(s,x,z,team,kind){
  if(s.noises.length>=NOISE_CAP)s.noises.shift();
  s.noises.push({x,z,team,kind,t:s.time});
}
export function throwGrenade(s,t){
  if(!t.alive||t.grenades<=0||s.phase!=='live')return false;
  t.grenades--;
  const cp=Math.cos(t.pitch||0);
  const p={x:t.x,y:t.y+1.5,z:t.z,vx:-Math.sin(t.yaw)*7.4*cp,vy:3.6+Math.sin(t.pitch||0)*2,vz:-Math.cos(t.yaw)*7.4*cp,fuse:2.4};
  s.projectiles.push(p);
  return true;
}
export {GRENADE,SOLIDS};
