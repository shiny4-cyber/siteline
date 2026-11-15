// Render world: geometry generated from the same SOLIDS data used for collision.
import * as THREE from 'three';
import {SOLIDS,SITE} from './map.js';
export const PALETTE={
  skyTop:'#243a56',skyLow:'#f0a45e',ground:'#8d7b5f',sand:'#c9ac82',sandDark:'#a88c64',
  teal:'#1f5f63',tealDark:'#143e44',steel:'#3a4149',orange:'#e08a4a',cream:'#f2e3c8',
};
function canvasTexture(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function noiseTexture(base,spec,size=128){
  return canvasTexture(size,size,(g,w,h)=>{
    g.fillStyle=base;g.fillRect(0,0,w,h);
    for(let i=0;i<900;i++){
      const a=0.03+Math.random()*0.06;
      g.fillStyle=`rgba(${spec},${a})`;
      g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1+Math.random()*3);
    }
    g.strokeStyle='rgba(0,0,0,0.16)';g.lineWidth=1;
    for(let i=0;i<w;i+=32){g.beginPath();g.moveTo(i,0);g.lineTo(i,h);g.stroke();}
  });
}
function signTexture(title,sub){
  return canvasTexture(512,192,(g,w,h)=>{
    g.fillStyle='#12262b';g.fillRect(0,0,w,h);
    g.strokeStyle=PALETTE.orange;g.lineWidth=10;g.strokeRect(10,10,w-20,h-20);
    g.fillStyle=PALETTE.cream;g.font='bold 84px sans-serif';g.textAlign='center';
    g.fillText(title,w/2,108);
    g.fillStyle=PALETTE.orange;g.font='bold 34px sans-serif';g.fillText(sub,w/2,158);
  });
}
function groundTexture(){
  return canvasTexture(1024,1024,(g,w,h)=>{
    g.fillStyle=PALETTE.ground;g.fillRect(0,0,w,h);
    for(let i=0;i<4000;i++){g.fillStyle=`rgba(60,50,38,${Math.random()*0.16})`;g.fillRect(Math.random()*w,Math.random()*h,4,4);}
    g.strokeStyle='rgba(240,214,166,0.55)';g.lineWidth=7;g.setLineDash([26,18]);
    g.beginPath();g.moveTo(150,1024);g.lineTo(150,640);g.stroke();
    g.beginPath();g.moveTo(880,1024);g.lineTo(880,640);g.stroke();
    g.setLineDash([]);g.strokeStyle='rgba(240,214,166,0.85)';g.lineWidth=10;
    g.strokeRect(300,110,430,380);
    g.fillStyle='rgba(224,138,74,0.9)';g.font='bold 46px sans-serif';g.textAlign='center';
    g.fillText('SITE A',515,90);
  });
}
export function buildWorld(scene){
  scene.background=new THREE.Color(PALETTE.skyTop);
  scene.fog=new THREE.Fog('#e8b078',58,130);
  const hemi=new THREE.HemisphereLight(0xffe2bc,0x4a5142,2.05);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffcf94,3.1);sun.position.set(-24,34,26);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-40;sun.shadow.camera.right=40;
  sun.shadow.camera.top=40;sun.shadow.camera.bottom=-40;scene.add(sun);
  const skyTex=canvasTexture(8,256,(g,w,h)=>{
    const grad=g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#2f5478');grad.addColorStop(0.45,'#7d93a4');
    grad.addColorStop(0.72,'#f2b06a');grad.addColorStop(1,'#ffd9a0');
    g.fillStyle=grad;g.fillRect(0,0,w,h);
  });
  skyTex.wrapS=THREE.RepeatWrapping;
  const skyMat=new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,fog:false,toneMapped:false,depthWrite:false});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(150,24,16),skyMat);
  sky.rotation.y=0.4;scene.add(sky);
  const fieldMat=new THREE.MeshStandardMaterial({map:groundTexture(),roughness:0.95,metalness:0.02});
  const field=new THREE.Mesh(new THREE.PlaneGeometry(40,48),fieldMat);
  field.rotation.x=-Math.PI/2;field.receiveShadow=true;scene.add(field);
  const texSand=noiseTexture(PALETTE.sand,'92,68,40'),texTeal=noiseTexture(PALETTE.tealDark,'0,0,0'),texSteel=noiseTexture(PALETTE.steel,'20,24,28');
  const mats={
    boundary:new THREE.MeshStandardMaterial({map:texSand,roughness:0.9}),
    splitter:new THREE.MeshStandardMaterial({map:texSand,roughness:0.92}),
    hall:new THREE.MeshStandardMaterial({map:texTeal,roughness:0.85}),
    crate:new THREE.MeshStandardMaterial({map:texSteel,roughness:0.7,metalness:0.25}),
    cargo:new THREE.MeshStandardMaterial({color:PALETTE.orange,roughness:0.8}),
    console:new THREE.MeshStandardMaterial({color:'#2b3a3f',roughness:0.6,metalness:0.4}),
  };
  const geoByKey=new Map();
  for(const b of SOLIDS){
    const key=`${b.w}|${b.d}|${b.h}`;
    let geo=geoByKey.get(key);
    if(!geo){geo=new THREE.BoxGeometry(b.w,b.h,b.d);geoByKey.set(key,geo);}
    const m=new THREE.Mesh(geo,mats[b.kind]||mats.crate);
    m.position.set(b.x,b.h/2,b.z);m.castShadow=true;m.receiveShadow=true;scene.add(m);
    if(b.kind==='boundary'||b.kind==='hall'){
      const cap=new THREE.Mesh(new THREE.BoxGeometry(b.w+0.08,0.12,b.d+0.08),new THREE.MeshStandardMaterial({color:PALETTE.sandDark,roughness:0.9}));
      cap.position.set(b.x,b.h-0.06,b.z);scene.add(cap);
    }
  }
  const trim=new THREE.MeshStandardMaterial({color:PALETTE.orange,roughness:0.6,metalness:0.3});
  for(const door of [[-3,-5],[8,-10]]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(0.18,3.1,0.2),trim);
    post.position.set(door[0]-1.6,1.55,door[1]);scene.add(post);
    const post2=post.clone();post2.position.x=door[0]+1.6;scene.add(post2);
    const lintel=new THREE.Mesh(new THREE.BoxGeometry(3.4,0.18,0.22),trim);
    lintel.position.set(door[0],3.05,door[1]);scene.add(lintel);
  }
  const signMat=new THREE.MeshBasicMaterial({map:signTexture('RELAY A','CHARGE SITE'),toneMapped:false});
  for(const s of [[-3,-4.55,0.1],[8.06,-10,Math.PI/2]]){
    const backing=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.9,0.06),new THREE.MeshStandardMaterial({color:'#101d21'}));
    backing.position.set(s[0],3.9,s[1]);backing.rotation.y=s[2];scene.add(backing);
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(2.2,0.82),signMat);
    panel.position.set(s[0]+(s[2]?0.04:0),3.9,s[1]+(s[2]?0:-0.04));panel.rotation.y=s[2];scene.add(panel);
  }
  const pad=new THREE.Mesh(new THREE.CircleGeometry(SITE.radius,40),new THREE.MeshStandardMaterial({color:'#c8642e',roughness:0.9,emissive:'#5a2408',emissiveIntensity:0.6}));
  pad.rotation.x=-Math.PI/2;pad.position.set(SITE.x,0.02,SITE.z);scene.add(pad);
  const ring=new THREE.Mesh(new THREE.RingGeometry(SITE.radius-0.08,SITE.radius,48),new THREE.MeshBasicMaterial({color:'#ffcf8a',side:THREE.DoubleSide,toneMapped:false}));
  ring.rotation.x=-Math.PI/2;ring.position.set(SITE.x,0.04,SITE.z);scene.add(ring);
  for(const l of [[-9,4,0xffb066],[10,4,0xffb066],[-2,-13,0x9fe3d0],[6,-3,0xffb066]]){
    const lamp=new THREE.PointLight(l[2],26,22,2);lamp.position.set(l[0],4.3,l[1]);scene.add(lamp);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8),new THREE.MeshBasicMaterial({color:l[2],toneMapped:false}));
    bulb.position.copy(lamp.position);scene.add(bulb);
  }
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.12,7,8),new THREE.MeshStandardMaterial({color:PALETTE.steel,metalness:0.6,roughness:0.4}));
  mast.position.set(-15,3.5,-19);scene.add(mast);
  return {sun};
}
export function buildViewmodel(camera){
  const group=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:'#23292e',roughness:0.55,metalness:0.4});
  const trimMat=new THREE.MeshStandardMaterial({color:PALETTE.orange,roughness:0.5,metalness:0.3});
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.11,0.52),bodyMat);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.02,0.36,8),bodyMat);
  barrel.rotation.x=Math.PI/2;barrel.position.set(0,0.012,-0.42);
  const stock=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.09,0.22),bodyMat);stock.position.set(0,-0.02,0.32);
  const mag=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.17,0.1),trimMat);mag.position.set(0,-0.13,-0.04);mag.rotation.x=0.2;
  const grip=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.14,0.08),bodyMat);grip.position.set(0,-0.11,0.18);grip.rotation.x=-0.25;
  const sight=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.12),trimMat);sight.position.set(0,0.08,-0.08);
  group.add(body,barrel,stock,mag,grip,sight);
  group.position.set(0.26,-0.23,-0.52);
  const flash=new THREE.PointLight(0xffb066,0,7,2);flash.position.set(0,0.02,-0.6);group.add(flash);
  camera.add(group);
  return {group,flash,baseX:0.26,baseY:-0.23};
}
