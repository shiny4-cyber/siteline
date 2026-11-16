// Render world: geometry from the collision SOLIDS, materials from canvases built once at load.
import * as THREE from 'three';
import {SOLIDS,SITES} from './map.js';
export const PALETTE={
  skyTop:'#243a56',skyLow:'#f0a45e',ground:'#8d7b5f',sand:'#c9ac82',sandDark:'#a88c64',
  teal:'#1f5f63',tealDark:'#143e44',steel:'#3a4149',orange:'#e08a4a',cream:'#f2e3c8',
  grime:'#3a352b',concrete:'#6f7a74',
};
function canvasTexture(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
// Masonry: mortar joints, pitting, damp streaks near the base. Tiled, never redrawn per frame.
function concreteTexture(base,mortar,repeatX=2,repeatY=1){
  const t=canvasTexture(512,512,(g,w,h)=>{
    g.fillStyle=base;g.fillRect(0,0,w,h);
    for(let i=0;i<9000;i++){
      const a=0.04+Math.random()*0.13;
      g.fillStyle=`rgba(255,255,255,${a*0.5})`;
      g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*2,1+Math.random()*2);
      g.fillStyle=`rgba(40,36,30,${a})`;
      g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1+Math.random()*3);
    }
    g.strokeStyle=mortar;g.lineWidth=3;
    for(let y=0;y<=h;y+=128){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
    for(let y=0;y<h;y+=128)for(let x=(y/128)%2?64:0;x<=w;x+=128){
      g.beginPath();g.moveTo(x,y);g.lineTo(x,y+128);g.stroke();
    }
    for(let i=0;i<26;i++){
      const x=Math.random()*w,y=Math.random()*h*0.5,hh=40+Math.random()*180;
      g.fillStyle=`rgba(24,26,22,${0.05+Math.random()*0.09})`;
      g.fillRect(x,y,3+Math.random()*10,hh);
    }
    for(let i=0;i<12;i++){
      g.fillStyle=`rgba(30,26,20,${0.10+Math.random()*0.12})`;
      g.fillRect(Math.random()*w,h-30-Math.random()*70,20+Math.random()*70,20+Math.random()*60);
    }
  });
  t.repeat.set(repeatX,repeatY);return t;
}
function metalTexture(base,rust=0.5,repeatX=2,repeatY=1){
  const t=canvasTexture(256,256,(g,w,h)=>{
    g.fillStyle=base;g.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=2){
      g.fillStyle=`rgba(255,255,255,${Math.random()*0.05})`;g.fillRect(0,y,w,1);
      g.fillStyle=`rgba(0,0,0,${Math.random()*0.07})`;g.fillRect(0,y+1,w,1);
    }
    for(let i=0;i<8;i++){g.fillStyle='rgba(0,0,0,0.18)';g.fillRect(0,Math.random()*h,w,1);}
    for(let i=0;i<70;i++){
      g.fillStyle=`rgba(150,86,40,${Math.random()*rust*0.5})`;
      const s=2+Math.random()*12;g.fillRect(Math.random()*w,Math.random()*h,s,s*0.6);
    }
    g.strokeStyle='rgba(0,0,0,0.35)';g.lineWidth=2;g.strokeRect(2,2,w-4,h-4);
  });
  t.repeat.set(repeatX,repeatY);return t;
}
function sandTexture(){
  const t=canvasTexture(512,512,(g,w,h)=>{
    g.fillStyle=PALETTE.sand;g.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=6){
      g.fillStyle=`rgba(120,94,60,${0.03+Math.random()*0.07})`;g.fillRect(0,y,w,2+Math.random()*4);
    }
    for(let i=0;i<7000;i++){
      g.fillStyle=Math.random()>0.5?'rgba(80,62,40,0.12)':'rgba(255,238,205,0.15)';
      g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*2,1+Math.random()*2);
    }
    for(let i=0;i<10;i++){
      g.strokeStyle='rgba(90,70,46,0.18)';g.lineWidth=1+Math.random()*2;
      g.beginPath();g.moveTo(Math.random()*w,0);
      for(let y=0;y<h;y+=40)g.lineTo(Math.random()*w*0.3+40,y);
      g.stroke();
    }
  });
  t.repeat.set(2,1);return t;
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
    for(let i=0;i<5200;i++){g.fillStyle=`rgba(60,50,38,${Math.random()*0.18})`;g.fillRect(Math.random()*w,Math.random()*h,4,4);}
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
// Painted hazard hatch for the plant areas, drawn once per site.
function siteMarking(site){
  return canvasTexture(512,512,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    g.save();g.beginPath();g.arc(w/2,h/2,w*0.47,0,Math.PI*2);g.clip();
    g.fillStyle='rgba(20,26,26,0.30)';g.fillRect(0,0,w,h);
    g.strokeStyle=site.accent;g.globalAlpha=0.55;g.lineWidth=18;
    for(let i=-h;i<w+h;i+=64){g.beginPath();g.moveTo(i,0);g.lineTo(i+h,h);g.stroke();}
    g.globalAlpha=1;g.fillStyle='rgba(12,20,20,0.82)';g.beginPath();g.arc(w/2,h/2,w*0.34,0,Math.PI*2);g.fill();
    g.fillStyle=site.accent;g.font='bold 210px sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.fillText(site.short,w/2,h/2+10);
    g.restore();
  });
}
// Soft contact occlusion: one gradient texture reused under every solid, built once.
function aoTexture(){
  return canvasTexture(128,128,(g,w,h)=>{
    const grad=g.createRadialGradient(w/2,h/2,w*0.12,w/2,h/2,w*0.5);
    grad.addColorStop(0,'rgba(8,10,10,0.55)');
    grad.addColorStop(0.55,'rgba(8,10,10,0.28)');
    grad.addColorStop(1,'rgba(8,10,10,0)');
    g.clearRect(0,0,w,h);g.fillStyle=grad;g.fillRect(0,0,w,h);
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
  // Textures are built once here; materials share them, so the frame loop never touches a canvas.
  const texSand=sandTexture();
  const texHall=concreteTexture('#54635e','rgba(16,22,20,0.75)',4,2);
  const texConcrete=concreteTexture(PALETTE.concrete,'rgba(28,30,26,0.7)',2.5,1.5);
  const texSteel=metalTexture(PALETTE.steel,0.7,2,1);
  const texCargo=metalTexture('#b96a34',0.9,2,1);
  const texConsole=metalTexture('#2b3a3f',0.25,1,1);
  const mats={
    boundary:new THREE.MeshStandardMaterial({map:texSand,roughnessMap:texSand,roughness:0.96,metalness:0.02,color:'#cbb08a'}),
    splitter:new THREE.MeshStandardMaterial({map:texConcrete,roughnessMap:texConcrete,roughness:0.9,metalness:0.03,color:'#b8a888'}),
    hall:new THREE.MeshStandardMaterial({map:texHall,roughnessMap:texHall,roughness:0.8,metalness:0.08,color:'#96aaa2'}),
    crate:new THREE.MeshStandardMaterial({map:texSteel,roughnessMap:texSteel,roughness:0.62,metalness:0.45}),
    cargo:new THREE.MeshStandardMaterial({map:texCargo,roughnessMap:texCargo,roughness:0.72,metalness:0.3}),
    console:new THREE.MeshStandardMaterial({map:texConsole,roughnessMap:texConsole,roughness:0.5,metalness:0.55}),
  };
  const trimDark=new THREE.MeshStandardMaterial({map:texConcrete,roughness:0.95,metalness:0.05,color:'#4d4838'});
  const aoMat=new THREE.MeshBasicMaterial({map:aoTexture(),transparent:true,depthWrite:false,toneMapped:false});
  const geoByKey=new Map();
  for(const b of SOLIDS){
    const key=`${b.w}|${b.d}|${b.h}`;
    let geo=geoByKey.get(key);
    if(!geo){geo=new THREE.BoxGeometry(b.w,b.h,b.d);geoByKey.set(key,geo);}
    const m=new THREE.Mesh(geo,mats[b.kind]||mats.crate);
    m.position.set(b.x,b.h/2,b.z);m.castShadow=true;m.receiveShadow=true;scene.add(m);
    // Skirting at the base and a cap at the top give every wall an edge instead of a flat plane.
    const skirt=new THREE.Mesh(new THREE.BoxGeometry(b.w+0.1,0.26,b.d+0.1),trimDark);
    skirt.position.set(b.x,0.13,b.z);skirt.receiveShadow=true;scene.add(skirt);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(b.w+0.08,0.12,b.d+0.08),trimDark);
    cap.position.set(b.x,b.h-0.06,b.z);scene.add(cap);
    const ao=new THREE.Mesh(new THREE.PlaneGeometry(b.w+1.1,b.d+1.1),aoMat);
    ao.rotation.x=-Math.PI/2;ao.position.set(b.x,0.012,b.z);scene.add(ao);
  }
  const trim=new THREE.MeshStandardMaterial({map:texSteel,roughness:0.55,metalness:0.5,color:'#e6a06a'});
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
    const pad=new THREE.Mesh(new THREE.CircleGeometry(site.radius,40),new THREE.MeshStandardMaterial({color:'#b45a2c',roughness:0.95,metalness:0.02}));
    pad.rotation.x=-Math.PI/2;pad.position.set(site.x,0.02,site.z);pad.receiveShadow=true;scene.add(pad);
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(site.radius*1.9,site.radius*1.9),
      new THREE.MeshBasicMaterial({map:siteMarking(site),transparent:true,toneMapped:false,depthWrite:false}));
    mark.rotation.x=-Math.PI/2;mark.position.set(site.x,0.035,site.z);scene.add(mark);
    const ring=new THREE.Mesh(new THREE.RingGeometry(site.radius-0.08,site.radius,48),new THREE.MeshBasicMaterial({color:site.accent,side:THREE.DoubleSide,toneMapped:false}));
    ring.rotation.x=-Math.PI/2;ring.position.set(site.x,0.05,site.z);scene.add(ring);
  }
  for(let i=0;i<5;i++){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.3,3.4,10),new THREE.MeshStandardMaterial({map:texSand,roughnessMap:texSand,roughness:0.9}));
    post.position.set(-16.2,1.7,12-i*4.4);post.castShadow=true;scene.add(post);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.22,0.9),new THREE.MeshStandardMaterial({map:texConcrete,roughness:0.9}));
    cap.position.set(-16.2,3.5,12-i*4.4);scene.add(cap);
  }
  for(const l of [[-9,4,0xffb066],[10,4,0xffb066],[-2,-13,0x9fe3d0],[6,-3,0xffb066]]){
    const lamp=new THREE.PointLight(l[2],26,22,2);lamp.position.set(l[0],4.3,l[1]);scene.add(lamp);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8),new THREE.MeshBasicMaterial({color:l[2],toneMapped:false}));
    bulb.position.copy(lamp.position);scene.add(bulb);
  }
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.12,7,10),new THREE.MeshStandardMaterial({map:texConsole,metalness:0.6,roughness:0.4}));
  mast.position.set(-15,3.5,-19);scene.add(mast);
  return {sun};
}
export function buildViewmodel(camera){
  const group=new THREE.Group();
  const texGun=metalTexture('#4a535b',0.35,1,1);
  const bodyMat=new THREE.MeshStandardMaterial({map:texGun,roughnessMap:texGun,roughness:0.5,metalness:0.55});
  const railMat=new THREE.MeshStandardMaterial({color:'#12181c',roughness:0.36,metalness:0.75});
  const trimMat=new THREE.MeshStandardMaterial({color:PALETTE.orange,roughness:0.45,metalness:0.35});
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.11,0.52),bodyMat);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.02,0.36,10),bodyMat);
  barrel.rotation.x=Math.PI/2;barrel.position.set(0,0.012,-0.42);
  const rail=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.022,0.3),railMat);rail.position.set(0,0.062,-0.14);
  const stock=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.09,0.22),bodyMat);stock.position.set(0,-0.02,0.32);
  const mag=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.17,0.1),trimMat);mag.position.set(0,-0.13,-0.04);mag.rotation.x=0.2;
  const grip=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.14,0.08),railMat);grip.position.set(0,-0.11,0.18);grip.rotation.x=-0.25;
  const foregrip=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.1,0.07),railMat);foregrip.position.set(0,-0.085,-0.28);
  const sight=new THREE.Mesh(new THREE.BoxGeometry(0.038,0.038,0.1),trimMat);sight.position.set(0,0.086,-0.08);
  const topStrip=new THREE.Mesh(new THREE.BoxGeometry(0.052,0.012,0.24),new THREE.MeshStandardMaterial({color:'#6d7a82',roughness:0.4,metalness:0.6}));
  topStrip.position.set(0,0.056,0.02);
  group.add(topStrip);
  group.add(body,barrel,rail,stock,mag,grip,foregrip,sight);
  // Dark outline: one static edge pass, so the rifle reads as an object against the scene.
  const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.1,0.12,0.54)),
    new THREE.LineBasicMaterial({color:'#0a1013',transparent:true,opacity:0.85}));
  group.add(outline);
  group.position.set(0.26,-0.23,-0.52);
  const flash=new THREE.PointLight(0xffb066,0,7,2);flash.position.set(0,0.02,-0.6);group.add(flash);
  camera.add(group);
  return {group,flash,baseX:0.26,baseY:-0.23};
}
