// Player locomotion: acceleration, friction, crouch, jump and collision resolution.
import {moveBody} from './map.js';
const WALK=5.35,CROUCH=2.25,ACCEL=58,FRICTION=9.5,GRAVITY=18,JUMP=5.4;
export function eyeHeight(p){
  return 1.62-(p.crouch?0.42:0)+Math.sin(p.bob)*0.018;
}
export function stepPlayer(s,dt){
  const p=s.player;
  if(!p.alive)return;
  const i=s.input;
  const wishF=i.forward, wishS=i.strafe;
  const len=Math.hypot(wishF,wishS)||1;
  const speed=p.crouch?CROUCH:WALK;
  const sin=Math.sin(p.yaw),cos=Math.cos(p.yaw);
  let tx=(-sin*wishF+cos*wishS)/len*speed;
  let tz=(-cos*wishF-sin*wishS)/len*speed;
  if(!wishF&&!wishS){tx=0;tz=0;}
  const accel=p.onGround?ACCEL:ACCEL*0.32;
  p.vx+=Math.max(-accel*dt,Math.min(accel*dt,tx-p.vx));
  p.vz+=Math.max(-accel*dt,Math.min(accel*dt,tz-p.vz));
  if(p.onGround&&!wishF&&!wishS){
    const drop=Math.max(0,1-FRICTION*dt);
    p.vx*=drop;p.vz*=drop;
  }
  if(i.jump&&p.onGround&&!p.crouch){p.vy=JUMP;p.onGround=false;}
  p.vy-=GRAVITY*dt;p.y+=p.vy*dt;
  if(p.y<=0){p.y=0;p.vy=0;if(!p.onGround)p.landing=0.18;p.onGround=true;}
  else p.onGround=false;
  moveBody(p,p.vx*dt,p.vz*dt);
  p.bodyY=p.y;
  const speedNow=Math.hypot(p.vx,p.vz);
  if(p.onGround&&speedNow>0.4)p.bob+=dt*(p.crouch?5:11)*Math.min(1,speedNow/5);
  if(p.landing>0)p.landing=Math.max(0,p.landing-dt);
  p.moving=speedNow>0.35;
}
export {WALK,CROUCH};
