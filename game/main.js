// Main loop and renderer: 120 Hz fixed simulation, rendering decoupled, input and debug hooks.
import * as THREE from 'three';
import {createState,spawnRound,startRound,WEAPONS,GRENADE_ORDER,STEP,BUY_TIME} from './state.js';
import {tick,buy,advance as simAdvance,throwGrenade,reload,fire} from './sim.js';
import {buildWorld,buildViewmodel,PALETTE} from './world.js';
import {createHud} from './hud.js';
import {createBriefing,openBriefing,dismiss as dismissBriefing,isBriefingOpen} from './briefing.js';
import {modeOf} from './modes.js';
import {sfx,unlockAudio} from './audio.js';
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
const state=createState(Number(params.get('seed')??(Math.random()*1e6|0)),params.get('mode')??'standard');
state.debug.nobots=params.get('nobots')==='1';
spawnRound(state,{nobots:state.debug.nobots,seed:state.seed});
if(params.get('fast')==='1')state.phaseTimer=1.2;
const hud=createHud(state,item=>{if(buy(state,item))hud.feed(item.replace('grenade:','').toUpperCase()+' ACQUIRED');});
createBriefing(()=>{state.debug.paused=false;});
let selectedMode=state.mode.id;
for(const btn of document.querySelectorAll('.mode')){
  btn.addEventListener('click',()=>{
    if(started)return;
    selectedMode=btn.dataset.mode;
    for(const other of document.querySelectorAll('.mode'))other.classList.toggle('sel',other===btn);
    state.mode=modeOf(selectedMode);
    state.seed=Math.random()*1e6|0;
    spawnRound(state,{nobots:state.debug.nobots,seed:state.seed});
    hud.update(state);
  });
}
// Character meshes are pooled once; the loop only moves them.
const BOT_GEO={body:new THREE.BoxGeometry(0.62,0.86,0.4),head:new THREE.BoxGeometry(0.32,0.3,0.32),legs:new THREE.BoxGeometry(0.56,0.78,0.36),
  plate:new THREE.BoxGeometry(0.5,0.42,0.1),helmet:new THREE.BoxGeometry(0.36,0.14,0.36)};
