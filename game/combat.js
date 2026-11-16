// Weapons, hit traces, damage, recoil patterns and grenade effects. No three.js import.
import {WEAPONS,GRENADES} from './state.js';
import {rayBox,wallDistance,SOLIDS,visible} from './map.js';
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
    if(attacker){attacker.kills=(attacker.kills||0)+1;
      const bounty=300+50*Math.min(6,s.round-1);
      if(attacker===s.player){s.player.kills++;s.stats.killParts[part]++;s.player.money=Math.min(16000,s.player.money+bounty);}
      s.killFeed.unshift({t:s.time,text:`${attacker===s.player?'YOU':attacker.team==='attack'?'SAPPER':'CUSTODIAN'} ▸ ${part==='head'?'HEADSHOT':'ELIMINATED'} (+$${bounty})`});
      if(s.killFeed.length>6)s.killFeed.length=6;
    }
    if(target===s.player)s.player.deaths++;
  }
  return dmg;
}
// Fixed per-weapon spray patterns: the first shots are tight, the tail climbs.
export const RECOIL={
  rifle:[[0,1],[0.1,1.05],[-0.15,1.1],[0.25,1.15],[-0.3,1.2],[0.45,1.15],[-0.55,1.1],[0.7,1.05],[-0.85,1.0],[1.0,0.95]],
  smg:[[0,1],[0.2,0.9],[-0.2,0.85],[0.35,0.8],[-0.4,0.75],[0.5,0.7]],
  dmr:[[0,1],[0.2,1.2],[-0.2,1.4]],
  shotgun:[[0,1],[0.4,1.3],[-0.4,1.5]],
  lmg:[[0,1],[0.15,1.0],[-0.2,1.05],[0.3,1.1],[-0.35,1.05],[0.5,1.0],[-0.6,0.95],[0.75,0.9],[-0.9,0.85],[1.05,0.8],[-1.1,0.75],[1.2,0.7]],
};
function patternOf(t,w){
  const p=RECOIL[w.id]||RECOIL.rifle;
  return p[Math.min(p.length-1,t.sprayIndex||0)];
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
function traceShot(s,t,ox,oy,oz,yaw,pitch,spread,range){
  forward(yaw,pitch,spread,DIR);
  let hitActor=null,hitPart=null,hitDist=range;
  for(let i=0;i<s.actors.length;i++){
    const a=s.actors[i];
    if(!a.alive||a.team===t.team)continue;
    const r=traceBody(ox,oy,oz,DIR[0],DIR[1],DIR[2],a);
    if(r.part&&r.dist<hitDist){hitDist=r.dist;hitActor=a;hitPart=r.part;}
  }
  const wall=wallDistance(ox,oy,oz,DIR[0],DIR[1],DIR[2]);
  return {hitActor,hitPart,dist:Math.min(hitDist,wall),wall,dx:DIR[0],dy:DIR[1],dz:DIR[2]};
}
export function fire(s,t){
  if(!t.alive||s.phase!=='live')return false;
  const w=WEAPONS[t.weapon]||WEAPONS.rifle;
  if(t.reload>0||t.cooldown>0||t.mag<=0)return false;
  t.mag--;t.cooldown=60/w.rpm;t.shots=(t.shots||0)+1;
  if(t===s.player)s.stats.shots++;
  const pat=patternOf(t,w);
  if((t.sinceShot||9)>0.35)t.sprayIndex=0;else t.sprayIndex=(t.sprayIndex||0)+1;
  t.sinceShot=0;
  t.recoil=Math.min(1.6,t.recoil+0.3+w.recoil*6);
  t.recoilPitch=Math.min(0.09,t.recoilPitch+0.015);
  t.pitch=Math.min(1.45,(t.pitch||0)+0.004+pat[1]*0.0016);
  const ox=t.x,oy=t.y+1.55,oz=t.z;
  const yaw=t.yaw+pat[0]*0.0032*(t.crouch?0.6:1);
  const pitch=t.pitch+t.recoilPitch*0.35+pat[1]*0.0022;
  const pellets=w.pellets||1;
  let best=null,damageDealt=0;
  for(let p=0;p<pellets;p++){
    const shot=traceShot(s,t,ox,oy,oz,yaw,pitch,spreadOf(t),w.range);
    if(shot.hitActor&&shot.dist<shot.wall){
      const falloff=w.pellets?Math.max(0.25,1-shot.dist/w.range):1-Math.min(0.35,shot.dist/260);
      const dealt=applyDamage(s,shot.hitActor,w.damage*falloff,shot.hitPart,t);
      damageDealt+=dealt;
      if(!best||shot.dist<best.dist)best={hit:true,actor:shot.hitActor,part:shot.hitPart,dist:shot.dist,
        x:ox+shot.dx*shot.dist,y:oy+shot.dy*shot.dist,z:oz+shot.dz*shot.dist};
    }else if(!best||shot.dist<best.dist){
      best={hit:false,dist:shot.dist,x:ox+shot.dx*shot.dist,y:oy+shot.dy*shot.dist,z:oz+shot.dz*shot.dist};
    }
  }
  if(damageDealt>0&&t===s.player){s.stats.hits++;s.lastEvent=best&&best.part==='head'?'HEADSHOT':'HIT';}
  pushNoise(s,t.x,t.z,t.team,'gunfire');
  if(best&&best.actor)s.lastHitPart=best.part;
  return Object.assign(best||{hit:false,dist:0,x:ox,y:oy,z:oz},{damage:damageDealt,pellets});
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
  t.sinceShot=(t.sinceShot||0)+dt;
  if(t.sinceShot>0.4)t.sprayIndex=0;
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
export function throwGrenade(s,t,type){
  if(!t.alive||s.phase!=='live')return false;
  const kind=type&&GRENADES[type]?type:(t.grenadeType||'frag');
  const stock=t.stock||{};
  const count=stock[kind]||0;
  if(count<=0)return false;
  stock[kind]=count-1;
  type=kind;
  const cp=Math.cos(t.pitch||0);
  const p={x:t.x,y:t.y+1.5,z:t.z,vx:-Math.sin(t.yaw)*7.4*cp,vy:3.6+Math.sin(t.pitch||0)*2,vz:-Math.cos(t.yaw)*7.4*cp,fuse:GRENADES[type].fuse,type};
  s.projectiles.push(p);
  return true;
}
export function explode(s,x,z,type='frag'){
  const g=GRENADES[type]||GRENADES.frag;
  if(type==='smoke'){
    s.smokes.push({x,z,r:g.radius,until:s.time+g.duration});
    pushNoise(s,x,z,'','smoke');
    return {kind:'smoke',x,z,r:g.radius};
  }
  if(type==='flash'){
    const blinded=[];
    for(let i=0;i<s.actors.length;i++){
      const a=s.actors[i];
      if(!a.alive||a.team==='attack')continue;
      const d=Math.hypot(a.x-x,a.z-z);
      if(d<g.radius&&visible(x,z,a.x,a.z,1.4)){a.blind=Math.max(a.blind||0,g.blind);blinded.push(a.id);}
    }
    s.flashAt={x,z,t:s.time};
    pushNoise(s,x,z,'','flash');
    return {kind:'flash',blinded};
  }
  const hit=[];
  for(let i=0;i<s.actors.length;i++){
    const a=s.actors[i];
    if(!a.alive)continue;
    const d=Math.hypot(a.x-x,a.z-z);
    if(d<g.radius){applyDamage(s,a,g.damage*(1-d/g.radius),'body',null);hit.push(a.id);}
  }
  const p=s.player;
  if(p.alive){
    const d=Math.hypot(p.x-x,p.z-z);
    if(d<g.radius){applyDamage(s,p,g.damage*(1-d/g.radius),'body',null);hit.push('player');}
  }
  pushNoise(s,x,z,'','explosion');
  return {kind:'frag',hit};
}
// Smoke blocks sight: a segment whose midpoint band crosses the cloud is obscured.
export function smokeBlocks(s,ax,az,bx,bz){
  for(let i=0;i<s.smokes.length;i++){
    const c=s.smokes[i];
    if(c.until<=s.time)continue;
    const vx=bx-ax,vz=bz-az,len2=vx*vx+vz*vz||1;
    let t=((c.x-ax)*vx+(c.z-az)*vz)/len2;
    t=Math.max(0,Math.min(1,t));
    const px=ax+vx*t,pz=az+vz*t;
    if(Math.hypot(px-c.x,pz-c.z)<c.r*0.85)return true;
  }
  return false;
}
export {GRENADES,SOLIDS};
