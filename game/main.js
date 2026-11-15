// Main loop and renderer: 120 Hz fixed simulation, rendering decoupled, input and debug hooks.
import * as THREE from 'three';
import {createState,spawnRound,startRound,WEAPONS,STEP,BUY_TIME} from './state.js';
import {tick,buy,advance as simAdvance,throwGrenade,reload,fire} from './sim.js';
import {buildWorld,buildViewmodel,PALETTE} from './world.js';
import {createHud} from './hud.js';
import {eyeHeight} from './movement.js';
const params=new URLSearchParams(location.search);
const canvas=document.getElementById('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(74,1,0.05,260);
scene.add(camera);
buildWorld(scene);
const view=buildViewmodel(camera);
const state=createState();
state.debug.nobots=params.get('nobots')==='1';
spawnRound(state,{nobots:state.debug.nobots});
if(params.get('fast')==='1')state.phaseTimer=1.2;
const hud=createHud(state,item=>{if(buy(state,item))hud.feed(item.toUpperCase()+' ACQUIRED');});
// Character meshes are pooled once; the loop only moves them.
const BOT_GEO={body:new THREE.BoxGeometry(0.62,0.86,0.4),head:new THREE.BoxGeometry(0.32,0.3,0.32),legs:new THREE.BoxGeometry(0.56,0.78,0.36)};
const BOT_MAT={attack:new THREE.MeshStandardMaterial({color:'#d8894a',roughness:0.7}),defend:new THREE.MeshStandardMaterial({color:'#2f7f86',roughness:0.7}),head:new THREE.MeshStandardMaterial({color:'#e8cdac',roughness:0.8}),legs:new THREE.MeshStandardMaterial({color:'#39434a',roughness:0.85})};
const actorMeshes=[];
for(let i=0;i<7;i++){
  const g=new THREE.Group();
  const legs=new THREE.Mesh(BOT_GEO.legs,BOT_MAT.legs);legs.position.y=0.39;
  const body=new THREE.Mesh(BOT_GEO.body,BOT_MAT.defend);body.position.y=1.1;
  const head=new THREE.Mesh(BOT_GEO.head,BOT_MAT.head);head.position.y=1.66;
  const visor=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.09,0.06),new THREE.MeshStandardMaterial({color:'#101a1c',roughness:0.2,metalness:0.6}));
  visor.position.set(0,1.66,-0.16);
  g.add(legs,body,head,visor);g.castShadow=true;g.visible=false;scene.add(g);
  actorMeshes.push({group:g,body,head});
}
const tracerGeo=new THREE.BufferGeometry();
const tracerPos=new Float32Array(6);
tracerGeo.setAttribute('position',new THREE.BufferAttribute(tracerPos,3));
const tracerMat=new THREE.LineBasicMaterial({color:'#ffd9a0',transparent:true,opacity:0.8});
const tracer=new THREE.Line(tracerGeo,tracerMat);tracer.visible=false;tracer.frustumCulled=false;scene.add(tracer);
let tracerT=0;
const bombGroup=new THREE.Group();
const bombBody=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.18,0.26),new THREE.MeshStandardMaterial({color:'#3a3f44',metalness:0.5,roughness:0.5}));
const bombLamp=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8),new THREE.MeshBasicMaterial({color:'#ff5a3c',toneMapped:false}));
bombLamp.position.y=0.12;bombGroup.add(bombBody,bombLamp);bombGroup.visible=false;scene.add(bombGroup);
const bombLight=new THREE.PointLight(0xff6a3c,0,7,2);bombGroup.add(bombLight);
const grenadeMesh=new THREE.Mesh(new THREE.SphereGeometry(0.11,10,8),new THREE.MeshStandardMaterial({color:'#4b5a3a',roughness:0.6}));
grenadeMesh.visible=false;scene.add(grenadeMesh);
const keys=Object.create(null);
let started=false,locked=false;
const input=state.input;
function resize(){
  const w=innerWidth,h=innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.updateProjectionMatrix();
}
addEventListener('resize',resize);resize();
const startPanel=document.getElementById('start');
document.getElementById('play').addEventListener('click',()=>begin());
canvas.addEventListener('click',()=>{
  if(!started)begin();
  if(!locked&&canvas.requestPointerLock)canvas.requestPointerLock();
  if(state.phase==='live'&&WEAPONS[state.player.weapon].auto===false)shootOnce();
});
function begin(){
  if(started)return;
  started=true;startPanel.style.display='none';
  document.getElementById('loading').style.display='none';
  if(canvas.requestPointerLock)canvas.requestPointerLock();
}
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;});
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyB'||e.code==='Escape'){
    const on=document.getElementById('buy').classList.toggle('on');
    if(on)document.exitPointerLock&&document.exitPointerLock();
    e.preventDefault();return;
  }
  if(e.code==='KeyR')reload(state.player);
  if(e.code==='KeyG')throwGrenade(state,state.player);
  if(e.code==='KeyE')input.plant=true;
  if(e.code==='KeyF')input.defuse=true;
  if(e.code.startsWith('Digit')){
    const map={Digit1:'rifle',Digit2:'smg',Digit3:'dmr',Digit4:'armour',Digit5:'grenade',Digit6:'defuse'};
    const item=map[e.code];
    if(item&&buy(state,item))hud.feed(item.toUpperCase()+' ACQUIRED');
  }
});
addEventListener('keyup',e=>{
  keys[e.code]=false;
  if(e.code==='KeyE'){input.plant=false;state.plantProgress=0;}
  if(e.code==='KeyF')input.defuse=false;
});
addEventListener('mousedown',e=>{
  if(e.button===0&&started){input.shoot=true;if(WEAPONS[state.player.weapon].auto===false)shootOnce();}
});
addEventListener('mouseup',e=>{if(e.button===0)input.shoot=false;});
addEventListener('mousemove',e=>{
  if(!locked||!started)return;
  const p=state.player;
  p.yaw-=e.movementX*0.0021;
  p.pitch=Math.max(-1.35,Math.min(1.35,p.pitch-e.movementY*0.0021));
});
addEventListener('wheel',e=>{
  if(!started||state.phase!=='buy')return;
  const order=['rifle','smg','dmr'];
  const i=order.indexOf(state.player.weapon);
  const next=order[(i+(e.deltaY>0?1:order.length-1))%order.length];
  buy(state,next);
},{passive:true});
let shotResult=null;
function shootOnce(){
  const r=fire(state,state.player);
  if(r){shotResult=r;showTracer(r);}
}
function showTracer(r){
  if(!r)return;
  const ox=state.player.x,oy=state.player.y+1.5,oz=state.player.z;
  tracerPos[0]=ox;tracerPos[1]=oy;tracerPos[2]=oz;
  tracerPos[3]=r.x;tracerPos[4]=r.y;tracerPos[5]=r.z;
  tracerGeo.attributes.position.needsUpdate=true;
  tracer.visible=true;tracerT=0.055;
}
let last=performance.now(),acc=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.25,(now-last)/1000);last=now;
  const p=state.player;
  input.forward=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  input.strafe=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  input.crouch=!!keys.ControlLeft||!!keys.KeyC;
  p.crouch=input.crouch;
  input.jump=!!keys.Space;
  if(started&&state.phase==='live'&&WEAPONS[p.weapon].auto&&input.shoot){
    const r=fire(state,p);
    if(r)showTracer(r);
  }
  acc+=dt;
  let steps=0;
  if(!state.debug.paused)while(acc>=STEP&&steps<8){tick(state,STEP);acc-=STEP;steps++;}
  if(acc>STEP*8)acc=0;
  if(input.jump)input.jump=false;
  render();
  hud.update(state);
}
function render(){
  const p=state.player;
  camera.position.set(p.x,p.y+eyeHeight(p)+(p.landing>0?-p.landing*0.35:0),p.z);
  camera.rotation.set(p.pitch,0,0);
  camera.rotation.y=p.yaw;
  camera.rotation.x=p.pitch+p.recoilPitch*0.28;
  camera.fov=74+(p.recoil>0?p.recoil*0.5:0);
  camera.updateProjectionMatrix();
  camera.rotation.z=Math.sin(p.bob*0.5)*0.004;
  const vm=view.group;
  const recoil=p.recoil*0.06;
  vm.position.set(view.baseX+Math.sin(p.bob)*0.006,-Math.abs(Math.cos(p.bob))*0.004+view.baseY-p.crouch*0.01+recoil*0.2,-0.52+recoil*0.5);
  vm.rotation.set(recoil*0.6,0.02+Math.sin(p.bob*0.5)*0.01,0);
  view.flash.intensity=p.cooldown>0.06?7:0;
  view.flash.position.set(0,0.02,-0.62);
  if(tracerT>0){tracerT-=STEP*4;tracerMat.opacity=Math.max(0,tracerT*14);}else tracer.visible=false;
  for(let i=0;i<state.actors.length&&i<actorMeshes.length;i++){
    const a=state.actors[i],m=actorMeshes[i];
    m.group.visible=a.alive;
    if(!a.alive)continue;
    m.group.position.set(a.x,a.y,a.z);
    m.group.rotation.y=a.yaw;
    m.body.material=a.team==='attack'?BOT_MAT.attack:BOT_MAT.defend;
    m.body.position.y=a.crouch?0.85:1.1;
    m.head.position.y=a.crouch?1.41:1.66;
  }
  const b=state.bomb;
  bombGroup.visible=!!b;
  if(b){
    bombGroup.position.set(b.x,0.1,b.z);
    const blink=b.state==='armed'?(Math.sin(state.time*9)>0?2.4:0.4):0;
    bombLight.intensity=blink*3;bombLamp.material.color.setHex(b.state==='armed'?0xff5a3c:0x7fff9a);
    bombLamp.scale.setScalar(b.state==='armed'?1+blink*0.2:1);
  }
  const g=state.projectiles[0];
  grenadeMesh.visible=!!g;
  if(g)grenadeMesh.position.set(g.x,g.y,g.z);
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
// A starved or background tab stops rAF; repaint the last state without advancing time.
setInterval(()=>{if(performance.now()-last>420){last=performance.now();acc=0;render();hud.update(state);}},240);
// Debug hooks for headless verification; read-only except the documented teleport and step.
globalThis.__advance=seconds=>{simAdvance(state,seconds);render();hud.update(state);return true;};
globalThis.__tp=(x,z,yaw=0,pitch=0)=>{const p=state.player;p.x=x;p.z=z;p.y=0;p.vx=p.vz=0;p.yaw=yaw;p.pitch=pitch;render();return true;};
globalThis.__buy=id=>buy(state,id);
globalThis.__fire=()=>{const r=fire(state,state.player);if(r)showTracer(r);render();return r;};
globalThis.__reload=()=>reload(state.player);
globalThis.__start=()=>{begin();return true;};
globalThis.__pause=v=>{state.debug.paused=v!==false;return state.debug.paused;};
globalThis.__state=state;
globalThis.__camera=camera;
globalThis.__three=THREE;
globalThis.__probe=(ndcX=0,ndcY=0)=>{
  const ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(ndcX,ndcY),camera);
  const hits=ray.intersectObjects(scene.children,true).slice(0,4);
  return hits.map(h=>({name:h.object.type,dist:+h.distance.toFixed(2),geo:h.object.geometry&&h.object.geometry.type,
    color:h.object.material&&h.object.material.color?h.object.material.color.getHexString():null,
    pos:h.object.position.toArray().map(v=>+v.toFixed(1))}));
};
globalThis.__debug=()=>({
  phase:state.phase,round:state.round,timer:+state.phaseTimer.toFixed(2),score:{...state.score},
  money:state.player.money,hp:state.player.hp,alive:state.player.alive,mag:state.player.mag,
  reserve:state.player.reserve,weapon:state.player.weapon,armour:state.player.armour,
  pos:[+state.player.x.toFixed(2),+state.player.z.toFixed(2)],yaw:+state.player.yaw.toFixed(3),
  bomb:state.bomb?{state:state.bomb.state,timer:+state.bomb.timer.toFixed(2),x:+state.bomb.x.toFixed(2),z:+state.bomb.z.toFixed(2)}:null,
  bots:state.actors.map(b=>({id:b.id,team:b.team,alive:b.alive,hp:Math.round(b.hp),state:b.state,x:+b.x.toFixed(2),z:+b.z.toFixed(2)})),
  botsAlive:state.actors.filter(b=>b.alive).length,bullets:state.projectiles.length,
  started,errors:0,
});
document.getElementById('loading').style.display='none';
