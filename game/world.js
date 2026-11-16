// Render world: geometry generated from the same SOLIDS data used for collision.
import * as THREE from 'three';
import {SOLIDS,SITES} from './map.js';
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
    const toU=x=>((x+20)/40)*w, toV=z=>((z+24)/48)*h;
    g.fillStyle=PALETTE.ground;g.fillRect(0,0,w,h);
    for(let i=0;i<4000;i++){g.fillStyle=`rgba(60,50,38,${Math.random()*0.16})`;g.fillRect(Math.random()*w,Math.random()*h,4,4);}
    // West arcade: pale sandstone band. East freight: teal band. The two lanes read apart at a glance.
    g.fillStyle='rgba(201,172,130,0.35)';g.fillRect(toU(-17),0,toU(8)-toU(-17),h);
    g.fillStyle='rgba(31,95,99,0.30)';g.fillRect(toU(8),0,toU(17)-toU(8),h);
    g.strokeStyle='rgba(240,214,166,0.55)';g.lineWidth=7;g.setLineDash([26,18]);
    g.beginPath();g.moveTo(toU(-11),h);g.lineTo(toU(-11),toV(2));g.stroke();
    g.beginPath();g.moveTo(toU(11),h);g.lineTo(toU(11),toV(2));g.stroke();
    g.setLineDash([]);g.strokeStyle='rgba(240,214,166,0.85)';g.lineWidth=10;
    g.strokeRect(toU(-3.2),toV(-13.2),toU(3.2)-toU(-3.2),toV(-6.8)-toV(-13.2));
    g.fillStyle='rgba(224,138,74,0.95)';g.font='bold 46px sans-serif';g.textAlign='center';
    g.fillText('SITE A',toU(0),toV(-14.2));
    g.fillStyle='rgba(127,211,200,0.95)';g.fillText('SITE B',toU(-12),toV(-0.6));
    g.strokeStyle='rgba(127,211,200,0.8)';g.lineWidth=8;
    g.beginPath();g.arc(toU(-12),toV(2.5),58,0,Math.PI*2);g.stroke();
  });
}
export function buildWorld(scene){
  scene.background=new THREE.Color(PALETTE.skyTop);
  scene.fog=new THREE.Fog('#e8b078',58,130);
  const hemi=new THREE.HemisphereLight(0xffe2bc,0x4a5142,2.2);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffd6a2,3.4);sun.position.set(-24,34,26);sun.castShadow=true;
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
  const signOf=(site)=>new THREE.MeshBasicMaterial({map:signTexture(site.name,`CHARGE SITE ${site.short}`),toneMapped:false});
  const signSpecs=[
    {site:SITES[0],pos:[-3,3.9,-4.55],rot:0,back:[2.3,0.9,0.06]},
    {site:SITES[0],pos:[8.06,3.05,-10],rot:Math.PI/2,back:[2.3,0.9,0.06]},
    {site:SITES[1],pos:[-12,3.25,6.1],rot:0,back:[2.6,1.0,0.08]},
  ];
  for(const spec of signSpecs){
    const backing=new THREE.Mesh(new THREE.BoxGeometry(spec.back[0],spec.back[1],spec.back[2]),new THREE.MeshStandardMaterial({color:'#101d21'}));
    backing.position.set(spec.pos[0],spec.pos[1],spec.pos[2]);backing.rotation.y=spec.rot;scene.add(backing);
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(spec.back[0]-0.1,spec.back[1]-0.1),signOf(spec.site));
    panel.position.set(spec.pos[0]+(spec.rot?0.05:0),spec.pos[1],spec.pos[2]+(spec.rot?0:-0.05));
    panel.rotation.y=spec.rot;scene.add(panel);
    if(spec.site===SITES[1]){
      for(const off of [-1.1,1.1]){
        const leg=new THREE.Mesh(new THREE.BoxGeometry(0.12,3.3,0.12),new THREE.MeshStandardMaterial({color:PALETTE.steel,metalness:0.5,roughness:0.5}));
        leg.position.set(spec.pos[0]+off,1.65,spec.pos[2]);scene.add(leg);
      }
    }
  }
  for(const site of SITES){
    const pad=new THREE.Mesh(new THREE.CircleGeometry(site.radius,40),new THREE.MeshStandardMaterial({color:'#c8642e',roughness:0.9,emissive:'#5a2408',emissiveIntensity:0.6}));
    pad.rotation.x=-Math.PI/2;pad.position.set(site.x,0.02,site.z);scene.add(pad);
    const ring=new THREE.Mesh(new THREE.RingGeometry(site.radius-0.08,site.radius,48),new THREE.MeshBasicMaterial({color:site.accent,side:THREE.DoubleSide,toneMapped:false}));
    ring.rotation.x=-Math.PI/2;ring.position.set(site.x,0.04,site.z);scene.add(ring);
  }
  // West arcade colonnade: warm sandstone posts give that lane its own silhouette.
  for(let i=0;i<5;i++){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.3,3.4,8),new THREE.MeshStandardMaterial({map:texSand,roughness:0.9}));
    post.position.set(-16.2,1.7,12-i*4.4);post.castShadow=true;scene.add(post);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.22,0.9),new THREE.MeshStandardMaterial({color:PALETTE.sandDark,roughness:0.9}));
    cap.position.set(-16.2,3.5,12-i*4.4);scene.add(cap);
  }
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