const BOT_MAT={
  attack:new THREE.MeshStandardMaterial({color:'#d8894a',roughness:0.58,metalness:0.18}),
  attackDark:new THREE.MeshStandardMaterial({color:'#8d4d22',roughness:0.66,metalness:0.22}),
  defend:new THREE.MeshStandardMaterial({color:'#2f7f86',roughness:0.56,metalness:0.24}),
  defendDark:new THREE.MeshStandardMaterial({color:'#164549',roughness:0.64,metalness:0.26}),
  headA:new THREE.MeshStandardMaterial({color:'#e6c9a4',roughness:0.72}),
  headD:new THREE.MeshStandardMaterial({color:'#c9b596',roughness:0.72}),
  legs:new THREE.MeshStandardMaterial({color:'#39434a',roughness:0.8,metalness:0.12}),
};
const OUTLINE_MAT=new THREE.LineBasicMaterial({color:'#070c0e',transparent:true,opacity:0.9});
const OUT_BODY=new THREE.EdgesGeometry(BOT_GEO.body),OUT_HEAD=new THREE.EdgesGeometry(BOT_GEO.head);
const SHADOW_GEO=new THREE.CircleGeometry(0.52,18);
const SHADOW_MAT=new THREE.MeshBasicMaterial({color:0x0a1012,transparent:true,opacity:0.46,depthWrite:false});
const actorMeshes=[];
for(let i=0;i<7;i++){
  const g=new THREE.Group();
  const legs=new THREE.Mesh(BOT_GEO.legs,BOT_MAT.legs);legs.position.y=0.39;
  const body=new THREE.Mesh(BOT_GEO.body,BOT_MAT.defend);body.position.y=1.1;
  const plate=new THREE.Mesh(BOT_GEO.plate,BOT_MAT.defendDark);plate.position.set(0,1.16,-0.21);
  const head=new THREE.Mesh(BOT_GEO.head,BOT_MAT.headD);head.position.y=1.66;
  const helmet=new THREE.Mesh(BOT_GEO.helmet,BOT_MAT.defendDark);helmet.position.y=1.79;
  const visor=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.09,0.06),new THREE.MeshStandardMaterial({color:'#0b1416',roughness:0.18,metalness:0.7}));
  visor.position.set(0,1.66,-0.16);
  const bodyEdges=new THREE.LineSegments(OUT_BODY,OUTLINE_MAT);
  bodyEdges.position.copy(body.position);
  const headEdges=new THREE.LineSegments(OUT_HEAD,OUTLINE_MAT);
  headEdges.position.copy(head.position);
  const shadow=new THREE.Mesh(SHADOW_GEO,SHADOW_MAT);
  shadow.rotation.x=-Math.PI/2;shadow.visible=false;scene.add(shadow);
  g.add(legs,body,plate,head,helmet,visor,bodyEdges,headEdges);g.castShadow=true;g.visible=false;scene.add(g);
  actorMeshes.push({group:g,body,plate,head,helmet,shadow,bodyEdges,headEdges});
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
  unlockAudio();
  if(!state.briefingShown){
    state.briefingShown=true;state.debug.paused=true;
    openBriefing(state.site,state.mode);
  }
  if(canvas.requestPointerLock)canvas.requestPointerLock();
}
function newMatch(){
  state.round=1;state.score.attack=0;state.score.defend=0;
  state.matchWinner=null;state.briefingShown=true;state.debug.paused=false;
  spawnRound(state,{nobots:state.debug.nobots,seed:Math.random()*1e6|0});
  hud.update(state);
}
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;});
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(isBriefingOpen()&&(e.code==='Enter'||e.code==='Space'||e.code==='Escape')){dismissBriefing();e.preventDefault();return;}
  if(e.code==='Enter'&&state.phase==='matchEnd'){newMatch();return;}
  if(e.code==='KeyB'||e.code==='Escape'){
    const on=document.getElementById('buy').classList.toggle('on');
    if(on)document.exitPointerLock&&document.exitPointerLock();
    e.preventDefault();return;
  }
  if(e.code==='KeyR'){if(reload(state.player))sfx.reload();}
  if(e.code==='KeyG')throwSelected();
  if(e.code==='KeyQ')cycleGrenade();
  if(e.code==='KeyE')input.plant=true;
  if(e.code==='KeyF')input.defuse=true;
  if(e.code.startsWith('Digit')){
    const n=e.code.slice(5);
    if(state.phase==='buy'){
      const map={'1':'rifle','2':'smg','3':'dmr','4':'shotgun','5':'lmg','6':'armour',
        '7':'grenade:frag','8':'grenade:smoke','9':'grenade:flash','0':'defuse'};
      const item=map[n];
      if(item&&buy(state,item))hud.feed(item.replace('grenade:','').toUpperCase()+' ACQUIRED');
    }else{
      const pick={'7':'frag','8':'smoke','9':'flash'}[n];
      if(pick){state.player.grenadeType=pick;hud.feed('GRENADE · '+pick.toUpperCase());}
    }
  }
});
function throwSelected(){
  const p=state.player;
  if(p.stock[p.grenadeType]>0&&throwGrenade(state,p,p.grenadeType)){sfx.grenade();hud.feed((p.grenadeType||'frag').toUpperCase()+' OUT');return;}
  const next=GRENADE_ORDER.find(k=>p.stock[k]>0);
  if(next){p.grenadeType=next;if(throwGrenade(state,p,next)){sfx.grenade();hud.feed(next.toUpperCase()+' OUT');}}
}
function cycleGrenade(){
  const p=state.player,i=GRENADE_ORDER.indexOf(p.grenadeType);
  p.grenadeType=GRENADE_ORDER[(i+1)%GRENADE_ORDER.length];
  hud.feed('GRENADE · '+p.grenadeType.toUpperCase());
}
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
  if(r){shotResult=r;showTracer(r);sfx.shot(state.player.weapon);}
}
function showTracer(r){
  if(!r)return;
  const ox=state.player.x,oy=state.player.y+1.5,oz=state.player.z;
  tracerPos[0]=ox;tracerPos[1]=oy;tracerPos[2]=oz;
  tracerPos[3]=r.x;tracerPos[4]=r.y;tracerPos[5]=r.z;
  tracerGeo.attributes.position.needsUpdate=true;
  tracer.visible=true;tracerT=0.055;
}
let last=performance.now(),acc=0,stepTimer=0,lastKills=0,lastRoundOver=false;
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
    if(r){showTracer(r);sfx.shot(p.weapon);}
  }
  acc+=dt;
  let steps=0;
  if(!state.debug.paused)while(acc>=STEP&&steps<8){tick(state,STEP);acc-=STEP;steps++;}
  if(acc>STEP*8)acc=0;
  if(input.jump)input.jump=false;
  if(p.alive&&state.phase==='live'&&Math.hypot(p.vx,p.vz)>1.2&&p.onGround){
    stepTimer-=dt;
    if(stepTimer<=0){sfx.footstep();stepTimer=p.crouch?0.62:0.4;}
  }
  if(p.kills>lastKills){lastKills=p.kills;sfx.kill();}
  if(state.phase==='roundEnd'&&!lastRoundOver){lastRoundOver=true;sfx.round(state.winner==='attack');}
  if(state.phase!=='roundEnd')lastRoundOver=false;
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
    m.shadow.visible=a.alive;
    if(!a.alive)continue;
    m.group.position.set(a.x,a.y,a.z);
    m.group.rotation.y=a.yaw;
    const atk=a.team==='attack';
    m.body.material=atk?BOT_MAT.attack:BOT_MAT.defend;
    m.plate.material=atk?BOT_MAT.attackDark:BOT_MAT.defendDark;
    m.helmet.material=atk?BOT_MAT.attackDark:BOT_MAT.defendDark;
    m.head.material=atk?BOT_MAT.headA:BOT_MAT.headD;
    m.body.position.y=a.crouch?0.85:1.1;
    m.head.position.y=a.crouch?1.41:1.66;
    m.helmet.position.y=a.crouch?1.54:1.79;
    m.plate.position.y=a.crouch?0.91:1.16;
    m.bodyEdges.position.y=m.body.position.y;
    m.headEdges.position.y=m.head.position.y;
    m.shadow.position.set(a.x,0.025,a.z);
    m.shadow.scale.setScalar(a.crouch?0.85:1);
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
globalThis.__dismissBriefing=()=>{const closed=dismissBriefing();state.debug.paused=false;return closed;};
globalThis.__setMode=id=>{state.mode=modeOf(id);spawnRound(state,{nobots:state.debug.nobots,seed:state.seed});hud.update(state);return state.mode.id;};
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
  site:{id:state.site.id,name:state.site.name,x:state.site.x,z:state.site.z},
  mode:{id:state.mode.id,name:state.mode.name,rounds:state.mode.rounds,buy:state.mode.buy,economy:state.mode.economy},
  briefingShown:state.briefingShown,briefingOpen:isBriefingOpen(),matchWinner:state.matchWinner,
  money:state.player.money,hp:state.player.hp,alive:state.player.alive,mag:state.player.mag,
  reserve:state.player.reserve,weapon:state.player.weapon,armour:state.player.armour,
  stock:{...state.player.stock},grenadeType:state.player.grenadeType,
  smokes:state.smokes.length,summary:state.summary?{...state.summary}:null,
  pos:[+state.player.x.toFixed(2),+state.player.z.toFixed(2)],yaw:+state.player.yaw.toFixed(3),
  bomb:state.bomb?{state:state.bomb.state,timer:+state.bomb.timer.toFixed(2),x:+state.bomb.x.toFixed(2),z:+state.bomb.z.toFixed(2)}:null,
  bots:state.actors.map(b=>({id:b.id,team:b.team,alive:b.alive,hp:Math.round(b.hp),state:b.state,x:+b.x.toFixed(2),z:+b.z.toFixed(2)})),
  botsAlive:state.actors.filter(b=>b.alive).length,bullets:state.projectiles.length,
  started,errors:0,
});
document.getElementById('loading').style.display='none';
